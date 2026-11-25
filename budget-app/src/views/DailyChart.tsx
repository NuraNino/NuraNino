import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { categoryMap, monthLabel, txOfMonth, won } from '../domain/calc'
import { lastDayOf } from '../domain/recurring'
import type { Group } from '../domain/types'
import { Card } from '../components'

type Mode = 'expense' | 'living' | 'saving'
const MODES: { id: Mode; label: string; groups: Group[] }[] = [
  { id: 'expense', label: '지출 전체', groups: ['생활비', '고정비', '예비비'] },
  { id: 'living', label: '생활비', groups: ['생활비'] },
  { id: 'saving', label: '저축', groups: ['저축'] },
]

const W = 360
const H = 180
const PAD = { l: 34, r: 6, t: 12, b: 22 }

/** 위쪽만 4px 둥근 막대 (기준선에 붙음) */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function niceMax(v: number) {
  if (v <= 0) return 10000
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

const short = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만` : n.toLocaleString('ko-KR'))

export function DailyChart() {
  const { data, month } = useStore()
  const [mode, setMode] = useState<Mode>('expense')
  const [hover, setHover] = useState<number | null>(null)
  const cats = useMemo(() => categoryMap(data), [data])
  const days = lastDayOf(month)
  const groups = MODES.find((m) => m.id === mode)!.groups

  const { values, items } = useMemo(() => {
    const values = Array<number>(days).fill(0)
    const items: { memo: string; amount: number }[][] = Array.from({ length: days }, () => [])
    for (const t of txOfMonth(data, month)) {
      const g = cats.get(t.categoryId)?.group
      if (!g || !groups.includes(g)) continue
      const d = Number(t.date.slice(8)) - 1
      values[d] += t.amount
      items[d].push({ memo: t.memo || cats.get(t.categoryId)?.name || '', amount: t.amount })
    }
    return { values, items }
  }, [data, month, cats, groups, days])

  const total = values.reduce((a, b) => a + b, 0)
  const max = niceMax(Math.max(...values))
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const slot = iw / days
  const bw = Math.max(2, slot - 2) * 0.7
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const ticks = [0, max / 2, max]
  const xLabels = [1, 5, 10, 15, 20, 25, days].filter((d, i, a) => a.indexOf(d) === i && d <= days)
  const active = hover !== null && values[hover] > 0 ? hover : null

  return (
    <Card title={`${monthLabel(month)} 일별 ${MODES.find((m) => m.id === mode)!.label}`} actions={<strong className="small">{won(total)}</strong>}>
      <div className="seg three chart-seg" role="radiogroup" aria-label="보기">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="chart" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`일별 금액 막대 차트, 합계 ${won(total)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="axis" x={PAD.l - 4} y={y(t) + 3} textAnchor="end">
                {short(t)}
              </text>
            </g>
          ))}
          {xLabels.map((d) => (
            <text key={d} className="axis" x={PAD.l + slot * (d - 0.5)} y={H - 6} textAnchor="middle">
              {d}
            </text>
          ))}
          {values.map((v, i) => {
            const x = PAD.l + slot * i + (slot - bw) / 2
            return (
              <g key={i}>
                {v > 0 && <path className={`bar-mark${active === i ? ' on' : ''}`} d={barPath(x, y(v), bw, PAD.t + ih - y(v))} />}
                <rect
                  className="hit"
                  x={PAD.l + slot * i}
                  y={PAD.t}
                  width={slot}
                  height={ih}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            )
          })}
        </svg>
        {active !== null && (
          <div
            className="chart-tip"
            style={{ left: `${((PAD.l + slot * (active + 0.5)) / W) * 100}%` }}
            data-side={active > days / 2 ? 'left' : 'right'}
          >
            <strong>
              {Number(month.slice(5))}월 {active + 1}일 · {won(values[active])}
            </strong>
            {items[active]
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 4)
              .map((it, k) => (
                <span key={k}>
                  {it.memo} {won(it.amount)}
                </span>
              ))}
            {items[active].length > 4 && <span className="muted">외 {items[active].length - 4}건</span>}
          </div>
        )}
      </div>
      {total === 0 && <p className="empty">이번 달 내역이 없습니다.</p>}
    </Card>
  )
}
