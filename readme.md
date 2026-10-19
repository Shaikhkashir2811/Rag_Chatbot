# PaperMind AI — RAG Document Assistant

PaperMind AI is an AI-powered document assistant that allows users to upload PDF files and ask questions about their content. It uses Retrieval-Augmented Generation (RAG) to retrieve relevant document passages and generate answers with source and page information.

## Screenshots

### PDF Upload

<p align="center">
  <img width="1346" height="603" alt="d1" src="/backend/docs/b1.png" />

</p>


### Chat Interface

<p align="center">
  <img width="1346" height="603" alt="d1" src="/backend//docs/b2.png" />

</p>



### Answers with Sources

<p align="center">
  <img width="1346" height="603" alt="d1" src="/backend/docs/b3.png" />

</p>

<p align="center">
  <img width="1346" height="603" alt="d1" src="/backend/docs/b4.png" />

</p>


## Features

- Upload and extract text from PDF documents.
- Split documents into chunks while preserving page metadata.
- Retrieve relevant passages using semantic similarity search.
- Generate answers using the local Phi-3 language model.
- Rewrite follow-up questions using recent conversation history.
- Stream answers progressively in the chat interface.
- Display source PDF names, page numbers, and topic labels.
- Store chat sessions, messages, and document records in Neon PostgreSQL.
- Store document embeddings locally in ChromaDB.
- React-based interface with dark/light theme support.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI |
| RAG framework | LangChain |
| Vector database | ChromaDB |
| Embeddings | Sentence Transformers |
| Language model | Ollama, Phi-3 |
| Cloud database | Neon PostgreSQL |

## Project Structure

```text
PaperMind-AI/
├── backend/
│   ├── app.py
│   ├── pdf_reader.py
│   ├── text_splitter.py
│   ├── vector_store.py
│   ├── rag_chain.py
│   ├── question_rewriter.py
│   ├── memory_manager.py
│   ├── requirements.txt
│   ├── uploads/          # Uploaded PDFs; not committed
│   └── chroma_db/        # Local vector data; not committed
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── index.html
├── docs/
│   └── images/           # README screenshots
├── .gitignore
├── .env.example
└── README.md
```

## Prerequisites

Install the following before running the project:

- Python 3.12 recommended
- Node.js and npm
- Git
- Ollama
- A Neon PostgreSQL account and database

## 1. Clone the Repository

```bash
git clone https://github.com/Shaikhkashir2811/RAG_ChatBot.git
cd RAG_ChatBot
```

## 2. Set Up the Backend

Open a terminal in the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If the project uses environment variables, install `python-dotenv` and the PostgreSQL driver listed in your requirements if they are not already included.

## 3. Set Up Ollama and Phi-3

Install Ollama from:

https://ollama.com/download

Download the Phi-3 model:

```bash
ollama pull phi3
```

Check that the model is available:

```bash
ollama list
```

Ollama runs the language model locally. Keep the Ollama service running while using PaperMind AI.

## 4. Configure Neon PostgreSQL

1. Create a project at https://neon.tech/
2. Create or select a PostgreSQL database.
3. Copy its connection string from the Neon dashboard.
4. Create a `.env` file in the `backend` folder.
5. Set the database URL expected by your backend configuration.

Example:

```env
DATABASE_URL=your_neon_postgresql_connection_string
```

Replace the placeholder with your own connection string. Never commit `.env` or share its password publicly.

Ensure the required tables are initialized using the database setup implemented in `memory_manager.py`.

**Important:** Neon stores chat history and document records. ChromaDB stores the document vectors locally in the backend directory. These are separate storage systems.

## 5. Run the Backend

From the `backend` directory, with the virtual environment activated:

```bash
python -m uvicorn app:app --reload
```

Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

## 6. Set Up the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

http://localhost:5173

## 7. Use PaperMind AI

1. Start Ollama and the FastAPI backend.
2. Start the React frontend.
3. Create a chat session.
4. Upload a text-readable PDF.
5. Ask questions about the uploaded document.
6. Read the generated answer and inspect the source pages.

Scanned PDFs may require OCR if they do not contain extractable text.

## Storage and Important Notes

- `backend/chroma_db/`: local vector database; generated as documents are indexed.
- `backend/uploads/`: local copies of uploaded PDFs.
- Neon PostgreSQL: cloud-hosted chat sessions, messages, and document records.
- `.env`: private configuration; must remain untracked by Git.

A fresh clone does not contain your locally uploaded PDFs or ChromaDB index. Upload documents again to build a new local index.

## Troubleshooting

**Ollama connection error**

Ensure Ollama is installed, running, and the `phi3` model is downloaded.

**Neon connection error**

Check `DATABASE_URL`, internet connectivity, and the Neon project status.

**Python package errors**

Activate the backend virtual environment and install `requirements.txt` again.

**Frontend API connection error**

Ensure the FastAPI backend is running and the configured API URL matches the backend address.

**No text extracted from a PDF**

The PDF may be scanned or image-only and may need OCR.

## Future Improvements

- More accurate retrieval and reranking.
- Session-specific document retrieval.
- Improved conversation memory and follow-up handling.
- OCR support for scanned PDFs.
- Deployment of the frontend and backend.

## Author

**Kashir Shaikh**

GitHub: [Shaikhkashir2811](https://github.com/Shaikhkashir2811)

Portfolio: https://kashir’s.vercel.app
