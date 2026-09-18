import { NextRequest, NextResponse } from "next/server";
import { loadDashboard } from "@/lib/dashboard-service";
import { AccessError } from "@/lib/access";
import { QuerySchema } from "@/lib/contracts";
export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid brief query", issues: parsed.error.issues },
      { status: 400 },
    );
  try {
    return NextResponse.json(await loadDashboard(params, request.headers), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Sign-in required"
            : status === 403
              ? "Access not granted"
              : "Workspace unavailable",
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
