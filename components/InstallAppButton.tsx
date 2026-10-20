'use client'

/**
 * 「アプリとして入れる」ボタン（ポータルのトップだけに出す）
 * - Chrome / Edge：ブラウザのインストール画面を開く（Dock・タスクバーに置けるようになる）
 * - Safari：サブドメインのアプリへ移ると Safari に戻ってしまうため、Chrome をすすめる
 * - すでにアプリとして開いているとき、「閉じる」を押したあとは出さない
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, X } from 'lucide-react'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'accel-install-dismissed'

export default function InstallAppButton() {
  const pathname = usePathname()
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [safari, setSafari] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch {}
    if (standalone || dismissed) return
    setHidden(false)

    const ua = navigator.userAgent
    setSafari(/Safari/.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS|Firefox/.test(ua))

    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as InstallPromptEvent) }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (pathname !== '/' || hidden || (!promptEvent && !safari)) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setHidden(true)
  }
  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice.catch(() => null)
    setPromptEvent(null)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border-2 border-border-soft bg-surface p-3 pl-4 text-sm shadow-lg">
      {promptEvent ? (
        <button onClick={install} className="flex items-center gap-2 font-bold text-accel-primary hover:text-accel-hover">
          <Download size={16} />
          アプリとして入れる（Dock に置けます）
        </button>
      ) : (
        <p className="leading-relaxed text-black/70">
          Chrome で開くと、アクセルダッシュを Dock に置けるアプリとして入れられます（Safari だと各アプリへ移るたびにブラウザに戻ってしまいます）。
        </p>
      )}
      <button onClick={dismiss} aria-label="閉じる" className="flex-shrink-0 rounded p-0.5 text-black/40 hover:bg-surface-muted hover:text-black">
        <X size={14} />
      </button>
    </div>
  )
}
