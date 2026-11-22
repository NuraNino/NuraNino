import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { categoryMap, monthLabel, sum, won } from '../domain/calc'
import { uid } from '../domain/defaults'
import { installmentStatus, schedule } from '../domain/installments'
import { GROUPS, type Group, type Installment } from '../domain/types'
import { Bar, Card, Empty, MoneyInput } from '../components'

/** 요약 화면: 이번 달 기준 할부 현황 */
export function InstallmentSummary() {
  const { data, month } = useStore()
  const rows = (data.installments ?? [])
    .map((inst) => ({ inst, st: installmentStatus(inst, month) }))
    .filter(({ st }) => !st.notStarted && (st.no !== null || st.remaining > 0))
  if (rows.length === 0) return null
  const thisMonth = sum(rows.map((r) => r.st.thisMonth))
  const remaining = sum(rows.map((r) => r.st.remaining))

  return (
    <Card title="할부 현황">
      <div className="row-between small">
        <span className="muted">이번 달 할부금</span>
        <strong>{won(thisMonth)}</strong>
      </div>
      <div className="row-between small">
        <span className="muted">이번 달 이후 남은 금액</span>
        <strong>{won(remaining)}</strong>
      </div>
      <ul className="list">
        {rows.map(({ inst, st }) => (
          <li key={inst.id} className="rank">
            <div className="row-between">
              <span>
                {inst.name} <span className="muted small">{st.paidCount}/{st.total}회</span>
              </span>
              <span>
                {won(st.thisMonth)} <span className="muted small">남은 {won(st.remaining)}</span>
              </span>
            </div>
            <Bar value={st.paidCount} max={st.total} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

interface Draft {
  id: string | null
  name: string
  principal: number | null
  months: number
  startMonth: string
  day: number
  fee: number | null
  group: Group
  categoryId: string
  paymentMethodId: string
}

/** 설정 화면: 할부 등록·관리 */
export function InstallmentSettings() {
  const { data, setData, month } = useStore()
  const cats = useMemo(() => categoryMap(data), [data])
  const list = data.installments ?? []
  const catsOf = (g: Group) => data.categories.filter((c) => c.group === g && !c.archived)
  const cardPm = data.paymentMethods.find((p) => !p.archived && p.name.includes('카드')) ?? data.paymentMethods[0]

  const blank = (): Draft => ({
    id: null,
    name: '',
    principal: null,
    months: 3,
    startMonth: month,
    day: 15,
    fee: null,
    group: '생활비',
    categoryId: catsOf('생활비').find((c) => c.name === '생활용품')?.id ?? catsOf('생활비')[0]?.id ?? '',
    paymentMethodId: cardPm?.id ?? '',
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const preview = draft?.principal ? schedule({ principal: draft.principal, months: draft.months, fee: draft.fee ?? 0 }) : null

  const save = () => {
    if (!draft) return
    if (!draft.name.trim()) return setError('내용을 입력하세요.')
    if (!draft.principal || draft.principal <= 0) return setError('할부 원금을 입력하세요.')
    if (!(draft.months >= 1 && draft.months <= 60)) return setError('할부 기간은 1–60개월로 입력하세요.')
    if (!/^\d{4}-\d{2}$/.test(draft.startMonth)) return setError('첫 청구월을 입력하세요.')
    if (!draft.categoryId) return setError('분류를 선택하세요.')
    setError('')
    const inst: Installment = {
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      principal: draft.principal,
      months: Math.round(draft.months),
      startMonth: draft.startMonth,
      day: Math.min(31, Math.max(1, Math.round(draft.day) || 1)),
      fee: draft.fee || undefined,
      categoryId: draft.categoryId,
      paymentMethodId: draft.paymentMethodId,
    }
    setData((d) => {
      const xs = d.installments ?? []
      return { ...d, installments: draft.id ? xs.map((x) => (x.id === draft.id ? inst : x)) : [...xs, inst] }
    })
    setDraft(null)
  }

  const edit = (x: Installment) => {
    setDraft({
      id: x.id,
      name: x.name,
      principal: x.principal,
      months: x.months,
      startMonth: x.startMonth,
      day: x.day,
      fee: x.fee ?? null,
      group: cats.get(x.categoryId)?.group ?? '생활비',
      categoryId: x.categoryId,
      paymentMethodId: x.paymentMethodId,
    })
    setError('')
  }

  const remove = (id: string) => {
    if (!confirm('이 할부를 삭제할까요? 이미 등록된 할부금 지출은 남습니다.')) return
    setData((d) => ({ ...d, installments: (d.installments ?? []).filter((x) => x.id !== id) }))
  }

  return (
    <Card
      title="할부"
      actions={
        !draft && (
          <button className="btn small" onClick={() => setDraft(blank())}>
            + 추가
          </button>
        )
      }
    >
      <p className="small muted">
        할부 원금과 기간을 등록하면 매달 할부금이 지출 화면의 반복 항목에 나타납니다. 지출은 결제한 달이 아니라 매달 청구되는
        할부금으로 기록됩니다.
      </p>

      {draft && (
        <div className="form rule-form">
          <div className="grid2">
            <label>
              내용
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 유모차" />
            </label>
            <label>
              할부 원금
              <MoneyInput value={draft.principal} onChange={(v) => set('principal', v)} ariaLabel="할부 원금" />
            </label>
            <label>
              기간 (개월)
              <input type="number" min={1} max={60} inputMode="numeric" value={draft.months} onChange={(e) => set('months', Number(e.target.value))} />
            </label>
            <label>
              수수료 총액 (선택)
              <MoneyInput value={draft.fee} onChange={(v) => set('fee', v)} ariaLabel="할부 수수료" placeholder="무이자면 비움" />
            </label>
            <label>
              첫 청구월
              <input type="month" value={draft.startMonth} onChange={(e) => set('startMonth', e.target.value)} />
            </label>
            <label>
              결제일 (매월 며칠)
              <input type="number" min={1} max={31} inputMode="numeric" value={draft.day} onChange={(e) => set('day', Number(e.target.value))} />
            </label>
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
            <label>
              결제수단
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
          {preview && (
            <p className="small">
              월 {won(preview[preview.length - 1])}
              {preview[0] !== preview[preview.length - 1] ? ` (첫 회 ${won(preview[0])})` : ''} × {preview.length}회 = 총{' '}
              <strong>{won(sum(preview))}</strong>
            </p>
          )}
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

      {list.length === 0 ? (
        <Empty>등록된 할부가 없습니다.</Empty>
      ) : (
        <ul className="list">
          {list.map((x) => {
            const st = installmentStatus(x, month)
            const c = cats.get(x.categoryId)
            const pm = data.paymentMethods.find((p) => p.id === x.paymentMethodId)?.name
            return (
              <li key={x.id} className={`rule${st.finished && st.no === null ? ' archived' : ''}`}>
                <button className="tx-main" onClick={() => edit(x)} aria-label={`${x.name} 수정`}>
                  <span className="tx-body">
                    <span className="tx-memo">{x.name}</span>
                    <span className="muted small">
                      {c?.name} · {pm} · {monthLabel(x.startMonth)}부터 {x.months}개월 ·{' '}
                      {st.notStarted ? '시작 전' : st.finished && st.no === null ? '완납' : `${st.paidCount}/${st.total}회, 남은 ${won(st.remaining)}`}
                    </span>
                  </span>
                  <span className="tx-amt">{won(x.principal + (x.fee ?? 0))}</span>
                </button>
                <button className="icon-btn" aria-label="삭제" onClick={() => remove(x.id)}>
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
