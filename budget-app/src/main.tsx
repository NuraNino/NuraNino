import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import { App } from './App'
import { SyncProvider, takeInviteFromUrl } from './sync/SyncProvider'
import './styles.css'
import { applySeason, applyTheme, loadTheme } from './theme'
import { monthOf, todayISO } from './domain/calc'

applyTheme(loadTheme())
applySeason(monthOf(todayISO()))
takeInviteFromUrl()
// '기기 설정' 모드일 때 시스템 다크 모드 전환을 상태 표시줄 색에도 반영
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(loadTheme()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <SyncProvider>
        <App />
      </SyncProvider>
    </StoreProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
