# from langchain_ollama import ChatOllama
# from langchain_core.prompts import ChatPromptTemplate


# # Initialize Phi-3 once
# llm = ChatOllama(
#     model="phi3",
#     temperature=0
# )


# def rewrite_question(chat_history, question):
#     """
#     Rewrite a follow-up question into a standalone question
#     using previous conversation context.
#     """

#     history_text = ""

#     for message in chat_history:
#         role = message.get("role", "")
#         content = message.get("content", "")

#         history_text += f"{role}: {content}\n"

#     prompt = ChatPromptTemplate.from_template(
#         """
# You are a question rewriting assistant.

# Given the conversation history and the latest user question,
# rewrite the latest question into a standalone question.

# Rules:
# 1. Do NOT answer the question.
# 2. Do NOT add extra information.
# 3. Preserve the original meaning.
# 4. If the question is already clear, return it unchanged.

# Conversation History:
# {history}

# Current Question:
# {question}

# Standalone Question:
# """
#     )

#     chain = prompt | llm

#     response = chain.invoke({
#         "history": history_text,
#         "question": question
#     })

#     return response.content.strip()



from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate


llm = ChatOllama(
    model="phi3",
    temperature=0,
)

prompt = ChatPromptTemplate.from_template(
    """
You rewrite questions for a PDF-based retrieval system.

Use the conversation history only to understand references
in the latest user question.

Rules:
1. Return one standalone question only.
2. Preserve the user's exact intent.
3. Resolve references such as "he", "it", "that", and "this language"
   using the conversation when the reference is clear.
4. Do not answer the question.
5. Do not add facts or assumptions.
6. If the question is already understandable on its own,
   keep its meaning and wording.
7. If the reference is unclear, keep the original question.

Conversation history:
{history}

Latest user question:
{question}

Standalone question:
"""
)


def rewrite_question(chat_history, question):
    original_question = question.strip()

    if not original_question or not chat_history:
        return original_question

    history_lines = []

    for message in chat_history:
        role = message.get("role", "")
        content = message.get("content", "")

        if role in ("user", "assistant") and content:
            history_lines.append(f"{role}: {content}")

    history_text = "\n".join(history_lines)

    try:
        response = (prompt | llm).invoke(
            {
                "history": history_text,
                "question": original_question,
            }
        )

        rewritten_question = response.content.strip().strip('"')

        if not rewritten_question:
            return original_question

        return rewritten_question

    except Exception as error:
        print(f"Question rewriting failed: {error}")
        return original_question
