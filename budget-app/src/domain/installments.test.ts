import { describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { installmentRules, installmentStatus, monthsBetween, schedule } from './installments'
import { dueItems, recurringBudget, registerDue, suggestRules } from './recurring'
import type { BudgetData, Installment } from './types'

const inst: Installment = {
  id: 'i1',
  name: '유모차',
  principal: 1000000,
  months: 3,
  startMonth: '2026-11',
  day: 15,
  categoryId: '',
  paymentMethodId: 'pm',
}

describe('할부', () => {
  it('균등 분할, 나머지는 첫 회차', () => {
    expect(schedule(inst)).toEqual([333334, 333333, 333333])
    expect(schedule({ ...inst, fee: 30000 })).toEqual([343334, 343333, 343333])
    expect(monthsBetween('2026-11', '2027-02')).toBe(3)
  })

  it('회차·남은 금액', () => {
    expect(installmentStatus(inst, '2026-10')).toMatchObject({ no: null, notStarted: true, remaining: 1000000, paidCount: 0 })
    expect(installmentStatus(inst, '2026-11')).toMatchObject({ no: 1, thisMonth: 333334, paidCount: 1, remaining: 666666 })
    expect(installmentStatus(inst, '2027-01')).toMatchObject({ no: 3, paidCount: 3, remaining: 0, finished: true })
    expect(installmentStatus(inst, '2027-02')).toMatchObject({ no: null, finished: true, remaining: 0 })
  })

  it('지출 화면 반복 항목으로 나오고 등록·예산에 반영', () => {
    const base = createDefaultData()
    const cat = base.categories.find((c) => c.name === '생활용품')!.id
    const data: BudgetData = { ...base, installments: [{ ...inst, categoryId: cat }] }
    expect(installmentRules(data, '2027-02')).toHaveLength(0)
    const due = dueItems(data, '2026-12')
    expect(due.map((d) => [d.rule.name, d.rule.amount, d.date])).toEqual([['유모차 (할부 2/3)', 333333, '2026-12-15']])
    expect(recurringBudget(data, '2026-12').get(cat)).toBe(333333)
    const d2 = registerDue(data, '2026-12', [due[0].rule.id])
    expect(d2.transactions[0]).toMatchObject({ memo: '유모차 (할부 2/3)', amount: 333333, recurringId: 'inst:i1' })
    expect(dueItems(d2, '2026-12')[0].status).toBe('done')
    // 할부 지출은 반복 항목 후보로 다시 제안하지 않음
    expect(suggestRules(d2, '2026-12', ['생활비'])).toHaveLength(0)
  })
})
