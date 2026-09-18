import "server-only";
import { open } from "node:fs/promises";
import { demoWorkspace } from "@/data/demo";
import { validateReferences } from "./briefs";
import { WorkspaceSchema, type Workspace } from "./contracts";
import { AccessError } from "./access";

export async function readJsonFile(
  path: string,
  maxBytes: number,
): Promise<unknown> {
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes) throw new AccessError(503);
    // Allocate for the actual snapshot, not the full 20 MiB ceiling on every request.
    // An extra byte detects in-place growth; publishers should use atomic replacement.
    const bytes = Buffer.alloc(stat.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await file.read(
        bytes,
        total,
        bytes.length - total,
        null,
      );
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > stat.size || total > maxBytes) throw new AccessError(503);
    return JSON.parse(bytes.subarray(0, total).toString("utf8"));
  } finally {
    await file.close();
  }
}

export interface BriefRepository {
  readWorkspace(): Promise<Workspace>;
}

// Approved snapshots only. Raw private records must stay in the upstream system.
export const briefRepository: BriefRepository = {
  async readWorkspace() {
    try {
      if (
        process.env.STRIDE_WORKSPACE_FILE &&
        process.env.STRIDE_AUTH_MODE !== "gateway"
      )
        throw new AccessError(503);
      const raw = process.env.STRIDE_WORKSPACE_FILE
        ? await readJsonFile(
            process.env.STRIDE_WORKSPACE_FILE,
            20 * 1024 * 1024,
          )
        : demoWorkspace;
      const workspace = WorkspaceSchema.parse(raw);
      if (validateReferences(workspace).length) throw new AccessError(503);
      return workspace;
    } catch {
      throw new AccessError(503);
    }
  },
};
