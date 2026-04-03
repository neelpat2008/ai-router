/** Allow long OpenRouter calls on Vercel (Pro: up to 60s; Hobby: capped by plan). */
export const maxDuration = 60;

function getOpenRouterKey(): string | undefined {
  const k = process.env.OPENROUTER_KEY ?? process.env.OPENROUTER_API_KEY;
  const t = typeof k === "string" ? k.trim() : "";
  return t || undefined;
}

function openRouterRequestHeaders(apiKey: string): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "RouteAI";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

function extractOpenRouterError(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const o = data as Record<string, unknown>;
  const err = o.error;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query : "";
    const mode = typeof body.mode === "string" ? body.mode : "";

    if (!query.trim()) {
      return Response.json({ error: "Missing or empty query.", answer: null }, { status: 400 });
    }

    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      return Response.json(
        {
          error:
            "Missing API key: set OPENROUTER_KEY (or OPENROUTER_API_KEY) in Vercel → Project → Settings → Environment Variables, then redeploy.",
          answer: null,
        },
        { status: 500 },
      );
    }

    const systemPrompt = mode ? `You are an assistant answering in "${mode}" mode.` : "You are an assistant.";

    const response = await fetch("https://api.openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: openRouterRequestHeaders(apiKey),
      body: JSON.stringify({
        model: resolveModel(mode),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });

    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return Response.json(
        {
          error: "Could not parse response from OpenRouter.",
          answer: null,
          rawPreview: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const errMsg = extractOpenRouterError(data);
    const d = data as {
      choices?: { message?: { content?: string } }[];
      output?: string;
    };
    const answer =
      (typeof d.choices?.[0]?.message?.content === "string" && d.choices[0].message.content) ||
      (typeof d.output === "string" ? d.output : null) ||
      null;

    if (!response.ok) {
      return Response.json(
        {
          answer: null,
          error: errMsg || `OpenRouter request failed (HTTP ${response.status}).`,
          raw: data,
        },
        { status: 502 },
      );
    }

    if (!answer?.trim()) {
      return Response.json(
        {
          answer: null,
          error: errMsg || "The model returned an empty reply.",
          raw: data,
        },
        { status: 502 },
      );
    }

    return Response.json({ answer, raw: data }, { status: 200 });
  } catch (err) {
    return Response.json({ error: "Request failed", details: String(err), answer: null }, { status: 500 });
  }
}


/** Override any mode: set OPENROUTER_MODEL in Vercel (e.g. qwen/qwen3.6-plus-preview). */
function resolveModel(mode: string) {
  const fromEnv = process.env.OPENROUTER_MODEL?.trim();
  if (fromEnv) return fromEnv;

  // Free-tier ID from OpenRouter docs; preview slug often fails without credits / access.
  const defaultModel = "qwen/qwen3.6-plus:free";
  switch (mode) {
    case "factoids":
    case "science":
    case "math":
    case "coding":
    case "writing":
    case "reading":
    case "fast general":
    default:
      return defaultModel;
  }
}
