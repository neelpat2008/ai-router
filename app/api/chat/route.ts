export async function POST(req: Request) {
  const body = await req.json();

  return new Response(JSON.stringify({
    message: "Backend received your request",
    input: body
  }));
}
