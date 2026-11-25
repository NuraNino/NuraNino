/**
 * BudgetData ↔ 서버 기록(records) 변환.
 * 지출 한 건, 분류 하나, 월 계획 하나처럼 작은 단위로 나눠 저장해서
 * 두 사람이 동시에 다른 항목을 고쳐도 서로 덮어쓰지 않게 합니다.
 */
import { createDefaultData } from '../domain/defaults'
import type { BudgetData } from '../domain/types'

export const KINDS = ['tx', 'inc', 'cat', 'pm', 'plan', 'rec', 'inst', 'skip', 'settings'] as const
export type Kind = (typeof KINDS)[number]

/** 'kind:id' → 평문 JSON 문자열 */
export type RecordMap = Map<string, string>

export const keyOf = (kind: Kind, id: string) => `${kind}:${id}`
export function splitKey(key: string): { kind: Kind; id: string } {
  const i = key.indexOf(':')
  return { kind: key.slice(0, i) as Kind, id: key.slice(i + 1) }
}

/** 순서가 의미 있는 목록(분류, 결제수단, 반복 항목, 할부)은 o(순서)를 함께 저장 */
const put = (m: RecordMap, kind: Kind, id: string, v: unknown, o?: number) =>
  m.set(keyOf(kind, id), JSON.stringify(o === undefined ? { v } : { o, v }))

export function toRecords(d: BudgetData): RecordMap {
  const m: RecordMap = new Map()
  d.categories.forEach((x, i) => put(m, 'cat', x.id, x, i))
  d.paymentMethods.forEach((x, i) => put(m, 'pm', x.id, x, i))
  for (const x of d.transactions) put(m, 'tx', x.id, x)
  for (const x of d.incomes) put(m, 'inc', x.id, x)
  for (const [month, p] of Object.entries(d.plans)) put(m, 'plan', month, p)
  ;(d.recurring ?? []).forEach((x, i) => put(m, 'rec', x.id, x, i))
  ;(d.installments ?? []).forEach((x, i) => put(m, 'inst', x.id, x, i))
  for (const [month, ids] of Object.entries(d.recurringSkips ?? {})) if (ids.length) put(m, 'skip', month, ids)
  put(m, 'settings', 'settings', d.settings)
  return m
}

export function fromRecords(m: RecordMap): BudgetData {
  const by: Record<Kind, { id: string; o: number; v: unknown }[]> = {
    tx: [], inc: [], cat: [], pm: [], plan: [], rec: [], inst: [], skip: [], settings: [],
  }
  for (const [key, json] of m) {
    const { kind, id } = splitKey(key)
    if (!(kind in by)) continue
    const { o, v } = JSON.parse(json) as { o?: number; v: unknown }
    by[kind].push({ id, o: o ?? 0, v })
  }
  const ordered = <T,>(k: Kind) => by[k].sort((a, b) => a.o - b.o).map((x) => x.v as T)
  const defaults = createDefaultData()
  const d: BudgetData = {
    version: 1,
    categories: ordered('cat'),
    paymentMethods: ordered('pm'),
    transactions: by.tx.map((x) => x.v as BudgetData['transactions'][number]),
    incomes: by.inc.map((x) => x.v as BudgetData['incomes'][number]),
    plans: Object.fromEntries(by.plan.map((x) => [x.id, x.v as BudgetData['plans'][string]])),
    settings: (by.settings[0]?.v as BudgetData['settings']) ?? defaults.settings,
    recurring: ordered('rec'),
    installments: ordered('inst'),
    recurringSkips: Object.fromEntries(by.skip.map((x) => [x.id, x.v as string[]])),
  }
  return d
}

/** 두 기록 집합의 차이: 바뀐/새 항목과 삭제된 항목 */
export function diff(current: RecordMap, base: Record<string, string>): { key: string; value: string | null }[] {
  const out: { key: string; value: string | null }[] = []
  for (const [key, value] of current) if (base[key] !== value) out.push({ key, value })
  for (const key of Object.keys(base)) if (!current.has(key)) out.push({ key, value: null })
  return out
}
