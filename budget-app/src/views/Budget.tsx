import { useStore } from '../store'
import { addMonths, monthLabel, monthSummary, planOf, won } from '../domain/calc'
import { OfferingCard } from './Offering'
import { Card, Diff, MoneyInput } from '../components'
import type { BudgetLine, Group } from '../domain/types'

/** 예산 화면 표시 순서 (엑셀 지출계획 시트와 같은 흐름) */
const BUDGET_ORDER: Group[] = ['예비비', '고정비', '저축', '생활비']
import { recurringBudget } from '../domain/recurring'

export function Budget({ go }: { go?: (tab: string) => void }) {
  const { data, month, updatePlan } = useStore()
  const s = monthSummary(data, month)
  const plan = planOf(data, month)
  const prev = addMonths(month, -1)
  const prevPlan = data.plans[prev]

  const rec = recurringBudget(data, month)
  const recDiffers = [...rec].filter(([id, amt]) => (plan.budgets[id]?.amount ?? 0) !== amt)
  const fillFromRecurring = () => {
    const names = recDiffers.map(([id, amt]) => `${data.categories.find((c) => c.id === id)?.name} ${won(amt)}`).join(', ')
    if (!confirm(`반복 항목 합계로 예산을 바꿀까요?\n${names}`)) return
    updatePlan(month, (p) => {
      const budgets = { ...p.budgets }
      for (const [id, amt] of rec) budgets[id] = { ...(budgets[id] ?? {}), amount: amt }
      return { ...p, budgets }
    })
  }

  const setLine = (categoryId: string, patch: Partial<BudgetLine>) =>
    updatePlan(month, (p) => {
      const cur = p.budgets[categoryId] ?? { amount: 0 }
      return { ...p, budgets: { ...p.budgets, [categoryId]: { ...cur, ...patch } } }
    })

  const copyPrev = () => {
    if (!prevPlan) return
    const hasAny = Object.values(plan.budgets).some((b) => b.amount)
    if (hasAny && !confirm(`${monthLabel(month)} 예산을 ${monthLabel(prev)} 예산으로 덮어쓸까요?`)) return
    updatePlan(month, (p) => ({ ...p, budgets: structuredClone(prevPlan.budgets), notes: p.notes ?? prevPlan.notes }))
  }

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">비용계획 총합계</span>
          <strong>{won(s.expensePlanned)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">수입계획</span>
          <strong>{won(s.incomePlanned)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">수입계획 차이</span>
          <strong className={s.planGap < 0 ? 'neg' : ''}>{won(s.planGap)}</strong>
          <span className="kpi-sub">{s.planGap < 0 ? '계획 단계 적자입니다' : '계획상 남는 금액'}</span>
        </div>
      </div>

      <div className="row-end">
        {recDiffers.length > 0 && (
          <button className="btn" onClick={fillFromRecurring}>
            반복 항목으로 예산 채우기 ({recDiffers.length})
          </button>
        )}
        {prevPlan && (
          <button className="btn" onClick={copyPrev}>
            {monthLabel(prev)} 예산 복사
          </button>
        )}
      </div>

      <OfferingCard go={go} />

      {[...s.groups].sort((a, b) => BUDGET_ORDER.indexOf(a.group) - BUDGET_ORDER.indexOf(b.group)).map((g) => (
        <Card
          key={g.group}
          title={
            <>
              {g.group} <span className="muted small">계획 {won(g.planned)} · 실지출 {won(g.actual)}</span>
            </>
          }
        >
          <div className="table-wrap">
            <table className="table edit">
              <thead>
                <tr>
                  <th>항목</th>
                  <th className="num">계획</th>
                  <th className="hide-sm">메모</th>
                  <th className="num">실지출</th>
                  <th className="num">차이</th>
                </tr>
              </thead>
              <tbody>
                {g.categories.map((c) => (
                  <tr key={c.category.id} className={c.actual > c.planned ? 'over-row' : ''}>
                    <td>{c.category.name}</td>
                    <td className="num">
                      <MoneyInput
                        value={c.planned || null}
                        ariaLabel={`${c.category.name} 계획`}
                        onChange={(v) => setLine(c.category.id, { amount: v ?? 0 })}
                      />
                    </td>
                    <td className="hide-sm">
                      <input
                        value={c.memo ?? ''}
                        placeholder="메모"
                        aria-label={`${c.category.name} 메모`}
                        onChange={(e) => setLine(c.category.id, { memo: e.target.value || undefined })}
                      />
                    </td>
                    <td className="num">{won(c.actual)}</td>
                    <td className="num">
                      <Diff value={c.diff} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>합계</td>
                  <td className="num">{won(g.planned)}</td>
                  <td className="hide-sm" />
                  <td className="num">{won(g.actual)}</td>
                  <td className="num">
                    <Diff value={g.diff} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ))}

      <Card title="피드백 메모">
        <textarea
          rows={4}
          value={plan.notes ?? ''}
          placeholder="예: 매년 6월, 12월 자동차세 예산 편성하기"
          onChange={(e) => updatePlan(month, (p) => ({ ...p, notes: e.target.value }))}
        />
      </Card>
    </div>
  )
}
