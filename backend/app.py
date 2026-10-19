# from fastapi import FastAPI, File, UploadFile 
# from pdf_reader import read_pdf
# from text_splitter import split_text
# from vector_store import store_to_vector_db
# from rag_chain import ask_question
# from fastapi.middleware.cors import CORSMiddleware
# import shutil
# from memory_manager import  create_session


# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:5173",
#         "http://127.0.0.1:5173"
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.get("/")
# def home():
#     return {"message":"RAG backend Running."}

# @app.post("/upload-pdf")
# def upload_pdf(pdf_file:UploadFile = File(...)):

#     file_path = f"uploads/{pdf_file.filename}"
    
#     with open(file_path, "wb") as buffer:
#         shutil.copyfileobj(pdf_file.file, buffer)

#     pdf_text = read_pdf(file_path)

#     chunks = split_text(pdf_text)

#     store_to_vector_db(chunks)

#     return{
#         "message": "Pdf uploaded successfully.",
#         "file_name":pdf_file.filename,
#         "total_chunks": len(chunks),
#         "chunks": chunks
#     }


# @app.get("/ask")
# def ask(
#         session_id: str,
#         query: str
# ):

#     answer = ask_question(
#         session_id=session_id,
#         query=query
#     )

#     return {
#         "session_id": session_id,
#         "question": query,
#         "answer": answer
#     }


# @app.get("/create-session")
# def create_new_session():

#     session_id = create_session()

#     return {
#         "session_id": session_id
#     }



from pathlib import Path
import shutil
from uuid import UUID

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pdf_reader import read_pdf
from text_splitter import split_text
from vector_store import store_to_vector_db
from rag_chain import ask_question_stream

from memory_manager import (
    create_session,
    get_chat_history,
    get_all_sessions,
    delete_session,
    save_document,
)


app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    session_id: str
    query: str


@app.get("/")
def home():
    return {"message": "RAG backend Running."}


@app.post("/upload-pdf")
def upload_pdf(
    pdf_file: UploadFile = File(...),
    session_id: str = Form(...),
):
    if not pdf_file.filename or not pdf_file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid PDF file.",
        )

    try:
        session_uuid = UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid session ID.",
        )

    filename = Path(pdf_file.filename).name
    file_path = UPLOAD_DIR / filename

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(pdf_file.file, buffer)

        pages = read_pdf(str(file_path))

        if not pages:
            raise HTTPException(
                status_code=400,
                detail="No readable text found in this PDF.",
            )

        chunks = split_text(pages)

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No text chunks could be created from this PDF.",
            )

        store_to_vector_db(chunks, source=filename)

        document = save_document(
            session_id=session_uuid,
            filename=filename,
            storage_path=str(file_path.resolve()),
            status="completed",
        )

        return {
            "message": "PDF uploaded successfully.",
            "file_name": filename,
            "total_pages": len(pages),
            "total_chunks": len(chunks),
            "document": document,
        }

    except HTTPException:
        raise

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"PDF upload failed: {error}",
        ) from error

    finally:
        pdf_file.file.close()


@app.post("/ask")
def ask(request: AskRequest):
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    return StreamingResponse(
        ask_question_stream(
            session_id=request.session_id,
            query=request.query,
        ),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/create-session")
def create_new_session():
    session_id = create_session()

    return {
        "session_id": session_id,
    }


@app.get("/sessions")
def list_sessions():
    return {
        "sessions": get_all_sessions(),
    }


@app.get("/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    return {
        "session_id": session_id,
        "messages": get_chat_history(session_id),
    }


@app.delete("/sessions/{session_id}")
def remove_session(session_id: str):
    delete_session(session_id)

    return {
        "message": "Session deleted successfully.",
        "session_id": session_id,
    }
