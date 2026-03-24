export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, mode } = body;

    // simple echo for testing
    return new Response(
      JSON.stringify({ answer: `You said: "${query}" in mode "${mode}"` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ answer: "Error: invalid request" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
