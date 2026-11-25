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
  /** 할부에서 만들어진 항목일 때 회차 정보 (저장하지 않고 계산해서 붙임) */
  installment?: { no: number; total: number }
}

/** 할부: 원금(+수수료)을 개월 수로 나눠 매달 지출로 등록 */
export interface Installment {
  id: string
  name: string // 예: 노트북
  principal: number // 할부 원금
  months: number // 할부 기간(개월)
  startMonth: string // 첫 청구월 'YYYY-MM'
  day: number // 매월 결제일
  fee?: number // 할부 수수료 총액 (선택)
  categoryId: string
  paymentMethodId: string
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
  /** 이 달의 헌금 계산 */
  offering?: {
    /** 사람별로 직접 더하는 십일조 대상 수입 (실 수입에 없는 수금액 등) */
    extraBase: Record<string, AmountLine[]>
    /** 기타 헌금. 없으면 설정의 기본 목록을 사용 */
    others?: AmountLine[]
  }
}

/** 십일조를 따로 계산하는 사람 (예: 남편, 아내) */
export interface TitheMember {
  id: string
  name: string
  sources: string[] // 이 사람의 십일조 대상 수입 내용(source) 이름
}

/** 금액 한 줄 (기타 헌금, 직접 넣는 대상 수입 등) */
export interface AmountLine {
  id: string
  label: string
  amount: number
}

export interface TitheSettings {
  enabled: boolean
  rate: number // 0.1 = 10%
  sources: string[] // (이전 버전) 십일조 대상 수입 — members가 없을 때 첫 사람의 대상으로 사용
  extra: number // (이전 버전) 선교헌금 등 고정 추가액 — defaultOfferings가 없을 때 기타 헌금 기본값으로 사용
  categoryId?: string // 헌금 카테고리 (총 헌금이 들어가는 예산 항목)
  members?: TitheMember[]
  /** 달마다 기본으로 채워지는 기타 헌금 (감사헌금, 선교헌금 …) */
  defaultOfferings?: AmountLine[]
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
  installments?: Installment[]
  recurringSkips?: Record<string, string[]> // 'YYYY-MM' → 이번 달 건너뛴 반복 항목 id
}
