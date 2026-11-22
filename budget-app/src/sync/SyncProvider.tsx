import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useStore } from '../store'
import { DEFAULT_ITERATIONS, deriveKey, makeKeyCheck, newSalt, verifyKeyCheck } from './crypto'
import { applyPulled, commitPulled, pullChanges, pushChanges, type Remote, type SyncState } from './engine'
import { clearKeys, loadKey, saveKey } from './keyStore'
import { fromRecords, type RecordMap } from './records'
import { getClient, supabaseRemote, syncConfigured, type HouseholdRow } from './supabase'

export type Phase = 'off' | 'loading' | 'signedOut' | 'noHousehold' | 'locked' | 'ready'

interface Status {
  syncing: boolean
  lastSync: number | null
  error: string | null
}

interface SyncApi {
  phase: Phase
  email: string | null
  household: HouseholdRow | null
  members: number
  status: Status
  /** 화면이 바뀌어도 보여 줄 안내 (예: 참여는 됐지만 비밀번호가 틀림) */
  notice: string
  sendLink: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  createHousehold: (passphrase: string) => Promise<void>
  joinHousehold: (code: string, passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  createInvite: () => Promise<string>
  syncNow: () => void
}

const Ctx = createContext<SyncApi | null>(null)

const STATE_KEY = 'household-budget:sync'
interface StoredState extends SyncState {
  householdId: string
}

function loadState(): StoredState | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as StoredState | null
  } catch {
    return null
  }
}
function saveState(s: StoredState | null) {
  try {
    if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STATE_KEY)
  } catch {
    /* 저장 실패 시 다음 실행 때 전체를 다시 맞춤 */
  }
}

const message = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  if (/invalid or expired invite/.test(m)) return '초대 코드가 잘못되었거나 만료(3일)·사용되었습니다.'
  if (/Failed to fetch|NetworkError|network/i.test(m)) return '인터넷에 연결되어 있지 않습니다. 연결되면 자동으로 다시 시도합니다.'
  if (/OperationError|decrypt/i.test(m)) return '복호화에 실패했습니다. 가계부 비밀번호가 다른 기기와 같은지 확인하세요.'
  return m
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, setData } = useStore()
  const [phase, setPhase] = useState<Phase>(syncConfigured ? 'loading' : 'off')
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [household, setHousehold] = useState<HouseholdRow | null>(null)
  const [members, setMembers] = useState(0)
  const [notice, setNotice] = useState('')
  const [status, setStatus] = useState<Status>({ syncing: false, lastSync: null, error: null })

  const clientRef = useRef<SupabaseClient | null>(null)
  const keyRef = useRef<CryptoKey | null>(null)
  const remoteRef = useRef<Remote | null>(null)
  const stateRef = useRef<StoredState | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const queue = useRef<Promise<void>>(Promise.resolve())

  // ---------- 로그인 상태 ----------
  useEffect(() => {
    if (!syncConfigured) return
    let unsub: (() => void) | undefined
    let cancelled = false
    void getClient().then(async (client) => {
      if (cancelled) return
      clientRef.current = client
      const { data: s } = await client.auth.getSession()
      setEmail(s.session?.user.email ?? null)
      setUserId(s.session?.user.id ?? null)
      if (!s.session) setPhase('signedOut')
      const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
        setEmail(session?.user.email ?? null)
        setUserId(session?.user.id ?? null)
        if (!session) setPhase('signedOut')
      })
      unsub = () => sub.subscription.unsubscribe()
      // 로그인 링크(?code=…)로 돌아온 경우 주소 정리
      if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash)
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  // ---------- 가계부(household) 찾기 ----------
  const loadHousehold = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    const { data: rows, error } = await client.from('households').select('id,kdf_salt,kdf_iterations,key_check').order('created_at').limit(1)
    if (error) {
      setStatus((s) => ({ ...s, error: message(error) }))
      return
    }
    const h = (rows?.[0] as HouseholdRow | undefined) ?? null
    setHousehold(h)
    if (!h) {
      setPhase('noHousehold')
      return
    }
    const { count } = await client.from('household_members').select('user_id', { count: 'exact', head: true }).eq('household_id', h.id)
    setMembers(count ?? 0)
    const key = await loadKey(h.id)
    keyRef.current = key
    setPhase(key ? 'ready' : 'locked')
  }, [])

  useEffect(() => {
    if (userId) void loadHousehold()
  }, [userId, loadHousehold])

  // ---------- 동기화 ----------
  const enqueue = useCallback((job: () => Promise<void>) => {
    queue.current = queue.current.then(job, job)
    return queue.current
  }, [])

  const runSync = useCallback(
    () =>
      enqueue(async () => {
        const remote = remoteRef.current
        const key = keyRef.current
        const st = stateRef.current
        if (!remote || !key || !st) return
        setStatus((s) => ({ ...s, syncing: true }))
        try {
          await pushChanges(remote, key, dataRef.current, st)
          const before = { ...st.shadow }
          const { pulled, cursor } = await pullChanges(remote, key, st)
          if (pulled.length) setData((d) => applyPulled(d, pulled, before))
          commitPulled(st, pulled, cursor)
          saveState(st)
          setStatus({ syncing: false, lastSync: Date.now(), error: null })
        } catch (e) {
          saveState(st)
          setStatus((s) => ({ ...s, syncing: false, error: message(e) }))
        }
      }),
    [enqueue, setData],
  )

  /** 다른 기기의 가계부에 처음 연결: 로컬 데이터를 서버 데이터로 교체 (아무것도 올리지 않음) */
  const initialPull = useCallback(
    (h: HouseholdRow) =>
      enqueue(async () => {
        const remote = remoteRef.current!
        const key = keyRef.current!
        const st: StoredState = { householdId: h.id, cursor: null, shadow: {} }
        setStatus((s) => ({ ...s, syncing: true }))
        const { pulled, cursor } = await pullChanges(remote, key, st)
        const map: RecordMap = new Map()
        for (const p of pulled) {
          if (p.value === null) map.delete(p.key)
          else map.set(p.key, p.value)
        }
        commitPulled(st, pulled, cursor)
        stateRef.current = st
        saveState(st)
        if (map.size) setData(() => fromRecords(map))
        setStatus({ syncing: false, lastSync: Date.now(), error: null })
      }),
    [enqueue, setData],
  )

  // 준비되면 연결·실시간 구독·주기적 동기화
  useEffect(() => {
    if (phase !== 'ready' || !household || !clientRef.current) return
    remoteRef.current = supabaseRemote(clientRef.current, household.id)
    const stored = loadState()
    if (stored?.householdId === household.id) {
      stateRef.current = stored
      void runSync()
    } else {
      void initialPull(household).catch((e) => setStatus((s) => ({ ...s, syncing: false, error: message(e) })))
    }
    let t: ReturnType<typeof setTimeout> | undefined
    const soon = (ms: number) => {
      clearTimeout(t)
      t = setTimeout(() => void runSync(), ms)
    }
    const unsub = remoteRef.current.subscribe(() => soon(400))
    const onOnline = () => soon(0)
    const onVisible = () => document.visibilityState === 'visible' && soon(0)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    const iv = setInterval(() => void runSync(), 60_000)
    return () => {
      unsub()
      clearTimeout(t)
      clearInterval(iv)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      remoteRef.current = null
    }
  }, [phase, household, runSync, initialPull])

  // 데이터가 바뀌면 잠시 뒤 올리기
  useEffect(() => {
    if (phase !== 'ready' || !stateRef.current) return
    const t = setTimeout(() => void runSync(), 1500)
    return () => clearTimeout(t)
  }, [data, phase, runSync])

  // ---------- 동작 ----------
  const requireClient = () => {
    if (!clientRef.current) throw new Error('동기화 서버에 연결하지 못했습니다.')
    return clientRef.current
  }

  const api: SyncApi = useMemo(
    () => ({
      phase,
      email,
      household,
      members,
      status,
      notice,
      async sendLink(addr) {
        const { error } = await requireClient().auth.signInWithOtp({
          email: addr,
          options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
        })
        if (error) throw new Error(error.message)
      },
      async verifyCode(addr, code) {
        const { error } = await requireClient().auth.verifyOtp({ email: addr, token: code.trim(), type: 'email' })
        if (error) throw new Error('코드가 맞지 않거나 만료되었습니다.')
      },
      async signOut() {
        await requireClient().auth.signOut()
        await clearKeys()
        saveState(null)
        keyRef.current = null
        stateRef.current = null
        setHousehold(null)
        setPhase('signedOut')
      },
      async createHousehold(passphrase) {
        const salt = newSalt()
        const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS)
        const check = await makeKeyCheck(key)
        const { data: h, error } = await requireClient().rpc('create_household', {
          p_salt: salt,
          p_iterations: DEFAULT_ITERATIONS,
          p_key_check: check,
        })
        if (error) throw new Error(error.message)
        const row = h as HouseholdRow
        await saveKey(row.id, key)
        keyRef.current = key
        // 이 기기 데이터를 처음부터 모두 올림
        const st: StoredState = { householdId: row.id, cursor: null, shadow: {} }
        stateRef.current = st
        saveState(st)
        setHousehold(row)
        setMembers(1)
        setPhase('ready')
      },
      async joinHousehold(code, passphrase) {
        const { data: h, error } = await requireClient().rpc('accept_invite', { p_code: code.trim() })
        if (error) throw new Error(message(error))
        const row = h as HouseholdRow
        setHousehold(row)
        const key = await deriveKey(passphrase, row.kdf_salt, row.kdf_iterations)
        if (!(await verifyKeyCheck(key, row.key_check))) {
          setNotice('가계부 비밀번호가 맞지 않습니다. 참여는 되었으니 비밀번호만 다시 입력하세요.')
          setPhase('locked')
          return
        }
        await saveKey(row.id, key)
        keyRef.current = key
        saveState(null) // 서버 데이터로 교체
        await loadHousehold()
      },
      async unlock(passphrase) {
        if (!household) return
        const key = await deriveKey(passphrase, household.kdf_salt, household.kdf_iterations)
        if (!(await verifyKeyCheck(key, household.key_check))) throw new Error('가계부 비밀번호가 맞지 않습니다.')
        await saveKey(household.id, key)
        keyRef.current = key
        setNotice('')
        setPhase('ready')
      },
      async createInvite() {
        if (!household) throw new Error('가계부가 없습니다.')
        const { data: code, error } = await requireClient().rpc('create_invite', { p_household: household.id })
        if (error) throw new Error(error.message)
        return code as string
      },
      syncNow() {
        void runSync()
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, email, household, members, status, notice, runSync, loadHousehold],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useSync(): SyncApi {
  const s = useContext(Ctx)
  if (!s) throw new Error('SyncProvider missing')
  return s
}

/** 주소의 #invite=코드 를 꺼내 보관 (로그인 링크를 거쳐도 유지) */
const INVITE_KEY = 'household-budget:invite'
export function takeInviteFromUrl(): void {
  const m = location.hash.match(/invite=([0-9a-f]{20,})/i)
  if (!m) return
  try {
    localStorage.setItem(INVITE_KEY, m[1])
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', location.pathname + location.search)
}
export function pendingInvite(): string {
  try {
    return localStorage.getItem(INVITE_KEY) ?? ''
  } catch {
    return ''
  }
}
export function clearInvite() {
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {
    /* ignore */
  }
}
