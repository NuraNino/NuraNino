/**
 * 종단간 암호화 (WebCrypto).
 * - 가계부 비밀번호 → PBKDF2-SHA256(기본 600,000회) → AES-GCM 256 키
 * - 기록마다 새 12바이트 IV, 추가 인증 데이터(AAD)로 "종류:id"를 묶어
 *   서버에서 기록을 바꿔치기하면 복호화가 실패하도록 합니다.
 * - 서버에는 솔트·반복 횟수·키 확인용 암호문만 저장되고 비밀번호와 키는 저장되지 않습니다.
 */

export const DEFAULT_ITERATIONS = 600_000
const KEY_CHECK_PLAINTEXT = 'household-budget:key-check:v1'
const KEY_CHECK_AAD = 'key-check'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export const newSalt = (): string => toB64(randomBytes(16))

export async function deriveKey(passphrase: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // 키를 밖으로 꺼낼 수 없게
    ['encrypt', 'decrypt'],
  )
}

export interface Sealed {
  iv: string
  ciphertext: string
}

export async function encryptText(key: CryptoKey, plaintext: string, aad: string): Promise<Sealed> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext))
  return { iv: toB64(iv), ciphertext: toB64(new Uint8Array(ct)) }
}

/** 키·AAD가 맞지 않거나 암호문이 변조되면 예외 */
export async function decryptText(key: CryptoKey, sealed: Sealed, aad: string): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(aad) },
    key,
    fromB64(sealed.ciphertext),
  )
  return dec.decode(pt)
}

/** 서버에 저장할 키 확인값 ("iv.ciphertext") */
export async function makeKeyCheck(key: CryptoKey): Promise<string> {
  const s = await encryptText(key, KEY_CHECK_PLAINTEXT, KEY_CHECK_AAD)
  return `${s.iv}.${s.ciphertext}`
}

export async function verifyKeyCheck(key: CryptoKey, check: string): Promise<boolean> {
  const [iv, ciphertext] = check.split('.')
  try {
    return (await decryptText(key, { iv, ciphertext }, KEY_CHECK_AAD)) === KEY_CHECK_PLAINTEXT
  } catch {
    return false
  }
}
