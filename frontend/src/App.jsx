
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

const getSessionId = (session) => session?.id || session?.session_id;

function normalizeList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="3" /><path d="M12 3v4M9 13h.01M15 13h.01M9 17h6" /><path d="M2 12v3M22 12v3" /></>,
  };

  return <svg {...common}>{paths[name] || paths.message}</svg>;
}

function TypingIndicator() {
  return (
    <div className="typing-row">
      <div className="avatar assistant-avatar">
        <Icon name="bot" size={18} />
      </div>
      <div className="typing-bubble" aria-label="Generating answer">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function App() {
  const [theme, setTheme] = useState("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
const [hasUploadedPdf, setHasUploadedPdf] = useState(false);
 const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);
  const textareaRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch(`${API}/sessions`);
    if (!response.ok) throw new Error("Could not load chat history.");

    const data = await response.json();
    const items = normalizeList(data, "sessions");

    setSessions(items);
    return items;
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) {
      setMessages([]);
      return;
    }

    const response = await fetch(
      `${API}/sessions/${encodeURIComponent(id)}/messages`
    );

    if (!response.ok) throw new Error("Could not load this conversation.");

    const data = await response.json();
    const items = normalizeList(data, "messages");

    setMessages(
      items.map((message, index) => ({
        ...message,
        id: message.id ?? `${id}-${index}`,
        role: message.role || "assistant",
        content: message.content || "",
      }))
    );
  }, []);


const createSession = useCallback(async () => {
  const response = await fetch(`${API}/create-session`);

  if (!response.ok) {
    throw new Error("Could not create a new chat.");
  }

  const data = await response.json();
  const newId = data.session_id || data.id;

  if (!newId) {
    throw new Error("The backend did not return a session ID.");
  }

  setSessionId(newId);
  setMessages([]);
  setPageError("");
  setUploadStatus(null);
  setSelectedFile(null);
  setQuestion("");
  setHasUploadedPdf(false);
  setSidebarOpen(false);

  try {
    await loadSessions();
  } catch (error) {
    console.error("Could not refresh chat list:", error);
  }

  return newId;
}, [loadSessions]);


  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const items = await loadSessions();
        if (cancelled) return;

        if (items.length) {
          const firstId = getSessionId(items[0]);

          if (firstId) {
            setSessionId(firstId);
            await loadMessages(firstId);
          } else {
            await createSession();
          }
        } else {
          await createSession();
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error.message || "Could not connect to the backend."
          );
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadSessions, loadMessages, createSession]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
  chatContainerRef.current?.scrollTo({
    top: chatContainerRef.current.scrollHeight,
    behavior: "auto",
  });
}, [messages]);

 async function selectSession(id) {
  if (!id || id === sessionId) {
    setSidebarOpen(false);
    return;
  }

  const selectedSession = sessions.find(
    (session) => getSessionId(session) === id
  );

  setSessionId(id);
  setMessages([]);
  setPageError("");
  setUploadStatus(null);
  setSelectedFile(null);
  setHasUploadedPdf(Boolean(selectedSession?.pdf_name));
  setSidebarOpen(false);

  try {
    await loadMessages(id);
  } catch (error) {
    setPageError(error.message || "Could not load conversation.");
  }
}

  async function deleteSession(id, event) {
    event?.stopPropagation();

    if (!window.confirm("Delete this conversation and its chat history?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/sessions/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Could not delete this chat.");
      }

      const remaining = await loadSessions();

      if (id === sessionId) {
        const nextId = remaining.length
          ? getSessionId(remaining[0])
          : null;

        if (nextId) {
          setSessionId(nextId);
          await loadMessages(nextId);
        } else {
          await createSession();
        }
      }
    } catch (error) {
      setPageError(error.message || "Could not delete conversation.");
    }
  }

  async function uploadPDF(event) {
    event?.preventDefault();

    if (!selectedFile) {
      setUploadStatus({
        type: "error",
        msg: "Choose a PDF file first.",
      });
      return;
    }

    if (!sessionId) {
      setUploadStatus({
        type: "error",
        msg: "Your chat is still initializing. Please try again.",
      });
      return;
    }

    setUploadLoading(true);
    setUploadStatus({ type: "info", msg: "Uploading and processing PDF…" });

    const formData = new FormData();
    formData.append("pdf_file", selectedFile);
    formData.append("session_id", sessionId);

    try {
      const response = await fetch(`${API}/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "PDF upload failed.");
      }
      setHasUploadedPdf(true);

      setUploadStatus(
        {
        
    type: "success",
    msg: `${data.file_name} uploaded successfully — ${
      data.total_pages ?? "?"
    } pages, ${data.total_chunks} chunks processed.`
    
  });

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSessions();
    } catch (error) {
      setUploadStatus({
        type: "error",
        msg: error.message || "Upload failed. Check your backend.",
      });
    } finally {
      setUploadLoading(false);
    }
  }




const askQuestion = async (event) => {
  event?.preventDefault();

  const trimmedQuestion = question.trim();

  if (!trimmedQuestion || loading) return;

  if (!hasUploadedPdf && !activeSession?.pdf_name) {
    const timestamp = Date.now();

    setMessages((previous) => [
      ...previous,
      {
        id: `user-${timestamp}`,
        role: "user",
        content: trimmedQuestion,
      },
      {
        id: `assistant-${timestamp}`,
        role: "assistant",
        content:
          "Hi! 👋 I'm PaperMind, your AI document assistant.\n\nPlease upload a PDF first. After uploading, you can ask me questions about its contents, and I'll provide answers with relevant page numbers and topic details.",
        sources: [],
      },
    ]);

    setQuestion("");
    return;
  }

  const currentSessionId = sessionId;
  const timestamp = Date.now();
  const assistantId = `assistant-${timestamp}`;

  setLoading(true);
  setQuestion("");
  setPageError("");

  const userMessage = {
    id: `user-${timestamp}`,
    role: "user",
    content: trimmedQuestion,
  };

  const assistantMessage = {
    id: assistantId,
    role: "assistant",
    content: "",
    sources: [],
    topic: "General",
    streaming: true,
  };

  setMessages((previous) => [
    ...previous,
    userMessage,
    assistantMessage,
  ]);

  try {
    const response = await fetch(`${API}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson",
      },
      body: JSON.stringify({
        session_id: currentSessionId,
        query: trimmedQuestion,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || "Failed to get an answer."
      );
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let answerText = "";
    let buffer = "";

    const updateAssistant = (updates) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? { ...message, ...updates }
            : message
        )
      );
    };

    const processLine = async (line) => {
      if (!line.trim()) return;

      const eventData = JSON.parse(line);

      if (eventData.type === "token") {
        answerText += eventData.content || "";

        updateAssistant({
          content: answerText,
          streaming: true,
        });

        // Give React time to render the new text.
        await new Promise((resolve) =>
          requestAnimationFrame(resolve)
        );
      } else if (eventData.type === "done") {
        updateAssistant({
          content: answerText || "No answer was returned.",
          topic: eventData.topic || "General",
          sources: eventData.sources || [],
          streaming: false,
        });
      } else if (eventData.type === "error") {
        throw new Error(
          eventData.message || "Answer generation failed."
        );
      }
    };

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        await processLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      await processLine(buffer);
    }

    await loadSessions();
  } catch (error) {
    console.error("Chat error:", error);

    setPageError(error.message || "Something went wrong.");

    setMessages((previous) =>
      previous.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: message.content
                ? `${message.content}\n\nError: ${error.message}`
                : `Sorry, something went wrong: ${error.message}`,
              streaming: false,
            }
          : message
      )
    );
  } finally {
    setLoading(false);
  }
};




  function handleFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadStatus({
        type: "error",
        msg: "Please drop a PDF file.",
      });
      return;
    }

    setSelectedFile(file);
    setUploadPanelOpen(true);
    setUploadStatus(null);
  }

  const activeSession = sessions.find(
    (session) => getSessionId(session) === sessionId
  );

  const hasUserMessages = messages.some((message) => message.role === "user");

  return (
    <div
      className={`app-shell ${theme === "dark" ? "theme-dark" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleFileDrop}
    >
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Icon name="file" size={22} /></div>
          <div>
            <div className="brand-name">PaperMind</div>
            <div className="brand-caption">PDF intelligence</div>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <Icon name="close" />
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={async () => {
            try {
              await createSession();
            } catch (error) {
              setPageError(error.message);
            }
          }}
        >
          <Icon name="plus" size={18} />
          <span>New chat</span>
          <span className="new-chat-shortcut">+</span>
        </button>

        <div className="history-heading">
          <span>YOUR CONVERSATIONS</span>
          <span className="history-count">{sessions.length}</span>
        </div>

        <div className="history-list">
                  
        {sessions.map((session) => {
          const id = getSessionId(session);
          const active = id === sessionId;

          return (
            <button
              key={id}
              className={`history-item ${
                active ? "history-item-active" : ""
              }`}
              onClick={() => selectSession(id)}
              title={session.title || "New Chat"}
            >
              <Icon name="message" size={17} />

              <div className="history-details">
                <span className="history-title">
                  {session.title || "New Chat"}
                </span>

                <span className="history-pdf">
                  <Icon name="file" size={13} />
                  <span>{session.pdf_name || "No PDF uploaded"}</span>
                </span>
              </div>

              <span
                className="delete-chat"
                role="button"
                tabIndex={0}
                aria-label="Delete conversation"
                title="Delete chat"
                onClick={(event) => deleteSession(id, event)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    deleteSession(id, event);
                  }
                }}
              >
                <Icon name="trash" size={15} />
              </span>
            </button>
          );
        })}


          {!bootLoading && sessions.length === 0 && (
            <p className="history-empty">Your conversations will appear here.</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Icon name="file" size={18} /></div>
            <div>
              <strong>Your documents, understood.</strong>
              <p>Upload a PDF and explore it with AI.</p>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="status-dot" />
            <span>Local AI workspace</span>
            <span className="footer-version">RAG</span>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Icon name="menu" />
            </button>

            <div className="breadcrumb">
              <span className="breadcrumb-muted">Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {activeSession?.title || "New conversation"}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="connection-indicator">
              <span className="status-dot" />
              <span>Assistant ready</span>
            </div>
            <button
              className="theme-button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title="Toggle theme"
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
            </button>
            <button
              className="upload-top-button"
              onClick={() => setUploadPanelOpen((open) => !open)}
            >
              <Icon name="upload" size={17} />
              <span>Upload PDF</span>
            </button>
          </div>
        </header>

        {pageError && (
          <div className="page-error">
            <span>{pageError}</span>
            <button onClick={() => setPageError("")} aria-label="Dismiss error">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        <section className="chat-area">
          {bootLoading ? (
            <div className="loading-screen">
              <div className="loading-mark"><Icon name="bot" size={26} /></div>
              <p>Preparing your workspace…</p>
            </div>
          ) : !hasUserMessages && messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-mark">
                <Icon name="bot" size={30} />
              </div>
              <div className="welcome-eyebrow">
                YOUR PERSONAL DOCUMENT ASSISTANT
              </div>
              <h1>Make your PDFs<br />work <span>for you.</span></h1>
              <p className="welcome-description">
                Ask questions, explore key ideas, and get answers grounded in
                the documents you upload.
              </p>

              <div className="suggestion-grid">
                <button
                  className="suggestion-card"
                  onClick={() => setQuestion("Summarize the main topics in this PDF.")}
                >
                  <span className="suggestion-icon lavender">✳</span>
                  <strong>Summarize this document</strong>
                  <span>Get the main ideas and key points</span>
                </button>
                <button
                  className="suggestion-card"
                  onClick={() => setQuestion("What are the most important points?")}
                >
                  <span className="suggestion-icon peach">⌕</span>
                  <strong>Find key information</strong>
                  <span>Discover important details quickly</span>
                </button>
                <button
                  className="suggestion-card"
                  onClick={() => setQuestion("Explain the most important topic in simple terms.")}
                >
                  <span className="suggestion-icon mint">↗</span>
                  <strong>Explain a topic</strong>
                  <span>Make complex ideas easier to understand</span>
                </button>
                <button
                  className="suggestion-card"
                  onClick={() => setUploadPanelOpen(true)}
                >
                  <span className="suggestion-icon blue"><Icon name="upload" size={19} /></span>
                  <strong>Start with a PDF</strong>
                  <span>Upload a document to get started</span>
                </button>
              </div>

              <div className="welcome-note">
                <span className="status-dot" />
                Answers are generated by your local AI setup
              </div>
            </div>
          ) : (
            <div className="messages-container" ref={chatContainerRef}>

              <div className="conversation-heading">
                <div>
                  <span className="conversation-eyebrow">CONVERSATION</span>
                  <h2>{activeSession?.title || "Your conversation"}</h2>
                </div>
                <span className="message-count">
                  {messages.length} {messages.length === 1 ? "message" : "messages"}
                </span>
              </div>

              {messages.map((message, index) => {
                if (message.role === "system") return null;
                const isUser = message.role === "user";

                return (
                  <article
                    key={message.id ?? index}
                    className={`message-row ${isUser ? "message-user" : "message-assistant"}`}
                  >
                    {!isUser && (
                      <div className="avatar assistant-avatar">
                        <Icon name="bot" size={18} />
                      </div>
                    )}

                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{isUser ? "You" : "PaperMind"}</strong>
                        {!isUser && <span className="ai-label">AI ASSISTANT</span>}
                        {message.created_at && (
                          <span className="message-time">
                            {formatDate(message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="message-content">
                        {message.content}

                        {message.streaming && (
                          <span className="streaming-cursor" aria-label="Generating response">
                            ▍
                          </span>
                        )}
                      </div>
                                            
                      
                  {!isUser &&
                    Array.isArray(message.sources) &&
                    message.sources.length > 0 && (
                      <div className="source-panel">
                        <div className="source-panel-heading">
                          <Icon name="file-text" size={16} />
                          <strong>Answer sources</strong>
                        </div>

                        {Object.values(
                          message.sources.reduce((groups, source) => {
                            const fileName =
                              typeof source === "string"
                                ? source
                                : source.file_name ||
                                  source.filename ||
                                  source.source ||
                                  "Unknown PDF";

                            if (!groups[fileName]) {
                              groups[fileName] = {
                                fileName,
                                topic: source.topic || "General",
                                pages: [],
                              };
                            }

                            if (
                              typeof source === "object" &&
                              source.page != null &&
                              !groups[fileName].pages.includes(source.page)
                            ) {
                              groups[fileName].pages.push(source.page);
                            }

                            return groups;
                          }, {})
                        ).map((source) => {
                          const pages = [...source.pages].sort((a, b) => a - b);

                          return (
                            <p className="source-line" key={source.fileName}>
                              Found in <strong>{source.fileName}</strong>
                              {" — Topic: "}
                              <strong>{source.topic}</strong>
                              {" — Page no: "}
                              <strong>{pages[0] ?? "Unavailable"}</strong>
                              {pages.length > 1 &&
                                ` (other pages: ${pages.slice(1).join(", ")})`}
                            </p>
                          );
                        })}
                      </div>
                    )}


                    </div>
                  </article>
                );
              })}

              {loading && <TypingIndicator />}
              <div ref={messageEndRef} />
            </div>
          )}
        </section>

        <footer className="composer-area">
          {uploadPanelOpen && (
            <form className="upload-panel" onSubmit={uploadPDF}>
              <div className="upload-panel-heading">
                <div className="upload-panel-icon">
                  <Icon name="file" size={20} />
                </div>
                <div className="upload-panel-title">
                  <strong>Add a PDF document</strong>
                  <span>PDF files with selectable text work best</span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setUploadPanelOpen(false)}
                  aria-label="Close upload panel"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setUploadStatus(null);
                  }
                }}
              />

              <button
                className={`drop-zone ${selectedFile ? "drop-zone-selected" : ""}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
              >
                <span className="drop-icon"><Icon name="upload" size={22} /></span>
                <span className="drop-title">
                  {selectedFile ? selectedFile.name : "Choose a PDF from your computer"}
                </span>
                <span className="drop-subtitle">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload`
                    : "PDF format"}
                </span>
              </button>

              {uploadStatus && (
                <div className={`upload-status status-${uploadStatus.type}`}>
                  <span>{uploadStatus.msg}</span>
                </div>
              )}

              <div className="upload-panel-actions">
                <span className="upload-privacy">Processed by your RAG backend</span>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={uploadLoading || !selectedFile || !sessionId}
                >
                  {uploadLoading ? "Processing…" : "Upload document"}
                  {!uploadLoading && <Icon name="upload" size={16} />}
                </button>
              </div>
            </form>
          )}

          <form className="composer" onSubmit={askQuestion}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  askQuestion(event);
                }
              }}
              placeholder="Ask anything about your document…"
              rows={1}
              disabled={loading || bootLoading || !sessionId}
              aria-label="Ask a question about your PDF"
            />
            <div className="composer-toolbar">
              <div className="composer-hints">
                <button
                  type="button"
                  className="composer-tool"
                  onClick={() => {
                    setUploadPanelOpen((open) => !open);
                  }}
                >
                  <Icon name="file" size={16} />
                  <span>Add PDF</span>
                </button>
                <span className="keyboard-hint">
                  <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for a new line
                </span>
              </div>
              <button
                className="send-button"
                type="submit"
                disabled={!question.trim() || loading || !sessionId}
                aria-label="Send message"
              >
                <Icon name="send" size={18} />
              </button>
            </div>
          </form>

          <p className="disclaimer">
            AI responses can be inaccurate. Verify important information against your source document.
          </p>
        </footer>
      </main>
    </div>
  );
}
