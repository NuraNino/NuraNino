/** 화면 테마(기기별 설정). 가계부 데이터와 별개로 이 브라우저에만 저장됩니다. */
export type ThemeMode = 'system' | 'light' | 'dark'
export type Accent = 'green' | 'blue' | 'purple' | 'rose' | 'orange' | 'slate'

export interface Theme {
  mode: ThemeMode
  accent: Accent
}

export const ACCENTS: { id: Accent; label: string; light: string; dark: string }[] = [
  { id: 'green', label: '숲 초록', light: '#1f6f5c', dark: '#4fb79a' },
  { id: 'blue', label: '바다 파랑', light: '#2559c7', dark: '#6c9cff' },
  { id: 'purple', label: '라벤더', light: '#6b46c1', dark: '#a68bf0' },
  { id: 'rose', label: '로즈', light: '#b8325f', dark: '#f283ab' },
  { id: 'orange', label: '귤 주황', light: '#b4510b', dark: '#f59e5b' },
  { id: 'slate', label: '먹색', light: '#3f4a55', dark: '#aab6c2' },
]

export const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: '기기 설정' },
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
]

const KEY = 'household-budget:theme'
const DEFAULT: Theme = { mode: 'system', accent: 'green' }

export function loadTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Theme> | null
    return {
      mode: MODES.some((m) => m.id === t?.mode) ? t!.mode! : DEFAULT.mode,
      accent: ACCENTS.some((a) => a.id === t?.accent) ? t!.accent! : DEFAULT.accent,
    }
  } catch {
    return DEFAULT
  }
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    /* 저장 불가해도 현재 화면에는 적용 */
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t.mode === 'system') root.removeAttribute('data-mode')
  else root.setAttribute('data-mode', t.mode)
  root.setAttribute('data-accent', t.accent)
  // 상태 표시줄 색을 현재 배경색과 맞춤
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#f6f7f5')
}
