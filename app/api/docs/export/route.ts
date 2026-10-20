import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, ADMIN_DOMAIN } from '@/lib/supabaseAdmin'
import { appKey } from '@/lib/appKeyShared'
import { buildTree, pathOf, type DocCategory } from '@/lib/docTree'

export const dynamic = 'force-dynamic'

/**
 * 資料置き場（リンク集）を Claude 向けに書き出す。アドマネージャーの claude.ai の接続（MCP）がサーバーから呼ぶ。人は使わない。
 * - 合言葉：Vercel の BILLING_API_SECRET（アドマネージャーと同じ値。アプリどうしの合言葉）
 * - X-User-Email：claude.ai でつないでいる人。担当者か、ポータルで「資料置き場」にチェックが付いた人だけに返す（画面と同じ決まり）
 * - ?q= で名前・説明・カテゴリー・URL を絞る。?category= でカテゴリー名（の一部）で絞る
 */
function secretOk(req: NextRequest) {
  const secret = (process.env.BILLING_API_SECRET || '').trim()
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!secret || secret.length < 24 || !got) return false
  const a = Buffer.from(secret), b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function canRead(email: string) {
  const e = email.trim().toLowerCase()
  if (!e) return false
  if (e.endsWith(ADMIN_DOMAIN)) return true
  // 社外の人：ポータルで「資料置き場」（/docs）にチェックが付いているか
  const { data: apps } = await supabaseAdmin.from('apps').select('id, slug')
  const app = (apps ?? []).find((a: { slug: string }) => appKey(a.slug) === appKey('/docs'))
  if (!app) return false
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return false
    const u = data.users.find((x) => (x.email || '').toLowerCase() === e)
    if (u) {
      const { data: rows } = await supabaseAdmin.from('app_access').select('app_id').eq('user_id', u.id).eq('app_id', app.id)
      return (rows ?? []).length > 0
    }
    if (data.users.length < 200) break
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!secretOk(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const email = req.headers.get('x-user-email') || ''
  if (!(await canRead(email))) return NextResponse.json({ error: `${email || 'この人'} は資料置き場を見る権限がありません（ポータルのユーザー管理で「資料置き場」にチェックを付けてもらってください）` }, { status: 403 })
  const [c, l] = await Promise.all([
    supabaseAdmin.from('doc_categories').select('id, parent_id, name, description, sort_order'),
    supabaseAdmin.from('doc_links').select('id, title, description, url, kind, category_id, pinned, updated_at'),
  ])
  if (c.error || l.error) return NextResponse.json({ error: (c.error ?? l.error)!.message }, { status: 500 })
  const cats = (c.data ?? []) as DocCategory[]
  const byId = new Map(cats.map((x) => [x.id, x]))
  const tree = buildTree(cats)
  const path = (id: string | null) => (id && byId.has(id) ? pathOf(id, byId).map((x) => x.name).join(' › ') : '未分類')
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const cat = (req.nextUrl.searchParams.get('category') || '').trim().toLowerCase()
  let links = (l.data ?? []).map((x) => ({ title: x.title, description: x.description, url: x.url, kind: x.kind, category: path(x.category_id), important: x.pinned, updated_at: x.updated_at }))
  if (cat) links = links.filter((x) => x.category.toLowerCase().includes(cat))
  if (q) {
    const terms = q.split(/\s+/).filter(Boolean)
    links = links.filter((x) => { const hay = [x.title, x.description ?? '', x.category, x.url].join(' ').toLowerCase(); return terms.every((t) => hay.includes(t)) })
  }
  return NextResponse.json({
    categories: tree.flat.map(({ c, depth }) => ({ path: path(c.id), depth, description: c.description })),
    links: links.sort((a, b) => a.category.localeCompare(b.category, 'ja') || a.title.localeCompare(b.title, 'ja')),
    total: (l.data ?? []).length,
  })
}
