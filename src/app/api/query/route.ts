export async function POST(req: Request) {
  try {
    const { query, model, mode } = await req.json();

    const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
    if (!OPENROUTER_KEY) {
      return new Response(JSON.stringify({ error: 'Missing OPENROUTER_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const systemPrompt = mode ? `You are an assistant answering in "${mode}" mode.` : 'You are an assistant.';

    const modelToUse = model || getModelFromMode(mode);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    });

    const data = await response.json();

    const answer = data?.choices?.[0]?.message?.content || data?.output || null;

    return new Response(JSON.stringify({ answer, raw: data }), { status: response.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Request failed', details: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

function getModelFromMode(mode: string | undefined) {
  switch (mode) {
    case 'factoids':
      return 'qwen/qwen3.8-27b:free';
    case 'science':
      return 'qwen/qwen3.8-27b:free';
    case 'math':
      return 'qwen/qwen3.8-27b:free';
    case 'coding':
      return 'qwen/qwen3.8-27b:free';
    case 'writing':
      return 'qwen/qwen3.8-27b:free';
    case 'reading':
      return 'qwen/qwen3.8-27b:free';
    case 'fast general':
      return 'qwen/qwen3.8-27b:free';
    default:
      return 'qwen/qwen3.8-27b:free';
  }
}
