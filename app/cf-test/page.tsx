'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { IS_TEST_DEPLOY } from '@/lib/testMode'

/** Cloudflare テスト版だけのページ：チャットワークをテスト用ルームに送って確かめる */
export default function CfTestPage() {
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  if (!IS_TEST_DEPLOY) return <main style={{ padding: 24 }}>このページはテスト版だけで使えます。</main>

  async function call(label: string, path: string) {
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } })
      const text = await res.text()
      setLog((l) => [`${new Date().toLocaleTimeString('ja-JP')} ${label}：${res.ok ? '成功' : `失敗（${res.status}）`} ${text}`, ...l])
    } catch (e) {
      setLog((l) => [`${label}：失敗 ${e instanceof Error ? e.message : String(e)}`, ...l])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>テスト段階2：チャットワーク</h1>
      <p>送り先は Cloudflare の CHATWORK_TEST_ROOM_ID のルームだけです。本番の通知先には送りません。データベースにも書き込みません。</p>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <button disabled={busy} onClick={() => call('テスト送信', '/api/chatwork/test')} style={{ padding: '8px 16px', border: '1px solid #999', borderRadius: 6 }}>① テスト送信</button>
        <button disabled={busy} onClick={() => call('未入金通知の中身', '/api/test/receivables-preview')} style={{ padding: '8px 16px', border: '1px solid #999', borderRadius: 6 }}>② 未入金通知の中身を送る</button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 13 }}>{log.join('\n') || 'まだ送っていません'}</pre>
    </main>
  )
}
