/**
 * 請求書（基幹システムの「請求書」画面から呼ぶ。サーバー専用）
 *
 *  1. 下書きを作る（buildDrafts）：基幹システムの取引商品（毎月定額・その月のスポット）と、
 *     アドマネージャーの媒体費・手数料から、顧客ごと・月ごとに 1 枚の下書きを crm_docs `invoices` に作る
 *  2. MF に作る（createInMf）：マネーフォワード クラウド請求書の API で請求書を作る（請求書番号・PDF・インボイス対応は MF のまま）
 *     作った請求書は、毎朝の MF 同期で売上（revenues）と未入金（receivables）に今までどおり入る
 *  3. 送る（sendInvoices）：MF の PDF を添付して、登録した宛先にメールで送る（SMTP）
 *
 * 顧客ごとの設定は crm_docs `billing`（id = 顧客ID）、文面などの全体設定は crm_docs `meta/invoicing`。
 * 「自動で送る」の顧客は、まとめて送るときに確認なしで送る。「確認してから」の顧客は、確認済みにしたものだけ送る。
 * 書き込みは人がボタンを押したときだけ（cron では動かさない）。
 */
import nodemailer from 'nodemailer'
import { supabaseAdmin } from './supabaseAdmin'
import { hasScope, mfFile, mfGet, mfSend, MF_INVOICE_BASE } from './mf'
import { nameKey } from './mfSync'

/* ---------- 型 ---------- */
export type Excise = 'ten_percent' | 'eight_percent_as_reduced_tax_rate' | 'untaxable' | 'non_taxable'
export interface InvoiceLine {
  id: string
  name: string
  detail?: string
  qty: number
  unit?: string
  price: number
  excise: Excise
  /** どこから来た行か：monthly＝毎月定額の取引商品、spot＝スポット、ads＝広告費・手数料、manual＝手で足した行 */
  source: 'monthly' | 'spot' | 'ads' | 'manual'
  ref?: string
}
export type InvoiceStatus = 'draft' | 'creating' | 'created' | 'sending' | 'sent' | 'error'
export interface Invoice {
  id: string
  month: string
  customerId: string
  customerName: string
  status: InvoiceStatus
  /** 人が中身を直したか（直した下書きは、作り直しで上書きしない） */
  edited?: boolean
  /** 確認済み（「確認してから送る」顧客は、これが付いたものだけまとめて送れる） */
  checked?: boolean
  checkedBy?: string
  title: string
  billingDate: string
  dueDate: string
  salesDate: string
  lines: InvoiceLine[]
  subtotal: number
  tax: number
  total: number
  mf: { partnerId: string; partnerName: string; departmentId: string; departmentName: string; auto?: boolean } | null
  to: string[]
  cc: string[]
  attention: string
  warnings: string[]
  mfBillingId?: string
  mfNumber?: string
  mfPdfUrl?: string
  lockAt?: string
  sentAt?: string
  sentBy?: string
  sentTo?: string[]
  error?: string
  history: { at: string; by: string; what: string }[]
  createdAt: string
  createdBy: string
  updatedAt: string
}
export type AdsMode = 'actual' | 'prepay' | 'fee_only' | 'none'
export interface BillingSetting {
  send?: 'auto' | 'confirm'
  to?: string
  cc?: string
  attention?: string
  partnerId?: string
  partnerName?: string
  departmentId?: string
  departmentName?: string
  adsMode?: AdsMode
  recruitMode?: AdsMode
  due?: 'next_end' | 'this_end' | 'next_next_end'
  title?: string
  skipProducts?: string[]
}
interface InvoicingMeta {
  subject?: string
  body?: string
}
interface MfDepartment { id: string; name?: string; person_name?: string; person_title?: string; email?: string; cc_emails?: string }
interface MfPartner { id: string; name: string; departments?: MfDepartment[] }
interface AdGroup { cost: number; budget: number; fee: { type: 'rate' | 'fixed'; value: number } | null; fee_amount: number | null }
interface AdClient { crm_customer_id: string; name: string; ads: AdGroup; recruit: AdGroup; platforms: { key: string; label: string; group: 'ads' | 'recruit'; cost: number; budget: number }[] }

export const DEFAULT_SUBJECT = '【株式会社アクセルパートナーズ】{月}分 ご請求書のご送付'
export const DEFAULT_BODY = [
  '{会社名}',
  '{宛名}',
  '',
  'いつも大変お世話になっております。',
  '株式会社アクセルパートナーズです。',
  '',
  '{月}分のご請求書をお送りいたします。',
  '添付の PDF をご確認くださいますよう、お願いいたします。',
  '',
  '　ご請求金額：{金額}円（税込）',
  '　お支払期限：{期限}',
  '',
  'ご不明な点がございましたら、本メールにご返信ください。',
  '今後ともどうぞよろしくお願いいたします。',
].join('\n')

/* ---------- 小さな道具 ---------- */
const now = () => new Date().toISOString()
export function jstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}
export function monthAdd(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export function monthEnd(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
export const monthJa = (ym: string) => `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月`
const yen = (n: number) => Math.round(n).toLocaleString('ja-JP')
export function dueDateOf(billingDate: string, due: BillingSetting['due']) {
  const ym = billingDate.slice(0, 7)
  if (due === 'this_end') return monthEnd(ym)
  if (due === 'next_next_end') return monthEnd(monthAdd(ym, 2))
  return monthEnd(monthAdd(ym, 1))
}
export const splitMails = (s: string | undefined) =>
  String(s || '')
    .split(/[,，;；\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
export function totals(lines: InvoiceLine[]) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.price * l.qty), 0)
  const taxable10 = lines.filter((l) => l.excise === 'ten_percent').reduce((s, l) => s + Math.round(l.price * l.qty), 0)
  const taxable8 = lines.filter((l) => l.excise === 'eight_percent_as_reduced_tax_rate').reduce((s, l) => s + Math.round(l.price * l.qty), 0)
  // 税率ごとに 1 回だけ端数を切り捨て（インボイスの決まり。確定値は MF で作ったときの値に置き換える）
  const tax = Math.floor(taxable10 * 0.1) + Math.floor(taxable8 * 0.08)
  return { subtotal, tax, total: subtotal + tax }
}
const lineId = (s: string) => s.replace(/[^\w-]/g, '').slice(0, 60)

async function getDoc<T>(collection: string, id: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin.from('crm_docs').select('data').eq('collection', collection).eq('id', id).maybeSingle()
  if (error) throw new Error(`crm_docs/${collection} の読み込みに失敗：${error.message}`)
  return (data?.data as T | undefined) ?? null
}
async function listDocs<T>(collection: string, idPrefix?: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabaseAdmin.from('crm_docs').select('data').eq('collection', collection).range(from, from + 999)
    if (idPrefix) q = q.like('id', `${idPrefix}%`)
    const { data, error } = await q
    if (error) throw new Error(`crm_docs/${collection} の読み込みに失敗：${error.message}`)
    out.push(...((data ?? []).map((r) => r.data as T)))
    if (!data || data.length < 1000) break
  }
  return out
}
async function putDoc(collection: string, id: string, data: unknown) {
  const { error } = await supabaseAdmin.from('crm_docs').upsert({ collection, id, data, updated_at: now() }, { onConflict: 'collection,id' })
  if (error) throw new Error(`crm_docs/${collection} の保存に失敗：${error.message}`)
}
export const invoiceId = (month: string, customerId: string) => `inv-${month}-${customerId}`

/* ---------- MF の取引先（宛先・部門） ---------- */
/** MF の取引先と部門（メールアドレス付き）。1 時間はしまっておいたものを使う（refresh で取り直す） */
export async function mfPartners(refresh = false): Promise<{ at: string; list: MfPartner[] }> {
  const cached = await getDoc<{ at: string; list: MfPartner[] }>('meta', 'mfpartners')
  if (!refresh && cached && Date.now() - new Date(cached.at).getTime() < 3600_000) return cached
  const list: MfPartner[] = []
  for (let page = 1; page <= 50; page++) {
    const r = await mfGet<{ data: MfPartner[]; pagination?: { total_pages?: number } }>(`${MF_INVOICE_BASE}/partners?page=${page}&per_page=100`)
    for (const p of r.data ?? []) {
      list.push({
        id: String(p.id),
        name: String(p.name ?? ''),
        departments: (p.departments ?? []).map((d) => ({ id: String(d.id), name: d.name ?? '', person_name: d.person_name ?? '', person_title: d.person_title ?? '', email: d.email ?? '', cc_emails: d.cc_emails ?? '' })),
      })
    }
    if (!r.pagination?.total_pages || page >= r.pagination.total_pages) break
  }
  const out = { at: now(), list }
  await putDoc('meta', 'mfpartners', out)
  return out
}

/** 顧客に当てる MF の取引先・部門：設定 → 名寄せ表（meta/mfmap）で同じ顧客に当てた取引先名 → 名前が 1 つだけ合う取引先 */
export function pickPartner(customerId: string, customerName: string, setting: BillingSetting | null, partners: MfPartner[], mfmap: Record<string, string>) {
  const dept = (p: MfPartner, id?: string) => (id ? p.departments?.find((d) => d.id === id) : undefined) ?? p.departments?.[0]
  if (setting?.departmentId) {
    for (const p of partners) {
      const d = p.departments?.find((x) => x.id === setting.departmentId)
      if (d) return { partner: p, dept: d, auto: false }
    }
  }
  if (setting?.partnerId) {
    const p = partners.find((x) => x.id === setting.partnerId)
    if (p && dept(p)) return { partner: p, dept: dept(p)!, auto: false }
  }
  const names = Object.entries(mfmap).filter(([, id]) => id === customerId).map(([n]) => n)
  for (const n of names) {
    const hits = partners.filter((p) => p.name === n || nameKey(p.name) === nameKey(n))
    if (hits.length === 1 && dept(hits[0])) return { partner: hits[0], dept: dept(hits[0])!, auto: true }
  }
  const hits = partners.filter((p) => nameKey(p.name) === nameKey(customerName))
  if (hits.length === 1 && dept(hits[0])) return { partner: hits[0], dept: dept(hits[0])!, auto: true }
  return null
}

/* ---------- アドマネージャーの数字 ---------- */
async function adFigures(months: string[]): Promise<{ ok: boolean; data: Record<string, AdClient[]>; error?: string }> {
  const secret = (process.env.BILLING_API_SECRET || '').trim()
  const base = (process.env.ADMANAGER_URL || 'https://admanager.accel-dash.com').replace(/\/$/, '')
  if (!secret) return { ok: false, data: {}, error: 'Vercel に BILLING_API_SECRET が無いため、アドマネージャーの広告費は入れていません' }
  try {
    const res = await fetch(`${base}/api/billing?month=${months.join(',')}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' })
    const j = (await res.json().catch(() => ({}))) as { months?: Record<string, AdClient[]>; error?: string }
    if (!res.ok) return { ok: false, data: {}, error: `アドマネージャーの数字を読めませんでした（${res.status}：${j.error ?? ''}）` }
    return { ok: true, data: j.months ?? {} }
  } catch (e) {
    return { ok: false, data: {}, error: `アドマネージャーにつながりませんでした：${e instanceof Error ? e.message : String(e)}` }
  }
}

/** 顧客ごとに、アドマネージャーのクライアント（複数あれば足す）をまとめる */
function adsByCustomer(list: AdClient[] | undefined) {
  const m = new Map<string, AdClient[]>()
  for (const c of list ?? []) {
    const a = m.get(c.crm_customer_id) ?? []
    a.push(c)
    m.set(c.crm_customer_id, a)
  }
  return m
}

/**
 * 広告の請求行。month はこの請求書の対象月。
 * - actual：その月の実績の媒体費（媒体ごと）＋手数料
 * - prepay：その月の予算（媒体ごと）＋手数料（予算から）、前の月の実績と予算の差を精算
 * - fee_only：その月の手数料だけ（媒体費はクライアントが直接払う）
 */
export function adLines(group: 'ads' | 'recruit', mode: AdsMode, month: string, cur: AdClient[] | undefined, prev: AdClient[] | undefined): { lines: InvoiceLine[]; warnings: string[] } {
  const lines: InvoiceLine[] = []
  const warnings: string[] = []
  if (!cur?.length || mode === 'none') return { lines, warnings }
  const gLabel = group === 'ads' ? '広告' : '求人広告'
  const plats = (list: AdClient[] | undefined) => {
    const m = new Map<string, { label: string; cost: number; budget: number }>()
    for (const c of list ?? []) for (const p of c.platforms.filter((x) => x.group === group)) {
      const v = m.get(p.key) ?? { label: p.label, cost: 0, budget: 0 }
      v.cost += p.cost
      v.budget += p.budget
      m.set(p.key, v)
    }
    return m
  }
  const feeOf = (list: AdClient[] | undefined, base: 'cost' | 'budget') => {
    let amt = 0
    let has = false
    const labels: string[] = []
    for (const c of list ?? []) {
      const g = c[group]
      if (!g.fee) continue
      has = true
      amt += g.fee.type === 'rate' ? Math.round((g[base] * g.fee.value) / 100) : Math.round(g.fee.value)
      labels.push(g.fee.type === 'rate' ? `${g.fee.value}%` : '定額')
    }
    return { has, amt, label: [...new Set(labels)].join('・') }
  }
  const mj = monthJa(month)
  const cp = plats(cur)
  if (mode === 'actual' || mode === 'prepay') {
    for (const [k, p] of cp) {
      const v = mode === 'actual' ? p.cost : p.budget
      if (v <= 0) continue
      lines.push({ id: lineId(`${group}-${k}`), name: `${p.label} ${gLabel}費`, detail: `${mj}分・${mode === 'actual' ? '実績' : 'ご予算'}`, qty: 1, unit: '式', price: Math.round(v), excise: 'ten_percent', source: 'ads', ref: k })
    }
    if (mode === 'prepay' && [...cp.values()].every((p) => p.budget <= 0)) warnings.push(`${gLabel}：${mj}の月予算がアドマネージャーに入っていません`)
  }
  const fee = feeOf(cur, mode === 'prepay' ? 'budget' : 'cost')
  if (fee.has && fee.amt > 0) lines.push({ id: lineId(`${group}-fee`), name: `${gLabel}運用手数料`, detail: `${mj}分${fee.label ? `（${fee.label}）` : ''}`, qty: 1, unit: '式', price: fee.amt, excise: 'ten_percent', source: 'ads', ref: 'fee' })
  else if (!fee.has) warnings.push(`${gLabel}：アドマネージャーに手数料が入っていません`)
  if (mode === 'prepay' && prev?.length) {
    const pp = plats(prev)
    const pm = monthJa(monthAdd(month, -1))
    for (const [k, p] of pp) {
      const diff = Math.round(p.cost - p.budget)
      if (p.budget <= 0 || diff === 0) continue
      lines.push({ id: lineId(`${group}-${k}-adj`), name: `${p.label} ${gLabel}費 精算`, detail: `${pm}分（実績と前払いの差）`, qty: 1, unit: '式', price: diff, excise: 'ten_percent', source: 'ads', ref: `${k}-adj` })
    }
    const pf = feeOf(prev, 'cost'), pfb = feeOf(prev, 'budget')
    const fdiff = pf.amt - pfb.amt
    if (pf.has && fdiff !== 0) lines.push({ id: lineId(`${group}-fee-adj`), name: `${gLabel}運用手数料 精算`, detail: `${pm}分（実績と前払いの差）`, qty: 1, unit: '式', price: fdiff, excise: 'ten_percent', source: 'ads', ref: 'fee-adj' })
  }
  return { lines, warnings }
}

/* ---------- 1. 下書きを作る ---------- */
interface CrmCustomer { id: string; name?: string; contactName?: string; email?: string; statusId?: string }
interface CrmProduct { id: string; customerId: string; title?: string; kind?: string; amount?: number; startMonth?: string; endMonth?: string; targetMonth?: string; active?: boolean }

export function productActiveIn(p: CrmProduct, month: string) {
  if (p.active === false) return false
  if ((p.kind || 'monthly') === 'spot') return !!p.targetMonth && p.targetMonth === month
  if (p.startMonth && month < p.startMonth) return false
  if (p.endMonth && month > p.endMonth) return false
  return true
}

export interface DraftSummary { month: string; created: number; updated: number; kept: number; skipped: number; warnings: string[] }

export async function buildDrafts(month: string, by: string, onlyCustomer?: string): Promise<DraftSummary> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('月の形が違います（YYYY-MM）')
  const [customers, products, settingsRows, existing, mfmapDoc] = await Promise.all([
    listDocs<CrmCustomer>('customers'),
    listDocs<CrmProduct>('products'),
    supabaseAdmin.from('crm_docs').select('id,data').eq('collection', 'billing'),
    listDocs<Invoice>('invoices', `inv-${month}-`),
    getDoc<{ map?: Record<string, string> }>('meta', 'mfmap'),
  ])
  if (settingsRows.error) throw new Error(settingsRows.error.message)
  const settings = new Map((settingsRows.data ?? []).map((r) => [r.id as string, r.data as BillingSetting]))
  const ex = new Map(existing.map((i) => [i.customerId, i]))
  const mfmap = mfmapDoc?.map ?? {}
  const warnings: string[] = []
  let partners: MfPartner[] = []
  try {
    partners = (await mfPartners()).list
  } catch (e) {
    warnings.push(`MF の取引先を読めませんでした（宛先は後で選べます）：${e instanceof Error ? e.message : String(e)}`)
  }
  const ad = await adFigures([month, monthAdd(month, -1)])
  if (!ad.ok && ad.error) warnings.push(ad.error)
  const adCur = adsByCustomer(ad.data[month])
  const adPrev = adsByCustomer(ad.data[monthAdd(month, -1)])

  const byCustomer = new Map<string, CrmProduct[]>()
  for (const p of products) {
    if (!p.customerId || !productActiveIn(p, month)) continue
    const a = byCustomer.get(p.customerId) ?? []
    a.push(p)
    byCustomer.set(p.customerId, a)
  }

  const today = jstToday()
  let created = 0, updated = 0, kept = 0, skipped = 0
  const custById = new Map(customers.map((c) => [c.id, c]))
  const ids = new Set([...byCustomer.keys(), ...adCur.keys()].filter((id) => custById.has(id)))
  if (onlyCustomer) for (const id of [...ids]) if (id !== onlyCustomer) ids.delete(id)
  for (const cid of ids) {
    const c = custById.get(cid)!
    const s = settings.get(cid) ?? {}
    const prev = ex.get(cid)
    // MF に作った・送った・人が直した下書きは作り直さない
    if (prev && (prev.status !== 'draft' && prev.status !== 'error' || prev.edited)) {
      kept++
      continue
    }
    const lines: InvoiceLine[] = []
    const w: string[] = []
    for (const p of (byCustomer.get(cid) ?? []).sort((a, b) => String(a.kind).localeCompare(String(b.kind)))) {
      if ((s.skipProducts ?? []).includes(p.id)) continue
      const amt = Math.round(Number(p.amount) || 0)
      if (!amt) continue
      const spot = (p.kind || 'monthly') === 'spot'
      lines.push({ id: lineId(`p-${p.id}`), name: String(p.title || (spot ? 'スポット' : '月額サービス')).slice(0, 60), detail: spot ? '' : `${monthJa(month)}分`, qty: 1, unit: '式', price: amt, excise: 'ten_percent', source: spot ? 'spot' : 'monthly', ref: p.id })
    }
    for (const g of ['ads', 'recruit'] as const) {
      const mode: AdsMode = (g === 'ads' ? s.adsMode : s.recruitMode) ?? 'actual'
      const r = adLines(g, mode, month, adCur.get(cid), adPrev.get(cid))
      lines.push(...r.lines)
      w.push(...r.warnings)
    }
    if (!lines.length) {
      skipped++
      continue
    }
    if (lines.some((l) => l.source === 'monthly' && /広告|運用|リスティング|手数料/.test(l.name)) && lines.some((l) => l.source === 'ads' && l.ref === 'fee')) {
      w.push('取引商品の月額（広告の運用など）と、アドマネージャーの手数料の両方が入っています。二重になっていないか確認してください')
    }
    const pick = partners.length ? pickPartner(cid, String(c.name || ''), s, partners, mfmap) : null
    if (!pick) w.push('MF の取引先・部門が決まっていません（顧客の請求設定で選んでください）')
    const to = splitMails(s.to).length ? splitMails(s.to) : splitMails(pick?.dept.email)
    const cc = splitMails(s.cc).length ? splitMails(s.cc) : splitMails(pick?.dept.cc_emails)
    if (!to.length) w.push('送付先のメールアドレスがありません（MF の部門か、顧客の請求設定に入れてください）')
    const billingDate = today
    const t = totals(lines)
    const inv: Invoice = {
      id: invoiceId(month, cid),
      month,
      customerId: cid,
      customerName: String(c.name || ''),
      status: 'draft',
      checked: false,
      title: (s.title || '{月}分 ご請求書').replace(/\{月\}/g, monthJa(month)).slice(0, 80),
      billingDate,
      dueDate: dueDateOf(billingDate, s.due),
      salesDate: monthEnd(month),
      lines,
      ...t,
      mf: pick ? { partnerId: pick.partner.id, partnerName: pick.partner.name, departmentId: pick.dept.id, departmentName: pick.dept.name ?? '', auto: pick.auto } : null,
      to,
      cc,
      attention: s.attention || (pick?.dept.person_name ? `${pick.dept.person_name} 様` : c.contactName ? `${c.contactName} 様` : 'ご担当者 様'),
      warnings: w,
      history: [...(prev?.history ?? []), { at: now(), by, what: prev ? '下書きを作り直し' : '下書きを作成' }].slice(-30),
      createdAt: prev?.createdAt ?? now(),
      createdBy: prev?.createdBy ?? by,
      updatedAt: now(),
    }
    await putDoc('invoices', inv.id, inv)
    if (prev) updated++
    else created++
  }
  return { month, created, updated, kept, skipped, warnings }
}

/* ---------- 2. MF に作る ---------- */
const LOCK_MS = 5 * 60_000
async function lock(inv: Invoice, status: 'creating' | 'sending') {
  if ((inv.status === 'creating' || inv.status === 'sending') && inv.lockAt && Date.now() - new Date(inv.lockAt).getTime() < LOCK_MS) {
    throw new Error('ほかの人が処理しています。少し待ってから開き直してください')
  }
  const next = { ...inv, status, lockAt: now() }
  await putDoc('invoices', inv.id, next)
  return next
}

interface MfBilling { id: string; billing_number?: string; pdf_url?: string; subtotal_price?: string; excise_price?: string; total_price?: string; partner_name?: string }

export async function createInMf(id: string, by: string): Promise<Invoice> {
  let inv = await getDoc<Invoice>('invoices', id)
  if (!inv) throw new Error('請求書が見つかりません')
  if (inv.mfBillingId) return inv
  if (inv.status === 'creating' && inv.lockAt && Date.now() - new Date(inv.lockAt).getTime() >= LOCK_MS) {
    // 前回、MF に送ったあとで止まった可能性がある。二重に作らないよう、人に確かめてもらう
    throw new Error('前回の作成が途中で止まっています。MF に同じ請求書ができていないか確かめてから「やり直す」を押してください')
  }
  if (!(await hasScope('mfc/invoice/data.write'))) throw new Error('MF に請求書を作る権限がまだありません。アクセルダッシュの「マネーフォワード連携」で「接続」を押し、もう一度許可してください')
  const mf = inv.mf
  if (!mf?.departmentId) throw new Error('MF の取引先・部門が決まっていません')
  if (!inv.lines.length) throw new Error('明細がありません')
  if (inv.lines.some((l) => !l.name.trim() || !Number.isFinite(l.price) || !Number.isFinite(l.qty))) throw new Error('品目名・単価・数量の入っていない行があります')
  inv = await lock(inv, 'creating')
  try {
    const b = await mfSend<MfBilling>('POST', `${MF_INVOICE_BASE}/invoice_template_billings`, {
      department_id: mf.departmentId,
      title: inv.title,
      billing_date: inv.billingDate,
      due_date: inv.dueDate,
      sales_date: inv.salesDate,
      tag_names: ['基幹システム'],
      items: inv.lines.map((l) => ({ name: l.name.slice(0, 100), detail: l.detail || undefined, unit: l.unit || undefined, price: Math.round(l.price), quantity: l.qty, excise: l.excise })),
    })
    const num = (v: unknown) => Math.round(Number(String(v ?? '').replace(/,/g, '')) || 0)
    const next: Invoice = {
      ...inv,
      status: 'created',
      lockAt: undefined,
      error: undefined,
      mfBillingId: String(b.id),
      mfNumber: b.billing_number ?? '',
      mfPdfUrl: b.pdf_url ?? '',
      subtotal: b.subtotal_price != null ? num(b.subtotal_price) : inv.subtotal,
      tax: b.excise_price != null ? num(b.excise_price) : inv.tax,
      total: b.total_price != null ? num(b.total_price) : inv.total,
      history: [...inv.history, { at: now(), by, what: `MF に作成（${b.billing_number ?? b.id}）` }].slice(-30),
      updatedAt: now(),
    }
    await putDoc('invoices', id, next)
    // 毎朝の同期で売上・未入金をこの顧客につなげるよう、取引先名 → 顧客 の対応が無ければ足す
    const pn = b.partner_name || mf.partnerName
    if (pn) {
      const mm = (await getDoc<{ map?: Record<string, string> }>('meta', 'mfmap')) ?? {}
      if (!mm.map?.[pn]) await putDoc('meta', 'mfmap', { ...mm, map: { ...(mm.map ?? {}), [pn]: inv.customerId } })
    }
    return next
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 応答が返らずに失敗したときは、MF にできている可能性があるので「creating」のまま残す
    const sure = /MF API エラー（4\d\d/.test(msg)
    await putDoc('invoices', id, { ...inv, status: sure ? 'error' : 'creating', lockAt: sure ? undefined : inv.lockAt, error: msg, updatedAt: now() })
    throw e
  }
}

/** 止まった「作成中」を人が確かめたあとで戻す（MF にできていなかったときだけ押してもらう） */
export async function resetStuck(id: string, by: string) {
  const inv = await getDoc<Invoice>('invoices', id)
  if (!inv) throw new Error('請求書が見つかりません')
  if (inv.status !== 'creating' && inv.status !== 'sending') return inv
  const next: Invoice = { ...inv, status: inv.mfBillingId ? 'created' : 'draft', lockAt: undefined, history: [...inv.history, { at: now(), by, what: '途中で止まった処理をやり直せるように戻した' }].slice(-30), updatedAt: now() }
  await putDoc('invoices', id, next)
  return next
}

/* ---------- 3. 送る ---------- */
export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM)
}
function transport() {
  const port = Number(process.env.SMTP_PORT || 465)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') },
  })
}
export function fillTemplate(t: string, inv: Invoice) {
  const d = inv.dueDate ? `${Number(inv.dueDate.slice(0, 4))}年${Number(inv.dueDate.slice(5, 7))}月${Number(inv.dueDate.slice(8, 10))}日` : '—'
  return t
    .replace(/\{会社名\}/g, inv.customerName)
    .replace(/\{宛名\}/g, inv.attention || 'ご担当者 様')
    .replace(/\{月\}/g, monthJa(inv.month))
    .replace(/\{金額\}/g, yen(inv.total))
    .replace(/\{期限\}/g, d)
    .replace(/\{請求書番号\}/g, inv.mfNumber || '')
    .replace(/\{件名\}/g, inv.title)
}

export async function sendInvoice(id: string, by: string): Promise<Invoice> {
  if (!mailConfigured()) throw new Error('メールの送り元が設定されていません（Vercel の SMTP_HOST・SMTP_USER・SMTP_PASS・MAIL_FROM）')
  let inv = await getDoc<Invoice>('invoices', id)
  if (!inv) throw new Error('請求書が見つかりません')
  if (inv.status === 'sent') throw new Error('この請求書はもう送ってあります（もう一度送るときは「再送」）')
  if (!inv.to.length) throw new Error('送付先のメールアドレスがありません')
  if (!inv.mfBillingId) inv = await createInMf(id, by)
  const meta = (await getDoc<InvoicingMeta>('meta', 'invoicing')) ?? {}
  const pdf = await mfFile(inv.mfPdfUrl || `${MF_INVOICE_BASE}/billings/${inv.mfBillingId}/pdf`)
  inv = await lock(inv, 'sending')
  try {
    const subject = fillTemplate(meta.subject || DEFAULT_SUBJECT, inv)
    const text = fillTemplate(meta.body || DEFAULT_BODY, inv)
    const fileName = `請求書_${inv.customerName}_${monthJa(inv.month)}分${inv.mfNumber ? `_${inv.mfNumber}` : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '')
    const bcc = splitMails(process.env.MAIL_BCC)
    await transport().sendMail({
      from: process.env.MAIL_FROM,
      to: inv.to,
      cc: inv.cc.length ? inv.cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject,
      text,
      attachments: [{ filename: fileName, content: pdf.data, contentType: 'application/pdf' }],
    })
    const next: Invoice = {
      ...inv,
      status: 'sent',
      lockAt: undefined,
      error: undefined,
      sentAt: now(),
      sentBy: by,
      sentTo: [...inv.to, ...inv.cc],
      history: [...inv.history, { at: now(), by, what: `メールで送付（${[...inv.to, ...inv.cc].join('、')}）` }].slice(-30),
      updatedAt: now(),
    }
    await putDoc('invoices', id, next)
    return next
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await putDoc('invoices', id, { ...inv, status: 'created', lockAt: undefined, error: `送れませんでした：${msg}`, updatedAt: now() })
    throw new Error(`送れませんでした：${msg}`)
  }
}

/** 送ったものをもう一度送る（宛先を直したときなど） */
export async function resend(id: string, by: string) {
  const inv = await getDoc<Invoice>('invoices', id)
  if (!inv) throw new Error('請求書が見つかりません')
  if (inv.status === 'sent') await putDoc('invoices', id, { ...inv, status: 'created', history: [...inv.history, { at: now(), by, what: '再送のため送付済みを外した' }].slice(-30) })
  return sendInvoice(id, by)
}

/**
 * まとめて送る：その月の、まだ送っていない請求書のうち、
 * 「自動で送る」の顧客の分と、「確認してから」で確認済みにした分だけ
 */
export async function sendBulk(month: string, by: string) {
  const list = await listDocs<Invoice>('invoices', `inv-${month}-`)
  const { data, error } = await supabaseAdmin.from('crm_docs').select('id,data').eq('collection', 'billing')
  if (error) throw new Error(error.message)
  const settings = new Map((data ?? []).map((r) => [r.id as string, r.data as BillingSetting]))
  const targets = list.filter((i) => i.status !== 'sent' && i.status !== 'creating' && i.status !== 'sending' && i.to.length && (i.checked || (settings.get(i.customerId)?.send ?? 'confirm') === 'auto'))
  const sent: string[] = []
  const failed: { id: string; name: string; error: string }[] = []
  for (const i of targets) {
    try {
      await sendInvoice(i.id, by)
      sent.push(i.id)
    } catch (e) {
      failed.push({ id: i.id, name: i.customerName, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { targets: targets.length, sent: sent.length, failed }
}
