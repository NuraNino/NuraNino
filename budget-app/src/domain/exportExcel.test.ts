import { describe, expect, it } from 'vitest'
import writeXlsxFile from 'write-excel-file/node'
import readXlsxFile, { readSheetNames } from 'read-excel-file/node'
import { createDefaultData } from './defaults'
import { BACKUP_SHEET, buildBackupSheets, readBackupFromWorkbook } from './exportExcel'
import { applyImport, parseWorkbook, type Workbook } from './importExcel'
import type { BudgetData } from './types'

function sample(): BudgetData {
  const d = createDefaultData()
  const cat = (n: string) => d.categories.find((c) => c.name === n)!.id
  d.transactions = [
    { id: 't1', date: '2026-11-03', categoryId: cat('집밥'), paymentMethodId: d.paymentMethods[2].id, memo: '쿠팡 장보기 ', amount: 65220 },
    { id: 't2', date: '2026-12-01', categoryId: cat('헌금'), paymentMethodId: d.paymentMethods[1].id, memo: '십일조, 선교헌금', amount: 395907, note: '메모 "따옴표"' },
  ]
  d.incomes = [{ id: 'i1', date: '2026-11-01', source: '월급', amount: 3178867 }]
  d.plans['2026-11'] = {
    budgets: { [cat('집밥')]: { amount: 300000, memo: '장보기' } },
    incomePlan: [{ id: 'p1', kind: '월급', source: '월급', amount: 3178867 }],
    offering: { extraBase: { m2: [{ id: 'x', label: '세종 수금', amount: 580200 }] }, others: [{ id: 'o', label: '선교헌금', amount: 20000 }] },
  }
  d.recurring = [{ id: 'r1', kind: 'expense', name: '관리비', amount: 343690, day: 19, months: [], categoryId: cat('관리비'), paymentMethodId: d.paymentMethods[1].id, active: true }]
  d.installments = [{ id: 'n1', name: '유모차', principal: 1000000, months: 6, startMonth: '2026-10', day: 15, categoryId: cat('생활용품'), paymentMethodId: d.paymentMethods[2].id }]
  // 큰 데이터(여러 조각으로 나뉘는지 확인)
  for (let i = 0; i < 400; i++) {
    d.transactions.push({ id: `bulk${i}`, date: '2026-10-05', categoryId: cat('외식'), paymentMethodId: d.paymentMethods[0].id, memo: `외식 ${i} — 공백 끝 `, amount: 1000 + i })
  }
  return d
}

async function roundTrip(d: BudgetData): Promise<Workbook> {
  const sheets = buildBackupSheets(d, new Date('2026-11-25T00:00:00Z'))
  const buf = await writeXlsxFile(sheets as never, {}).toBuffer()
  const wb: Workbook = {}
  for (const name of await readSheetNames(buf)) wb[name] = (await readXlsxFile(buf, { sheet: name })) as Workbook[string]
  return wb
}

describe('엑셀 백업', () => {
  it('엑셀로 썼다가 읽으면 데이터가 그대로 복원됨', async () => {
    const d = sample()
    const wb = await roundTrip(d)
    expect(Object.keys(wb)).toEqual(['안내', '월별 요약', '지출', '수입', '예산', '수입 계획', '반복 항목', '할부', '분류', BACKUP_SHEET])
    expect(wb[BACKUP_SHEET].length).toBeGreaterThan(2) // 여러 조각
    expect(readBackupFromWorkbook(wb)).toEqual(d)
  })

  it('보기용 시트: 지출 표는 날짜·금액이 엑셀 값으로, 기존 엑셀 가져오기로도 읽힘', async () => {
    const d = sample()
    const wb = await roundTrip(d)
    const header = wb['지출'][0]
    expect(header).toEqual(['주차', '날짜', '큰 항목', '작은 항목', '결제방법', '내용', '금액', '비고'])
    const first = wb['지출'][1]
    expect(first[1]).toBeInstanceOf(Date)
    expect(first[6]).toBe(1000)
    const parsed = parseWorkbook(wb)
    expect(parsed.transactions).toHaveLength(d.transactions.length)
    const restored = applyImport(createDefaultData(), parsed, { replaceMonth: true }).data
    expect(restored.transactions.find((t) => t.memo === '십일조, 선교헌금')?.amount).toBe(395907)
  })

  it('백업 파일이 아니면 null', () => {
    expect(readBackupFromWorkbook({ 시트1: [['a']] })).toBeNull()
  })
})
