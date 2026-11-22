import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { addMonths, categoryMap, monthLabel, txOfMonth, won } from '../domain/calc'
import { uid } from '../domain/defaults'
import { dueItems, registerDue, setSkipped, suggestRules } from '../domain/recurring'
import { GROUPS, type Group, type RecurringRule } from '../domain/types'
import { Card, Empty, MoneyInput } from '../components'

const monthsText = (ms: number[]) =>
  ms.length === 0 ? '매달' : `${[...ms].sort((a, b) => a - b).join('·')}월`

/** 지출 화면 위: 이번 달 등록할 반복 항목 */
export function RecurringDue({ onManage }: { onManage: () => void }) {
  const { data, setData, month } = useStore()
  const cats = useMemo(() => categoryMap(data), [data])
  const items = dueItems(data, month)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const pending = items.filter((i) => i.status === 'pending')

  if ((data.recurring ?? []).length === 0) {
    return (
      <div className="alert info">
        매달 나가는 고정비(관리비·보험·구독 등)를 반복 항목으로 등록해 두면 한 번에 입력할 수 있습니다.{' '}
        <button className="link" onClick={onManage}>
          반복 항목 설정
        </button>
      </div>
    )
  }
  if (items.length === 0) return null

  const register = (ids: string[]) => setData((d) => registerDue(d, month, ids, amounts))

  return (
    <Card
      title={`${monthLabel(month)} 반복 항목 · 대기 ${pending.length}건`}
      actions={
        <>
          <button className="btn small ghost" onClick={onManage}>
            관리
          </button>
          {pending.length > 0 && (
            <button className="btn small primary" onClick={() => register(pending.map((p) => p.rule.id))}>
              모두 등록 ({won(pending.reduce((s, p) => s + (amounts[p.rule.id] ?? p.rule.amount), 0))})
            </button>
          )}
        </>
      }
    >
      <ul className="list">
        {items.map(({ rule, date, status }) => {
          const c = rule.categoryId ? cats.get(rule.categoryId) : undefined
          return (
            <li key={rule.id} className={`due due-${status}`}>
              <span className="tx-date">{Number(date.slice(8))}일</span>
              <span className="tx-body">
                <span className="tx-memo">{rule.name}</span>
                <span className="muted small">
                  {rule.kind === 'income' ? '수입' : `${c?.group ?? ''} · ${c?.name ?? '분류 없음'}`} · {monthsText(rule.months)}
                </span>
              </span>
              {status === 'pending' ? (
                <>
                  <span className="due-amt">
                    <MoneyInput
                      value={amounts[rule.id] ?? rule.amount}
                      ariaLabel={`${rule.name} 이번 달 금액`}
                      allowNegative={rule.kind === 'income'}
                      onChange={(v) => setAmounts((a) => ({ ...a, [rule.id]: v ?? 0 }))}
                    />
                  </span>
                  <span className="due-actions">
                    <button className="btn small" onClick={() => register([rule.id])}>
                      등록
                    </button>
                    <button className="btn small ghost" onClick={() => setData((d) => setSkipped(d, month, rule.id, true))}>
                      건너뛰기
                    </button>
                  </span>
                </>
              ) : status === 'done' ? (
                <span className="due-state pos">✓ 등록됨</span>
              ) : (
                <span className="due-state">
                  <span className="muted small">건너뜀</span>{' '}
                  <button className="link small" onClick={() => setData((d) => setSkipped(d, month, rule.id, false))}>
                    되돌리기
                  </button>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

interface Draft {
  id: string | null
  kind: 'expense' | 'income'
  name: string
  amount: number | null
  day: number
  months: number[]
  group: Group
  categoryId: string
  paymentMethodId: string
}

/** 설정 화면: 반복 항목 관리 */
export function RecurringSettings() {
  const { data, setData, month } = useStore()
  const cats = useMemo(() => categoryMap(data), [data])
  const rules = data.recurring ?? []
  const catsOf = (g: Group) => data.categories.filter((c) => c.group === g && !c.archived)

  const blank = (): Draft => ({
    id: null,
    kind: 'expense',
    name: '',
    amount: null,
    day: 1,
    months: [],
    group: '고정비',
    categoryId: catsOf('고정비')[0]?.id ?? '',
    paymentMethodId: data.paymentMethods.find((p) => !p.archived)?.id ?? '',
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  // 이번 달(없으면 지난달) 고정비·저축 지출에서 후보 만들기
  const sourceMonth = txOfMonth(data, month).length ? month : addMonths(month, -1)
  const suggestions = suggestRules(data, sourceMonth)
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const pickedSet = picked ?? new Set(suggestions.map((s) => `${s.name}|${s.categoryId}`))
  const keyOf = (r: RecurringRule) => `${r.name}|${r.categoryId}`

  const save = () => {
    if (!draft) return
    if (!draft.name.trim()) return setError('내용을 입력하세요.')
    if (!draft.amount) return setError('금액을 입력하세요.')
    if (draft.kind === 'expense' && !draft.categoryId) return setError('분류를 선택하세요.')
    setError('')
    const rule: RecurringRule = {
      id: draft.id ?? uid(),
      kind: draft.kind,
      name: draft.name.trim(),
      amount: draft.amount,
      day: Math.min(31, Math.max(1, Math.round(draft.day) || 1)),
      months: [...draft.months].sort((a, b) => a - b),
      categoryId: draft.kind === 'expense' ? draft.categoryId : undefined,
      paymentMethodId: draft.kind === 'expense' ? draft.paymentMethodId : undefined,
      active: rules.find((r) => r.id === draft.id)?.active ?? true,
    }
    setData((d) => {
      const list = d.recurring ?? []
      return { ...d, recurring: draft.id ? list.map((r) => (r.id === draft.id ? rule : r)) : [...list, rule] }
    })
    setDraft(null)
  }

  const edit = (r: RecurringRule) => {
    const c = r.categoryId ? cats.get(r.categoryId) : undefined
    setDraft({
      id: r.id,
      kind: r.kind,
      name: r.name,
      amount: r.amount,
      day: r.day,
      months: r.months,
      group: c?.group ?? '고정비',
      categoryId: r.categoryId ?? '',
      paymentMethodId: r.paymentMethodId ?? '',
    })
    setError('')
  }

  const update = (id: string, patch: Partial<RecurringRule>) =>
    setData((d) => ({ ...d, recurring: (d.recurring ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const remove = (id: string) => {
    if (!confirm('이 반복 항목을 삭제할까요? 이미 등록된 지출·수입은 남습니다.')) return
    setData((d) => ({ ...d, recurring: (d.recurring ?? []).filter((r) => r.id !== id) }))
  }

  const addSuggestions = () => {
    const chosen = suggestions.filter((s) => pickedSet.has(keyOf(s)))
    if (!chosen.length) return
    setData((d) => ({ ...d, recurring: [...(d.recurring ?? []), ...chosen] }))
    setPicked(null)
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  return (
    <Card
      title="반복 지출·수입"
      actions={
        !draft && (
          <button className="btn small" onClick={() => setDraft(blank())}>
            + 추가
          </button>
        )
      }
    >
      <p className="small muted">
        등록해 두면 매달 지출 화면에서 한 번에 입력할 수 있습니다. 자동차세처럼 특정 달에만 나가는 항목은 해당 월만 고르세요.
      </p>

      {draft && (
        <div className="form rule-form">
          <div className="seg two" role="radiogroup" aria-label="종류">
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.kind === k}
                className={draft.kind === k ? 'on' : ''}
                onClick={() => set('kind', k)}
              >
                {k === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <div className="grid2">
            <label>
              내용
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder={draft.kind === 'expense' ? '예: 아파트 관리비' : '예: 월급'} />
            </label>
            <label>
              금액
              <MoneyInput value={draft.amount} onChange={(v) => set('amount', v)} ariaLabel="반복 금액" />
            </label>
            <label>
              날짜 (매월 며칠)
              <input type="number" min={1} max={31} inputMode="numeric" value={draft.day} onChange={(e) => set('day', Number(e.target.value))} />
            </label>
            {draft.kind === 'expense' && (
              <label>
                결제방법
                <select value={draft.paymentMethodId} onChange={(e) => set('paymentMethodId', e.target.value)}>
                  {data.paymentMethods
                    .filter((p) => !p.archived || p.id === draft.paymentMethodId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {draft.kind === 'expense' && (
              <label>
                큰 항목
                <select
                  value={draft.group}
                  onChange={(e) => {
                    const g = e.target.value as Group
                    setDraft((d) => (d ? { ...d, group: g, categoryId: catsOf(g)[0]?.id ?? '' } : d))
                  }}
                >
                  {GROUPS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
            )}
            {draft.kind === 'expense' && (
              <label>
                작은 항목
                <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  {data.categories
                    .filter((c) => c.group === draft.group && (!c.archived || c.id === draft.categoryId))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <fieldset>
            <legend className="small">반복하는 달 (아무것도 안 고르면 매달)</legend>
            <div className="month-chips">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <label key={m} className="check chip">
                  <input
                    type="checkbox"
                    checked={draft.months.includes(m)}
                    onChange={(e) => set('months', e.target.checked ? [...draft.months, m] : draft.months.filter((x) => x !== m))}
                  />
                  {m}월
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            <button className="btn ghost" onClick={() => setDraft(null)}>
              취소
            </button>
            <button className="btn primary" onClick={save}>
              {draft.id ? '저장' : '추가'}
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <Empty>등록된 반복 항목이 없습니다.</Empty>
      ) : (
        <ul className="list">
          {rules.map((r) => {
            const c = r.categoryId ? cats.get(r.categoryId) : undefined
            return (
              <li key={r.id} className={`rule${r.active ? '' : ' archived'}`}>
                <button className="tx-main" onClick={() => edit(r)} aria-label={`${r.name} 수정`}>
                  <span className="tx-body">
                    <span className="tx-memo">{r.name}</span>
                    <span className="muted small">
                      {r.kind === 'income' ? '수입' : `${c?.group ?? ''} · ${c?.name ?? '분류 없음'}`} · {monthsText(r.months)} {r.day}일
                    </span>
                  </span>
                  <span className="tx-amt">{won(r.amount)}</span>
                </button>
                <button className="btn small ghost" onClick={() => update(r.id, { active: !r.active })}>
                  {r.active ? '멈춤' : '재개'}
                </button>
                <button className="icon-btn" aria-label="삭제" onClick={() => remove(r.id)}>
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {suggestions.length > 0 && (
        <div className="preview">
          <p className="small">
            <strong>{monthLabel(sourceMonth)} 고정비·저축 지출에서 가져오기</strong>
          </p>
          <ul className="list">
            {suggestions.map((s) => (
              <li key={keyOf(s)}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={pickedSet.has(keyOf(s))}
                    onChange={(e) => {
                      const next = new Set(pickedSet)
                      if (e.target.checked) next.add(keyOf(s))
                      else next.delete(keyOf(s))
                      setPicked(next)
                    }}
                  />
                  <span className="tx-body">
                    <span>
                      {s.name} · {won(s.amount)}
                    </span>
                    <span className="muted small">
                      {cats.get(s.categoryId ?? '')?.name} · 매달 {s.day}일
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="row-end">
            <button className="btn primary small" onClick={addSuggestions} disabled={pickedSet.size === 0}>
              선택한 {suggestions.filter((s) => pickedSet.has(keyOf(s))).length}개 추가
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
