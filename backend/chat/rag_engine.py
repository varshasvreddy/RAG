"""
RAG (Retrieval-Augmented Generation) engine.
Handles context retrieval from FAISS and LLM query processing via Gemini.
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are **ResearchAI**, an expert AI research assistant built for university students.

Your job is to give **thorough, well-structured, and accurate** answers based **strictly** on the document context provided below.

## Your Response Rules:

1. **Only use information from the provided context.** If the answer isn't in the context, state that clearly.
2. **Structure every response** using markdown:
   - Use **## headings** for major sections
   - Use **bullet points** for lists
   - Use **bold** for key terms and important facts
   - Use **numbered lists** for steps or sequences
   - Use **> blockquotes** for direct quotes from the source
3. **Be comprehensive** — don't give one-line answers. Explain concepts clearly as if teaching a student.
4. **Cite your sources** — refer to [Source 1], [Source 2], etc. when referencing specific information.
5. **Use student-friendly language** — break down complex concepts into simple terms.
6. **If summarizing**, provide:
   - A brief overview (2-3 sentences)
   - Key points organized by topic/theme
   - Any important definitions, dates, or figures
7. **If explaining a concept**, provide:
   - A clear definition
   - How it works (step by step if applicable)
   - Examples from the document
   - Why it matters

---

## Document Context:

{context}

---

Now answer the student's question thoroughly and accurately. Always use markdown formatting.
"""


def get_llm():
    """Initialize the Gemini LLM via LangChain."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key == 'your-gemini-api-key-here':
        raise ValueError(
            "Gemini API key not configured. Please set GEMINI_API_KEY in backend/.env file. "
            "Get a free key at https://aistudio.google.com/apikey"
        )

    return ChatGoogleGenerativeAI(
        model="gemini-3-flash-preview",
        google_api_key=api_key,
        temperature=0.2,
        max_output_tokens=4096,
    )


def retrieve_context(document_ids: list, query: str, k: int = 8) -> list:
    """
    Retrieve relevant chunks from FAISS for the given document IDs.
    Returns a list of {content, score, document_id} dicts.
    Uses k=8 for more comprehensive context.
    """
    from documents.processor import load_vector_store

    all_results = []

    for doc_id in document_ids:
        vector_store = load_vector_store(doc_id)
        if vector_store is None:
            print(f"[RAG] Warning: No vector store found for document {doc_id}")
            continue

        results = vector_store.similarity_search_with_score(query, k=k)
        for doc, score in results:
            all_results.append({
                'content': doc.page_content,
                'score': float(score),
                'document_id': str(doc_id),
            })

    # Sort by relevance (lower L2 distance = more similar)
    all_results.sort(key=lambda x: x['score'])

    # Return top results
    return all_results[:k]


def generate_answer(query: str, document_ids: list, chat_history: list = None) -> dict:
    """
    Full RAG pipeline:
    1. Retrieve relevant context from FAISS
    2. Build prompt with context + history
    3. Send to Gemini LLM
    4. Return answer with sources
    """
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

    # 1. Retrieve context
    retrieved = retrieve_context(document_ids, query)

    if not retrieved:
        return {
            'answer': "## No Relevant Information Found\n\n"
                      "I couldn't find any relevant information in the uploaded documents for your question.\n\n"
                      "**Suggestions:**\n"
                      "- Make sure your documents are fully processed (green checkmark)\n"
                      "- Try rephrasing your question with different keywords\n"
                      "- Check if the information you're looking for is actually in the uploaded documents",
            'sources': [],
        }

    # 2. Build context string with clear source labels
    context_parts = []
    sources = []
    for i, r in enumerate(retrieved):
        context_parts.append(f"[Source {i+1}]:\n{r['content']}")
        sources.append({
            'chunk_content': r['content'][:300] + '...' if len(r['content']) > 300 else r['content'],
            'document_id': r['document_id'],
            'relevance_score': round(1 / (1 + r['score']), 3),
        })

    context_str = "\n\n---\n\n".join(context_parts)

    # 3. Build messages
    messages = [
        SystemMessage(content=SYSTEM_PROMPT.format(context=context_str)),
    ]

    # Add recent chat history for conversational context
    if chat_history:
        for msg in chat_history[-8:]:  # Last 4 exchanges
            if msg['role'] == 'user':
                messages.append(HumanMessage(content=msg['content']))
            else:
                messages.append(AIMessage(content=msg['content']))

    messages.append(HumanMessage(content=query))

    # 4. Call LLM
    print(f"[RAG] Sending query to Gemini with {len(retrieved)} context chunks...")
    llm = get_llm()
    response = llm.invoke(messages)

    # Extract clean text from response
    # Gemini may return structured content blocks with metadata
    raw_content = response.content
    if isinstance(raw_content, list):
        # Extract only the text parts from structured response blocks
        text_parts = []
        for block in raw_content:
            if isinstance(block, dict):
                text_parts.append(block.get('text', ''))
            elif isinstance(block, str):
                text_parts.append(block)
        answer_text = '\n'.join(text_parts).strip()
    elif isinstance(raw_content, str):
        answer_text = raw_content.strip()
    else:
        answer_text = str(raw_content).strip()

    print(f"[RAG] [OK] Got response ({len(answer_text)} chars)")

    return {
        'answer': answer_text,
        'sources': sources,
    }
