import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store'
import { addMonths, monthLabel, monthSummary, offeringDrivesBudget, planOf, sum, won, type CategoryRow } from '../domain/calc'
import { LineList, OfferingPanel } from './Offering'
import { Card, Diff, MoneyInput } from '../components'
import type { AmountLine, BudgetLine, Group } from '../domain/types'
import { recurringBudget } from '../domain/recurring'

/** 예산 화면 표시 순서 (엑셀 지출계획 시트와 같은 흐름) */
const BUDGET_ORDER: Group[] = ['예비비', '고정비', '저축', '생활비']
/** 항목명 아래에 세부 내용(예: 경조사 → 부모님 결혼기념일)을 늘 보이게 적는 그룹 (기존 엑셀의 '작은 항목' 칸) */
const detailGroup = (g: Group) => g === '예비비'
/** 항목마다 펼치는 계산란이 있는 그룹 (엑셀의 =117077+20912+… 같은 수식 대신) */
const calcGroup = (g: Group) => g === '고정비' || g === '저축'

export function Budget({ go }: { go?: (tab: string) => void }) {
  const { data, month, updatePlan } = useStore()
  const s = monthSummary(data, month)
  const plan = planOf(data, month)
  const prev = addMonths(month, -1)
  const prevPlan = data.plans[prev]
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  /** 예산 금액이 자동(헌금 계산·계산란)으로 정해지는 항목 */
  const isAuto = (id: string) => offeringDrivesBudget(data, month, id) || (plan.budgets[id]?.calc?.length ?? 0) > 0

  const rec = recurringBudget(data, month)
  const recDiffers = [...rec].filter(([id, amt]) => !isAuto(id) && (plan.budgets[id]?.amount ?? 0) !== amt)
  const fillFromRecurring = () => {
    const names = recDiffers.map(([id, amt]) => `${data.categories.find((c) => c.id === id)?.name} ${won(amt)}`).join(', ')
    if (!confirm(`반복 항목 합계로 예산을 바꿀까요?\n${names}`)) return
    updatePlan(month, (p) => {
      const budgets = { ...p.budgets }
      for (const [id, amt] of recDiffers) budgets[id] = { ...(budgets[id] ?? {}), amount: amt }
      return { ...p, budgets }
    })
  }

  const setLine = (categoryId: string, patch: Partial<BudgetLine>) =>
    updatePlan(month, (p) => {
      const cur = p.budgets[categoryId] ?? { amount: 0 }
      return { ...p, budgets: { ...p.budgets, [categoryId]: { ...cur, ...patch } } }
    })

  const setCalc = (categoryId: string, lines: AmountLine[]) =>
    updatePlan(month, (p) => {
      const cur = p.budgets[categoryId] ?? { amount: 0 }
      // 계산란 합계를 amount에도 적어 둠 (줄을 모두 지우면 마지막 합계가 직접 입력 금액으로 남음)
      return {
        ...p,
        budgets: {
          ...p.budgets,
          [categoryId]: { ...cur, calc: lines.length ? lines : undefined, amount: lines.length ? sum(lines.map((l) => l.amount)) : cur.amount },
        },
      }
    })

  const copyPrev = () => {
    if (!prevPlan) return
    const hasAny = Object.values(plan.budgets).some((b) => b.amount || b.calc?.length)
    if (hasAny && !confirm(`${monthLabel(month)} 예산을 ${monthLabel(prev)} 예산으로 덮어쓸까요?`)) return
    updatePlan(month, (p) => ({ ...p, budgets: structuredClone(prevPlan.budgets), notes: p.notes ?? prevPlan.notes }))
  }

  const row = (g: Group, c: CategoryRow, cols: number) => {
    const id = c.category.id
    const offering = offeringDrivesBudget(data, month, id)
    const canExpand = offering || calcGroup(g)
    const lines = plan.budgets[id]?.calc ?? []
    const auto = offering || lines.length > 0
    const expanded = open.has(id)
    return (
      <Fragment key={id}>
        <tr className={`${c.actual > c.planned ? 'over-row' : ''}${expanded ? ' expanded' : ''}`}>
          {detailGroup(g) ? (
            <td className="name-detail">
              <span className="name-detail-label">{c.category.name}</span>
              <input
                className="detail-input"
                value={c.memo ?? ''}
                placeholder="세부 내용"
                aria-label={`${c.category.name} 세부 내용`}
                onChange={(e) => setLine(id, { memo: e.target.value || undefined })}
              />
            </td>
          ) : canExpand ? (
            <td>
              <button
                className="expander"
                onClick={() => toggle(id)}
                aria-expanded={expanded}
                aria-label={`${c.category.name} 계산 ${expanded ? '접기' : '펼치기'}`}
              >
                <ChevronRight size={16} className="chev" aria-hidden />
                <span>{c.category.name}</span>
                {offering ? <span className="tag">헌금 계산</span> : lines.length > 0 ? <span className="tag">계산 {lines.length}</span> : null}
              </button>
            </td>
          ) : (
            <td>{c.category.name}</td>
          )}
          <td className="num">
            {auto ? (
              <button className="auto-amount" onClick={() => !expanded && toggle(id)} title="계산란 합계 (펼쳐서 고치기)">
                {won(c.planned)}
              </button>
            ) : (
              <MoneyInput value={c.planned || null} ariaLabel={`${c.category.name} 계획`} onChange={(v) => setLine(id, { amount: v ?? 0 })} />
            )}
          </td>
          {!detailGroup(g) && (
            <td className="hide-sm">
              <input
                value={c.memo ?? ''}
                placeholder="메모"
                aria-label={`${c.category.name} 메모`}
                onChange={(e) => setLine(id, { memo: e.target.value || undefined })}
              />
            </td>
          )}
          <td className="num">{won(c.actual)}</td>
          <td className="num">
            <Diff value={c.diff} />
          </td>
        </tr>
        {expanded && (
          <tr className="calc-row">
            <td colSpan={cols}>
              {offering ? (
                <OfferingPanel go={go} />
              ) : (
                <div className="calc-panel">
                  <LineList lines={lines} placeholder="예: 실손보험" addLabel="계산 줄 추가" onChange={(ls) => setCalc(id, ls)} />
                  <div className="row-between total-row">
                    <span>{lines.length ? '합계 = 예산' : '줄을 추가하면 합계가 예산이 됩니다'}</span>
                    <strong>{won(lines.length ? sum(lines.map((l) => l.amount)) : c.planned)}</strong>
                  </div>
                </div>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    )
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

      {[...s.groups]
        .sort((a, b) => BUDGET_ORDER.indexOf(a.group) - BUDGET_ORDER.indexOf(b.group))
        .map((g) => {
          const cols = detailGroup(g.group) ? 4 : 5
          return (
            <Card
              key={g.group}
              title={
                <>
                  {g.group} <span className="muted small">계획 {won(g.planned)} · 실지출 {won(g.actual)}</span>
                </>
              }
            >
              {calcGroup(g.group) && <p className="small muted card-hint">▸를 누르면 항목별 계산란이 펼쳐집니다.</p>}
              <div className="table-wrap">
                <table className="table edit">
                  <thead>
                    <tr>
                      <th>{detailGroup(g.group) ? '항목 · 세부 내용' : '항목'}</th>
                      <th className="num">계획</th>
                      {!detailGroup(g.group) && <th className="hide-sm">메모</th>}
                      <th className="num">실지출</th>
                      <th className="num">차이</th>
                    </tr>
                  </thead>
                  <tbody>{g.categories.map((c) => row(g.group, c, cols))}</tbody>
                  <tfoot>
                    <tr>
                      <td>합계</td>
                      <td className="num">{won(g.planned)}</td>
                      {!detailGroup(g.group) && <td className="hide-sm" />}
                      <td className="num">{won(g.actual)}</td>
                      <td className="num">
                        <Diff value={g.diff} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )
        })}

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
