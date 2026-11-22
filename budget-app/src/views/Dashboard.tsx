import { useStore } from '../store'
import { monthSummary, won, carryoverFor } from '../domain/calc'
import { Bar, Card, Diff, Empty } from '../components'

export function Dashboard({ go }: { go: (tab: string) => void }) {
  const { data, month } = useStore()
  const s = monthSummary(data, month)
  const carry = carryoverFor(data, month)
  const hasPlan = s.expensePlanned > 0 || s.incomePlanned > 0
  const overs = s.groups.flatMap((g) => g.categories).filter((c) => c.actual > c.planned && c.actual > 0)

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">실 수입</span>
          <strong>{won(s.incomeActual)}</strong>
          <span className="kpi-sub">계획 {won(s.incomePlanned)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">실 지출</span>
          <strong>{won(s.expenseActual)}</strong>
          <span className="kpi-sub">계획 {won(s.expensePlanned)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">실수입 − 실지출</span>
          <strong className={s.net < 0 ? 'neg' : ''}>{won(s.net)}</strong>
          <span className="kpi-sub">남은 고정비·저축 {won(s.remainingFixed)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">예상 월말 잔액</span>
          <strong className={s.projected < 0 ? 'neg' : ''}>{won(s.projected)}</strong>
          <span className="kpi-sub">남은 고정비·저축을 뺀 금액</span>
        </div>
      </div>

      {hasPlan && s.planGap < 0 && (
        <div className="alert">
          <strong>계획 단계 적자</strong> 수입 계획보다 지출 계획이 {won(-s.planGap)} 많습니다.{' '}
          <button className="link" onClick={() => go('budget')}>예산 조정</button>
        </div>
      )}
      {!hasPlan && (
        <div className="alert info">
          이번 달 예산이 아직 없습니다. <button className="link" onClick={() => go('budget')}>예산 만들기</button>
          {' · '}
          <button className="link" onClick={() => go('settings')}>엑셀 가져오기</button>
        </div>
      )}
      {carry !== null && !data.incomes.some((i) => i.date.startsWith(month) && i.source === '이월금') && (
        <div className="alert info">
          전월 잔액 {won(carry)}을 이월금으로 넣을 수 있습니다.{' '}
          <button className="link" onClick={() => go('income')}>수입에서 추가</button>
        </div>
      )}

      <Card title="그룹별 예산 대비 지출">
        <div className="groups">
          {s.groups.map((g) => (
            <div key={g.group} className="group-row">
              <div className="row-between">
                <span className="group-name">{g.group}</span>
                <span className="muted small">
                  {won(g.actual)} / {won(g.planned)}
                </span>
              </div>
              <Bar value={g.actual} max={g.planned} />
              <div className="row-between small">
                <span className="muted">{g.planned ? `${Math.round((g.actual / g.planned) * 100)}%` : '예산 없음'}</span>
                <Diff value={g.diff} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="예산 초과 항목">
        {overs.length === 0 ? (
          <Empty>초과한 항목이 없습니다.</Empty>
        ) : (
          <ul className="list">
            {overs.map((c) => (
              <li key={c.category.id} className="row-between">
                <span>
                  <span className="tag">{c.category.group}</span> {c.category.name}
                </span>
                <span>
                  {won(c.actual)} <span className="muted small">/ {won(c.planned)}</span> <Diff value={c.diff} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
