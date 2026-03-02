Modes and OpenRouter tblocks

For each mode below, set a mode-specific OpenRouter env var and then call the `/process` endpoint with the selected `mode` and `query`.

Format (replace <KEY> and <QUESTION>):

- Env var (tblock):

  OPENROUTER_KEY_<MODE>=<YOUR_OPENROUTER_KEY>

- Example curl (calls local FastAPI `/process` which will use the OpenRouter key when present):

```bash
curl -sS -X POST "http://localhost:8000/process" \
  -H "Content-Type: application/json" \
  -d '{"mode":"<mode display name>", "query":"<QUESTION>"}'
```

Modes

- math

  OPENROUTER_KEY_MATH=<YOUR_OPENROUTER_KEY>
  Example mode value: "math"

- science

  OPENROUTER_KEY_SCIENCE=<YOUR_OPENROUTER_KEY>
  Example mode value: "science"

- factoids

  OPENROUTER_KEY_FACTOIDS=<YOUR_OPENROUTER_KEY>
  Example mode value: "factoids"

- coding

  OPENROUTER_KEY_CODING=<YOUR_OPENROUTER_KEY>
  Example mode value: "coding"

- writing

  OPENROUTER_KEY_WRITING=<YOUR_OPENROUTER_KEY>
  Example mode value: "writing"

- reading

  OPENROUTER_KEY_READING=<YOUR_OPENROUTER_KEY>
  Example mode value: "reading"

- fast general

  OPENROUTER_KEY_FAST_GENERAL=<YOUR_OPENROUTER_KEY>
  Example mode value: "fast general"

Notes

- If a mode-specific `OPENROUTER_KEY_<MODE>` is not present, the server will fall back to `OPENROUTER_KEY_DEFAULT` if set.
- If no OpenRouter key exists for the mode, the server will try OpenAI keys (`OPENAI_KEY_<MODE>`, `OPENAI_KEY_DEFAULT`, or `OPENAI_KEY`).
- You can set a default model for OpenRouter using `OPENROUTER_MODEL` (defaults to `gpt-4o-mini`).
- The Next.js frontend posts `{query, mode}` to `/api/query`, which proxies to `http://localhost:8000/process`.
