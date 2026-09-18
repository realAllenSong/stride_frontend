export function GET() {
  return Response.json(
    { status: "ok", service: "stride" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
