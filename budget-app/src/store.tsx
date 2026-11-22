import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createDefaultData } from './domain/defaults'
import { emptyPlan, monthOf, todayISO } from './domain/calc'
import type { BudgetData, MonthPlan } from './domain/types'

const STORAGE_KEY = 'household-budget:v1'

function load(): BudgetData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetData
      if (parsed && parsed.version === 1) return parsed
    }
  } catch {
    /* 저장소 사용 불가 → 기본값 */
  }
  return createDefaultData()
}

export function isBudgetData(x: unknown): x is BudgetData {
  const d = x as BudgetData
  return (
    !!d &&
    d.version === 1 &&
    Array.isArray(d.categories) &&
    Array.isArray(d.paymentMethods) &&
    Array.isArray(d.transactions) &&
    Array.isArray(d.incomes) &&
    typeof d.plans === 'object' &&
    !!d.settings
  )
}

interface Store {
  data: BudgetData
  setData: (updater: (d: BudgetData) => BudgetData) => void
  month: string
  setMonth: (m: string) => void
  updatePlan: (month: string, updater: (p: MonthPlan) => MonthPlan) => void
  saveError: boolean
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<BudgetData>(load)
  const [month, setMonth] = useState(() => monthOf(todayISO()))
  const [saveError, setSaveError] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [data])

  const setData = useCallback((updater: (d: BudgetData) => BudgetData) => setDataState(updater), [])
  const updatePlan = useCallback(
    (m: string, updater: (p: MonthPlan) => MonthPlan) =>
      setDataState((d) => ({ ...d, plans: { ...d.plans, [m]: updater(d.plans[m] ?? emptyPlan()) } })),
    [],
  )

  const value = useMemo(
    () => ({ data, setData, month, setMonth, updatePlan, saveError }),
    [data, setData, month, updatePlan, saveError],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
