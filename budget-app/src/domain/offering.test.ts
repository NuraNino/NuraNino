import { describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { offeringFor, titheMembers } from './offering'
import type { BudgetData } from './types'

const base = (): BudgetData => {
  const d = createDefaultData()
  d.incomes = [
    { id: 'i1', date: '2026-11-01', source: 'A 월급', amount: 3178867 },
    { id: 'i2', date: '2026-11-11', source: 'B 강사료', amount: 510760 },
    { id: 'i3', date: '2026-10-01', source: 'A 월급', amount: 9999999 }, // 다른 달
  ]
  return d
}

describe('헌금 계산', () => {
  it('이전 버전 설정을 그대로 이어받음 (대상 수입 → 첫 사람, 고정 추가액 → 선교헌금)', () => {
    const d = base()
    d.settings.tithe.sources = ['A 월급']
    d.settings.tithe.extra = 20000
    expect(titheMembers(d).map((m) => m.name)).toEqual(['남편', '아내'])
    const r = offeringFor(d, '2026-11')
    expect(r.members[0].tithe).toBe(317887) // 3,178,867 × 10% 반올림
    expect(r.members[1].tithe).toBe(0)
    expect(r.others).toEqual([{ id: 'o1', label: '선교헌금', amount: 20000 }])
    expect(r.othersAreDefault).toBe(true)
    expect(r.total).toBe(317887 + 20000)
  })

  it('사람별 십일조 + 직접 더한 수입 + 기타 헌금 합계', () => {
    const d = base()
    d.settings.tithe.members = [
      { id: 'h', name: '남편', sources: ['A 월급'] },
      { id: 'w', name: '아내', sources: ['B 강사료'] },
    ]
    d.plans['2026-11'] = {
      budgets: {},
      incomePlan: [],
      offering: {
        extraBase: { w: [{ id: 'x', label: '세종 수금', amount: 69440 }] },
        others: [
          { id: 'a', label: '감사헌금', amount: 30000 },
          { id: 'b', label: '선교헌금', amount: 20000 },
        ],
      },
    }
    const r = offeringFor(d, '2026-11')
    expect(r.members.map((m) => [m.member.name, m.base, m.tithe])).toEqual([
      ['남편', 3178867, 317887],
      ['아내', 510760 + 69440, 58020],
    ])
    expect(r.titheTotal).toBe(317887 + 58020)
    expect(r.othersTotal).toBe(50000)
    expect(r.othersAreDefault).toBe(false)
    expect(r.total).toBe(317887 + 58020 + 50000)
  })
})

describe('예산 금액 결정 (계산란·헌금 자동)', () => {
  it('계산란 줄이 있으면 합계가 예산, 없으면 직접 입력 금액', async () => {
    const { plannedAmount, monthSummary } = await import('./calc')
    const d = base()
    const ins = d.categories.find((c) => c.name === '보험')!.id
    const food = d.categories.find((c) => c.name === '집밥')!.id
    d.plans['2026-11'] = {
      budgets: {
        [ins]: { amount: 1, calc: [{ id: 'a', label: '건강', amount: 117077 }, { id: 'b', label: '실손', amount: 20912 }] },
        [food]: { amount: 300000 },
      },
      incomePlan: [],
    }
    expect(plannedAmount(d, '2026-11', ins)).toBe(137989)
    expect(plannedAmount(d, '2026-11', food)).toBe(300000)
    expect(monthSummary(d, '2026-11').expensePlanned).toBe(437989)
  })

  it('헌금 계산을 설정하면 헌금 예산 = 총 헌금, 실 수입이 없으면 수입 계획으로', async () => {
    const { plannedAmount } = await import('./calc')
    const d = base()
    const tithe = d.settings.tithe.categoryId!
    d.incomes = [] // 아직 월급이 안 들어옴
    d.settings.tithe.members = [{ id: 'h', name: '남편', sources: ['A 월급'] }]
    d.settings.tithe.defaultOfferings = [{ id: 'o', label: '선교헌금', amount: 20000 }]
    d.plans['2026-12'] = { budgets: { [tithe]: { amount: 999 } }, incomePlan: [{ id: 'p', kind: '월급', source: 'A 월급', amount: 3000000 }] }
    const r = offeringFor(d, '2026-12')
    expect(r.members[0].fromPlan).toEqual(['A 월급'])
    expect(plannedAmount(d, '2026-12', tithe)).toBe(300000 + 20000)
    // 헌금 계산을 끄면 직접 입력 금액
    d.settings.tithe.enabled = false
    expect(plannedAmount(d, '2026-12', tithe)).toBe(999)
  })
})
