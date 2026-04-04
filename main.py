from fastapi import FastAPI
from pydantic import BaseModel
import os
import httpx
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Tuple

class QueryRequest(BaseModel):
    query: str
    mode: str


app = FastAPI()

# Allow local Next.js dev server to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_mode(mode: str) -> str:
    """Normalize mode into an environment variable friendly suffix.

    Examples:
      "fast math" -> "FAST_MATH"
    """
    if not mode:
        return "DEFAULT"
    return "_".join(mode.strip().upper().split())


def get_provider_and_key_for_mode(mode: str) -> Tuple[Optional[str], Optional[str]]:
    """Return (provider, key) for the given mode.

    Provider is one of: "openrouter", "openai". Returns (None, None) when no key found.
    Priority checks:
      1) OPENROUTER_KEY_<MODE>
      2) OPENAI_KEY_<MODE>
      3) OPENROUTER_KEY_DEFAULT
      4) OPENAI_KEY_DEFAULT or OPENAI_KEY
    """
    suffix = normalize_mode(mode)

    or_env = os.getenv(f"OPENROUTER_KEY_{suffix}")
    if or_env:
        return ("openrouter", or_env)

    oa_env = os.getenv(f"OPENAI_KEY_{suffix}")
    if oa_env:
        return ("openai", oa_env)

    # fallbacks
    or_default = os.getenv("OPENROUTER_KEY_DEFAULT")
    if or_default:
        return ("openrouter", or_default)

    oa_default = os.getenv("OPENAI_KEY_DEFAULT") or os.getenv("OPENAI_KEY")
    if oa_default:
        return ("openai", oa_default)

    return (None, None)


@app.post("/process")
async def process(request: QueryRequest):
    provider, api_key = get_provider_and_key_for_mode(request.mode)
    if not api_key or not provider:
        return {"error": "No API key configured for this mode and no default found."}

    system_prompt = f"You are an assistant answering in '{request.mode}' mode. Be concise and match the style requested by the mode."
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": request.query},
    ]

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    if provider == "openrouter":
        url = "https://openrouter.ai/api/v1/chat/completions"
        # default to the OpenRouter free model; override with OPENROUTER_MODEL env var
        payload = {
            "model": os.getenv("OPENROUTER_MODEL", "openrouter/free"),
            "messages": messages,
            "max_tokens": 800,
            "temperature": 0.7,
        }
    else:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
            "messages": messages,
            "max_tokens": 800,
            "temperature": 0.7,
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)

    if resp.status_code != 200:
        return {"error": f"{provider} request failed", "status_code": resp.status_code, "detail": resp.text}

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
        content = ""

    return {"answer": content, "raw": data, "provider": provider}

