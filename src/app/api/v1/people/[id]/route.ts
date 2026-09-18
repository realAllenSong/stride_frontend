import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { PeriodQuery, personDetail } from "@/lib/agent-api";
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return handle(request, PeriodQuery, (access, query) =>
    personDetail(access.workspace, id, query),
  );
};
