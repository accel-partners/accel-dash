// サーバー専用。Cloudflare テスト版で、チャットワークをテスト用ルームにだけ送るための部品。
// 本番（Vercel）では testChatworkRoom() が常に null なので、ここの処理は動かない。
import { supabaseAdmin } from './supabaseAdmin'
import { IS_TEST_DEPLOY } from './testMode'
import { jstToday, paidText, postChatwork, reminderText } from './receivables'

type Recv = Parameters<typeof reminderText>[0][number]

/** テスト版の送り先。テスト版で、Cloudflare に CHATWORK_TEST_ROOM_ID が入っているときだけ返す */
export function testChatworkRoom(): string | null {
  if (!IS_TEST_DEPLOY) return null
  const id = String(process.env.CHATWORK_TEST_ROOM_ID || '').replace(/\D/g, '')
  return id || null
}

export const TEST_CHATWORK_TAG = '【Cloudflare テスト版から送信・本番の通知ではありません】'

/**
 * 未入金通知の「中身」だけをテスト用ルームに送る。
 * 本番の notifyReceivables() と違い、データベースには何も書き込まない
 * （送った印を付けないので、本番の通知が抜けることはない）。
 */
export async function previewReceivables(room: string, token: string, now = new Date()) {
  const recs: Recv[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('crm_docs').select('id,data').eq('collection', 'receivables').range(from, from + 999)
    if (error) throw new Error(`未入金の読み込みに失敗：${error.message}`)
    for (const r of data ?? []) recs.push({ ...(r.data as Recv), id: r.id as string })
    if (!data || data.length < 1000) break
  }
  const { data: meta } = await supabaseAdmin
    .from('crm_docs').select('data').eq('collection', 'meta').eq('id', 'receivables').maybeSingle()
  const day = Math.max(1, Math.min(15, Number((meta?.data as { chatwork?: { remindDay?: number } } | null)?.chatwork?.remindDay) || 3))
  const today = jstToday(now)
  await postChatwork(room, token, `${TEST_CHATWORK_TAG}\n${reminderText(recs, today, day)}`)
  const pending = recs.filter((r) => r.status === 'paid' && (r as { notifyPaid?: boolean }).notifyPaid)
  if (pending.length) await postChatwork(room, token, `${TEST_CHATWORK_TAG}\n${paidText(pending)}`)
  return { records: recs.length, paidPending: pending.length }
}
