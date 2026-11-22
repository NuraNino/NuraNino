export const GROUPS = ['생활비', '고정비', '예비비', '저축'] as const
export type Group = (typeof GROUPS)[number]

export interface Category {
  id: string
  group: Group
  name: string
  archived?: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  archived?: boolean
}

/** 지출 한 건 (엑셀 '2026년 11월 지출' 시트의 한 행) */
export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  categoryId: string
  paymentMethodId: string
  memo: string // 내용
  amount: number // 원 단위 정수
  note?: string // 비고
  recurringId?: string // 반복 항목에서 만들어진 경우
}

/** 실제 수입 한 건 (엑셀 '이번 달 실 수입 내역') */
export interface Income {
  id: string
  date: string
  source: string // 내용: 월급, 부업 수입, 이월금 …
  amount: number
  note?: string
  recurringId?: string
}

/** 반복 항목: 매달(또는 지정한 달) 같은 지출·수입을 자동으로 등록 */
export interface RecurringRule {
  id: string
  kind: 'expense' | 'income'
  name: string // 지출의 '내용' 또는 수입의 '내용(source)'
  amount: number
  day: number // 1–31 (그 달에 없는 날이면 말일)
  months: number[] // 비어 있으면 매달, 예: [6, 12] = 자동차세
  categoryId?: string // 지출
  paymentMethodId?: string // 지출
  active: boolean
}

/** 수입 계획 한 줄 (엑셀 '이번 달 수입 계획') */
export interface IncomePlanItem {
  id: string
  kind: string // 월급 / 월급 외 고정수입 / 정부지원금 / 이월금 …
  source: string
  amount: number
}

export interface BudgetLine {
  amount: number
  memo?: string // 예: "벅스+쿠팡+자동차+와이즐리"
}

export interface MonthPlan {
  budgets: Record<string, BudgetLine> // categoryId → 예산
  incomePlan: IncomePlanItem[]
  notes?: string // 피드백 메모
}

export interface TitheSettings {
  enabled: boolean
  rate: number // 0.1 = 10%
  sources: string[] // 십일조 대상 수입 내용(source) 이름
  extra: number // 선교헌금 등 고정 추가액
  categoryId?: string // 헌금 카테고리
}

export interface Settings {
  tithe: TitheSettings
}

export interface BudgetData {
  version: 1
  categories: Category[]
  paymentMethods: PaymentMethod[]
  transactions: Transaction[]
  incomes: Income[]
  plans: Record<string, MonthPlan> // 'YYYY-MM' → 계획
  settings: Settings
  recurring?: RecurringRule[]
  recurringSkips?: Record<string, string[]> // 'YYYY-MM' → 이번 달 건너뛴 반복 항목 id
}
