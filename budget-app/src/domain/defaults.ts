import type { BudgetData, Category, Group, PaymentMethod } from './types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** 엑셀 '지출 목록' 시트의 분류 체계 */
export const DEFAULT_CATEGORIES: Record<Group, string[]> = {
  생활비: ['집밥', '외식', '생활용품', '의류미용', '병원의료', '자동차', '휴식여가', '취미계발'],
  고정비: ['용돈', '헌금', '보험', '이자', '관리비', '통신', '구독', '후원금'],
  예비비: ['선물', '경조사', '친목', '여행', '기타'],
  저축: ['적금', '예금'],
}

export const DEFAULT_PAYMENT_METHODS = ['현금', '계좌이체', '국민카드', '현대카드', '기타카드', '기타결제']

export function createDefaultData(): BudgetData {
  const categories: Category[] = []
  for (const [group, names] of Object.entries(DEFAULT_CATEGORIES) as [Group, string[]][]) {
    for (const name of names) categories.push({ id: uid(), group, name })
  }
  const paymentMethods: PaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((name) => ({ id: uid(), name }))
  const titheCat = categories.find((c) => c.name === '헌금')
  return {
    version: 1,
    categories,
    paymentMethods,
    transactions: [],
    incomes: [],
    plans: {},
    settings: {
      tithe: { enabled: true, rate: 0.1, sources: [], extra: 0, categoryId: titheCat?.id },
    },
  }
}
