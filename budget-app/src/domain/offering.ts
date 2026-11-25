/** 헌금 계산: 사람별 십일조 + 공동 기타 헌금 = 헌금 예산 */
import { incomesOfMonth, planOf, sum } from './calc'
import type { AmountLine, BudgetData, TitheMember } from './types'

/** 설정의 십일조 대상자 (이전 버전 설정이면 '남편'(기존 대상 수입) + '아내'로 시작) */
export function titheMembers(data: BudgetData): TitheMember[] {
  const t = data.settings.tithe
  return (
    t.members ?? [
      { id: 'm1', name: '남편', sources: t.sources },
      { id: 'm2', name: '아내', sources: [] },
    ]
  )
}

/** 설정의 기본 기타 헌금 (이전 버전의 '고정 추가액'은 선교헌금으로 옮김) */
export function defaultOfferings(data: BudgetData): AmountLine[] {
  const t = data.settings.tithe
  return t.defaultOfferings ?? (t.extra ? [{ id: 'o1', label: '선교헌금', amount: t.extra }] : [])
}

export interface MemberTithe {
  member: TitheMember
  /** 대상 수입 합계 (실 수입, 아직 없으면 수입 계획) */
  incomeBase: number
  /** 대상 수입 중 수입 계획 금액으로 대신한 항목 */
  fromPlan: string[]
  /** 직접 더한 대상 수입 */
  extraLines: AmountLine[]
  base: number
  tithe: number
}

export interface OfferingResult {
  rate: number
  members: MemberTithe[]
  titheTotal: number
  others: AmountLine[]
  /** 기타 헌금이 이 달 값이 아니라 설정의 기본값인지 */
  othersAreDefault: boolean
  othersTotal: number
  total: number
}

export function offeringFor(data: BudgetData, month: string): OfferingResult {
  const rate = data.settings.tithe.rate
  const plan = planOf(data, month)
  const incomes = incomesOfMonth(data, month)
  const members = titheMembers(data).map((member) => {
    // 엑셀처럼 이번 달 실제 수입이 아직 없으면 수입 계획 금액으로 계산 (월초에도 예산이 잡히도록)
    const fromPlan: string[] = []
    const incomeBase = sum(
      member.sources.map((src) => {
        const actual = sum(incomes.filter((i) => i.source === src).map((i) => i.amount))
        if (actual) return actual
        const planned = sum(plan.incomePlan.filter((p) => p.source === src).map((p) => p.amount))
        if (planned) fromPlan.push(src)
        return planned
      }),
    )
    const extraLines = plan.offering?.extraBase[member.id] ?? []
    const base = incomeBase + sum(extraLines.map((l) => l.amount))
    return { member, incomeBase, fromPlan, extraLines, base, tithe: Math.round(base * rate) }
  })
  const othersAreDefault = plan.offering?.others === undefined
  const others = plan.offering?.others ?? defaultOfferings(data)
  const titheTotal = sum(members.map((m) => m.tithe))
  const othersTotal = sum(others.map((o) => o.amount))
  return { rate, members, titheTotal, others, othersAreDefault, othersTotal, total: titheTotal + othersTotal }
}
