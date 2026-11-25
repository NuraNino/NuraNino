import { useEffect, useState } from 'react'
import { ArrowDownToLine, ChartColumn, ChevronLeft, ChevronRight, House, Receipt, Settings2, Wallet } from 'lucide-react'
import { useStore } from './store'
import { addMonths, monthLabel } from './domain/calc'
import { Dashboard } from './views/Dashboard'
import { Transactions } from './views/Transactions'
import { Income } from './views/Income'
import { Budget } from './views/Budget'
import { Reports } from './views/Reports'
import { Settings } from './views/Settings'
import { SyncBadge } from './views/SyncSettings'
import { pendingInvite } from './sync/SyncProvider'
import { SeasonLayer } from './views/SeasonLayer'
import { PullToRefresh } from './PullToRefresh'
import { applySeason, seasonOf } from './theme'

const TABS = [
  { id: 'home', label: '요약', title: '이번 달 요약', Icon: House },
  { id: 'tx', label: '지출', title: '지출', Icon: Receipt },
  { id: 'income', label: '수입', title: '수입', Icon: ArrowDownToLine },
  { id: 'budget', label: '예산', title: '예산', Icon: Wallet },
  { id: 'reports', label: '리포트', title: '리포트', Icon: ChartColumn },
  { id: 'settings', label: '설정', title: '설정', Icon: Settings2 },
] as const
type TabId = (typeof TABS)[number]['id']

const TAB_KEY = 'household-budget:tab'
const initialTab = (): TabId => {
  if (pendingInvite()) return 'settings'
  try {
    const t = localStorage.getItem(TAB_KEY)
    if (TABS.some((x) => x.id === t)) return t as TabId
  } catch {
    /* ignore */
  }
  return 'home'
}

export function App() {
  const { month, setMonth, saveError } = useStore()
  const [tab, setTabState] = useState<TabId>(initialTab)
  const setTab = (t: string) => {
    setTabState(t as TabId)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 })
  }

  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  useEffect(() => applySeason(month), [month])

  return (
    <div className="app">
      <PullToRefresh />
      <header className="hero">
        <SeasonLayer season={seasonOf(month)} />
        <div className="hero-top">
          <div className="brand-wrap">
            <span className="brand">메덩파카 가계부</span>
            <SyncBadge onClick={() => setTab('settings')} />
          </div>
          <div className="month-nav" aria-label="월 선택">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
              <ChevronLeft size={20} />
            </button>
            <label className="month-label">
              <span>{monthLabel(month)}</span>
              <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="월" />
            </label>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <h1 className="hero-title">{current.title}</h1>
      </header>

      <nav className="tabbar" aria-label="메뉴">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <t.Icon size={22} strokeWidth={tab === t.id ? 2.4 : 1.8} aria-hidden />
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {saveError && <div className="alert">이 브라우저에 저장하지 못했습니다. 설정에서 백업 파일을 내려받아 두세요.</div>}

      <main className="content">
        {tab === 'home' && <Dashboard go={setTab} />}
        {tab === 'tx' && <Transactions go={setTab} />}
        {tab === 'income' && <Income />}
        {tab === 'budget' && <Budget />}
        {tab === 'reports' && <Reports />}
        {tab === 'settings' && <Settings />}
      </main>

    </div>
  )
}
