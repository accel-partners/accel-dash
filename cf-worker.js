// Cloudflare Workers の入口。画面・API は OpenNext が作った .open-next/worker.js にそのまま渡し、
// 決まった時刻（wrangler.jsonc の triggers.crons）には、Vercel Cron と同じように API を呼ぶ。
// Vercel では使わない（next build の対象外）。
import handler from './.open-next/worker.js'

// 時刻（UTC の cron 式）→ 呼ぶ API。wrangler.jsonc の triggers.crons と同じ式にする
const JOBS = {
  '0 1 * * *': '/api/mf/sync', // 毎朝 10:00（日本時間）：MF 同期（最後に未入金通知も送る）
  '30 1 * * *': '/api/receivables/notify' // 毎朝 10:30（日本時間）：未入金通知の取りこぼし用
}

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const path = JOBS[event.cron]
    if (!path) {
      console.log(`[cron] 知らない時刻の指定です：${event.cron}`)
      return
    }
    const secret = String(env.CRON_SECRET || '').trim()
    if (!secret) {
      console.log(`[cron] CRON_SECRET が未設定のため ${path} を動かしません`)
      return
    }
    const req = new Request(`https://accel-dash.com${path}`, {
      headers: { authorization: `Bearer ${secret}`, 'user-agent': 'cloudflare-cron' }
    })
    const res = await handler.fetch(req, env, ctx)
    const body = (await res.text()).slice(0, 300)
    console.log(`[cron] ${path} → ${res.status} ${body}`)
  }
}
