
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document


def split_text(pages):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )

    documents = []

    for page in pages:
        page_document = Document(
            page_content=page["text"],
            metadata=page["metadata"]
        )

        documents.extend(text_splitter.split_documents([page_document]))

    return documents
