import { useStore } from '../store'
import { categoryMap, monthSummary, txOfMonth, won, carryoverFor } from '../domain/calc'
import { Card, Diff, Empty, Ring } from '../components'
import { dueItems } from '../domain/recurring'
import { CategoryBadge, GROUP_CLASS, GroupIcon } from '../icons'
import { InstallmentSummary } from './Installments'

export function Dashboard({ go }: { go: (tab: string) => void }) {
  const { data, month } = useStore()
  const s = monthSummary(data, month)
  const cats = categoryMap(data)
  const carry = carryoverFor(data, month)
  const hasPlan = s.expensePlanned > 0 || s.incomePlanned > 0
  const pending = dueItems(data, month).filter((d) => d.status === 'pending')
  const overs = s.groups.flatMap((g) => g.categories).filter((c) => c.actual > c.planned && c.actual > 0)
  const recent = [...txOfMonth(data, month)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  return (
    <div className="stack">
      <section className="card balance-card">
        <span className="kpi-label">실수입 − 실지출</span>
        <strong className={`balance${s.net < 0 ? ' neg' : ''}`}>{won(s.net)}</strong>
        <div className="balance-row">
          <div>
            <span className="kpi-label">실 수입</span>
            <span className="balance-sub">{won(s.incomeActual)}</span>
            <span className="kpi-sub">계획 {won(s.incomePlanned)}</span>
          </div>
          <div>
            <span className="kpi-label">실 지출</span>
            <span className="balance-sub">{won(s.expenseActual)}</span>
            <span className="kpi-sub">계획 {won(s.expensePlanned)}</span>
          </div>
          <div>
            <span className="kpi-label">예상 월말 잔액</span>
            <span className={`balance-sub${s.projected < 0 ? ' neg' : ''}`}>{won(s.projected)}</span>
            <span className="kpi-sub">남은 고정비·저축 {won(s.remainingFixed)} 차감</span>
          </div>
        </div>
      </section>

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
      {pending.length > 0 && (
        <div className="alert info">
          이번 달 반복 항목 {pending.length}건({won(pending.reduce((sum, p) => sum + p.rule.amount, 0))})이 등록을 기다리고 있습니다.{' '}
          <button className="link" onClick={() => go('tx')}>지출에서 등록</button>
        </div>
      )}
      {carry !== null && !data.incomes.some((i) => i.date.startsWith(month) && i.source === '이월금') && (
        <div className="alert info">
          전월 잔액 {won(carry)}을 이월금으로 넣을 수 있습니다.{' '}
          <button className="link" onClick={() => go('income')}>수입에서 추가</button>
        </div>
      )}

      <Card title="예산 대비 지출" actions={<span className="muted small">{won(s.expenseActual)} / {won(s.expensePlanned)}</span>}>
        <div className="rings">
          {s.groups.map((g) => (
            <div key={g.group} className="ring-item">
              <Ring value={g.actual} max={g.planned} className={GROUP_CLASS[g.group]}>
                <GroupIcon group={g.group} />
              </Ring>
              <span className="ring-name">{g.group}</span>
              <span className={`ring-pct${g.actual > g.planned ? ' over' : ''}`}>
                {g.planned ? `${Math.round((g.actual / g.planned) * 100)}%` : '예산 없음'}
                {g.actual > g.planned ? ' 초과' : ''}
              </span>
              <span className="small">
                <Diff value={g.diff} />
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="최근 지출"
        actions={
          <button className="link small" onClick={() => go('tx')}>
            전체 보기
          </button>
        }
      >
        {recent.length === 0 ? (
          <Empty>이번 달 지출 내역이 없습니다.</Empty>
        ) : (
          <ul className="list item-list">
            {recent.map((t) => {
              const c = cats.get(t.categoryId)
              return (
                <li key={t.id} className="item">
                  <CategoryBadge category={c} />
                  <span className="item-body">
                    <span className="item-title">{t.memo || c?.name}</span>
                    <span className="muted small">
                      {Number(t.date.slice(5, 7))}월 {Number(t.date.slice(8))}일 · {c?.name}
                    </span>
                  </span>
                  <span className="item-amt">−{won(t.amount)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <InstallmentSummary />

      <Card title="예산 초과 항목">
        {overs.length === 0 ? (
          <Empty>초과한 항목이 없습니다.</Empty>
        ) : (
          <ul className="list item-list">
            {overs.map((c) => (
              <li key={c.category.id} className="item">
                <CategoryBadge category={c.category} size={34} />
                <span className="item-body">
                  <span className="item-title">{c.category.name}</span>
                  <span className="muted small">
                    {won(c.actual)} / 예산 {won(c.planned)}
                  </span>
                </span>
                <span className="item-amt">
                  <Diff value={c.diff} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
