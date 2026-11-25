/**
 * 엑셀(.xlsx) 백업.
 *
 * 보기용 시트(월별 요약, 지출, 수입, 예산, 수입 계획, 반복 항목, 할부, 분류)와
 * 복원용 시트("_백업데이터": 전체 데이터를 JSON으로 나눠 담음)를 함께 만듭니다.
 * 복원할 때는 "_백업데이터" 시트만 읽으므로, 보기용 시트를 고쳐도 복원 결과는 바뀌지 않습니다.
 */
import { categoryMap, monthLabel, monthOf, monthSummary, plannedAmount, weekOfMonth } from './calc'
import { GROUPS, type BudgetData } from './types'
import type { Workbook } from './importExcel'

export const BACKUP_SHEET = '_백업데이터'
const BACKUP_HEADER = '메덩파카 가계부 백업 v1 (base64)'

/** 엑셀이 셀 앞뒤 공백을 지울 수 있어서 JSON을 공백 없는 base64(UTF-8)로 담음 */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function fromBase64(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
/** 엑셀 셀 하나에는 글자를 32,767자까지 넣을 수 있어서 나눠 담음 */
const CHUNK = 30000

type Cell = string | number | Date | null | { value: string | number | Date; fontWeight?: 'bold'; format?: string; type?: unknown }
export interface SheetSpec {
  sheet: string
  data: Cell[][]
  columns?: { width: number }[]
  stickyRowsCount?: number
}

const head = (labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: 'bold' as const }))
const date = (iso: string): Cell => {
  const [y, m, d] = iso.split('-').map(Number)
  return { value: new Date(Date.UTC(y, m - 1, d)), format: 'yyyy-mm-dd' }
}
const money = (n: number): Cell => ({ value: n, format: '#,##0' })

export function buildBackupSheets(data: BudgetData, now = new Date()): SheetSpec[] {
  const cats = categoryMap(data)
  const pm = new Map(data.paymentMethods.map((p) => [p.id, p.name]))
  const months = [
    ...new Set([
      ...data.transactions.map((t) => monthOf(t.date)),
      ...data.incomes.map((i) => monthOf(i.date)),
      ...Object.keys(data.plans),
    ]),
  ].sort()

  const info: SheetSpec = {
    sheet: '안내',
    columns: [{ width: 90 }],
    data: [
      [{ value: '메덩파카 가계부 백업', fontWeight: 'bold' }],
      [`만든 시각: ${now.toLocaleString('ko-KR')}`],
      [`지출 ${data.transactions.length}건 · 수입 ${data.incomes.length}건 · 예산 ${Object.keys(data.plans).length}개월`],
      [''],
      ['복원: 앱 → 설정 → 백업 · 다른 기기로 옮기기 → "백업 파일로 복원"에서 이 파일을 고르세요.'],
      [`복원에는 "${BACKUP_SHEET}" 시트만 쓰입니다. 그 시트는 지우거나 고치지 마세요.`],
      ['다른 시트는 보기용입니다. 고쳐도 복원 결과는 바뀌지 않습니다.'],
    ],
  }

  const summary: SheetSpec = {
    sheet: '월별 요약',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, ...Array(6).fill({ width: 14 })],
    data: [
      head(['월', '실 수입', '실 지출', '실수입-실지출', '수입 계획', '지출 계획', '계획 차이']),
      ...months.map((m) => {
        const s = monthSummary(data, m)
        return [monthLabel(m), money(s.incomeActual), money(s.expenseActual), money(s.net), money(s.incomePlanned), money(s.expensePlanned), money(s.planGap)]
      }),
    ],
  }

  // 원래 엑셀 가계부의 지출 표와 같은 머리글 → 앱의 "엑셀 가져오기"로도 읽힘
  const txs = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))
  const tx: SheetSpec = {
    sheet: '지출',
    stickyRowsCount: 1,
    columns: [{ width: 7 }, { width: 12 }, { width: 9 }, { width: 11 }, { width: 11 }, { width: 28 }, { width: 13 }, { width: 18 }],
    data: [
      head(['주차', '날짜', '큰 항목', '작은 항목', '결제방법', '내용', '금액', '비고']),
      ...txs.map((t) => {
        const c = cats.get(t.categoryId)
        return [`${weekOfMonth(t.date)}주차`, date(t.date), c?.group ?? '', c?.name ?? '', pm.get(t.paymentMethodId) ?? '', t.memo, money(t.amount), t.note ?? '']
      }),
    ],
  }

  const inc: SheetSpec = {
    sheet: '수입',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, { width: 24 }, { width: 14 }, { width: 18 }],
    data: [
      head(['날짜', '내용', '금액', '비고']),
      ...[...data.incomes].sort((a, b) => a.date.localeCompare(b.date)).map((i) => [date(i.date), i.source, money(i.amount), i.note ?? '']),
    ],
  }

  const budgetRows: Cell[][] = []
  const planRows: Cell[][] = []
  for (const m of Object.keys(data.plans).sort()) {
    const p = data.plans[m]
    for (const g of GROUPS) {
      for (const c of data.categories.filter((x) => x.group === g)) {
        const b = p.budgets[c.id]
        const amount = plannedAmount(data, m, c.id)
        const calc = b?.calc?.length ? b.calc.map((l) => `${l.label} ${l.amount.toLocaleString('ko-KR')}`).join(' + ') : ''
        if (amount || b?.memo || calc) budgetRows.push([monthLabel(m), g, c.name, money(amount), b?.memo ?? '', calc])
      }
    }
    for (const i of p.incomePlan) planRows.push([monthLabel(m), i.kind, i.source, money(i.amount)])
  }
  const budget: SheetSpec = {
    sheet: '예산',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, { width: 9 }, { width: 11 }, { width: 14 }, { width: 24 }, { width: 50 }],
    data: [head(['월', '큰 항목', '작은 항목', '계획 금액', '메모·세부 내용', '계산 내역']), ...budgetRows],
  }
  const incomePlan: SheetSpec = {
    sheet: '수입 계획',
    stickyRowsCount: 1,
    columns: [{ width: 12 }, { width: 16 }, { width: 20 }, { width: 14 }],
    data: [head(['월', '구분', '내용', '금액']), ...planRows],
  }

  const recurring: SheetSpec = {
    sheet: '반복 항목',
    stickyRowsCount: 1,
    columns: [{ width: 7 }, { width: 24 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 16 }, { width: 11 }, { width: 8 }],
    data: [
      head(['종류', '내용', '금액', '날짜', '반복하는 달', '분류', '결제방법', '사용']),
      ...(data.recurring ?? []).map((r) => {
        const c = r.categoryId ? cats.get(r.categoryId) : undefined
        return [
          r.kind === 'income' ? '수입' : '지출',
          r.name,
          money(r.amount),
          `${r.day}일`,
          r.months.length ? `${r.months.join('·')}월` : '매달',
          c ? `${c.group} · ${c.name}` : '',
          r.paymentMethodId ? pm.get(r.paymentMethodId) ?? '' : '',
          r.active ? '사용' : '멈춤',
        ]
      }),
    ],
  }

  const installments: SheetSpec = {
    sheet: '할부',
    stickyRowsCount: 1,
    columns: [{ width: 20 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 8 }, { width: 12 }, { width: 16 }, { width: 11 }],
    data: [
      head(['내용', '할부 원금', '기간(개월)', '첫 청구월', '결제일', '수수료', '분류', '결제수단']),
      ...(data.installments ?? []).map((x) => {
        const c = cats.get(x.categoryId)
        return [x.name, money(x.principal), x.months, monthLabel(x.startMonth), `${x.day}일`, money(x.fee ?? 0), c ? `${c.group} · ${c.name}` : '', pm.get(x.paymentMethodId) ?? '']
      }),
    ],
  }

  // 원래 엑셀의 "지출 목록" 시트와 같은 모양 (큰 항목별 열 + 결제방법 열)
  const byGroup = GROUPS.map((g) => data.categories.filter((c) => c.group === g && !c.archived).map((c) => c.name))
  const pms = data.paymentMethods.filter((p) => !p.archived).map((p) => p.name)
  const rows = Math.max(...byGroup.map((x) => x.length), pms.length)
  const categories: SheetSpec = {
    sheet: '분류',
    columns: Array(6).fill({ width: 12 }),
    data: [
      head([...GROUPS, '', '결제방법']),
      ...Array.from({ length: rows }, (_, i) => [...byGroup.map((x) => x[i] ?? null), null, pms[i] ?? null]),
    ],
  }

  const json = toBase64(JSON.stringify(data))
  const chunks: Cell[][] = []
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)])
  const backup: SheetSpec = {
    sheet: BACKUP_SHEET,
    columns: [{ width: 40 }],
    data: [[BACKUP_HEADER], ...chunks],
  }

  return [info, summary, tx, inc, budget, incomePlan, recurring, installments, categories, backup]
}

/** 엑셀 백업의 "_백업데이터" 시트에서 전체 데이터를 되살림. 백업 파일이 아니면 null */
export function readBackupFromWorkbook(wb: Workbook): unknown | null {
  const rows = wb[BACKUP_SHEET]
  if (!rows || String(rows[0]?.[0] ?? '').trim() !== BACKUP_HEADER) return null
  const b64 = rows
    .slice(1)
    .map((r) => (r[0] === null || r[0] === undefined ? '' : String(r[0]).trim()))
    .join('')
  return JSON.parse(fromBase64(b64))
}
