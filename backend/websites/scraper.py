"""
Website scraper: crawls a URL, extracts text content, chunks it, and builds
a FAISS vector store — plugging into the same RAG pipeline as documents.
"""
import logging
import traceback
import re
from urllib.parse import urljoin, urlparse
from pathlib import Path

import requests
from bs4 import BeautifulSoup

from django.conf import settings
from django.utils import timezone
from django import db

logger = logging.getLogger(__name__)

# Tags whose content is noise, not article text
STRIP_TAGS = [
    'script', 'style', 'nav', 'footer', 'header', 'aside',
    'noscript', 'iframe', 'svg', 'form', 'button',
]

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}


def _clean_text(text: str) -> str:
    """Collapse whitespace and blank lines."""
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def scrape_page(url: str, timeout: int = 15) -> dict | None:
    """
    Fetch a single page and return extracted data, or None on failure.
    Returns {url, title, text, links[]}.
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()

        content_type = resp.headers.get('Content-Type', '')
        if 'text/html' not in content_type:
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Remove noise tags
        for tag in soup.find_all(STRIP_TAGS):
            tag.decompose()

        # Extract title
        title = ''
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        # Extract meta description
        description = ''
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            description = meta_desc['content'].strip()

        # Extract main text content
        # Prefer <main>, <article>, or the full <body>
        main_el = soup.find('main') or soup.find('article') or soup.find('body')
        if main_el is None:
            main_el = soup

        text = _clean_text(main_el.get_text(separator='\n'))

        # Extract same-domain links for crawling
        links = []
        base_domain = urlparse(url).netloc
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            full_url = urljoin(url, href)
            parsed = urlparse(full_url)
            # Keep only same-domain, http(s), no fragment-only links
            if parsed.netloc == base_domain and parsed.scheme in ('http', 'https'):
                clean = parsed._replace(fragment='').geturl()
                links.append(clean)

        return {
            'url': url,
            'title': title,
            'description': description,
            'text': text,
            'links': list(set(links)),
        }

    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        return None


def crawl_website(start_url: str, max_pages: int = 20) -> list[dict]:
    """
    BFS-crawl a website starting from `start_url`.
    Returns a list of page dicts: [{url, title, text, description}, ...].
    """
    visited = set()
    queue = [start_url]
    pages = []

    while queue and len(pages) < max_pages:
        url = queue.pop(0)

        # Normalise
        parsed = urlparse(url)
        normalised = parsed._replace(fragment='').geturl()
        if normalised in visited:
            continue
        visited.add(normalised)

        # Skip non-content URLs
        skip_exts = ('.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg',
                     '.css', '.js', '.zip', '.mp4', '.mp3', '.ico')
        if any(parsed.path.lower().endswith(ext) for ext in skip_exts):
            continue

        print(f"[SCRAPER] Crawling ({len(pages)+1}/{max_pages}): {url}")
        page_data = scrape_page(url)
        if page_data is None or len(page_data['text']) < 50:
            continue

        pages.append(page_data)

        # Add discovered links to queue
        for link in page_data.get('links', []):
            if link not in visited:
                queue.append(link)

    return pages


def process_website(website_id: str):
    """
    Full pipeline: scrape website → chunk text → embed → store in FAISS.
    Updates the WebsiteSource model with status.

    IMPORTANT: Runs in a background thread — close stale DB connections first.
    """
    db.connections.close_all()

    from websites.models import WebsiteSource, WebsitePage
    from documents.processor import chunk_text, build_vector_store

    try:
        site = WebsiteSource.objects.get(id=website_id)
        site.status = 'scraping'
        site.save()

        print(f"[SCRAPER] Starting crawl of '{site.url}' (max {site.max_pages} pages)...")

        # 1. Crawl website
        pages = crawl_website(site.url, max_pages=site.max_pages)

        if not pages:
            site.status = 'failed'
            site.error_message = "Could not extract any content from this website."
            site.save()
            print(f"[SCRAPER] FAIL: No content from {site.url}")
            return

        # Set site metadata from first page
        if not site.title and pages[0].get('title'):
            site.title = pages[0]['title'][:500]
        if not site.description and pages[0].get('description'):
            site.description = pages[0]['description']

        site.status = 'processing'
        site.pages_scraped = len(pages)
        site.save()

        # 2. Save scraped pages to DB
        WebsitePage.objects.filter(website=site).delete()
        for page_data in pages:
            WebsitePage.objects.create(
                website=site,
                url=page_data['url'],
                title=page_data.get('title', ''),
                content=page_data['text'],
                word_count=len(page_data['text'].split()),
            )

        # 3. Combine all page text and chunk it
        all_text_parts = []
        for page_data in pages:
            header = f"Page: {page_data.get('title', page_data['url'])}\nURL: {page_data['url']}\n\n"
            all_text_parts.append(header + page_data['text'])

        combined_text = '\n\n---\n\n'.join(all_text_parts)

        print(f"[SCRAPER] Chunking {len(combined_text)} chars from {len(pages)} pages...")
        chunk_data = chunk_text(combined_text, chunk_size=1500, chunk_overlap=300)
        chunk_texts = [c['content'] for c in chunk_data]

        print(f"[SCRAPER] Created {len(chunk_texts)} chunks, building vector store...")

        # 4. Build FAISS vector store (re-use same directory scheme as documents)
        # Prefix website IDs with 'web-' to avoid collision with document UUIDs
        store_id = f"web-{site.id}"
        build_vector_store(store_id, chunk_texts)

        # 5. Mark as ready
        site.num_chunks = len(chunk_texts)
        site.status = 'ready'
        site.error_message = None
        site.completed_at = timezone.now()
        site.save()

        print(f"[SCRAPER] [OK] '{site.title}': {len(pages)} pages, {len(chunk_texts)} chunks")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[SCRAPER] [FAIL] Error processing website {website_id}: {error_msg}")
        traceback.print_exc()
        try:
            site = WebsiteSource.objects.get(id=website_id)
            site.status = 'failed'
            site.error_message = error_msg
            site.save()
        except Exception:
            pass
    finally:
        db.connections.close_all()
