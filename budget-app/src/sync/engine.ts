/**
 * 동기화 엔진 (서버 종류와 무관한 부분).
 *
 * - shadow: 마지막으로 서버와 맞춘 기록(평문 JSON). 현재 데이터와 비교해 바뀐 것만 올립니다.
 * - push: 바뀐 기록을 암호화해 업로드 (삭제는 deleted 표시)
 * - pull: 서버에서 cursor 이후 바뀐 기록을 받아 복호화
 * - applyPulled: 받은 기록을 최신 로컬 데이터에 합침. 아직 올리지 않은 로컬 변경이 있는 항목은
 *   로컬 값을 유지하고(다음 push 때 서버에 반영) 나머지는 서버 값으로 바꿉니다.
 */
import { decryptText, encryptText } from './crypto'
import { diff, fromRecords, keyOf, splitKey, toRecords, type Kind } from './records'
import type { BudgetData } from '../domain/types'

export interface RemoteRow {
  kind: Kind
  id: string
  iv: string
  ciphertext: string
  deleted: boolean
  updated_at: string
}

export type PushRow = Omit<RemoteRow, 'updated_at'>

export interface Remote {
  /** since 이후(초과) 바뀐 기록, updated_at 오름차순 */
  pull(since: string | null): Promise<RemoteRow[]>
  push(rows: PushRow[]): Promise<void>
  subscribe(onChange: () => void): () => void
}

export interface SyncState {
  cursor: string | null
  shadow: Record<string, string>
}

export const emptySyncState = (): SyncState => ({ cursor: null, shadow: {} })

/** 서버 시계 오차·늦게 커밋된 기록을 놓치지 않도록 cursor를 조금 겹쳐서 다시 받음 */
const OVERLAP_MS = 2 * 60 * 1000

export interface Pulled {
  key: string
  value: string | null
}

const aadOf = (kind: string, id: string) => `${kind}:${id}`

export async function pushChanges(remote: Remote, key: CryptoKey, data: BudgetData, state: SyncState): Promise<number> {
  const changes = diff(toRecords(data), state.shadow)
  if (changes.length === 0) return 0
  const rows: PushRow[] = []
  for (const c of changes) {
    const { kind, id } = splitKey(c.key)
    if (c.value === null) rows.push({ kind, id, iv: '', ciphertext: '', deleted: true })
    else rows.push({ kind, id, ...(await encryptText(key, c.value, aadOf(kind, id))), deleted: false })
  }
  await remote.push(rows)
  for (const c of changes) {
    if (c.value === null) delete state.shadow[c.key]
    else state.shadow[c.key] = c.value
  }
  return changes.length
}

export async function pullChanges(remote: Remote, key: CryptoKey, state: SyncState): Promise<{ pulled: Pulled[]; cursor: string | null }> {
  const since = state.cursor ? new Date(Date.parse(state.cursor) - OVERLAP_MS).toISOString() : null
  const rows = await remote.pull(since)
  const pulled: Pulled[] = []
  let cursor = state.cursor
  for (const r of rows) {
    const k = keyOf(r.kind, r.id)
    const value = r.deleted ? null : await decryptText(key, { iv: r.iv, ciphertext: r.ciphertext }, aadOf(r.kind, r.id))
    pulled.push({ key: k, value })
    if (!cursor || r.updated_at > cursor) cursor = r.updated_at
  }
  return { pulled, cursor }
}

/** 순수 함수: 최신 로컬 데이터에 받은 기록을 합친 결과 (바뀐 게 없으면 같은 객체) */
export function applyPulled(data: BudgetData, pulled: Pulled[], shadowBefore: Record<string, string>): BudgetData {
  const current = toRecords(data)
  let changed = false
  for (const { key, value } of pulled) {
    const local = current.get(key) ?? null
    const pending = local !== (shadowBefore[key] ?? null)
    if (pending || local === value) continue
    if (value === null) current.delete(key)
    else current.set(key, value)
    changed = true
  }
  return changed ? fromRecords(current) : data
}

/** pull 후 shadow 갱신 (로컬이 이긴 항목은 다음 push에서 다시 올라감) */
export function commitPulled(state: SyncState, pulled: Pulled[], cursor: string | null) {
  for (const { key, value } of pulled) {
    if (value === null) delete state.shadow[key]
    else state.shadow[key] = value
  }
  state.cursor = cursor
}
