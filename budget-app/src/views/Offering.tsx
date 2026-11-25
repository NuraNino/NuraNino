import { useStore } from '../store'
import { addMonths, emptyPlan, monthLabel, won } from '../domain/calc'
import { uid } from '../domain/defaults'
import { offeringFor } from '../domain/offering'
import type { AmountLine, MonthPlan } from '../domain/types'
import { MoneyInput } from '../components'

/** 금액 줄 목록 편집 (내용 + 금액 + 삭제, 아래에 줄 추가) */
export function LineList({
  lines,
  onChange,
  placeholder,
  addLabel,
}: {
  lines: AmountLine[]
  onChange: (lines: AmountLine[]) => void
  placeholder: string
  addLabel: string
}) {
  return (
    <div className="lines">
      {lines.map((l) => (
        <div key={l.id} className="line">
          <input
            value={l.label}
            placeholder={placeholder}
            aria-label="내용"
            onChange={(e) => onChange(lines.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))}
          />
          <MoneyInput
            value={l.amount || null}
            ariaLabel={`${l.label || '항목'} 금액`}
            onChange={(v) => onChange(lines.map((x) => (x.id === l.id ? { ...x, amount: v ?? 0 } : x)))}
          />
          <button className="icon-btn" aria-label="삭제" onClick={() => onChange(lines.filter((x) => x.id !== l.id))}>
            ×
          </button>
        </div>
      ))}
      <button className="link small" onClick={() => onChange([...lines, { id: uid(), label: '', amount: 0 }])}>
        + {addLabel}
      </button>
    </div>
  )
}

/** 예산 표의 헌금 줄을 펼쳤을 때: 사람별 십일조 + 공동 기타 헌금 (합계가 헌금 예산이 됨) */
export function OfferingPanel({ go }: { go?: (tab: string) => void }) {
  const { data, month, updatePlan } = useStore()
  const r = offeringFor(data, month)
  const prevOthers = data.plans[addMonths(month, -1)]?.offering?.others
  const pct = Math.round(r.rate * 1000) / 10

  const setOffering = (fn: (o: NonNullable<MonthPlan['offering']>) => NonNullable<MonthPlan['offering']>) =>
    updatePlan(month, (p) => ({ ...(p ?? emptyPlan()), offering: fn(p.offering ?? { extraBase: {} }) }))

  return (
    <div className="offering">
      <h3 className="offering-head">
        십일조 <span className="muted small">대상 수입 × {pct}%</span>
      </h3>
      {r.members.map((m) => (
        <div key={m.member.id} className="member">
          <div className="row-between">
            <strong>{m.member.name || '이름 없음'}</strong>
            <strong>{won(m.tithe)}</strong>
          </div>
          <p className="small muted member-base">
            {m.member.sources.length ? m.member.sources.join(', ') : '대상 수입 없음'} {won(m.incomeBase)}
            {m.fromPlan.length > 0 && ` (아직 실 수입이 없어 ${m.fromPlan.join(', ')}은 수입 계획 금액)`}
            {m.extraLines.length > 0 && ` + 직접 ${won(m.base - m.incomeBase)}`} = 대상 {won(m.base)}
          </p>
          <LineList
            lines={m.extraLines}
            placeholder="예: 세종 수금"
            addLabel="대상 수입 직접 추가"
            onChange={(lines) => setOffering((o) => ({ ...o, extraBase: { ...o.extraBase, [m.member.id]: lines } }))}
          />
        </div>
      ))}
      <div className="row-between subtotal-row">
        <span>십일조 합계</span>
        <strong>{won(r.titheTotal)}</strong>
      </div>

      <h3 className="offering-head">
        기타 헌금 <span className="muted small">공동</span>
      </h3>
      {r.othersAreDefault && r.others.length > 0 && <p className="small muted">설정의 기본 목록입니다. 고치면 이번 달에만 적용됩니다.</p>}
      <LineList lines={r.others} placeholder="예: 감사헌금" addLabel="헌금 추가" onChange={(lines) => setOffering((o) => ({ ...o, others: lines }))} />
      {r.othersAreDefault && prevOthers && prevOthers.length > 0 && (
        <button className="link small" onClick={() => setOffering((o) => ({ ...o, others: prevOthers.map((x) => ({ ...x, id: uid() })) }))}>
          {monthLabel(addMonths(month, -1))} 기타 헌금 불러오기
        </button>
      )}
      <div className="row-between subtotal-row">
        <span>기타 헌금 합계</span>
        <strong>{won(r.othersTotal)}</strong>
      </div>
      <div className="row-between total-row">
        <span>총 헌금 = 예산</span>
        <strong>{won(r.total)}</strong>
      </div>
      {go && (
        <p className="small muted">
          사람·대상 수입·기본 헌금 목록은{' '}
          <button className="link small" onClick={() => go('settings')}>
            설정 → 헌금 계산 규칙
          </button>
          에서 바꿉니다.
        </p>
      )}
    </div>
  )
}
