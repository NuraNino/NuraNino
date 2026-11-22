import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushRow, Remote, RemoteRow } from './engine'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''
export const syncConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

let clientPromise: Promise<SupabaseClient> | null = null

/** 설정된 경우에만 supabase-js를 불러옵니다 (번들 크기 절약) */
export function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return clientPromise
}

export interface HouseholdRow {
  id: string
  kdf_salt: string
  kdf_iterations: number
  key_check: string
}

const PAGE = 1000
const CHUNK = 200

export function supabaseRemote(client: SupabaseClient, householdId: string): Remote {
  return {
    async pull(since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client
          .from('records')
          .select('kind,id,iv,ciphertext,deleted,updated_at')
          .eq('household_id', householdId)
          .order('updated_at')
          .order('kind')
          .order('id')
          .range(from, from + PAGE - 1)
        if (since) q = q.gt('updated_at', since)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        out.push(...(data as RemoteRow[]))
        if (!data || data.length < PAGE) break
      }
      return out
    },
    async push(rows: PushRow[]) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({ household_id: householdId, ...r }))
        const { error } = await client.from('records').upsert(chunk, { onConflict: 'household_id,kind,id' })
        if (error) throw new Error(error.message)
      }
    },
    subscribe(onChange) {
      const ch = client
        .channel(`records:${householdId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `household_id=eq.${householdId}` }, () => onChange())
        .subscribe()
      return () => {
        void client.removeChannel(ch)
      }
    },
  }
}
