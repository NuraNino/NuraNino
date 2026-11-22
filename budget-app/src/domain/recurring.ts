import { uid } from './defaults'
import { categoryMap, incomesOfMonth, txOfMonth } from './calc'
import type { BudgetData, Group, Income, RecurringRule, Transaction } from './types'

export type DueStatus = 'pending' | 'done' | 'skipped'

export interface DueItem {
  rule: RecurringRule
  date: string
  status: DueStatus
}

const pad = (n: number) => String(n).padStart(2, '0')

export function lastDayOf(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 규칙이 그 달에 적용되는 날짜 (말일 보정) */
export const dueDate = (rule: RecurringRule, month: string): string =>
  `${month}-${pad(Math.min(Math.max(1, rule.day), lastDayOf(month)))}`

export const appliesIn = (rule: RecurringRule, month: string): boolean =>
  rule.active && (rule.months.length === 0 || rule.months.includes(Number(month.slice(5, 7))))

/** 이번 달 반복 항목과 등록 상태 */
export function dueItems(data: BudgetData, month: string): DueItem[] {
  const rules = (data.recurring ?? []).filter((r) => appliesIn(r, month))
  const doneIds = new Set([
    ...txOfMonth(data, month).map((t) => t.recurringId),
    ...incomesOfMonth(data, month).map((i) => i.recurringId),
  ])
  const skipped = new Set(data.recurringSkips?.[month] ?? [])
  return rules
    .map((rule) => ({
      rule,
      date: dueDate(rule, month),
      status: (doneIds.has(rule.id) ? 'done' : skipped.has(rule.id) ? 'skipped' : 'pending') as DueStatus,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.name.localeCompare(b.rule.name))
}

/** 반복 항목들을 그 달의 지출·수입으로 등록 (amounts로 이번 달 금액만 바꿀 수 있음) */
export function registerDue(
  data: BudgetData,
  month: string,
  ruleIds: string[],
  amounts: Record<string, number> = {},
): BudgetData {
  const items = dueItems(data, month).filter((d) => ruleIds.includes(d.rule.id) && d.status !== 'done')
  const fallbackPm = data.paymentMethods[0]?.id ?? ''
  const txs: Transaction[] = []
  const incs: Income[] = []
  for (const { rule, date } of items) {
    const amount = amounts[rule.id] ?? rule.amount
    if (rule.kind === 'expense') {
      if (!rule.categoryId) continue
      txs.push({
        id: uid(),
        date,
        categoryId: rule.categoryId,
        paymentMethodId: rule.paymentMethodId ?? fallbackPm,
        memo: rule.name,
        amount,
        recurringId: rule.id,
      })
    } else {
      incs.push({ id: uid(), date, source: rule.name, amount, recurringId: rule.id })
    }
  }
  const skips = { ...(data.recurringSkips ?? {}) }
  if (skips[month]) skips[month] = skips[month].filter((id) => !items.some((i) => i.rule.id === id))
  return {
    ...data,
    transactions: [...data.transactions, ...txs],
    incomes: [...data.incomes, ...incs],
    recurringSkips: skips,
  }
}

export function setSkipped(data: BudgetData, month: string, ruleId: string, skip: boolean): BudgetData {
  const cur = new Set(data.recurringSkips?.[month] ?? [])
  if (skip) cur.add(ruleId)
  else cur.delete(ruleId)
  return { ...data, recurringSkips: { ...(data.recurringSkips ?? {}), [month]: [...cur] } }
}

/** 그 달에 적용되는 반복 지출의 카테고리별 합계 (예산 채우기용) */
export function recurringBudget(data: BudgetData, month: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of data.recurring ?? []) {
    if (r.kind !== 'expense' || !r.categoryId || !appliesIn(r, month)) continue
    out.set(r.categoryId, (out.get(r.categoryId) ?? 0) + r.amount)
  }
  return out
}

/**
 * 어떤 달의 고정비·저축 지출과 수입을 반복 항목 후보로 만듭니다.
 * 같은 내용(이름)+분류의 규칙이 이미 있으면 제외합니다.
 */
export function suggestRules(
  data: BudgetData,
  month: string,
  groups: Group[] = ['고정비', '저축'],
): RecurringRule[] {
  const cats = categoryMap(data)
  const existing = new Set((data.recurring ?? []).map((r) => `${r.kind}|${r.name}|${r.categoryId ?? ''}`))
  const out: RecurringRule[] = []
  const seen = new Set<string>()
  for (const t of txOfMonth(data, month).sort((a, b) => a.date.localeCompare(b.date))) {
    const g = cats.get(t.categoryId)?.group
    if (!g || !groups.includes(g) || !t.memo) continue
    const key = `expense|${t.memo}|${t.categoryId}`
    if (existing.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push({
      id: uid(),
      kind: 'expense',
      name: t.memo,
      amount: t.amount,
      day: Number(t.date.slice(8, 10)),
      months: [],
      categoryId: t.categoryId,
      paymentMethodId: t.paymentMethodId,
      active: true,
    })
  }
  return out
}
