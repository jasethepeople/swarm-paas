export type SnapshotFile = { path: string; language: string; content: string };

export function diffFileSnapshots(before: SnapshotFile[], after: SnapshotFile[]) {
  const beforeMap = new Map(before.map(file => [file.path, file]));
  const afterMap = new Map(after.map(file => [file.path, file]));
  return Array.from(new Set(Array.from(beforeMap.keys()).concat(Array.from(afterMap.keys())))).sort().map(path => ({
    path,
    before: beforeMap.get(path)?.content || null,
    after: afterMap.get(path)?.content || null,
    change: !beforeMap.has(path) ? "added" : !afterMap.has(path) ? "removed" : beforeMap.get(path)?.content === afterMap.get(path)?.content ? "unchanged" : "modified",
  })).filter(change => change.change !== "unchanged");
}
