import { NextRequest, NextResponse } from 'next/server'
import { requireAppUser } from '@/lib/supabaseAdmin'
import { buildDrafts, createInMf, mailConfigured, mfPartners, resend, resetStuck, sendBulk, sendInvoice } from '@/lib/invoices'
import { hasScope } from '@/lib/mf'

export const dynamic = 'force-dynamic'
// まとめて送るときは 1 社ずつ MF に作って PDF を取って送るので時間がかかる
export const maxDuration = 300

/**
 * 請求書（基幹システムの「請求書」画面から呼ぶ）。使えるのは基幹システムを使える人（担当者と、ポータルで基幹システムにチェックした人）。
 * GET：MF の取引先・部門の一覧と、設定の状態（MF に書けるか・メールを送れるか）。?refresh=1 で MF から取り直す
 * POST { action, month?, id?, customerId? }
 *   draft   … その月の下書きを作る（customerId を付けるとその顧客だけ）
 *   create  … MF に請求書を作る（id）
 *   send    … MF に作って PDF をメールで送る（id）
 *   resend  … 送った請求書をもう一度送る（id）
 *   bulk    … その月の「自動で送る」顧客の分と、確認済みにした分をまとめて送る（month）
 *   unstick … 途中で止まった処理を戻す（id。MF に同じ請求書ができていないか人が確かめてから）
 */
const ORIGINS = ['https://crm.accel-dash.com', 'https://accel-dash.com']
function cors(req: NextRequest) {
  const o = req.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  }
}
const APP = 'crm.accel-dash.com'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

export async function GET(req: NextRequest) {
  const h = cors(req)
  const auth = await requireAppUser(req, APP)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status, headers: h })
  const refresh = new URL(req.url).searchParams.get('refresh') === '1'
  let partners: Awaited<ReturnType<typeof mfPartners>> | null = null
  let partnerError = ''
  try {
    partners = await mfPartners(refresh)
  } catch (e) {
    partnerError = e instanceof Error ? e.message : String(e)
  }
  let canWrite = false
  try {
    canWrite = await hasScope('mfc/invoice/data.write')
  } catch {
    /* 接続していない */
  }
  return NextResponse.json(
    {
      partners: partners?.list ?? [],
      partnersAt: partners?.at ?? null,
      partnerError,
      canWrite,
      mail: mailConfigured(),
      mailFrom: process.env.MAIL_FROM || '',
      ads: !!process.env.BILLING_API_SECRET,
    },
    { headers: h }
  )
}

export async function POST(req: NextRequest) {
  const h = cors(req)
  const auth = await requireAppUser(req, APP)
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status, headers: h })
  const b = (await req.json().catch(() => ({}))) as { action?: string; month?: string; id?: string; customerId?: string }
  const by = auth.user.email
  try {
    switch (b.action) {
      case 'draft':
        return NextResponse.json(await buildDrafts(String(b.month || ''), by, b.customerId || undefined), { headers: h })
      case 'create':
        return NextResponse.json({ invoice: await createInMf(String(b.id || ''), by) }, { headers: h })
      case 'send':
        return NextResponse.json({ invoice: await sendInvoice(String(b.id || ''), by) }, { headers: h })
      case 'resend':
        return NextResponse.json({ invoice: await resend(String(b.id || ''), by) }, { headers: h })
      case 'bulk':
        return NextResponse.json(await sendBulk(String(b.month || ''), by), { headers: h })
      case 'unstick':
        return NextResponse.json({ invoice: await resetStuck(String(b.id || ''), by) }, { headers: h })
      default:
        return NextResponse.json({ error: 'action が違います' }, { status: 400, headers: h })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400, headers: h })
  }
}
