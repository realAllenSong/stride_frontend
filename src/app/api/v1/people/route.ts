import { NextRequest } from "next/server";
import { handle } from "@/lib/api-route";
import { listPeople, PeopleQuery } from "@/lib/agent-api";
export const GET = (request: NextRequest) =>
  handle(request, PeopleQuery, (access, query) =>
    listPeople(access.workspace, query),
  );
