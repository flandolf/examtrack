import { describe, expect, test } from "bun:test"
import { mergeCollection } from "../src/lib/sync"

type Item = { id: string; updatedAt: string; value: string }

describe("sync merge", () => {
  test("keeps the newest edit and applies newer deletions", () => {
    const local: Item[] = [
      { id: "local-wins", updatedAt: "2026-07-12T02:00:00.000Z", value: "local" },
      { id: "deleted", updatedAt: "2026-07-12T01:00:00.000Z", value: "old" },
    ]
    const remote = [
      { id: "local-wins", payload: { id: "local-wins", updatedAt: "2026-07-12T01:00:00.000Z", value: "remote" }, updated_at: "2026-07-12T01:00:00.000Z", deleted_at: null },
      { id: "deleted", payload: null, updated_at: "2026-07-12T03:00:00.000Z", deleted_at: "2026-07-12T03:00:00.000Z" },
      { id: "remote-wins", payload: { id: "remote-wins", updatedAt: "2026-07-12T04:00:00.000Z", value: "remote" }, updated_at: "2026-07-12T04:00:00.000Z", deleted_at: null },
    ]
    const tombstones: Record<string, string> = {}

    expect(mergeCollection(local, remote, tombstones)).toEqual([
      local[0],
      remote[2].payload,
    ])
    expect(tombstones.deleted).toBe("2026-07-12T03:00:00.000Z")
  })

  test("does not resurrect a locally deleted item from an older remote copy", () => {
    const tombstones = { deleted: "2026-07-12T03:00:00.000Z" }
    const remote = [{
      id: "deleted",
      payload: { id: "deleted", updatedAt: "2026-07-12T01:00:00.000Z", value: "old" },
      updated_at: "2026-07-12T01:00:00.000Z",
      deleted_at: null,
    }]

    expect(mergeCollection<Item>([], remote, tombstones)).toEqual([])
  })

  test("preserves full question text in a synced mistake payload", () => {
    const payload = {
      id: "mistake-1",
      updatedAt: "2026-07-12T04:00:00.000Z",
      questionText: "Differentiate $e^{2x}$.",
    }

    expect(mergeCollection([], [{ id: payload.id, payload, updated_at: payload.updatedAt, deleted_at: null }], {}))
      .toEqual([payload])
  })
})
