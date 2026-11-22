import { useState } from 'react'
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

const TABS = [
  { id: 'home', label: '요약', icon: '◎' },
  { id: 'tx', label: '지출', icon: '＋' },
  { id: 'income', label: '수입', icon: '↓' },
  { id: 'budget', label: '예산', icon: '▤' },
  { id: 'reports', label: '리포트', icon: '▦' },
  { id: 'settings', label: '설정', icon: '⚙' },
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-wrap">
          <h1 className="brand">우리집 가계부</h1>
          <SyncBadge onClick={() => setTab('settings')} />
        </div>
        <div className="month-nav" aria-label="월 선택">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
            ‹
          </button>
          <label className="month-label">
            <span>{monthLabel(month)}</span>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="월" />
          </label>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
            ›
          </button>
        </div>
      </header>

      <nav className="tabbar" aria-label="메뉴">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
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
