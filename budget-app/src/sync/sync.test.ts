import { describe, expect, it } from 'vitest'
import { createDefaultData, uid } from '../domain/defaults'
import type { BudgetData, Transaction } from '../domain/types'
import { decryptText, deriveKey, encryptText, makeKeyCheck, newSalt, verifyKeyCheck } from './crypto'
import { applyPulled, commitPulled, emptySyncState, pullChanges, pushChanges, type PushRow, type Remote, type RemoteRow, type SyncState } from './engine'
import { fromRecords, toRecords } from './records'

const ITER = 1000 // 테스트 속도용 (실제는 600,000)

class MemoryRemote implements Remote {
  rows = new Map<string, RemoteRow>()
  clock = Date.parse('2026-11-22T00:00:00Z')
  async pull(since: string | null) {
    return [...this.rows.values()].filter((r) => !since || r.updated_at > since).sort((a, b) => a.updated_at.localeCompare(b.updated_at))
  }
  async push(rows: PushRow[]) {
    for (const r of rows) this.rows.set(`${r.kind}:${r.id}`, { ...r, updated_at: new Date((this.clock += 1000)).toISOString() })
  }
  subscribe() {
    return () => {}
  }
}

class Client {
  data: BudgetData
  state: SyncState = emptySyncState()
  constructor(public remote: Remote, public key: CryptoKey, data: BudgetData) {
    this.data = data
  }
  async sync() {
    await pushChanges(this.remote, this.key, this.data, this.state)
    const before = { ...this.state.shadow }
    const { pulled, cursor } = await pullChanges(this.remote, this.key, this.state)
    this.data = applyPulled(this.data, pulled, before)
    commitPulled(this.state, pulled, cursor)
  }
}

const tx = (d: BudgetData, memo: string, amount: number): Transaction => ({
  id: uid(),
  date: '2026-11-22',
  categoryId: d.categories[0].id,
  paymentMethodId: d.paymentMethods[0].id,
  memo,
  amount,
})

describe('암호화', () => {
  it('왕복, AAD·키가 다르면 실패', async () => {
    const salt = newSalt()
    const key = await deriveKey('우리집 비밀번호', salt, ITER)
    const s = await encryptText(key, '{"a":1}', 'tx:1')
    expect(await decryptText(key, s, 'tx:1')).toBe('{"a":1}')
    await expect(decryptText(key, s, 'tx:2')).rejects.toThrow()
    const other = await deriveKey('다른 비밀번호', salt, ITER)
    await expect(decryptText(other, s, 'tx:1')).rejects.toThrow()
    const check = await makeKeyCheck(key)
    expect(await verifyKeyCheck(key, check)).toBe(true)
    expect(await verifyKeyCheck(other, check)).toBe(false)
    // 암호문(복호화 전 바이트)에 평문이 드러나지 않음
    expect(atob(s.ciphertext)).not.toContain('"a":1')
  })
})

describe('기록 변환', () => {
  it('BudgetData ↔ records 왕복 (분류 순서 유지)', () => {
    const d = createDefaultData()
    d.transactions.push(tx(d, '커피', 6600))
    d.plans['2026-11'] = { budgets: { [d.categories[0].id]: { amount: 300000 } }, incomePlan: [] }
    d.recurring = []
    d.installments = []
    d.recurringSkips = {}
    expect(fromRecords(toRecords(d))).toEqual(d)
  })
})

describe('동기화', () => {
  it('두 기기가 같은 가계부를 주고받음', async () => {
    const remote = new MemoryRemote()
    const key = await deriveKey('pw', newSalt(), ITER)
    const a = new Client(remote, key, createDefaultData())
    a.data.transactions.push(tx(a.data, '장보기', 50000))
    await a.sync()
    // 서버에는 암호문만
    expect([...remote.rows.values()].some((r) => r.ciphertext.includes('장보기'))).toBe(false)

    const b = new Client(remote, key, createDefaultData())
    b.data = fromRecords(new Map()) // 참여 기기는 빈 상태에서 시작
    b.data.categories = []
    b.data.paymentMethods = []
    await b.sync()
    expect(b.data.transactions.map((t) => t.memo)).toEqual(['장보기'])
    expect(b.data.categories.map((c) => c.name)).toEqual(a.data.categories.map((c) => c.name))

    // B가 추가, A가 수정 → 서로 반영
    b.data = { ...b.data, transactions: [...b.data.transactions, tx(b.data, '외식', 30000)] }
    a.data = { ...a.data, transactions: a.data.transactions.map((t) => ({ ...t, amount: 55000 })) }
    await b.sync()
    await a.sync()
    await b.sync()
    const view = (c: Client) => c.data.transactions.map((t) => `${t.memo}:${t.amount}`).sort()
    expect(view(a)).toEqual(['외식:30000', '장보기:55000'])
    expect(view(b)).toEqual(view(a))

    // 삭제 전파
    a.data = { ...a.data, transactions: a.data.transactions.filter((t) => t.memo !== '외식') }
    await a.sync()
    await b.sync()
    expect(view(b)).toEqual(['장보기:55000'])
  })

  it('같은 항목을 동시에 고치면 나중에 올린 쪽이 이김, 올리기 전 로컬 변경은 덮이지 않음', async () => {
    const remote = new MemoryRemote()
    const key = await deriveKey('pw', newSalt(), ITER)
    const a = new Client(remote, key, createDefaultData())
    a.data.transactions.push(tx(a.data, '마트', 10000))
    await a.sync()
    const b = new Client(remote, key, { ...createDefaultData(), categories: [], paymentMethods: [] })
    await b.sync()

    a.data = { ...a.data, transactions: a.data.transactions.map((t) => ({ ...t, amount: 11111 })) }
    b.data = { ...b.data, transactions: b.data.transactions.map((t) => ({ ...t, amount: 22222 })) }
    await a.sync() // A 먼저 올림
    // B: 아직 안 올린 변경이 있는 상태에서 받기만 → 로컬 값 유지
    const before = { ...b.state.shadow }
    const { pulled, cursor } = await pullChanges(remote, key, b.state)
    b.data = applyPulled(b.data, pulled, before)
    commitPulled(b.state, pulled, cursor)
    expect(b.data.transactions[0].amount).toBe(22222)
    await b.sync() // B가 나중에 올림
    await a.sync()
    expect(a.data.transactions[0].amount).toBe(22222)
  })

  it('비밀번호가 다르면 받아도 복호화 실패', async () => {
    const remote = new MemoryRemote()
    const salt = newSalt()
    const a = new Client(remote, await deriveKey('pw', salt, ITER), createDefaultData())
    await a.sync()
    const wrong = new Client(remote, await deriveKey('틀린 비밀번호', salt, ITER), createDefaultData())
    await expect(wrong.sync()).rejects.toThrow()
  })
})
