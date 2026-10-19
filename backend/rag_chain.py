# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_chroma import Chroma
# from langchain_ollama import OllamaLLM

# from memory_manager import (
#     get_recent_messages,
#     save_message,
# )

# from question_rewriter import rewrite_question


# # Load Embedding Model
# embedding_model = HuggingFaceEmbeddings(
#     model_name="sentence-transformers/all-MiniLM-L6-v2"
# )


# # Load Existing Chroma Database
# vector_store = Chroma(
#     persist_directory="chroma_db",
#     embedding_function=embedding_model
# )


# # Load Phi-3 Model
# llm = OllamaLLM(
#     model="phi3"
# )


# def retrieve_context(
#         query: str,
#         k: int = 3
# ) -> str:
#     """
#     Retrieve relevant chunks from ChromaDB.
#     """

#     try:

#         results = vector_store.similarity_search(
#             query=query,
#             k=k
#         )

#         if not results:
#             return "No relevant context found."

#         context = "\n\n".join(
#             doc.page_content
#             for doc in results
#         )

#         return context

#     except Exception as error:

#         return f"Error while retrieving context: {error}"


# def create_prompt(
#         context: str,
#         query: str
# ) -> str:
#     """
#     Create prompt for Phi-3.
#     """

#     return f"""
# You are a helpful AI assistant.

# Instructions:
# - Answer ONLY from the provided context.
# - Do NOT use outside knowledge.
# - If the answer is not available in the context,
#   say: "Answer not found in the context."

# Context:
# {context}

# Question:
# {query}

# Answer:
# """


# def generate_answer(
#         prompt: str
# ) -> str:
#     """
#     Generate answer using Phi-3.
#     """

#     try:

#         return llm.invoke(prompt)

#     except Exception as error:

#         return f"Error while generating answer: {error}"


# def ask_question(session_id, query):

#     recent_messages = get_recent_messages(
#         session_id,
#         limit=6
#     )

#     rewritten_query = rewrite_question(
#         recent_messages,
#         query
#     )

#     context = retrieve_context(
#         rewritten_query
#     )

#     prompt = create_prompt(
#         context,
#         rewritten_query
#     )

#     save_message(
#         session_id,
#         "user",
#         query
#     )

#     answer = generate_answer(
#         prompt
#     )

#     save_message(
#         session_id,
#         "assistant",
#         answer
#     )

#     return answer




import json
from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_ollama import OllamaLLM

from memory_manager import get_recent_messages, save_message
from question_rewriter import rewrite_question


BASE_DIR = Path(__file__).resolve().parent
CHROMA_DIR = str(BASE_DIR / "chroma_db")

embedding_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

vector_store = Chroma(
    collection_name="langchain",
    persist_directory=CHROMA_DIR,
    embedding_function=embedding_model,
)

llm = OllamaLLM(model="phi3")


def retrieve_context(query: str, k: int = 3):
    """Retrieve relevant document chunks and their metadata."""

    results = vector_store.similarity_search(
        query=query,
        k=k,
    )

    retrieved_documents = []

    for doc in results:
        retrieved_documents.append({
            "text": doc.page_content,
            "source": doc.metadata.get("source", "Unknown PDF"),
            "page": doc.metadata.get("page"),
            "metadata": doc.metadata,
        })

    return retrieved_documents


def create_prompt(context: str, query: str) -> str:
    """Create a grounded prompt for Phi-3."""

    return f"""
You are PaperMind, an AI assistant answering questions about uploaded documents.

Instructions:
- Answer using only the provided document context.
- Do not invent facts, page numbers, or sources.
- If the answer is unavailable in the context, say exactly:
  "Answer not found in the context."
- Use conversation history only to understand references in a follow-up question.
- Give a clear, well-formatted answer.
- Answer the user's question directly.

Document context:
{context}

Question:
{query}

Answer:
"""


def generate_answer(prompt: str) -> str:
    """Generate a complete answer when streaming is not needed."""

    return str(llm.invoke(prompt)).strip()


def generate_topic(context: str, query: str) -> str:
    """Generate a short topic label grounded in retrieved content."""

    prompt = f"""
Identify the main topic of the supplied document passages relevant
to the question.

Rules:
- Use only the supplied passages.
- Return a short topic label of 2 to 6 words.
- Do not explain the label.
- If no clear topic can be identified, return "General".

Question:
{query}

Document passages:
{context}

Topic:
"""

    try:
        topic = str(llm.invoke(prompt)).strip()
        return topic.strip('"\'` \n')[:100] or "General"
    except Exception:
        return "General"


def build_sources(retrieved_documents, topic: str):
    """Create unique source/page entries for the response."""

    sources = []
    seen_sources = set()

    for document in retrieved_documents:
        source = document["source"]
        page = document["page"]
        source_key = (source, page)

        if source_key not in seen_sources:
            seen_sources.add(source_key)

            sources.append({
                "file_name": source,
                "page": page,
                "topic": topic,
            })

    return sources


def ask_question(session_id: str, query: str) -> dict:
    """Generate a complete answer and return its source details."""

    query = query.strip()

    if not query:
        raise ValueError("Question cannot be empty.")

    recent_messages = get_recent_messages(session_id, limit=6)
    rewritten_query = rewrite_question(recent_messages, query)
    retrieved_documents = retrieve_context(rewritten_query)

    if not retrieved_documents:
        answer = "Answer not found in the context."

        save_message(session_id, "user", query)
        save_message(session_id, "assistant", answer)

        return {
            "answer": answer,
            "topic": "General",
            "sources": [],
        }

    context = "\n\n".join(
        document["text"] for document in retrieved_documents
    )

    prompt = create_prompt(context, rewritten_query)
    answer = generate_answer(prompt)
    topic = generate_topic(context, rewritten_query)
    sources = build_sources(retrieved_documents, topic)

    save_message(session_id, "user", query)
    save_message(
        session_id,
        "assistant",
        answer,
        sources=sources,
    )

    return {
        "answer": answer,
        "topic": topic,
        "sources": sources,
    }


def ask_question_stream(session_id: str, query: str):
    """Stream answer tokens as newline-delimited JSON events."""

    query = query.strip()

    if not query:
        yield json.dumps({
            "type": "error",
            "message": "Question cannot be empty.",
        }) + "\n"
        return

    try:
        recent_messages = get_recent_messages(
            session_id,
            limit=6,
        )

        rewritten_query = rewrite_question(
            recent_messages,
            query,
        )

        retrieved_documents = retrieve_context(rewritten_query)

        if not retrieved_documents:
            answer = "Answer not found in the context."

            save_message(session_id, "user", query)
            save_message(session_id, "assistant", answer)

            # Send the answer in small pieces for a consistent UI.
            for word in answer.split(" "):
                yield json.dumps({
                    "type": "token",
                    "content": word + " ",
                }) + "\n"

            yield json.dumps({
                "type": "done",
                "topic": "General",
                "sources": [],
            }) + "\n"
            return

        context = "\n\n".join(
            document["text"]
            for document in retrieved_documents
        )

        prompt = create_prompt(context, rewritten_query)

        answer_parts = []

        # Stream the model output as it is generated.
        for token in llm.stream(prompt):
            token_text = str(token)

            if token_text:
                answer_parts.append(token_text)

                yield json.dumps({
                    "type": "token",
                    "content": token_text,
                }, ensure_ascii=False) + "\n"

        answer = "".join(answer_parts).strip()

        topic = generate_topic(context, rewritten_query)
        sources = build_sources(retrieved_documents, topic)

        # Save the complete answer, not individual tokens.
        save_message(session_id, "user", query)
        save_message(
            session_id,
            "assistant",
            answer,
            sources=sources,
        )

        yield json.dumps({
            "type": "done",
            "topic": topic,
            "sources": sources,
        }, ensure_ascii=False) + "\n"

    except Exception as error:
        yield json.dumps({
            "type": "error",
            "message": str(error),
        }, ensure_ascii=False) + "\n"
