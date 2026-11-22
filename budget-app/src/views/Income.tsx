import { useState } from 'react'
import { useStore } from '../store'
import { addMonths, carryoverFor, incomesOfMonth, monthLabel, monthOf, planOf, sum, todayISO, won } from '../domain/calc'
import { uid } from '../domain/defaults'
import type { Income as IncomeT, IncomePlanItem } from '../domain/types'
import { Card, Empty, MoneyInput } from '../components'

export function Income() {
  const { data, setData, month, updatePlan } = useStore()
  const plan = planOf(data, month)
  const incomes = incomesOfMonth(data, month).sort((a, b) => a.date.localeCompare(b.date))
  const carry = carryoverFor(data, month)
  const planned = sum(plan.incomePlan.map((i) => i.amount))
  const actual = sum(incomes.map((i) => i.amount))
  const prevPlan = planOf(data, addMonths(month, -1)).incomePlan

  const sources = [...new Set([...plan.incomePlan.map((p) => p.source), ...data.incomes.map((i) => i.source)])].filter(Boolean)

  const [date, setDate] = useState(monthOf(todayISO()) === month ? todayISO() : `${month}-01`)
  const [source, setSource] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [error, setError] = useState('')

  const setPlanItems = (fn: (items: IncomePlanItem[]) => IncomePlanItem[]) =>
    updatePlan(month, (p) => ({ ...p, incomePlan: fn(p.incomePlan) }))

  const addIncome = (inc: Omit<IncomeT, 'id'>) => setData((d) => ({ ...d, incomes: [...d.incomes, { id: uid(), ...inc }] }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date.startsWith(month)) return setError(`${monthLabel(month)} 날짜를 입력하세요.`)
    if (!source.trim()) return setError('내용을 입력하세요.')
    if (amount === null || amount === 0) return setError('금액을 입력하세요.')
    setError('')
    addIncome({ date, source: source.trim(), amount })
    setAmount(null)
    setSource('')
  }

  return (
    <div className="stack">
      <div className="kpis two">
        <div className="kpi">
          <span className="kpi-label">수입 계획</span>
          <strong>{won(planned)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">실 수입</span>
          <strong>{won(actual)}</strong>
          <span className="kpi-sub">{planned ? `계획 대비 ${Math.round((actual / planned) * 100)}%` : ''}</span>
        </div>
      </div>

      <Card
        title="수입 계획"
        actions={
          <>
            {plan.incomePlan.length === 0 && prevPlan.length > 0 && (
              <button
                className="btn small"
                onClick={() => setPlanItems(() => prevPlan.filter((p) => p.kind !== '이월금').map((p) => ({ ...p, id: uid() })))}
              >
                전월 계획 복사
              </button>
            )}
            <button
              className="btn small"
              onClick={() => setPlanItems((items) => [...items, { id: uid(), kind: '', source: '', amount: 0 }])}
            >
              + 줄 추가
            </button>
          </>
        }
      >
        {plan.incomePlan.length === 0 ? (
          <Empty>수입 계획이 없습니다. 월급, 고정수입, 정부지원금, 이월금 등을 추가하세요.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table edit">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>내용</th>
                  <th className="num">금액</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plan.incomePlan.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        value={p.kind}
                        placeholder="월급"
                        aria-label="구분"
                        onChange={(e) => setPlanItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, kind: e.target.value } : x)))}
                      />
                    </td>
                    <td>
                      <input
                        value={p.source}
                        placeholder="예: 월급"
                        aria-label="내용"
                        onChange={(e) => setPlanItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, source: e.target.value } : x)))}
                      />
                    </td>
                    <td className="num">
                      <MoneyInput
                        value={p.amount}
                        allowNegative
                        ariaLabel="금액"
                        onChange={(v) => setPlanItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, amount: v ?? 0 } : x)))}
                      />
                    </td>
                    <td>
                      <button className="icon-btn" aria-label="삭제" onClick={() => setPlanItems((xs) => xs.filter((x) => x.id !== p.id))}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>합계</td>
                  <td className="num">{won(planned)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {carry !== null && !plan.incomePlan.some((p) => p.kind === '이월금') && (
          <p className="small">
            전월 잔액 <strong>{won(carry)}</strong>{' '}
            <button
              className="link"
              onClick={() => setPlanItems((xs) => [...xs, { id: uid(), kind: '이월금', source: '이월금', amount: carry }])}
            >
              계획에 이월금으로 추가
            </button>
          </p>
        )}
      </Card>

      <Card title="실 수입 내역">
        <form className="form" onSubmit={submit}>
          <div className="grid3">
            <label>
              날짜
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              내용
              <input list="income-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="예: 월급" />
              <datalist id="income-sources">
                {sources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <label>
              금액
              <MoneyInput value={amount} onChange={setAmount} allowNegative ariaLabel="수입 금액" />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            {carry !== null && !incomes.some((i) => i.source === '이월금') && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => addIncome({ date: `${month}-01`, source: '이월금', amount: carry })}
              >
                이월금 {won(carry)} 추가
              </button>
            )}
            <button className="btn primary" type="submit">
              추가
            </button>
          </div>
        </form>

        {incomes.length === 0 ? (
          <Empty>이번 달 수입 내역이 없습니다.</Empty>
        ) : (
          <ul className="list">
            {incomes.map((i) => (
              <li key={i.id} className="tx">
                <div className="tx-main static">
                  <span className="tx-date">{Number(i.date.slice(8))}일</span>
                  <span className="tx-body">
                    <span className="tx-memo">{i.source}</span>
                  </span>
                  <span className={`tx-amt${i.amount < 0 ? ' neg' : ''}`}>{won(i.amount)}</span>
                </div>
                <button
                  className="icon-btn"
                  aria-label="삭제"
                  onClick={() => confirm('이 수입을 삭제할까요?') && setData((d) => ({ ...d, incomes: d.incomes.filter((x) => x.id !== i.id) }))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
