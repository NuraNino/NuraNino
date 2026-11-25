import { describe, expect, it } from 'vitest'
import { addMonths, carryoverFor, monthSummary, paymentGroupMatrix, titheFor, weekGroupMatrix, weekOfMonth } from './calc'
import { createDefaultData } from './defaults'
import { applyImport, parseWorkbook, toISODate, type Workbook } from './importExcel'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

// 실제 가계부 양식을 축소한 가짜 통합문서 (개인 데이터 아님)
const workbook: Workbook = {
  '수입': [
    [null, '이번 달 수입 계획', null, null, null, '이번 달 실 수입 내역', null, null],
    [null, '월급', 'A 월급', 3000000, null, '날짜', '내용', '금액'],
    [null, '월급 외 고정수입', '이자수입', 100000, null, d('2026-11-01'), 'A 월급', 3000000],
    [null, '이월금', null, -50000, null, d('2026-11-01'), '이월금', -50000],
    [null, '합계', null, 3050000, null, d('2026-11-19'), 'B 이자', 120130],
    [null, null, null, null, null, '합계', null, 3070130],
  ],
  '지출계획': [
    [null, '이번 달 예비비 계획', null, null, null],
    [null, '큰 항목', '작은 항목', '금액', '합계'],
    [null, '경조사', '부모님 결혼기념일', 100000, 100000],
    [null, '합계', null, null, 100000],
    [],
    [null, '이번 달 고정비&저축 계획'],
    [null, '큰 항목', '작은 항목', '금액', '합계'],
    [null, '관리비', '아파트관리비', 360000, 360000],
    [null, '적금', '키위예금', 600000, 600000],
    [null, '합계'],
    [null, '이번 달 생활비 계획'],
    [null, '항목', '금액', '합계'],
    [null, '집밥', 300000, 300000],
    [null, '외식', null, null],
    [null, '합계'],
  ],
  '지출': [
    ['주차', '날짜', '큰 항목', '작은 항목', '결제방법', '내용', '금액', '비고'],
    ['1주차', d('2026-11-01'), '고정비', '헌금', '계좌이체', '십일조', 395906.7, null],
    ['1주차', d('2026-11-04'), '생활비', '집밥', '국민카드', '쿠팡 장보기', 28690, null],
    ['2주차', d('2026-11-08'), '예비비', '경조사', '신한카드', '결혼기념일', 100000, '메모'],
    ['3주차', d('2026-11-19'), '고정비', '관리비', '계좌이체', '아파트 관리비', 343690, null],
    ['3주차', d('2026-11-19'), '없는그룹', '뭔가', '현금', 'x', 1, null],
    [null, null, null, null, null, null, null, null],
  ],
  '지출 목록': [
    [null, '큰 항목', null, '생활비', '고정비', '예비비', '저축', null, '결제방법'],
    [null, '생활비', null, '집밥', '용돈', '선물', '적금', null, '현금'],
    [null, '고정비', null, '반려동물', '헌금', null, '예금', null, '계좌이체'],
  ],
}

describe('calc', () => {
  it('주차는 1–7일 단위', () => {
    expect(weekOfMonth('2026-11-01')).toBe(1)
    expect(weekOfMonth('2026-11-07')).toBe(1)
    expect(weekOfMonth('2026-11-08')).toBe(2)
    expect(weekOfMonth('2026-11-29')).toBe(5)
  })
  it('월 이동', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })
  it('엑셀 날짜 변환', () => {
    expect(toISODate(d('2026-11-03'))).toBe('2026-11-03')
    expect(toISODate(46327)).toBe('2026-11-01')
    expect(toISODate('2026.11.5')).toBe('2026-11-05')
    expect(toISODate('합계')).toBeNull()
  })
})

describe('엑셀 가져오기', () => {
  const parsed = parseWorkbook(workbook)
  const { data, stats } = applyImport(createDefaultData(), parsed, { replaceMonth: true })

  it('표를 머리글로 찾는다', () => {
    expect(parsed.month).toBe('2026-11')
    expect(parsed.transactions).toHaveLength(4)
    expect(parsed.warnings.some((w) => w.includes('없는그룹'))).toBe(true)
    expect(parsed.incomes).toHaveLength(3)
    expect(parsed.incomePlan.map((p) => p.source)).toEqual(['A 월급', '이자수입', '이월금'])
    expect(parsed.budgets.map((b) => [b.group, b.category, b.amount])).toEqual([
      ['예비비', '경조사', 100000],
      ['고정비', '관리비', 360000],
      ['저축', '적금', 600000],
      ['생활비', '집밥', 300000],
      ['생활비', '외식', 0],
    ])
  })

  it('금액은 원 단위로 반올림, 새 분류·결제수단은 추가', () => {
    expect(data.transactions.find((t) => t.memo === '십일조')?.amount).toBe(395907)
    expect(data.categories.some((c) => c.group === '생활비' && c.name === '반려동물')).toBe(true)
    expect(data.paymentMethods.some((p) => p.name === '신한카드')).toBe(true)
    expect(stats.newPaymentMethods).toBe(1)
  })

  it('요약 계산', () => {
    const s = monthSummary(data, '2026-11')
    expect(s.incomePlanned).toBe(3050000)
    expect(s.incomeActual).toBe(3070130)
    // 헌금 예산은 헌금 계산(월급 3,000,000 × 10%)으로 자동
    expect(s.expensePlanned).toBe(100000 + 360000 + 600000 + 300000 + 300000)
    expect(s.expenseActual).toBe(395907 + 28690 + 100000 + 343690)
    expect(s.planGap).toBe(3050000 - 1660000)
    // 남은 고정비·저축: 관리비 16,310 + 적금 600,000 (헌금은 예산 0이라 음수 → 0)
    expect(s.remainingFixed).toBe(16310 + 600000)
    expect(s.projected).toBe(s.net - s.remainingFixed)
  })

  it('십일조 = 월급 × 10% (+추가액)', () => {
    expect(data.settings.tithe.sources).toEqual(['A 월급'])
    expect(titheFor(data, '2026-11').amount).toBe(300000)
    const withExtra = { ...data, settings: { tithe: { ...data.settings.tithe, extra: 20000 } } }
    expect(titheFor(withExtra, '2026-11').amount).toBe(320000)
  })

  it('이월금은 전월 실수입 − 실지출', () => {
    expect(carryoverFor(data, '2026-11')).toBeNull()
    expect(carryoverFor(data, '2026-12')).toBe(3070130 - (395907 + 28690 + 100000 + 343690))
  })

  it('피벗', () => {
    const w = weekGroupMatrix(data, '2026-11')
    expect(w.cols).toEqual(['1주차', '2주차', '3주차'])
    expect(w.cells['고정비']['3주차']).toBe(343690)
    const p = paymentGroupMatrix(data, '2026-11')
    expect(p.rowTotals['계좌이체']).toBe(395907 + 343690)
  })

  it('다시 가져오면 해당 월을 교체 (중복 없음)', () => {
    const again = applyImport(data, parseWorkbook(workbook, data), { replaceMonth: true }).data
    expect(again.transactions).toHaveLength(4)
    expect(again.incomes).toHaveLength(3)
    const appended = applyImport(data, parseWorkbook(workbook, data), { replaceMonth: false }).data
    expect(appended.transactions).toHaveLength(8)
  })
})
