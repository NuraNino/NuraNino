import { useEffect, useState, type ReactNode } from 'react'
import { won } from './domain/calc'

const fmt = (n: number | null) => (n === null ? '' : n.toLocaleString('ko-KR'))
const parse = (s: string): number | null => {
  const neg = s.trim().startsWith('-')
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return neg ? null : null
  return (neg ? -1 : 1) * Number(digits)
}

/** 천 단위 쉼표가 붙는 금액 입력. allowNegative면 앞에 '-' 허용 (이월금 등) */
export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  placeholder = '0',
  id,
  autoFocus,
  ariaLabel,
}: {
  value: number | null
  onChange: (v: number | null) => void
  allowNegative?: boolean
  placeholder?: string
  id?: string
  autoFocus?: boolean
  ariaLabel?: string
}) {
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    if (parse(text) !== value) setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      id={id}
      className="money"
      inputMode={allowNegative ? 'text' : 'numeric'}
      placeholder={placeholder}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        let raw = e.target.value
        if (!allowNegative) raw = raw.replace(/-/g, '')
        const n = parse(raw)
        setText(raw.trim() === '-' ? '-' : fmt(n))
        onChange(n)
      }}
    />
  )
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0
  const over = max >= 0 && value > max
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`bar-fill${over ? ' over' : pct >= 90 ? ' warn' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Diff({ value }: { value: number }) {
  return <span className={value < 0 ? 'neg' : value > 0 ? 'pos' : 'muted'}>{value > 0 ? '+' : ''}{won(value)}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}

/** 원형 진행 표시 (가운데에 아이콘 등) */
export function Ring({ value, max, size = 56, className = '', children }: { value: number; max: number; size?: number; className?: string; children?: ReactNode }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : value > 0 ? 1 : 0
  const over = max >= 0 && value > max
  return (
    <span className={`ring ${className}${over ? ' over' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={4} fill="none" />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-center">{children}</span>
    </span>
  )
}
