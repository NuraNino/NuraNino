import { useState } from 'react'
import { isBudgetData, useStore } from '../store'
import { applyImport, parseWorkbook, type ImportStats, type ParsedWorkbook, type Workbook } from '../domain/importExcel'
import { createDefaultData, uid } from '../domain/defaults'
import { monthLabel, todayISO } from '../domain/calc'
import { GROUPS, type Group, type TitheMember } from '../domain/types'
import { defaultOfferings, titheMembers } from '../domain/offering'
import { Card, MoneyInput } from '../components'
import { RecurringSettings } from './Recurring'
import { InstallmentSettings } from './Installments'
import { SyncSettings } from './SyncSettings'
import { ACCENTS, MODES, SEASON_LABEL, applyTheme, loadTheme, saveTheme, seasonOf, type Theme } from '../theme'

async function readWorkbook(file: File): Promise<Workbook> {
  const { default: readXlsxFile, readSheetNames } = await import('read-excel-file')
  const wb: Workbook = {}
  for (const name of await readSheetNames(file)) {
    wb[name] = (await readXlsxFile(file, { sheet: name })) as Workbook[string]
  }
  return wb
}

function ExcelImport() {
  const { data, setData, setMonth } = useStore()
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null)
  const [fileName, setFileName] = useState('')
  const [replace, setReplace] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<ImportStats | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    setDone(null)
    setParsed(null)
    try {
      const wb = await readWorkbook(file)
      const p = parseWorkbook(wb, data)
      if (!p.transactions.length && !p.incomes.length && !p.budgets.length) {
        setError('가져올 지출·수입·예산 표를 찾지 못했습니다. 기존 가계부 양식의 .xlsx 파일인지 확인하세요.')
      } else {
        setParsed(p)
        setFileName(file.name)
      }
    } catch (e) {
      setError(`파일을 읽지 못했습니다: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const apply = () => {
    if (!parsed) return
    const result = applyImport(data, parsed, { replaceMonth: replace })
    setData(() => result.data)
    if (result.stats.month) setMonth(result.stats.month)
    setDone(result.stats)
    setParsed(null)
  }

  return (
    <Card title="엑셀 가계부 가져오기">
      <p className="small muted">
        기존 .xlsx 가계부의 지출 내역, 실 수입, 수입 계획, 지출 계획, 분류 목록을 머리글을 기준으로 찾아 가져옵니다. 파일은 이
        기기 안에서만 읽고 어디에도 올리지 않습니다.
      </p>
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
        disabled={busy}
      />
      {busy && <p className="small">읽는 중…</p>}
      {error && <p className="error">{error}</p>}
      {parsed && (
        <div className="preview">
          <p>
            <strong>{fileName}</strong> {parsed.month ? `· ${monthLabel(parsed.month)}` : ''}
          </p>
          <ul className="small">
            <li>지출 내역 {parsed.transactions.length}건</li>
            <li>실 수입 {parsed.incomes.length}건</li>
            <li>수입 계획 {parsed.incomePlan.length}줄 · 지출 계획 {parsed.budgets.length}줄</li>
            <li>
              분류 {parsed.master.categories.length}개 · 결제방법 {parsed.master.paymentMethods.length}개
            </li>
          </ul>
          {parsed.warnings.length > 0 && (
            <ul className="small warn-list">
              {parsed.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <label className="check">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            해당 월의 기존 내역과 계획을 교체 (끄면 기존 데이터에 추가)
          </label>
          <div className="row-end">
            <button className="btn ghost" onClick={() => setParsed(null)}>
              취소
            </button>
            <button className="btn primary" onClick={apply}>
              가져오기
            </button>
          </div>
        </div>
      )}
      {done && (
        <div className="alert info">
          가져오기 완료: 지출 {done.transactions}건, 수입 {done.incomes}건, 계획 {done.budgets + done.incomePlan}줄
          {done.newCategories ? `, 새 분류 ${done.newCategories}개` : ''}.
          {done.warnings.length > 0 && (
            <ul className="small">
              {done.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

function Backup() {
  const { data, setData } = useStore()
  const [msg, setMsg] = useState('')

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `가계부-백업-${todayISO()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const importJson = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!isBudgetData(parsed)) throw new Error('가계부 백업 파일 형식이 아닙니다.')
      if (!confirm('현재 데이터를 백업 파일 내용으로 바꿀까요?')) return
      setData(() => parsed)
      setMsg('백업을 복원했습니다.')
    } catch (e) {
      setMsg(`복원 실패: ${(e as Error).message}`)
    }
  }

  return (
    <Card title="백업 · 다른 기기로 옮기기">
      <p className="small muted">
        데이터는 이 브라우저에만 저장됩니다. 정기적으로 백업 파일을 내려받고, 다른 휴대폰에서는 백업 파일로 복원하세요.
      </p>
      <div className="row-wrap">
        <button className="btn" onClick={exportJson}>
          백업 파일 내려받기
        </button>
        <label className="btn">
          백업 파일로 복원
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importJson(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('모든 데이터를 지우고 처음 상태로 돌아갈까요? 되돌릴 수 없습니다.')) {
              setData(() => createDefaultData())
              setMsg('초기화했습니다.')
            }
          }}
        >
          전체 초기화
        </button>
      </div>
      {msg && <p className="small">{msg}</p>}
    </Card>
  )
}

function Categories() {
  const { data, setData } = useStore()
  const [newName, setNewName] = useState<Record<Group, string>>({ 생활비: '', 고정비: '', 예비비: '', 저축: '' })

  const rename = (id: string, name: string) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) }))
  const toggle = (id: string) =>
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c)) }))
  const add = (group: Group) => {
    const name = newName[group].trim()
    if (!name) return
    if (data.categories.some((c) => c.group === group && c.name === name)) return
    setData((d) => ({ ...d, categories: [...d.categories, { id: uid(), group, name }] }))
    setNewName((n) => ({ ...n, [group]: '' }))
  }

  return (
    <Card title="분류 (큰 항목 · 작은 항목)">
      <p className="small muted">
        사용하지 않는 항목은 숨기면 입력 목록에서 빠지고, 지난 기록은 그대로 남습니다. 같은 큰 항목 안에서는 이름이 겹치지 않게
        하세요.
      </p>
      <div className="cat-grid">
        {GROUPS.map((g) => (
          <div key={g} className="cat-col">
            <h3>{g}</h3>
            {data.categories
              .filter((c) => c.group === g)
              .map((c) => (
                <div key={c.id} className={`cat-item${c.archived ? ' archived' : ''}`}>
                  <input value={c.name} aria-label={`${g} 항목 이름`} onChange={(e) => rename(c.id, e.target.value)} />
                  <button className="btn small ghost" onClick={() => toggle(c.id)}>
                    {c.archived ? '보이기' : '숨기기'}
                  </button>
                </div>
              ))}
            <form
              className="cat-item"
              onSubmit={(e) => {
                e.preventDefault()
                add(g)
              }}
            >
              <input
                value={newName[g]}
                placeholder="새 항목"
                aria-label={`${g} 새 항목`}
                onChange={(e) => setNewName((n) => ({ ...n, [g]: e.target.value }))}
              />
              <button className="btn small" type="submit">
                추가
              </button>
            </form>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PaymentMethods() {
  const { data, setData } = useStore()
  const [name, setName] = useState('')
  return (
    <Card title="결제방법">
      <div className="cat-col">
        {data.paymentMethods.map((p) => (
          <div key={p.id} className={`cat-item${p.archived ? ' archived' : ''}`}>
            <input
              value={p.name}
              aria-label="결제방법 이름"
              onChange={(e) =>
                setData((d) => ({ ...d, paymentMethods: d.paymentMethods.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) }))
              }
            />
            <button
              className="btn small ghost"
              onClick={() =>
                setData((d) => ({ ...d, paymentMethods: d.paymentMethods.map((x) => (x.id === p.id ? { ...x, archived: !x.archived } : x)) }))
              }
            >
              {p.archived ? '보이기' : '숨기기'}
            </button>
          </div>
        ))}
        <form
          className="cat-item"
          onSubmit={(e) => {
            e.preventDefault()
            const n = name.trim()
            if (!n || data.paymentMethods.some((p) => p.name === n)) return
            setData((d) => ({ ...d, paymentMethods: [...d.paymentMethods, { id: uid(), name: n }] }))
            setName('')
          }}
        >
          <input value={name} placeholder="새 결제방법 (예: 신한카드)" aria-label="새 결제방법" onChange={(e) => setName(e.target.value)} />
          <button className="btn small" type="submit">
            추가
          </button>
        </form>
      </div>
    </Card>
  )
}

function TitheSettings() {
  const { data, setData } = useStore()
  const t = data.settings.tithe
  const members = titheMembers(data)
  const offerings = defaultOfferings(data)
  const set = (patch: Partial<typeof t>) =>
    setData((d) => ({ ...d, settings: { ...d.settings, tithe: { ...d.settings.tithe, ...patch } } }))
  const setMembers = (fn: (ms: TitheMember[]) => TitheMember[]) => set({ members: fn(members) })
  const sources = [
    ...new Set([
      ...data.incomes.map((i) => i.source),
      ...Object.values(data.plans).flatMap((p) => p.incomePlan.map((i) => i.source)),
      ...members.flatMap((m) => m.sources),
    ]),
  ]
    .filter((s) => s && s !== '이월금')
    .sort()

  return (
    <Card title="헌금 계산 규칙">
      <label className="check">
        <input type="checkbox" checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        예산 화면에 헌금 계산 표시
      </label>
      {t.enabled && (
        <div className="form">
          <div className="grid2">
            <label>
              십일조 비율 (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Math.round(t.rate * 1000) / 10}
                onChange={(e) => set({ rate: Math.max(0, Number(e.target.value) || 0) / 100 })}
              />
            </label>
            <label>
              총 헌금이 들어갈 예산 항목
              <select value={t.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
                <option value="">선택</option>
                {data.categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.group} · {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="small">십일조 — 사람별 대상 수입 (실 수입 내역의 '내용' 기준)</legend>
            {members.map((m) => (
              <div key={m.id} className="member-setting">
                <div className="cat-item">
                  <input
                    value={m.name}
                    aria-label="이름"
                    onChange={(e) => setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
                  />
                  {members.length > 1 && (
                    <button
                      className="btn small ghost"
                      onClick={() => confirm(`'${m.name}'을(를) 십일조 계산에서 뺄까요?`) && setMembers((ms) => ms.filter((x) => x.id !== m.id))}
                    >
                      빼기
                    </button>
                  )}
                </div>
                {sources.length === 0 ? (
                  <p className="small muted">수입을 먼저 입력하면 여기에서 고를 수 있습니다.</p>
                ) : (
                  <div className="row-wrap">
                    {sources.map((src) => (
                      <label key={src} className="check chip">
                        <input
                          type="checkbox"
                          checked={m.sources.includes(src)}
                          onChange={(e) =>
                            setMembers((ms) =>
                              ms.map((x) =>
                                x.id === m.id
                                  ? { ...x, sources: e.target.checked ? [...x.sources, src] : x.sources.filter((y) => y !== src) }
                                  : x,
                              ),
                            )
                          }
                        />
                        {src}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button className="link small" onClick={() => setMembers((ms) => [...ms, { id: uid(), name: '', sources: [] }])}>
              + 사람 추가
            </button>
          </fieldset>

          <fieldset>
            <legend className="small">기타 헌금 기본 목록 — 달마다 기본으로 채워짐 (공동)</legend>
            <div className="lines">
              {offerings.map((o) => (
                <div key={o.id} className="line">
                  <input
                    value={o.label}
                    placeholder="예: 선교헌금"
                    aria-label="헌금 이름"
                    onChange={(e) => set({ defaultOfferings: offerings.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                  />
                  <MoneyInput
                    value={o.amount || null}
                    ariaLabel={`${o.label || '헌금'} 기본 금액`}
                    onChange={(v) => set({ defaultOfferings: offerings.map((x) => (x.id === o.id ? { ...x, amount: v ?? 0 } : x)) })}
                  />
                  <button className="icon-btn" aria-label="삭제" onClick={() => set({ defaultOfferings: offerings.filter((x) => x.id !== o.id) })}>
                    ×
                  </button>
                </div>
              ))}
              <button className="link small" onClick={() => set({ defaultOfferings: [...offerings, { id: uid(), label: '', amount: 0 }] })}>
                + 헌금 추가
              </button>
            </div>
          </fieldset>
        </div>
      )}
    </Card>
  )
}

function ThemeSettings() {
  const { month } = useStore()
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const update = (patch: Partial<Theme>) => {
    const next = { ...theme, ...patch }
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }
  const dark =
    theme.mode === 'dark' || (theme.mode === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <Card title="화면 테마">
      <div className="form">
        <div className="seg three" role="radiogroup" aria-label="밝기">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={theme.mode === m.id}
              className={theme.mode === m.id ? 'on' : ''}
              onClick={() => update({ mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="swatches" role="radiogroup" aria-label="색상">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={theme.accent === a.id}
              className="swatch"
              onClick={() => update({ accent: a.id })}
            >
              <span className="swatch-dot" style={{ background: dark ? a.dark : a.light }} aria-hidden />
              {a.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={theme.seasonal} onChange={(e) => update({ seasonal: e.target.checked })} />
          계절 배경 (보고 있는 달 기준 · 지금 {SEASON_LABEL[seasonOf(month)]})
        </label>
        <p className="small muted">테마는 이 기기에만 저장되며, 백업 파일에는 포함되지 않습니다.</p>
      </div>
    </Card>
  )
}

export function Settings() {
  return (
    <div className="stack">
      <SyncSettings />
      <ThemeSettings />
      <ExcelImport />
      <RecurringSettings />
      <InstallmentSettings />
      <Backup />
      <TitheSettings />
      <Categories />
      <PaymentMethods />
    </div>
  )
}
