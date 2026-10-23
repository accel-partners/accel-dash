'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * 資料置き場のファイルの共有用 URL。開くと本人確認をしてからファイルに移る。
 * 社外にも共有していないファイルは、ログインしていなければログイン画面へ送る
 */
export default function FilePage() {
  const { token } = useParams<{ token: string }>()
  const [msg, setMsg] = useState('ファイルを開いています…')

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const t = data.session?.access_token
      const res = await fetch(`/api/files/${token}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string; needLogin?: boolean }
      if (res.ok && j.url) { window.location.replace(j.url); return }
      if (j.needLogin) { window.location.replace(`/login?next=${encodeURIComponent(`${window.location.origin}/f/${token}`)}`); return }
      setMsg(j.error || `ファイルを開けませんでした（${res.status}）`)
    })()
  }, [token])

  return <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6 text-center text-black/70">{msg}</div>
}
