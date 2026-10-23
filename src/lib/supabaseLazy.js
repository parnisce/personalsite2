import { whenIdle } from './idle'

// The Supabase client is about 200 KB, so the public pages load it after they have rendered
// instead of shipping it in the first bundle. Every caller shares the same promise.
let pending
export function getSupabase() {
  pending ??= new Promise((resolve, reject) => {
    whenIdle(() => import('./supabase').then((m) => resolve(m.supabase), reject), 3000)
  })
  return pending
}
