/**
 * 가계부 암호화 키를 이 기기의 IndexedDB에 보관합니다.
 * 키는 꺼낼 수 없는(non-extractable) CryptoKey 객체로 저장되어, 비밀번호나 원래 키 값은 남지 않습니다.
 */
const DB = 'household-budget-keys'
const STORE = 'keys'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close()) as Promise<T>
}

export async function saveKey(householdId: string, key: CryptoKey): Promise<void> {
  await tx('readwrite', (s) => s.put(key, householdId))
}

export async function loadKey(householdId: string): Promise<CryptoKey | null> {
  try {
    return ((await tx('readonly', (s) => s.get(householdId))) as CryptoKey | undefined) ?? null
  } catch {
    return null
  }
}

export async function clearKeys(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear())
  } catch {
    /* ignore */
  }
}
