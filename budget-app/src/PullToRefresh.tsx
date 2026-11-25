import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useSync } from './sync/SyncProvider'

/** 이만큼 당기면 놓았을 때 동기화 */
const THRESHOLD = 64
/** 최대로 내려가는 거리 */
const MAX = 110
/** 돌아가는 아이콘을 최소 이 시간은 보여 줌 (너무 빨리 끝나면 깜빡임처럼 보여서) */
const MIN_SPIN_MS = 700

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done'

/**
 * 페이지 맨 위에서 아래로 당기면 위쪽 여백에 동기화 아이콘이 나타나고, 놓으면 동기화합니다.
 * 헤더와 본문(.hero, .content)만 --ptr 만큼 내려가고, 하단 탭은 그대로 있습니다.
 */
export function PullToRefresh() {
  const sync = useSync()
  const [pull, setPull] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const start = useRef<{ x: number; y: number } | null>(null)
  const decided = useRef<'pull' | 'ignore' | null>(null)
  const pullRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const syncRef = useRef(sync)
  syncRef.current = sync

  const setP = (v: number) => {
    pullRef.current = v
    setPull(v)
  }
  const setPh = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  // 헤더·본문을 내리는 값
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--ptr', `${pull}px`)
    root.classList.toggle('ptr-active', pull > 0)
    root.classList.toggle('ptr-animating', phase !== 'pulling')
  }, [pull, phase])

  useEffect(() => {
    const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1 || !atTop()) {
        start.current = null
        return
      }
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
      decided.current = null
    }

    const onMove = (e: TouchEvent) => {
      if (!start.current || phaseRef.current === 'refreshing') return
      const t = e.touches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      if (decided.current === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        // 아래로, 세로 방향으로, 맨 위에서 시작한 경우만 당기기로 판단 (가로로 넘기는 표·타일은 그대로)
        decided.current = dy > 0 && Math.abs(dy) > Math.abs(dx) && atTop() ? 'pull' : 'ignore'
        if (decided.current === 'pull') setPh('pulling')
      }
      if (decided.current !== 'pull') return
      e.preventDefault()
      // 당길수록 덜 내려가게 (고무줄 느낌)
      const v = Math.min(MAX, dy * 0.5)
      setP(Math.max(0, v))
    }

    const onEnd = async () => {
      if (decided.current !== 'pull') {
        start.current = null
        return
      }
      start.current = null
      decided.current = null
      if (pullRef.current < THRESHOLD) {
        setPh('idle')
        setP(0)
        return
      }
      setPh('refreshing')
      setP(THRESHOLD)
      const began = Date.now()
      const s = syncRef.current
      let msg = ''
      if (s.phase === 'ready') {
        const err = await s.syncNow()
        msg = err ? '동기화하지 못했습니다' : '동기화됨'
      } else if (s.phase === 'off') {
        msg = '함께 쓰기가 연결되지 않았습니다'
      } else if (s.phase === 'locked') {
        msg = '가계부 비밀번호를 입력하면 동기화됩니다'
      } else {
        msg = '로그인하면 동기화됩니다'
      }
      const rest = MIN_SPIN_MS - (Date.now() - began)
      if (rest > 0) await new Promise((r) => setTimeout(r, rest))
      setMessage(msg)
      setPh('done')
      await new Promise((r) => setTimeout(r, 650))
      setP(0)
      setTimeout(() => {
        if (phaseRef.current === 'done') {
          setPh('idle')
          setMessage('')
        }
      }, 300)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (pull === 0 && phase === 'idle') return null
  const ready = pull >= THRESHOLD
  return (
    <div className="ptr" style={{ height: pull }} role="status" aria-live="polite">
      {phase === 'done' ? (
        <span className="ptr-msg">{message}</span>
      ) : (
        <span
          className={`ptr-icon${phase === 'refreshing' ? ' spin' : ''}${ready ? ' ready' : ''}`}
          style={phase === 'refreshing' ? undefined : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / THRESHOLD) }}
        >
          <RefreshCw size={20} strokeWidth={2.4} aria-hidden />
          <span className="sr-only">{phase === 'refreshing' ? '동기화하는 중' : ready ? '놓으면 동기화' : '당겨서 동기화'}</span>
        </span>
      )}
    </div>
  )
}
