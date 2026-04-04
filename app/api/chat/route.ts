import dns from "node:dns";
import https from "node:https";
import { URL } from "node:url";

/** Official host (see OpenRouter quickstart); `api.openrouter.ai` is not used and often does not resolve. */
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Allow long OpenRouter calls on Vercel (Pro: up to 60s; Hobby: capped by plan). */
export const maxDuration = 60;

/** Node runtime avoids Edge limitations on outbound fetch / timeouts. */
export const runtime = "nodejs";

// Vercel/Node often prefers AAAA records; IPv6 egress can fail and undici only reports "fetch failed".
dns.setDefaultResultOrder("ipv4first");

function getOpenRouterKey(): string | undefined {
  const k = process.env.OPENROUTER_KEY ?? process.env.OPENROUTER_API_KEY;
  if (typeof k !== "string") return undefined;
  // Newlines in pasted Vercel secrets break the Authorization header and make fetch throw.
  const t = k.replace(/\r\n|\r|\n|\t/g, "").trim();
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
    "X-OpenRouter-Title": title,
  };
}

/** When undici fetch fails (often on Vercel + IPv6), force IPv4 via node:https. */
function postJsonHttpsIpv4(
  urlString: string,
  headers: Record<string, string>,
  jsonBody: string,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  const url = new URL(urlString);
  const merged: Record<string, string> = {
    ...headers,
    "Content-Length": String(Buffer.byteLength(jsonBody, "utf8")),
  };

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: merged,
        timeout: timeoutMs,
        lookup(hostname, _opts, cb) {
          dns.lookup(hostname, { family: 4 }, cb);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`HTTPS timeout after ${timeoutMs}ms`));
    });
    req.write(jsonBody, "utf8");
    req.end();
  });
}

function formatFetchFailure(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts: string[] = [err.message];
  let c: unknown = err.cause;
  for (let i = 0; i < 6 && c instanceof Error; i++) {
    parts.push(c.message);
    c = c.cause;
  }
  return parts.join(" | ");
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body.", answer: null }, { status: 400 });
  }

  const query = body && typeof body === "object" && "query" in body && typeof (body as { query: unknown }).query === "string" ? (body as { query: string }).query : "";
  const mode = body && typeof body === "object" && "mode" in body && typeof (body as { mode: unknown }).mode === "string" ? (body as { mode: string }).mode : "";

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

  const jsonBody = JSON.stringify({
    model: resolveModel(mode),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
  });

  const headers = openRouterRequestHeaders(apiKey);

  const fetchSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(55_000)
      : undefined;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers,
      body: jsonBody,
      ...(fetchSignal ? { signal: fetchSignal } : {}),
    });
  } catch (err) {
    try {
      const { status, text } = await postJsonHttpsIpv4(OPENROUTER_CHAT_URL, headers, jsonBody, 55_000);
      response = new Response(text, { status });
    } catch (fallbackErr) {
      return Response.json(
        {
          error: `Could not reach OpenRouter (fetch: ${formatFetchFailure(err)}; IPv4 fallback: ${formatFetchFailure(fallbackErr)}).`,
          answer: null,
        },
        { status: 502 },
      );
    }
  }

  try {
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
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: `Server error while handling OpenRouter response: ${message}`,
        answer: null,
      },
      { status: 500 },
    );
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
