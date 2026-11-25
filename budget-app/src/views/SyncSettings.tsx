import { useState } from 'react'
import { useStore } from '../store'
import { clearInvite, pendingInvite, useSync } from '../sync/SyncProvider'
import { Card } from '../components'

const MIN_PASS = 8
const OTP_ENABLED = import.meta.env.VITE_SUPABASE_OTP === '1'

function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function SignIn() {
  const sync = useSync()
  const [mode, setMode] = useState<'password' | 'code'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [info, setInfo] = useState('')
  const { busy, error, setError, run } = useAction()
  const okEmail = email.includes('@')

  return (
    <div className="form">
      <p className="small muted">두 분이 같은 가계부를 함께 쓰려면 각자 이메일로 로그인하세요.</p>
      {/* 메일 코드 로그인은 Supabase 메일 양식에 {{ .Token }}을 넣은 경우(직접 SMTP 연결 필요)에만 동작하므로
          VITE_SUPABASE_OTP=1 로 빌드했을 때만 보여 줍니다. */}
      {OTP_ENABLED && (
        <div className="seg two" role="radiogroup" aria-label="로그인 방법">
          <button type="button" role="radio" aria-checked={mode === 'password'} className={mode === 'password' ? 'on' : ''} onClick={() => setMode('password')}>
            이메일 + 비밀번호
          </button>
          <button type="button" role="radio" aria-checked={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => setMode('code')}>
            메일 코드
          </button>
        </div>
      )}
      <label>
        이메일
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>

      {mode === 'password' ? (
        <>
          <label>
            로그인 비밀번호
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <p className="small muted">
            계정에 들어가는 비밀번호입니다. 다음 단계의 <strong>가계부 비밀번호</strong>(암호화용, 두 분이 공유)와는 다르게 정하세요.
          </p>
          {info && <p className="small">{info}</p>}
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            <button
              className="btn ghost"
              disabled={busy || !okEmail}
              onClick={() => {
                if (password.length < 8) return setError('로그인 비밀번호는 8자 이상으로 정하세요.')
                setInfo('')
                void run(async () => {
                  const r = await sync.signUpPassword(email.trim(), password)
                  if (r === 'confirm') setInfo('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤(어느 브라우저에서 열려도 괜찮습니다) 여기로 돌아와 "로그인"을 누르세요.')
                })
              }}
            >
              처음 가입
            </button>
            <button className="btn primary" disabled={busy || !okEmail || !password} onClick={() => run(() => sync.signInPassword(email.trim(), password))}>
              로그인
            </button>
          </div>
        </>
      ) : (
        <>
          {sent && (
            <label>
              메일로 받은 6자리 코드
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </label>
          )}
          <p className="small muted">
            메일 양식에 코드가 들어 있을 때만 쓸 수 있습니다(Supabase 메일 양식 설정 필요). 메일의 링크는 홈 화면 앱이 아닌 브라우저에서 열립니다.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            {!sent ? (
              <button className="btn primary" disabled={busy || !okEmail} onClick={() => run(async () => (await sync.sendLink(email.trim()), setSent(true)))}>
                로그인 메일 보내기
              </button>
            ) : (
              <>
                <button className="btn ghost" disabled={busy} onClick={() => run(() => sync.sendLink(email.trim()))}>
                  다시 보내기
                </button>
                <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={() => run(() => sync.verifyCode(email.trim(), code))}>
                  로그인
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function BackupHint() {
  const { data } = useStore()
  if (data.transactions.length === 0 && data.incomes.length === 0) return null
  return (
    <p className="small warn-text">
      이 기기의 현재 데이터({data.transactions.length + data.incomes.length}건)는 함께 쓰는 가계부 데이터로 <strong>교체</strong>됩니다.
      필요하면 아래 "백업 파일 내려받기"로 먼저 백업하세요.
    </p>
  )
}

function Passphrase({ value, onChange, label = '가계부 비밀번호', autoFocus }: { value: string; onChange: (v: string) => void; label?: string; autoFocus?: boolean }) {
  return (
    <label>
      {label}
      <input type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />
    </label>
  )
}

function Setup() {
  const sync = useSync()
  const invite = pendingInvite()
  const [mode, setMode] = useState<'create' | 'join'>(invite ? 'join' : 'create')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [ack, setAck] = useState(false)
  const [code, setCode] = useState(invite)
  const { busy, error, setError, run } = useAction()

  return (
    <div className="form">
      <div className="seg two" role="radiogroup" aria-label="시작 방법">
        <button type="button" role="radio" aria-checked={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>
          새 가계부 만들기
        </button>
        <button type="button" role="radio" aria-checked={mode === 'join'} className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>
          초대받아 참여
        </button>
      </div>

      {mode === 'create' ? (
        <>
          <p className="small muted">
            이 기기의 데이터를 암호화해서 올립니다. 가계부 비밀번호는 서버에 저장되지 않으며, 배우자에게는 초대 링크와 따로 알려 주세요.
          </p>
          <Passphrase value={p1} onChange={setP1} />
          <Passphrase value={p2} onChange={setP2} label="가계부 비밀번호 확인" />
          <label className="check">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            비밀번호를 잊으면 서버의 데이터를 아무도 되살릴 수 없다는 것을 이해했습니다.
          </label>
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            <button
              className="btn primary"
              disabled={busy || !ack}
              onClick={() => {
                if (p1.length < MIN_PASS) return setError(`비밀번호는 ${MIN_PASS}자 이상으로 정하세요.`)
                if (p1 !== p2) return setError('비밀번호 확인이 일치하지 않습니다.')
                void run(() => sync.createHousehold(p1))
              }}
            >
              {busy ? '암호화하는 중…' : '만들고 올리기'}
            </button>
          </div>
        </>
      ) : (
        <>
          <BackupHint />
          <label>
            초대 코드
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="초대 링크의 코드" autoCapitalize="off" spellCheck={false} />
          </label>
          <Passphrase value={p1} onChange={setP1} />
          {error && <p className="error">{error}</p>}
          <div className="row-end">
            <button
              className="btn primary"
              disabled={busy || code.trim().length < 20 || !p1}
              onClick={() => run(async () => (await sync.joinHousehold(code, p1), clearInvite()))}
            >
              {busy ? '확인하는 중…' : '참여하기'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Unlock() {
  const sync = useSync()
  const [p, setP] = useState('')
  const { busy, error, run } = useAction()
  return (
    <div className="form">
      <p className="small muted">이 기기에서 가계부를 열려면 가계부 비밀번호를 입력하세요.</p>
      <BackupHint />
      <Passphrase value={p} onChange={setP} autoFocus />
      {(error || sync.notice) && <p className="error">{error || sync.notice}</p>}
      <div className="row-end">
        <button className="btn primary" disabled={busy || !p} onClick={() => run(() => sync.unlock(p))}>
          {busy ? '확인하는 중…' : '열기'}
        </button>
      </div>
    </div>
  )
}

function Connected() {
  const sync = useSync()
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const { busy, error, run } = useAction()
  const last = sync.status.lastSync ? new Date(sync.status.lastSync).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="form">
      <p className="small">
        <strong>{sync.email}</strong> · 구성원 {sync.members}명
        <br />
        <span className={sync.status.error ? 'neg' : 'muted'}>
          {sync.status.syncing ? '동기화하는 중…' : sync.status.error ? sync.status.error : last ? `마지막 동기화 ${last}` : '연결됨'}
        </span>
      </p>
      <div className="row-wrap">
        <button className="btn" disabled={sync.status.syncing} onClick={sync.syncNow}>
          지금 동기화
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const code = await sync.createInvite()
              setLink(`${location.origin}${location.pathname}#invite=${code}`)
              setCopied(false)
            })
          }
        >
          배우자 초대 링크 만들기
        </button>
      </div>
      {link && (
        <div className="invite">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="초대 링크" />
          <button
            className="btn small"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: '가계부 초대', url: link })
                else {
                  await navigator.clipboard.writeText(link)
                  setCopied(true)
                }
              } catch {
                /* 사용자가 취소 */
              }
            }}
          >
            {copied ? '복사됨' : '보내기'}
          </button>
          <p className="small muted">링크는 3일 동안 한 번만 쓸 수 있습니다. 가계부 비밀번호는 링크와 같은 메시지로 보내지 말고 따로 알려 주세요.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="row-end">
        <button
          className="btn ghost danger"
          disabled={busy}
          onClick={() => {
            if (confirm('이 기기에서 로그아웃하고 암호화 키를 지울까요? 기기의 데이터는 남고, 다시 로그인하면 비밀번호로 열 수 있습니다.')) void run(sync.signOut)
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}

export function SyncSettings() {
  const sync = useSync()
  return (
    <Card title="함께 쓰기 (동기화)">
      {sync.phase === 'off' && (
        <p className="small muted">
          동기화 서버가 아직 연결되지 않았습니다. 지금은 이 기기에만 저장됩니다. (관리자: README의 "Supabase 연결" 안내 참고)
        </p>
      )}
      {sync.phase === 'loading' && <p className="small muted">연결하는 중…</p>}
      {sync.phase === 'signedOut' && <SignIn />}
      {sync.phase === 'noHousehold' && <Setup />}
      {sync.phase === 'locked' && <Unlock />}
      {sync.phase === 'ready' && <Connected />}
      {sync.phase !== 'off' && (
        <p className="small muted e2e-note">
          🔒 가계부 내용은 이 기기에서 암호화된 뒤 전송됩니다. 서버에는 알아볼 수 없는 암호문만 저장됩니다.
        </p>
      )}
    </Card>
  )
}

/** 상단 바의 동기화 상태 표시 */
export function SyncBadge({ onClick }: { onClick: () => void }) {
  const sync = useSync()
  if (sync.phase === 'off') return null
  const { label, cls } =
    sync.phase === 'ready'
      ? sync.status.error
        ? { label: '동기화 오류', cls: 'err' }
        : sync.status.syncing
          ? { label: '동기화 중', cls: 'busy' }
          : { label: '동기화됨', cls: 'ok' }
      : sync.phase === 'locked'
        ? { label: '잠김', cls: 'err' }
        : sync.phase === 'loading'
          ? { label: '연결 중', cls: 'busy' }
          : { label: '로그인 필요', cls: 'idle' }
  return (
    <button className={`sync-badge ${cls}`} onClick={onClick} aria-label={`동기화 상태: ${label}`}>
      <span className="sync-dot" aria-hidden />
      <span className="sync-label">{label}</span>
    </button>
  )
}
