import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { categoryMap, monthOf, sum, todayISO, txOfMonth, weekOfMonth, won } from '../domain/calc'
import { uid } from '../domain/defaults'
import { GROUPS, type Group, type Transaction } from '../domain/types'
import { Card, Empty, MoneyInput } from '../components'

interface Draft {
  date: string
  group: Group
  categoryId: string
  paymentMethodId: string
  memo: string
  amount: number | null
  note: string
}

const defaultDate = (month: string) => (monthOf(todayISO()) === month ? todayISO() : `${month}-01`)

export function Transactions() {
  const { data, setData, month } = useStore()
  const cats = useMemo(() => categoryMap(data), [data])
  const activeCats = (g: Group) => data.categories.filter((c) => c.group === g && !c.archived)
  const activePms = data.paymentMethods.filter((p) => !p.archived)

  const blank = (): Draft => {
    const group: Group = '생활비'
    return {
      date: defaultDate(month),
      group,
      categoryId: activeCats(group)[0]?.id ?? '',
      paymentMethodId: activePms[0]?.id ?? '',
      memo: '',
      amount: null,
      note: '',
    }
  }
  const [draft, setDraft] = useState<Draft>(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<'' | Group>('')
  const [filterPm, setFilterPm] = useState('')
  const [error, setError] = useState('')

  // 날짜가 선택한 월과 다르면 월 바꿀 때 기본 날짜도 맞춤
  if (!editing && monthOf(draft.date) !== month && draft.amount === null && !draft.memo) {
    setDraft((d) => ({ ...d, date: defaultDate(month) }))
  }

  const memoSuggestions = useMemo(() => {
    const seen = new Map<string, Transaction>()
    for (const t of [...data.transactions].sort((a, b) => a.date.localeCompare(b.date))) if (t.memo) seen.set(t.memo, t)
    return seen
  }, [data.transactions])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const onGroup = (g: Group) => setDraft((d) => ({ ...d, group: g, categoryId: activeCats(g)[0]?.id ?? '' }))

  const onMemo = (memo: string) => {
    const prev = memoSuggestions.get(memo)
    const c = prev && cats.get(prev.categoryId)
    if (prev && c && !editing) {
      setDraft((d) => ({ ...d, memo, group: c.group, categoryId: c.id, paymentMethodId: prev.paymentMethodId }))
    } else set('memo', memo)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.date) return setError('날짜를 입력하세요.')
    if (!draft.categoryId) return setError('작은 항목을 선택하세요.')
    if (!draft.amount) return setError('금액을 입력하세요.')
    setError('')
    const tx: Transaction = {
      id: editing ?? uid(),
      date: draft.date,
      categoryId: draft.categoryId,
      paymentMethodId: draft.paymentMethodId,
      memo: draft.memo.trim(),
      amount: draft.amount,
      note: draft.note.trim() || undefined,
    }
    setData((d) => ({
      ...d,
      transactions: editing ? d.transactions.map((t) => (t.id === editing ? tx : t)) : [...d.transactions, tx],
    }))
    setEditing(null)
    setDraft((d) => ({ ...blank(), date: d.date, group: d.group, categoryId: d.categoryId, paymentMethodId: d.paymentMethodId }))
  }

  const startEdit = (t: Transaction) => {
    const c = cats.get(t.categoryId)
    setEditing(t.id)
    setDraft({
      date: t.date,
      group: c?.group ?? '생활비',
      categoryId: t.categoryId,
      paymentMethodId: t.paymentMethodId,
      memo: t.memo,
      amount: t.amount,
      note: t.note ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = (id: string) => {
    if (!confirm('이 지출을 삭제할까요?')) return
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }))
    if (editing === id) {
      setEditing(null)
      setDraft(blank())
    }
  }

  const pmName = (id: string) => data.paymentMethods.find((p) => p.id === id)?.name ?? '미지정'

  const list = txOfMonth(data, month)
    .filter((t) => !filterGroup || cats.get(t.categoryId)?.group === filterGroup)
    .filter((t) => !filterPm || t.paymentMethodId === filterPm)
    .sort((a, b) => b.date.localeCompare(a.date))
  const weeks = [...new Set(list.map((t) => weekOfMonth(t.date)))].sort((a, b) => b - a)

  // 편집 중인 항목의 카테고리가 보관 상태여도 선택지에 보이도록
  const catOptions = data.categories.filter(
    (c) => c.group === draft.group && (!c.archived || c.id === draft.categoryId),
  )

  return (
    <div className="stack">
      <Card title={editing ? '지출 수정' : '지출 입력'}>
        <form className="form" onSubmit={submit}>
          <div className="seg" role="radiogroup" aria-label="큰 항목">
            {GROUPS.map((g) => (
              <button
                type="button"
                key={g}
                role="radio"
                aria-checked={draft.group === g}
                className={draft.group === g ? 'on' : ''}
                onClick={() => onGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="grid2">
            <label>
              작은 항목
              <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              금액
              <MoneyInput value={draft.amount} onChange={(v) => set('amount', v)} ariaLabel="금액" />
            </label>
            <label>
              날짜
              <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </label>
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
          </div>
          <label>
            내용
            <input
              list="memo-suggestions"
              value={draft.memo}
              onChange={(e) => onMemo(e.target.value)}
              placeholder="예: 쿠팡 장보기"
            />
            <datalist id="memo-suggestions">
              {[...memoSuggestions.keys()].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label>
            비고
            <input value={draft.note} onChange={(e) => set('note', e.target.value)} placeholder="선택" />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            {editing && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditing(null)
                  setDraft(blank())
                }}
              >
                취소
              </button>
            )}
            <button className="btn primary" type="submit">
              {editing ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </Card>

      <Card
        title={`지출 내역 · ${won(sum(list.map((t) => t.amount)))}`}
        actions={
          <>
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value as '' | Group)} aria-label="큰 항목 필터">
              <option value="">전체 항목</option>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select value={filterPm} onChange={(e) => setFilterPm(e.target.value)} aria-label="결제방법 필터">
              <option value="">전체 결제</option>
              {data.paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        }
      >
        {list.length === 0 ? (
          <Empty>이번 달 지출 내역이 없습니다.</Empty>
        ) : (
          weeks.map((w) => {
            const items = list.filter((t) => weekOfMonth(t.date) === w)
            return (
              <div key={w} className="week">
                <div className="week-head row-between">
                  <strong>{w}주차</strong>
                  <span>{won(sum(items.map((t) => t.amount)))}</span>
                </div>
                <ul className="list">
                  {items.map((t) => {
                    const c = cats.get(t.categoryId)
                    return (
                      <li key={t.id} className={`tx${editing === t.id ? ' editing' : ''}`}>
                        <button className="tx-main" onClick={() => startEdit(t)} aria-label={`${t.memo || c?.name} 수정`}>
                          <span className="tx-date">{Number(t.date.slice(8))}일</span>
                          <span className="tx-body">
                            <span className="tx-memo">{t.memo || c?.name}</span>
                            <span className="muted small">
                              {c?.group} · {c?.name} · {pmName(t.paymentMethodId)}
                              {t.note ? ` · ${t.note}` : ''}
                            </span>
                          </span>
                          <span className="tx-amt">{won(t.amount)}</span>
                        </button>
                        <button className="icon-btn" onClick={() => remove(t.id)} aria-label="삭제">
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
