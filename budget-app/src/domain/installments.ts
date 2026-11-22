import type { BudgetData, Installment, RecurringRule } from './types'

export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number)
  const [y2, m2] = to.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

/** 회차별 납부액: (원금 + 수수료)를 균등 분할, 원 단위 나머지는 첫 회차에 */
export function schedule(inst: Pick<Installment, 'principal' | 'months' | 'fee'>): number[] {
  const n = Math.max(1, Math.round(inst.months))
  const total = Math.round(inst.principal + (inst.fee ?? 0))
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => (i === 0 ? total - base * (n - 1) : base))
}

export interface InstallmentStatus {
  /** 이번 달 회차 (1부터). 이번 달에 청구가 없으면 null */
  no: number | null
  total: number
  thisMonth: number
  /** 이번 달까지 청구된 회차 수 */
  paidCount: number
  /** 이번 달 청구 이후 남은 금액 */
  remaining: number
  finished: boolean
  notStarted: boolean
}

export function installmentStatus(inst: Installment, month: string): InstallmentStatus {
  const s = schedule(inst)
  const idx = monthsBetween(inst.startMonth, month) // 0이면 1회차
  const paidCount = Math.min(s.length, Math.max(0, idx + 1))
  return {
    no: idx >= 0 && idx < s.length ? idx + 1 : null,
    total: s.length,
    thisMonth: idx >= 0 && idx < s.length ? s[idx] : 0,
    paidCount,
    remaining: s.slice(paidCount).reduce((a, b) => a + b, 0),
    finished: idx >= s.length - 1,
    notStarted: idx < 0,
  }
}

export const installmentRuleId = (id: string) => `inst:${id}`

/** 이번 달 청구되는 할부를 반복 항목 형태로 (지출 화면 등록·예산 채우기에 사용) */
export function installmentRules(data: BudgetData, month: string): RecurringRule[] {
  const out: RecurringRule[] = []
  for (const inst of data.installments ?? []) {
    const st = installmentStatus(inst, month)
    if (st.no === null) continue
    out.push({
      id: installmentRuleId(inst.id),
      kind: 'expense',
      name: `${inst.name} (할부 ${st.no}/${st.total})`,
      amount: st.thisMonth,
      day: inst.day,
      months: [],
      categoryId: inst.categoryId,
      paymentMethodId: inst.paymentMethodId,
      active: true,
      installment: { no: st.no, total: st.total },
    })
  }
  return out
}
