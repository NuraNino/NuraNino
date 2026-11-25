import { describe, expect, it } from 'vitest'
import { createDefaultData } from './defaults'
import { monthSummary } from './calc'
import { registerDue, setSkipped } from './recurring'
import type { BudgetData } from './types'

function setup(): BudgetData {
  const d = createDefaultData()
  d.settings.tithe.enabled = false
  const cat = (n: string) => d.categories.find((c) => c.name === n)!.id
  const pm = d.paymentMethods[1].id
  d.plans['2026-11'] = {
    budgets: { [cat('관리비')]: { amount: 360000 }, [cat('보험')]: { amount: 220000 }, [cat('통신')]: { amount: 42900 }, [cat('적금')]: { amount: 600000 } },
    incomePlan: [],
  }
  d.recurring = [
    { id: 'apt', kind: 'expense', name: '관리비', amount: 350000, day: 19, months: [], categoryId: cat('관리비'), paymentMethodId: pm, active: true },
    { id: 'i1', kind: 'expense', name: '실손', amount: 120000, day: 5, months: [], categoryId: cat('보험'), paymentMethodId: pm, active: true },
    { id: 'i2', kind: 'expense', name: '어린이', amount: 81070, day: 10, months: [], categoryId: cat('보험'), paymentMethodId: pm, active: true },
  ]
  return d
}
const rem = (d: BudgetData, name: string) =>
  monthSummary(d, '2026-11').groups.flatMap((g) => g.categories).find((c) => c.category.name === name)!

describe('예상 월말 잔액: 남은 고정비·저축', () => {
  it('반복 항목이 있으면 아직 등록 안 된 반복 항목 금액만', () => {
    const d = setup()
    expect(rem(d, '관리비')).toMatchObject({ remaining: 350000 })
    expect(rem(d, '보험')).toMatchObject({ remaining: 120000 + 81070 })
  })

  it('반복 항목이 모두 등록·건너뛰면 예산보다 적게 나가도 완료 (차액을 빼지 않음)', () => {
    let d = setup()
    d = registerDue(d, '2026-11', ['apt'], { apt: 343690 }) // 예산 360,000보다 적게
    expect(rem(d, '관리비')).toMatchObject({ remaining: 0, done: 'auto', diff: 360000 - 343690 })
    d = registerDue(d, '2026-11', ['i1'])
    expect(rem(d, '보험')).toMatchObject({ remaining: 81070 }) // 하나 남음
    d = setSkipped(d, '2026-11', 'i2', true)
    expect(rem(d, '보험')).toMatchObject({ remaining: 0, done: 'auto' })
  })

  it('반복 항목이 없으면 예산 − 실지출, 직접 완료 표시하면 0', () => {
    const d = setup()
    expect(rem(d, '통신')).toMatchObject({ remaining: 42900 })
    d.plans['2026-11'].done = [d.categories.find((c) => c.name === '통신')!.id]
    expect(rem(d, '통신')).toMatchObject({ remaining: 0, done: 'manual' })
    const s = monthSummary(d, '2026-11')
    expect(s.remainingFixed).toBe(350000 + 201070 + 0 + 600000)
  })
})

describe('직접 입력한 같은 지출', () => {
  it('같은 분류·같은 내용의 지출이 이미 있으면 반복 항목도 등록된 것으로 봄', () => {
    const d = setup()
    const cat = d.categories.find((c) => c.name === '관리비')!.id
    d.transactions.push({ id: 'm', date: '2026-11-19', categoryId: cat, paymentMethodId: 'p', memo: '관리비', amount: 343690 })
    expect(rem(d, '관리비')).toMatchObject({ remaining: 0, done: 'auto' })
    // 내용이 다르면 별개로 봄
    d.transactions[0].memo = '관리비 정산'
    expect(rem(d, '관리비')).toMatchObject({ remaining: 350000 })
  })
})
