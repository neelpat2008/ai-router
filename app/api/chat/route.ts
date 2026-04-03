export async function POST(req: Request) {
  try {
    const { query, mode } = await req.json();

    const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

    const systemPrompt = `You are an assistant answering in "${mode}" mode.`;

    const response = await fetch("https://api.openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModelFromMode(mode),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify({
        answer: data.choices?.[0]?.message?.content || "No response",
      }),
      { status: 200 }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ answer: "Error occurred" }),
      { status: 500 }
    );
  }
}

function getModelFromMode(mode: string) {
  switch (mode) {
    case 'factoids':
      return 'qwen/qwen3.6-plus-preview';
    case 'science':
      return 'qwen/qwen3.6-plus-preview';
    case 'math':
      return 'qwen/qwen3.6-plus-preview';
    case 'coding':
      return 'qwen/qwen3.6-plus-preview';
    case 'writing':
      return 'qwen/qwen3.6-plus-preview';
    case 'reading':
      return 'qwen/qwen3.6-plus-preview';
    case 'fast general':
    default:
      return 'qwen/qwen3.6-plus-preview';
  }
}
