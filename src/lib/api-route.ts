import "server-only";
import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { AccessError } from "./access";
import { loadAccess, type Access } from "./dashboard-service";
import { NotFound } from "./agent-api";

const noStore = { "Cache-Control": "private, no-store" };
const accessMessage = (status: number) =>
  status === 401
    ? "Sign-in required"
    : status === 403
      ? "Access not granted"
      : "Workspace unavailable";

/** Parse the query, authorize, run a projection and map errors to bounded JSON. */
export async function handle<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
  run: (access: Access, query: z.infer<S>) => unknown,
) {
  const parsed = schema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400, headers: noStore },
    );
  let access: Access;
  try {
    access = await loadAccess(request.headers);
  } catch (error) {
    const status = error instanceof AccessError ? error.status : 503;
    return NextResponse.json(
      { error: accessMessage(status) },
      { status, headers: noStore },
    );
  }
  try {
    return NextResponse.json(run(access, parsed.data), { headers: noStore });
  } catch (error) {
    // Inside a grant an unknown ID is a 403, so a response never confirms that
    // something exists outside the caller's scope. Demo mode can say 404.
    if (error instanceof NotFound)
      return NextResponse.json(
        {
          error: access.grant
            ? "Access not granted"
            : `${error.resource[0].toUpperCase()}${error.resource.slice(1)} not found`,
        },
        { status: access.grant ? 403 : 404, headers: noStore },
      );
    const status = error instanceof AccessError ? error.status : 503;
    return NextResponse.json(
      { error: accessMessage(status) },
      { status, headers: noStore },
    );
  }
}
