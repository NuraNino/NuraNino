/**
 * 기존 엑셀 가계부(.xlsx) 가져오기.
 *
 * 시트 이름에 의존하지 않고, 머리글(헤더) 텍스트로 각 표를 찾습니다.
 *  - 지출 내역: '날짜', '큰 항목', '작은 항목', '금액' 머리글이 있는 행
 *  - 실 수입 내역: '날짜', '내용', '금액' 머리글(큰 항목 없음)
 *  - 수입 계획: '이번 달 수입 계획' 제목 아래 (구분, 내용, 금액)
 *  - 지출 계획: '이번 달 … 계획' 제목 아래 (큰 항목/작은 항목/금액 또는 항목/금액)
 *  - 분류 목록: 생활비·고정비·예비비·저축 열 머리글이 있는 행 (+ '결제방법' 열)
 */
import { uid } from './defaults'
import { monthOf } from './calc'
import { GROUPS, type BudgetData, type BudgetLine, type Group, type MonthPlan } from './types'

export type Cell = string | number | boolean | Date | null | undefined
export type SheetRows = Cell[][]
export type Workbook = Record<string, SheetRows>

export interface ParsedTx {
  date: string
  group: Group
  category: string
  payment: string
  memo: string
  amount: number
  note?: string
}

export interface ParsedWorkbook {
  month: string | null
  master: { categories: { group: Group; name: string }[]; paymentMethods: string[] }
  transactions: ParsedTx[]
  incomes: { date: string; source: string; amount: number }[]
  incomePlan: { kind: string; source: string; amount: number }[]
  budgets: { group: Group | null; category: string; amount: number; memo?: string }[]
  warnings: string[]
}

const text = (v: Cell): string => (v === null || v === undefined ? '' : String(v).trim())
const isGroup = (v: string): v is Group => (GROUPS as readonly string[]).includes(v)

function toNumber(v: Cell): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,원\s]/g, ''))
    return v.trim() !== '' && Number.isFinite(n) ? n : null
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // 엑셀 날짜 일련번호
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    return toISODate(d)
  }
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/)
    if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  }
  return null
}

/** labels를 모두 포함하는 첫 행을 찾아 각 라벨의 열 위치를 돌려줍니다. */
function findHeaderRows(rows: SheetRows, labels: string[], exclude: string[] = []) {
  const found: { r: number; col: Record<string, number> }[] = []
  rows.forEach((row, r) => {
    const texts = row.map(text)
    if (exclude.some((e) => texts.includes(e))) return
    const col: Record<string, number> = {}
    for (const l of labels) {
      const i = texts.indexOf(l)
      if (i < 0) return
      col[l] = i
    }
    found.push({ r, col })
  })
  return found
}

function parseTransactions(wb: Workbook, warnings: string[]): ParsedTx[] {
  const out: ParsedTx[] = []
  for (const [sheet, rows] of Object.entries(wb)) {
    for (const h of findHeaderRows(rows, ['날짜', '큰 항목', '작은 항목', '금액'])) {
      const texts = rows[h.r].map(text)
      const payCol = texts.indexOf('결제방법')
      const memoCol = texts.indexOf('내용')
      const noteCol = texts.indexOf('비고')
      for (let r = h.r + 1; r < rows.length; r++) {
        const row = rows[r]
        const date = toISODate(row[h.col['날짜']])
        const amount = toNumber(row[h.col['금액']])
        if (!date || amount === null) continue
        const group = text(row[h.col['큰 항목']])
        const category = text(row[h.col['작은 항목']])
        if (!isGroup(group) || !category) {
          warnings.push(`[${sheet}] ${r + 1}행: 큰 항목/작은 항목을 알 수 없어 건너뜀 (${group || '빈칸'} / ${category || '빈칸'})`)
          continue
        }
        out.push({
          date,
          group,
          category,
          payment: payCol >= 0 ? text(row[payCol]) : '',
          memo: memoCol >= 0 ? text(row[memoCol]) : '',
          amount: Math.round(amount),
          note: noteCol >= 0 ? text(row[noteCol]) || undefined : undefined,
        })
      }
    }
  }
  return out
}

function parseIncomes(wb: Workbook) {
  const out: ParsedWorkbook['incomes'] = []
  for (const rows of Object.values(wb)) {
    for (const h of findHeaderRows(rows, ['날짜', '내용', '금액'], ['큰 항목', '작은 항목'])) {
      for (let r = h.r + 1; r < rows.length; r++) {
        const row = rows[r]
        const date = toISODate(row[h.col['날짜']])
        const amount = toNumber(row[h.col['금액']])
        const source = text(row[h.col['내용']])
        if (!date || amount === null || !source) continue
        out.push({ date, source, amount: Math.round(amount) })
      }
    }
  }
  return out
}

function findCells(rows: SheetRows, pred: (t: string) => boolean) {
  const out: { r: number; c: number; t: string }[] = []
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      const t = text(v)
      if (t && pred(t)) out.push({ r, c, t })
    }),
  )
  return out
}

function parseIncomePlan(wb: Workbook) {
  const out: ParsedWorkbook['incomePlan'] = []
  for (const rows of Object.values(wb)) {
    for (const { r, c } of findCells(rows, (t) => t.replace(/\s/g, '') === '이번달수입계획')) {
      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i] ?? []
        const kind = text(row[c])
        if (kind === '합계') break
        const amount = toNumber(row[c + 2])
        if (!kind && amount === null) break
        if (amount === null) continue
        out.push({ kind, source: text(row[c + 1]) || kind, amount: Math.round(amount) })
      }
    }
  }
  return out
}

function parseBudgets(wb: Workbook, groupOf: (name: string) => Group | null) {
  const out: ParsedWorkbook['budgets'] = []
  for (const rows of Object.values(wb)) {
    const titles = findCells(rows, (t) => /^이번\s*달.*계획$/.test(t) && !t.includes('수입'))
    for (const { r, c, t } of titles) {
      const blockGroup = (['예비비', '생활비', '고정비'] as const).find((g) => t.includes(g)) ?? null
      const header = (rows[r + 1] ?? []).map(text)
      const after = (label: string) => {
        const i = header.indexOf(label, c)
        return i >= c && i <= c + 4 ? i : -1
      }
      let nameCol = after('큰 항목')
      const memoCol = nameCol >= 0 ? after('작은 항목') : -1
      if (nameCol < 0) nameCol = after('항목')
      const amountCol = after('금액')
      if (nameCol < 0 || amountCol < 0) continue
      for (let i = r + 2; i < rows.length; i++) {
        const row = rows[i] ?? []
        const name = text(row[nameCol])
        if (!name || name === '합계') break
        const amount = toNumber(row[amountCol]) ?? 0
        const memo = memoCol >= 0 ? text(row[memoCol]) || undefined : undefined
        out.push({ group: groupOf(name) ?? blockGroup, category: name, amount: Math.round(amount), memo })
      }
    }
  }
  return out
}

function parseMaster(wb: Workbook): ParsedWorkbook['master'] {
  const categories: { group: Group; name: string }[] = []
  const paymentMethods: string[] = []
  for (const rows of Object.values(wb)) {
    rows.forEach((row, r) => {
      const texts = row.map(text)
      const groupCols = GROUPS.map((g) => [g, texts.indexOf(g)] as const).filter(([, i]) => i >= 0)
      if (groupCols.length < 3) return
      const read = (col: number) => {
        const vals: string[] = []
        for (let i = r + 1; i < rows.length; i++) {
          const t = text(rows[i]?.[col])
          if (!t) break
          vals.push(t)
        }
        return vals
      }
      for (const [g, col] of groupCols) for (const name of read(col)) categories.push({ group: g, name })
      const payCol = texts.indexOf('결제방법')
      if (payCol >= 0) paymentMethods.push(...read(payCol))
    })
  }
  return { categories, paymentMethods }
}

function mostCommon(xs: string[]): string | null {
  const counts = new Map<string, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  let best: string | null = null
  let n = 0
  for (const [k, v] of counts) if (v > n) [best, n] = [k, v]
  return best
}

export function parseWorkbook(wb: Workbook, existing?: BudgetData): ParsedWorkbook {
  const warnings: string[] = []
  const master = parseMaster(wb)
  const transactions = parseTransactions(wb, warnings)
  const incomes = parseIncomes(wb)
  const incomePlan = parseIncomePlan(wb)

  const known = new Map<string, Group>()
  for (const c of existing?.categories ?? []) known.set(c.name, c.group)
  for (const c of master.categories) known.set(c.name, c.group)
  for (const t of transactions) known.set(t.category, t.group)
  const budgets = parseBudgets(wb, (n) => known.get(n) ?? null)

  const month = mostCommon(transactions.map((t) => monthOf(t.date))) ?? mostCommon(incomes.map((i) => monthOf(i.date)))
  if (!month) warnings.push('날짜가 있는 지출/수입 내역을 찾지 못했습니다.')
  const otherMonths = transactions.filter((t) => month && monthOf(t.date) !== month).length
  if (otherMonths) warnings.push(`${month}이 아닌 날짜의 지출 ${otherMonths}건도 해당 날짜의 월로 가져옵니다.`)
  for (const b of budgets) if (!b.group) warnings.push(`계획 항목 '${b.category}'의 큰 항목을 알 수 없어 고정비로 넣습니다.`)

  return { month, master, transactions, incomes, incomePlan, budgets, warnings }
}

export interface ImportStats {
  month: string | null
  transactions: number
  incomes: number
  incomePlan: number
  budgets: number
  newCategories: number
  newPaymentMethods: number
  warnings: string[]
}

/** 파싱 결과를 기존 데이터에 합칩니다. replaceMonth면 해당 월의 기존 내역·계획을 교체합니다. */
export function applyImport(
  data: BudgetData,
  parsed: ParsedWorkbook,
  opts: { replaceMonth: boolean },
): { data: BudgetData; stats: ImportStats } {
  const categories = [...data.categories]
  const paymentMethods = [...data.paymentMethods]
  let newCategories = 0
  let newPaymentMethods = 0

  const catId = (group: Group, name: string): string => {
    let c = categories.find((x) => x.group === group && x.name === name)
    if (!c) {
      c = { id: uid(), group, name }
      categories.push(c)
      newCategories++
    }
    return c.id
  }
  const payId = (name: string): string => {
    const n = name || '기타결제'
    let p = paymentMethods.find((x) => x.name === n)
    if (!p) {
      p = { id: uid(), name: n }
      paymentMethods.push(p)
      newPaymentMethods++
    }
    return p.id
  }

  for (const c of parsed.master.categories) catId(c.group, c.name)
  for (const p of parsed.master.paymentMethods) payId(p)

  const month = parsed.month
  const importedMonths = new Set([
    ...parsed.transactions.map((t) => monthOf(t.date)),
    ...parsed.incomes.map((i) => monthOf(i.date)),
  ])
  const keep = (date: string) => !(opts.replaceMonth && importedMonths.has(monthOf(date)))

  const transactions = [
    ...data.transactions.filter((t) => keep(t.date)),
    ...parsed.transactions.map((t) => ({
      id: uid(),
      date: t.date,
      categoryId: catId(t.group, t.category),
      paymentMethodId: payId(t.payment),
      memo: t.memo,
      amount: t.amount,
      note: t.note,
    })),
  ]
  const incomes = [
    ...data.incomes.filter((i) => keep(i.date)),
    ...parsed.incomes.map((i) => ({ id: uid(), ...i })),
  ]

  const plans = { ...data.plans }
  if (month && (parsed.budgets.length || parsed.incomePlan.length)) {
    const base: MonthPlan = opts.replaceMonth || !plans[month] ? { budgets: {}, incomePlan: [] } : plans[month]
    const budgets: Record<string, BudgetLine> = opts.replaceMonth ? {} : { ...base.budgets }
    for (const b of parsed.budgets) {
      const id = catId(b.group ?? '고정비', b.category)
      const prev = budgets[id]
      budgets[id] = prev
        ? { amount: prev.amount + b.amount, memo: [prev.memo, b.memo].filter(Boolean).join(', ') || undefined }
        : { amount: b.amount, memo: b.memo }
    }
    plans[month] = {
      ...base,
      budgets,
      incomePlan: [
        ...(opts.replaceMonth ? [] : base.incomePlan),
        ...parsed.incomePlan.map((p) => ({ id: uid(), ...p })),
      ],
    }
  }

  // 십일조 대상이 비어 있으면 엑셀 규칙(월급 × 10%)대로 '월급'이 들어간 수입을 대상으로 설정
  let settings = data.settings
  const warnings = [...parsed.warnings]
  if (settings.tithe.sources.length === 0) {
    const salary = [...new Set(parsed.incomes.map((i) => i.source).filter((s) => s.includes('월급')))]
    if (salary.length) {
      settings = { ...settings, tithe: { ...settings.tithe, sources: salary } }
      warnings.push(`십일조 대상 수입을 '${salary.join(', ')}'(으)로 설정했습니다. 설정에서 바꿀 수 있습니다.`)
    }
  }
  if (!settings.tithe.categoryId) {
    const t = categories.find((c) => c.name === '헌금')
    if (t) settings = { ...settings, tithe: { ...settings.tithe, categoryId: t.id } }
  }

  return {
    data: { ...data, categories, paymentMethods, transactions, incomes, plans, settings },
    stats: {
      month,
      transactions: parsed.transactions.length,
      incomes: parsed.incomes.length,
      incomePlan: parsed.incomePlan.length,
      budgets: parsed.budgets.length,
      newCategories,
      newPaymentMethods,
      warnings,
    },
  }
}
