import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './store'
import { App } from './App'
import './styles.css'
import { applyTheme, loadTheme } from './theme'

applyTheme(loadTheme())
// '기기 설정' 모드일 때 시스템 다크 모드 전환을 상태 표시줄 색에도 반영
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(loadTheme()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
