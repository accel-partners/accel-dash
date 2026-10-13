/** apps.slug の書き方の違いをそろえる（SQL の public.app_key と同じ）。画面とサーバーの両方から使う */
export function appKey(slug: string): string {
  const s = (slug || '').trim().toLowerCase()
  if (s.startsWith('/')) return s.replace(/\/+$/, '') || '/'
  if (/^https?:\/\//.test(s)) return s.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (s.includes('.')) return s.replace(/\/+$/, '')
  return `${s}.accel-dash.com`
}

