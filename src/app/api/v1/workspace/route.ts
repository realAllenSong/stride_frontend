import { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api-route";
import { workspaceOverview } from "@/lib/agent-api";
export const GET = (request: NextRequest) =>
  handle(request, z.object({}), (access) =>
    workspaceOverview(access.workspace, access.session),
  );
