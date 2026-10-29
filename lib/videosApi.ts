import { NextResponse } from 'next/server'
import { requireAdmin, requireAppUser } from './supabaseAdmin'
import { VimeoError } from './vimeo'

/** 社内動画（/videos）の API 共通：担当者、またはポータルで「社内動画」にチェックが付いている人だけ */
export const VIDEOS_SLUG = '/videos'

type User = { id: string; email: string }

export async function videosRoute(req: Request, fn: (user: User) => Promise<unknown>, opts: { admin?: boolean } = {}) {
  const auth = opts.admin ? await requireAdmin(req) : await requireAppUser(req, VIDEOS_SLUG)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
  try {
    const out = await fn(auth.user)
    return out instanceof NextResponse ? out : NextResponse.json(out ?? { ok: true })
  } catch (e) {
    const status = e instanceof VimeoError ? e.status : 500
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[videos]', status, msg.slice(0, 200))
    return NextResponse.json({ error: msg }, { status: status >= 400 ? status : 500 })
  }
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
