"""
Document processing engine: text extraction, chunking, and embedding.
"""
import os
import logging
import traceback
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from django import db

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_path: str) -> tuple:
    """Extract text from a PDF file. Returns (text, num_pages)."""
    from PyPDF2 import PdfReader
    reader = PdfReader(file_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return '\n\n'.join(pages), len(reader.pages)


def extract_text_from_docx(file_path: str) -> tuple:
    """Extract text from a DOCX file. Returns (text, num_paragraphs)."""
    from docx import Document as DocxDocument
    doc = DocxDocument(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return '\n\n'.join(paragraphs), len(paragraphs)


def extract_text_from_txt(file_path: str) -> tuple:
    """Extract text from a plain text file. Returns (text, 1)."""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read(), 1


def extract_text(file_path: str, file_type: str) -> tuple:
    """Route extraction to the correct handler."""
    extractors = {
        'pdf': extract_text_from_pdf,
        'docx': extract_text_from_docx,
        'txt': extract_text_from_txt,
    }
    extractor = extractors.get(file_type)
    if not extractor:
        raise ValueError(f"Unsupported file type: {file_type}")
    return extractor(file_path)


def chunk_text(text: str, chunk_size: int = 1500, chunk_overlap: int = 300) -> list:
    """Split text into overlapping chunks with metadata."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    return [
        {
            'content': chunk,
            'chunk_index': i,
            'metadata': {
                'chunk_size': len(chunk),
            }
        }
        for i, chunk in enumerate(chunks)
    ]


def get_embeddings_model():
    """Get the sentence transformer embedding model."""
    os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
    from langchain_community.embeddings import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(
        model_name='all-MiniLM-L6-v2',
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True},
    )


def build_vector_store(document_id: str, chunks: list):
    """Build a FAISS vector store from text chunks and save to disk."""
    from langchain_community.vectorstores import FAISS

    store_path = Path(settings.VECTOR_STORE_DIR) / str(document_id)
    store_path.mkdir(parents=True, exist_ok=True)

    embeddings = get_embeddings_model()
    vector_store = FAISS.from_texts(chunks, embeddings)
    vector_store.save_local(str(store_path))
    return vector_store


def load_vector_store(document_id: str):
    """Load a FAISS vector store from disk."""
    from langchain_community.vectorstores import FAISS

    store_path = Path(settings.VECTOR_STORE_DIR) / str(document_id)
    if not store_path.exists():
        return None

    embeddings = get_embeddings_model()
    return FAISS.load_local(
        str(store_path),
        embeddings,
        allow_dangerous_deserialization=True,
    )


def process_document(document_id: str):
    """
    Full pipeline: extract text → chunk → embed → store in FAISS.
    Updates the Document model with processing status.
    
    IMPORTANT: This runs in a background thread, so we close
    old DB connections first to avoid stale connection issues.
    """
    # Close any stale DB connections for this thread
    db.connections.close_all()
    
    from documents.models import Document, DocumentChunk

    try:
        doc = Document.objects.get(id=document_id)
        file_path = doc.file.path

        # 1. Extract text
        print(f"[RAG] Extracting text from '{doc.title}'...")
        text, num_pages = extract_text(file_path, doc.file_type)

        if not text.strip():
            doc.processing_error = "No text content could be extracted from this document."
            doc.save()
            print(f"[RAG] ERROR: No text found in '{doc.title}'")
            return

        # 2. Chunk text
        print(f"[RAG] Chunking text into segments...")
        chunk_data = chunk_text(text)
        print(f"[RAG] Created {len(chunk_data)} chunks")

        # 3. Save chunks to database
        DocumentChunk.objects.filter(document=doc).delete()
        chunk_objects = []
        chunk_texts = []
        for c in chunk_data:
            chunk_objects.append(DocumentChunk(
                document=doc,
                content=c['content'],
                chunk_index=c['chunk_index'],
                metadata=c['metadata'],
            ))
            chunk_texts.append(c['content'])
        DocumentChunk.objects.bulk_create(chunk_objects)

        # 4. Build FAISS vector store
        print(f"[RAG] Building embeddings & vector store (first run downloads ~90MB model)...")
        build_vector_store(str(doc.id), chunk_texts)

        # 5. Update document status
        doc.num_pages = num_pages
        doc.num_chunks = len(chunk_data)
        doc.is_processed = True
        doc.processing_error = None
        doc.processed_at = timezone.now()
        doc.save()

        print(f"[RAG] [OK] Successfully processed '{doc.title}': {len(chunk_data)} chunks, {num_pages} pages")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[RAG] [FAIL] Error processing document {document_id}: {error_msg}")
        traceback.print_exc()
        try:
            doc = Document.objects.get(id=document_id)
            doc.processing_error = error_msg
            doc.save()
        except Exception:
            pass
    finally:
        db.connections.close_all()
