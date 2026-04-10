import type { MiniTask } from "@/lib/types/momentum"

export function groupMinisByParent(minis: MiniTask[]) {
  const m = new Map<string, MiniTask[]>()
  for (const x of minis) {
    const arr = m.get(x.parentTaskId) ?? []
    arr.push(x)
    m.set(x.parentTaskId, arr)
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  }
  return m
}
