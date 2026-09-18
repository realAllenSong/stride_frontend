import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { BriefQuery, periodBrief } from "@/lib/agent-api";
import { assertScoped } from "@/lib/dashboard-service";
export const GET = (request: NextRequest) =>
  handle(request, BriefQuery, (access, query) => {
    assertScoped(access, query);
    return periodBrief(access.workspace, query, access.session.personId);
  });
