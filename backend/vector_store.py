# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_chroma import Chroma
# def store_to_vector_db(chunks):

#     embedding_model = HuggingFaceEmbeddings(
#         model_name="sentence-transformers/all-MiniLM-L6-v2"
#     )

#     vector_store = Chroma.from_texts(
#         texts=chunks,
#         embedding=embedding_model,
#         persist_directory="chroma_db"
#     )

#     return vector_store


from pathlib import Path

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma


BASE_DIR = Path(__file__).resolve().parent
CHROMA_DIR = str(BASE_DIR / "chroma_db")
COLLECTION_NAME = "langchain"

_embedding_model = None


def get_embedding_model():
    global _embedding_model

    if _embedding_model is None:
        _embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    return _embedding_model


def get_vector_store():
    return Chroma(
        collection_name=COLLECTION_NAME,
        persist_directory=CHROMA_DIR,
        embedding_function=get_embedding_model(),
    )


def store_to_vector_db(chunks, source="unknown"):
    if not chunks:
        raise ValueError("No text chunks were provided.")

    cleaned_documents = []

    for chunk in chunks:
        text = chunk.page_content.strip()

        if not text:
            continue

        metadata = dict(chunk.metadata)
        metadata["source"] = source if source != "unknown" else metadata.get("source", "unknown")
        metadata["chunk_index"] = len(cleaned_documents)

        cleaned_documents.append(
            {
                "text": text,
                "metadata": metadata,
            }
        )

    if not cleaned_documents:
        raise ValueError("No valid text chunks were found.")

    vector_store = get_vector_store()

    if source != "unknown":
        vector_store.delete(where={"source": source})

    vector_store.add_texts(
        texts=[document["text"] for document in cleaned_documents],
        metadatas=[document["metadata"] for document in cleaned_documents],
    )

    return vector_store
