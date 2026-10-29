'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import { canUseApp, NO_ACCESS_HINT, NO_ACCESS_TEXT, STAFF_DOMAIN } from '@/lib/appAccess'
import { VIDEOS_SLUG } from '@/lib/videosClient'

/**
 * 社内動画の画面の枠（ヘッダーと権限の確認）。
 * 見られるのは担当者（@accel-partners.co.jp）と、ポータルのユーザー管理で「社内動画」にチェックを付けた人。
 * 本当の守りはサーバーの API（requireAppUser）。ここは表示の出し分け。
 */
export default function Shell({ children }: { children: (me: { email: string; isAdmin: boolean }) => ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'ng'>('loading')
  const [email, setEmail] = useState('')

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.push('/login'); return }
      const mail = data.session.user.email ?? ''
      setEmail(mail)
      setState((await canUseApp(VIDEOS_SLUG, mail)) ? 'ok' : 'ng')
    })()
  }, [router])

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-border-soft bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-black/70 hover:text-black">
              <ArrowLeft size={16} /> ポータル
            </Link>
            <img src="/logo.png" alt="ACCEL DASH" className="h-9 w-auto" />
            <Link href="/videos" className="hidden text-lg font-bold text-black sm:inline">社内動画</Link>
          </div>
          <div className="flex items-center gap-4">
            {email && <span className="hidden text-sm text-black/70 md:inline">{email}</span>}
            <button onClick={async () => { await signOut(); router.push('/login') }} className="flex items-center gap-2 rounded-lg border-2 border-border-soft bg-surface px-4 py-2 text-black hover:border-accel-secondary">
              <LogOut size={18} /> ログアウト
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {state === 'loading' ? (
          <p className="py-20 text-center text-black/70">読み込み中…</p>
        ) : state === 'ng' ? (
          <div className="rounded-xl border border-border-soft bg-surface p-10 text-center text-black/70">
            {NO_ACCESS_TEXT}<br /><span className="text-sm">{NO_ACCESS_HINT}</span>
          </div>
        ) : (
          children({ email, isAdmin: email.toLowerCase().endsWith(STAFF_DOMAIN) })
        )}
      </main>
    </div>
  )
}
