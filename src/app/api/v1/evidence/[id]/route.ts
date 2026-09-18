import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { AsOfQuery, evidenceRecord } from "@/lib/agent-api";
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return handle(request, AsOfQuery, (access, query) =>
    evidenceRecord(access.workspace, id, query),
  );
};
