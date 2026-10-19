# import json
# import os
# from datetime import datetime
# import uuid

# CHAT_HISTORY_FILE = "chat_history.json"

# def load_history():
#     """
#     Load chat history from a JSON file.
#     Returns a dictionary containing the chat history.
#     """

#     if not os.path.exists(CHAT_HISTORY_FILE):
#         return {}
    
#     try:
#         with open(CHAT_HISTORY_FILE, "r") as file:
#             return json.load(file)

#     except json.JSONDecodeError:
#         return {}
    
#     except Exception as error:
#         print(f"Error loading chat history: {error}")
#         return {}
    

# def save_history(data):
#     """"
#         save chat history dictionary to a JSON file.
#     """

#     try:
#         with open (CHAT_HISTORY_FILE, "w", encoding ="utf-8") as file:
#             json.dump(data, file ,indent = 4)

#     except  Exception as e:
#         print(f"Error saving chat history: {e}")


# def save_message(session_id, role, content):
#     """
#          Save a message for a specific session.
#     """

#     data = load_history()

#     if session_id not in data:
#         data[session_id] = []
    
#     message = {
#         "role": role,
#         "content": content,
#         "timestamp": datetime.now().isoformat()
#     }
#     data[session_id].append(message)
#     save_history(data)


# def get_chat_history(session_id):
#     """
#     Return complete chat history for a session.
#     """

#     data = load_history()

#     return data.get(session_id, [])


# def get_recent_messages(session_id, limit=6):
#     """
#     Return last N messages from a session.
#     """

#     history = get_chat_history(session_id)

#     return history[-limit:]

# def create_session():
#     """
#     Create a new session ID.
#     """

#     return str(uuid.uuid4())

# def delete_session(session_id):
#     """
#     Delete a session and its messages.
#     """

#     data = load_history()

#     if session_id in data:
#         del data[session_id]
#         save_history(data)
        







import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def get_connection():
    """Create a connection to Neon PostgreSQL."""

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is missing. Add it to backend/.env"
        )

    return psycopg.connect(
        database_url,
        row_factory=dict_row,
        connect_timeout=15,
    )


def create_session(title="New Chat"):
    """Create a new chat session."""

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO chat_sessions (title)
                VALUES (%s)
                RETURNING id
                """,
                (title,),
            )
            session = cursor.fetchone()

    return str(session["id"])


def save_message(session_id, role, content, sources=None):
    """Save a message, source metadata, and session timestamp."""

    if role not in ("user", "assistant", "system"):
        raise ValueError(f"Invalid message role: {role}")

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO chat_sessions (id)
                VALUES (%s)
                ON CONFLICT (id) DO NOTHING
                """,
                (session_id,),
            )

            cursor.execute(
                """
                INSERT INTO chat_messages
                    (session_id, role, content, sources)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    session_id,
                    role,
                    content,
                    Jsonb(sources or []),
                ),
            )

            if role == "user":
                cursor.execute(
                    """
                    UPDATE chat_sessions
                    SET title = CASE
                        WHEN title IS NULL OR title = 'New Chat'
                        THEN LEFT(%s, 60)
                        ELSE title
                    END,
                    updated_at = NOW()
                    WHERE id = %s
                    """,
                    (content.strip() or "New Chat", session_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE chat_sessions
                    SET updated_at = NOW()
                    WHERE id = %s
                    """,
                    (session_id,),
                )


def get_chat_history(session_id):
    """Return messages with their saved source metadata."""

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT role, content, sources, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (session_id,),
            )
            messages = cursor.fetchall()

    return [
        {
            "role": message["role"],
            "content": message["content"],
            "timestamp": message["created_at"].isoformat(),
            "sources": message["sources"] or [],
        }
        for message in messages
    ]


def get_recent_messages(session_id, limit=6):
    """Return recent messages in chronological order."""

    if limit <= 0:
        return []

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT role, content, sources, created_at
                FROM chat_messages
                WHERE session_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT %s
                """,
                (session_id, limit),
            )
            messages = cursor.fetchall()

    messages.reverse()

    return [
        {
            "role": message["role"],
            "content": message["content"],
            "timestamp": message["created_at"].isoformat(),
            "sources": message["sources"] or [],
        }
        for message in messages
    ]


def get_all_sessions():
    """Return chat history including the most recently uploaded PDF."""

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    s.id,
                    s.title,
                    s.created_at,
                    s.updated_at,
                    COUNT(m.id) AS message_count,
                    (
                        SELECT d.filename
                        FROM documents AS d
                        WHERE d.session_id = s.id
                        ORDER BY d.uploaded_at DESC
                        LIMIT 1
                    ) AS pdf_name
                FROM chat_sessions AS s
                LEFT JOIN chat_messages AS m
                    ON m.session_id = s.id
                GROUP BY s.id
                ORDER BY s.updated_at DESC
                """
            )
            sessions = cursor.fetchall()

    return [
        {
            "id": str(session["id"]),
            "title": session["title"] or "New Chat",
            "pdf_name": session["pdf_name"],
            "created_at": session["created_at"].isoformat(),
            "updated_at": session["updated_at"].isoformat(),
            "message_count": session["message_count"],
        }
        for session in sessions
    ]


def delete_session(session_id):
    """Delete a chat session and its messages."""

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM chat_sessions WHERE id = %s",
                (session_id,),
            )


def save_document(
    session_id,
    filename,
    storage_path,
    status="completed",
):
    """Save uploaded PDF information in the documents table."""

    query = """
        INSERT INTO documents (
            session_id,
            filename,
            storage_path,
            status
        )
        VALUES (%s, %s, %s, %s)
        RETURNING
            id, session_id, filename,
            storage_path, status, uploaded_at;
    """

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                query,
                (session_id, filename, storage_path, status),
            )
            document = cursor.fetchone()

    return document
