import { describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { dueDate, dueItems, lastDayOf, recurringBudget, registerDue, setSkipped, suggestRules } from './recurring'
import type { BudgetData, RecurringRule } from './types'

function setup(): { data: BudgetData; rules: Record<string, RecurringRule> } {
  const data = createDefaultData()
  const cat = (n: string) => data.categories.find((c) => c.name === n)!.id
  const pm = data.paymentMethods[1].id
  const rules: Record<string, RecurringRule> = {
    관리비: { id: 'r1', kind: 'expense', name: '아파트 관리비', amount: 360000, day: 19, months: [], categoryId: cat('관리비'), paymentMethodId: pm, active: true },
    자동차세: { id: 'r2', kind: 'expense', name: '자동차세', amount: 150000, day: 31, months: [6, 12], categoryId: cat('자동차'), paymentMethodId: pm, active: true },
    월급: { id: 'r3', kind: 'income', name: '월급', amount: 3000000, day: 25, months: [], active: true },
    멈춤: { id: 'r4', kind: 'expense', name: '멈춘 구독', amount: 9900, day: 1, months: [], categoryId: cat('구독'), active: false },
  }
  return { data: { ...data, recurring: Object.values(rules) }, rules }
}

describe('반복 항목', () => {
  it('말일 보정', () => {
    expect(lastDayOf('2026-02')).toBe(28)
    expect(lastDayOf('2028-02')).toBe(29)
    const { rules } = setup()
    expect(dueDate(rules.자동차세, '2026-06')).toBe('2026-06-30')
    expect(dueDate(rules.자동차세, '2026-12')).toBe('2026-12-31')
  })

  it('해당 월에만, 멈춘 항목은 제외', () => {
    const { data } = setup()
    expect(dueItems(data, '2026-11').map((d) => d.rule.name)).toEqual(['아파트 관리비', '월급'])
    expect(dueItems(data, '2026-12').map((d) => d.rule.name)).toEqual(['아파트 관리비', '월급', '자동차세'])
  })

  it('등록하면 지출·수입이 생기고 다시 등록해도 중복되지 않음', () => {
    const { data } = setup()
    let d = registerDue(data, '2026-11', ['r1', 'r3'], { r1: 343690 })
    expect(d.transactions).toHaveLength(1)
    expect(d.transactions[0]).toMatchObject({ date: '2026-11-19', amount: 343690, memo: '아파트 관리비', recurringId: 'r1' })
    expect(d.incomes[0]).toMatchObject({ date: '2026-11-25', amount: 3000000, source: '월급' })
    expect(dueItems(d, '2026-11').every((i) => i.status === 'done')).toBe(true)
    d = registerDue(d, '2026-11', ['r1', 'r3'])
    expect(d.transactions).toHaveLength(1)
    expect(d.incomes).toHaveLength(1)
  })

  it('건너뛰기와 되돌리기', () => {
    const { data } = setup()
    let d = setSkipped(data, '2026-11', 'r1', true)
    expect(dueItems(d, '2026-11').find((i) => i.rule.id === 'r1')?.status).toBe('skipped')
    expect(dueItems(d, '2026-12').find((i) => i.rule.id === 'r1')?.status).toBe('pending')
    d = setSkipped(d, '2026-11', 'r1', false)
    expect(dueItems(d, '2026-11').find((i) => i.rule.id === 'r1')?.status).toBe('pending')
  })

  it('예산 채우기용 합계', () => {
    const { data, rules } = setup()
    expect([...recurringBudget(data, '2026-11')]).toEqual([[rules.관리비.categoryId, 360000]])
    expect(recurringBudget(data, '2026-06').get(rules.자동차세.categoryId!)).toBe(150000)
  })

  it('지난달 고정비에서 후보 만들기 (이미 있는 항목 제외)', () => {
    const { data, rules } = setup()
    const cat = (n: string) => data.categories.find((c) => c.name === n)!.id
    const withTx: BudgetData = {
      ...data,
      transactions: [
        { id: 't1', date: '2026-10-19', categoryId: rules.관리비.categoryId!, paymentMethodId: 'p', memo: '아파트 관리비', amount: 350000 },
        { id: 't2', date: '2026-10-06', categoryId: cat('구독'), paymentMethodId: 'p', memo: '벅스 구독', amount: 9790 },
        { id: 't3', date: '2026-10-07', categoryId: cat('구독'), paymentMethodId: 'p', memo: '벅스 구독', amount: 9790 },
        { id: 't4', date: '2026-10-08', categoryId: cat('외식'), paymentMethodId: 'p', memo: '커피', amount: 6600 },
      ],
    }
    const s = suggestRules(withTx, '2026-10')
    expect(s.map((r) => [r.name, r.amount, r.day])).toEqual([['벅스 구독', 9790, 6]])
  })
})
