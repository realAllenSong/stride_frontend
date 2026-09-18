import { NextRequest, NextResponse } from "next/server";
import { openApiDocument } from "@/lib/agent-api";
// The contract is public; the data behind it is not.
export const GET = (request: NextRequest) =>
  NextResponse.json(openApiDocument(request.nextUrl.origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
