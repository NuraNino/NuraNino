import { useStore } from '../store'
import {
  categoryMap,
  monthLabel,
  monthlyTrend,
  paymentGroupMatrix,
  sum,
  txOfMonth,
  weekGroupMatrix,
  weekOfMonth,
  won,
  type Matrix,
} from '../domain/calc'
import { GROUPS } from '../domain/types'
import { Bar, Card, Empty } from '../components'
import { CategoryBadge, GROUP_CLASS } from '../icons'
import { DailyChart } from './DailyChart'

const n = (v: number | undefined) => (v ? Math.round(v).toLocaleString('ko-KR') : '')

function MatrixTable({ m, corner }: { m: Matrix; corner: string }) {
  if (m.total === 0) return <Empty>내역이 없습니다.</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{corner}</th>
            {m.cols.map((c) => (
              <th key={c} className="num">
                {c}
              </th>
            ))}
            <th className="num">합계</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r) => (
            <tr key={r}>
              <td>{r}</td>
              {m.cols.map((c) => (
                <td key={c} className="num">
                  {n(m.cells[r]?.[c])}
                </td>
              ))}
              <td className="num strong">{n(m.rowTotals[r])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>합계</td>
            {m.cols.map((c) => (
              <td key={c} className="num">
                {n(m.colTotals[c])}
              </td>
            ))}
            <td className="num">{n(m.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function Reports() {
  const { data, month } = useStore()
  const cats = categoryMap(data)
  const txs = txOfMonth(data, month)
  const weeks = [...new Set(txs.map((t) => weekOfMonth(t.date)))].sort()

  // 항목(작은 항목) × 주차 — 엑셀 '지출 합계' 피벗과 같은 구성
  const byCat = new Map<string, Record<number, number>>()
  for (const t of txs) {
    const row = byCat.get(t.categoryId) ?? {}
    row[weekOfMonth(t.date)] = (row[weekOfMonth(t.date)] ?? 0) + t.amount
    byCat.set(t.categoryId, row)
  }
  const catTotal = (id: string) => sum(Object.values(byCat.get(id) ?? {}))
  const ranking = [...byCat.keys()].map((id) => ({ id, total: catTotal(id) })).sort((a, b) => b.total - a.total)
  const top = ranking[0]?.total ?? 0
  const total = sum(txs.map((t) => t.amount))
  const trend = monthlyTrend(data, month, 6)

  return (
    <div className="stack">
      <DailyChart />

      {ranking.length > 0 && (
        <div className="tiles" role="list" aria-label="항목별 지출">
          {ranking.map(({ id, total: t }) => {
            const c = cats.get(id)
            return (
              <div key={id} role="listitem" className={`tile ${c ? GROUP_CLASS[c.group] : ''}`}>
                <CategoryBadge category={c} size={32} />
                <span className="tile-name">{c?.name}</span>
                <strong className="tile-amt">{won(t)}</strong>
              </div>
            )
          })}
        </div>
      )}

      <Card title="항목 × 주차">
        {txs.length === 0 ? (
          <Empty>이번 달 지출 내역이 없습니다.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>항목</th>
                  {weeks.map((w) => (
                    <th key={w} className="num">
                      {w}주차
                    </th>
                  ))}
                  <th className="num">합계</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => {
                  const ids = [...byCat.keys()].filter((id) => cats.get(id)?.group === g)
                  if (ids.length === 0) return null
                  const wsum = (w: number) => sum(ids.map((id) => byCat.get(id)?.[w] ?? 0))
                  return [
                    ...ids.map((id) => (
                      <tr key={id}>
                        <td>
                          <span className="tag">{g}</span> {cats.get(id)?.name}
                        </td>
                        {weeks.map((w) => (
                          <td key={w} className="num">
                            {n(byCat.get(id)?.[w])}
                          </td>
                        ))}
                        <td className="num strong">{n(catTotal(id))}</td>
                      </tr>
                    )),
                    <tr key={`${g}-sum`} className="subtotal">
                      <td>{g} 요약</td>
                      {weeks.map((w) => (
                        <td key={w} className="num">
                          {n(wsum(w))}
                        </td>
                      ))}
                      <td className="num">{n(sum(ids.map(catTotal)))}</td>
                    </tr>,
                  ]
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>총합계</td>
                  {weeks.map((w) => (
                    <td key={w} className="num">
                      {n(sum(txs.filter((t) => weekOfMonth(t.date) === w).map((t) => t.amount)))}
                    </td>
                  ))}
                  <td className="num">{n(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="큰 항목 × 주차">
        <MatrixTable m={weekGroupMatrix(data, month)} corner="큰 항목" />
      </Card>

      <Card title="결제방법 × 큰 항목">
        <MatrixTable m={paymentGroupMatrix(data, month)} corner="결제방법" />
      </Card>

      <Card title="항목별 지출 순위">
        {ranking.length === 0 ? (
          <Empty>내역이 없습니다.</Empty>
        ) : (
          <ul className="list">
            {ranking.map(({ id, total: t }) => (
              <li key={id} className="rank">
                <div className="row-between">
                  <span className="rank-name">
                    <CategoryBadge category={cats.get(id)} size={28} /> {cats.get(id)?.name}
                  </span>
                  <span>
                    {won(t)} <span className="muted small">{Math.round((t / total) * 100)}%</span>
                  </span>
                </div>
                <Bar value={t} max={top} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="최근 6개월">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>월</th>
                <th className="num">실 수입</th>
                <th className="num">실 지출</th>
                <th className="num">잔액</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((r) => (
                <tr key={r.month}>
                  <td>{monthLabel(r.month)}</td>
                  <td className="num">{n(r.income)}</td>
                  <td className="num">{n(r.expense)}</td>
                  <td className={`num${r.net < 0 ? ' neg' : ''}`}>{r.income || r.expense ? Math.round(r.net).toLocaleString('ko-KR') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
