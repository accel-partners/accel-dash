import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabaseAdmin'
import { previewReceivables, testChatworkRoom } from '@/lib/testChatwork'

export const dynamic = 'force-dynamic'

/** Cloudflare テスト版だけ：未入金通知の中身をテスト用ルームに送る（データベースには書き込まない）。本番では 404 */
export async function POST(req: NextRequest) {
  const room = testChatworkRoom()
  if (!room) return NextResponse.json({ error: 'テスト版でテスト用ルームが設定されているときだけ使えます' }, { status: 404 })
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status })
  const token = process.env.CHATWORK_API_TOKEN
  if (!token) return NextResponse.json({ error: 'Cloudflare に CHATWORK_API_TOKEN が入っていません' }, { status: 400 })
  try {
    const r = await previewReceivables(room, token)
    return NextResponse.json({ ok: true, room, ...r })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
