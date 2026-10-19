
from pypdf import PdfReader
from pathlib import Path


def read_pdf(file_path):
    reader = PdfReader(file_path)
    documents = []

    pdf_name = Path(file_path).name

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()

        if page_text and page_text.strip():
            documents.append({
                "text": page_text.strip(),
                "metadata": {
                    "source": pdf_name,
                    "page": page_number
                }
            })

    return documents
