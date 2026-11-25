import { GROUPS, type BudgetData, type Category, type Group, type MonthPlan, type Transaction } from './types'
import { offeringFor } from './offering'

export const monthOf = (date: string): string => date.slice(0, 7)

/** 엑셀의 주차 규칙: 1–7일 1주차, 8–14일 2주차 … */
export const weekOfMonth = (date: string): number => Math.ceil(Number(date.slice(8, 10)) / 7)

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const monthLabel = (month: string): string => {
  const [y, m] = month.split('-')
  return `${y}년 ${Number(m)}월`
}

export const won = (n: number): string => `${Math.round(n).toLocaleString('ko-KR')}원`

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export const emptyPlan = (): MonthPlan => ({ budgets: {}, incomePlan: [] })

export const planOf = (data: BudgetData, month: string): MonthPlan => data.plans[month] ?? emptyPlan()

export const txOfMonth = (data: BudgetData, month: string): Transaction[] =>
  data.transactions.filter((t) => monthOf(t.date) === month)

export const incomesOfMonth = (data: BudgetData, month: string) =>
  data.incomes.filter((i) => monthOf(i.date) === month)

export function categoryMap(data: BudgetData): Map<string, Category> {
  return new Map(data.categories.map((c) => [c.id, c]))
}

/** 헌금 예산을 헌금 계산 합계로 자동으로 맞추는지 (설정의 헌금 계산이 켜져 있고 그 항목일 때) */
export function offeringDrivesBudget(data: BudgetData, _month: string, categoryId: string): boolean {
  const t = data.settings.tithe
  return t.enabled && t.categoryId === categoryId
}

/** 항목의 예산 금액: 헌금 계산 합계 → 계산란 합계 → 직접 입력한 금액 순 */
export function plannedAmount(data: BudgetData, month: string, categoryId: string): number {
  if (offeringDrivesBudget(data, month, categoryId)) return offeringFor(data, month).total
  const line = planOf(data, month).budgets[categoryId]
  if (line?.calc?.length) return sum(line.calc.map((l) => l.amount))
  return line?.amount ?? 0
}

export interface CategoryRow {
  category: Category
  planned: number
  actual: number
  diff: number // planned - actual (양수 = 남음)
  memo?: string
}

export interface GroupRow {
  group: Group
  planned: number
  actual: number
  diff: number
  categories: CategoryRow[]
}

export interface MonthSummary {
  incomePlanned: number
  incomeActual: number
  expensePlanned: number
  expenseActual: number
  /** 수입계획 − 비용계획 (음수면 계획 단계에서 적자) */
  planGap: number
  /** 실수입 − 실지출 */
  net: number
  /** 아직 나가지 않은 고정비·저축 예정액 */
  remainingFixed: number
  /** 실수입 − 실지출 − 남은 고정비·저축 = 예상 월말 잔액 */
  projected: number
  groups: GroupRow[]
}

export function monthSummary(data: BudgetData, month: string): MonthSummary {
  const plan = planOf(data, month)
  const txs = txOfMonth(data, month)
  const actualByCat = new Map<string, number>()
  for (const t of txs) actualByCat.set(t.categoryId, (actualByCat.get(t.categoryId) ?? 0) + t.amount)

  const groups: GroupRow[] = GROUPS.map((group) => {
    const categories: CategoryRow[] = data.categories
      .filter((c) => c.group === group)
      .map((category) => {
        const planned = plannedAmount(data, month, category.id)
        const actual = actualByCat.get(category.id) ?? 0
        return { category, planned, actual, diff: planned - actual, memo: plan.budgets[category.id]?.memo }
      })
      // 보관(archived)된 항목은 이번 달에 계획/지출이 있을 때만 표시
      .filter((r) => !r.category.archived || r.planned !== 0 || r.actual !== 0)
    const planned = sum(categories.map((c) => c.planned))
    const actual = sum(categories.map((c) => c.actual))
    return { group, planned, actual, diff: planned - actual, categories }
  })

  const incomePlanned = sum(plan.incomePlan.map((i) => i.amount))
  const incomeActual = sum(incomesOfMonth(data, month).map((i) => i.amount))
  const expensePlanned = sum(groups.map((g) => g.planned))
  const expenseActual = sum(groups.map((g) => g.actual))
  const remainingFixed = sum(
    groups
      .filter((g) => g.group === '고정비' || g.group === '저축')
      .flatMap((g) => g.categories)
      .map((c) => Math.max(0, c.diff)),
  )
  const net = incomeActual - expenseActual
  return {
    incomePlanned,
    incomeActual,
    expensePlanned,
    expenseActual,
    planGap: incomePlanned - expensePlanned,
    net,
    remainingFixed,
    projected: net - remainingFixed,
    groups,
  }
}

/** 전월 잔액(실수입 − 실지출). 전월 기록이 전혀 없으면 null */
export function carryoverFor(data: BudgetData, month: string): number | null {
  const prev = addMonths(month, -1)
  const hasData = txOfMonth(data, prev).length > 0 || incomesOfMonth(data, prev).length > 0
  if (!hasData) return null
  const s = monthSummary(data, prev)
  return s.net
}

export interface TitheResult {
  base: number
  amount: number
}

/** 십일조 = 대상 수입 합계 × 비율(원 단위 반올림) + 고정 추가액 */
export function titheFor(data: BudgetData, month: string): TitheResult {
  const { rate, sources, extra } = data.settings.tithe
  const set = new Set(sources)
  const base = sum(incomesOfMonth(data, month).filter((i) => set.has(i.source)).map((i) => i.amount))
  return { base, amount: Math.round(base * rate) + extra }
}

export interface Matrix {
  rows: string[]
  cols: string[]
  cells: Record<string, Record<string, number>>
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
  total: number
}

function matrix(entries: { row: string; col: string; amount: number }[], rows: string[], cols: string[]): Matrix {
  const cells: Matrix['cells'] = {}
  const rowTotals: Record<string, number> = {}
  const colTotals: Record<string, number> = {}
  let total = 0
  for (const { row, col, amount } of entries) {
    cells[row] ??= {}
    cells[row][col] = (cells[row][col] ?? 0) + amount
    rowTotals[row] = (rowTotals[row] ?? 0) + amount
    colTotals[col] = (colTotals[col] ?? 0) + amount
    total += amount
  }
  return {
    rows: rows.filter((r) => rowTotals[r] !== undefined),
    cols: cols.filter((c) => colTotals[c] !== undefined),
    cells,
    rowTotals,
    colTotals,
    total,
  }
}

/** 엑셀 '지출 합계' 피벗: 그룹 × 주차 */
export function weekGroupMatrix(data: BudgetData, month: string): Matrix {
  const cats = categoryMap(data)
  const entries = txOfMonth(data, month).map((t) => ({
    row: cats.get(t.categoryId)?.group ?? '미분류',
    col: `${weekOfMonth(t.date)}주차`,
    amount: t.amount,
  }))
  return matrix(entries, [...GROUPS, '미분류'], ['1주차', '2주차', '3주차', '4주차', '5주차'])
}

/** 엑셀 '결제방법' 피벗: 결제수단 × 그룹 */
export function paymentGroupMatrix(data: BudgetData, month: string): Matrix {
  const cats = categoryMap(data)
  const pms = new Map(data.paymentMethods.map((p) => [p.id, p.name]))
  const entries = txOfMonth(data, month).map((t) => ({
    row: pms.get(t.paymentMethodId) ?? '미지정',
    col: cats.get(t.categoryId)?.group ?? '미분류',
    amount: t.amount,
  }))
  return matrix(entries, [...data.paymentMethods.map((p) => p.name), '미지정'], [...GROUPS, '미분류'])
}

/** 최근 n개월 월별 수입/지출 추이 */
export function monthlyTrend(data: BudgetData, month: string, n = 6) {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - n + 1)).map((m) => {
    const s = monthSummary(data, m)
    return { month: m, income: s.incomeActual, expense: s.expenseActual, net: s.net }
  })
}
