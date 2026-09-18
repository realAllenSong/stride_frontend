import type { Change } from "./contracts";

export function latestPerWork(changes: Change[]): Change[] {
  const map = new Map<string, Change>();
  [...changes]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .forEach((c) => map.set(`${c.projectId}:${c.workId}`, c));
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}
