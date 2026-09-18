import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { listProjects, ScopedQuery } from "@/lib/agent-api";
export const GET = (request: NextRequest) =>
  handle(request, ScopedQuery, (access, query) =>
    listProjects(access.workspace, query),
  );
