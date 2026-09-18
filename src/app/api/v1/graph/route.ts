import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { AsOfQuery, workspaceGraph } from "@/lib/agent-api";
export const GET = (request: NextRequest) =>
  handle(request, AsOfQuery, (access, query) =>
    workspaceGraph(access.workspace, query),
  );
