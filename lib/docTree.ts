/** 資料置き場のカテゴリー（親子で何段でも）。画面とサーバー（Claude 向けの書き出し）で共通 */
export interface DocCategory {
  id: string
  parent_id: string | null
  name: string
  description: string | null
  sort_order: number
}

const byOrder = (a: DocCategory, b: DocCategory) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ja')

/** 親ごとの子（キー '' が一番上）と、木の順に並べた一覧（深さ付き） */
export function buildTree(cats: DocCategory[]) {
  const ids = new Set(cats.map((c) => c.id))
  const children = new Map<string, DocCategory[]>()
  for (const c of cats) {
    const k = c.parent_id && ids.has(c.parent_id) ? c.parent_id : ''
    const a = children.get(k) ?? []
    a.push(c)
    children.set(k, a)
  }
  for (const a of children.values()) a.sort(byOrder)
  const flat: { c: DocCategory; depth: number }[] = []
  const seen = new Set<string>()
  const walk = (k: string, depth: number) => {
    for (const c of children.get(k) ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      flat.push({ c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk('', 0)
  return { children, flat }
}

/** その下にあるカテゴリーの ID（自分は含めない） */
export function descendants(id: string, children: Map<string, DocCategory[]>): string[] {
  const out: string[] = []
  const stack = [id]
  const seen = new Set([id])
  while (stack.length) {
    for (const c of children.get(stack.pop()!) ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c.id)
      stack.push(c.id)
    }
  }
  return out
}

/** 一番上から自分までのカテゴリー */
export function pathOf(id: string, byId: Map<string, DocCategory>): DocCategory[] {
  const out: DocCategory[] = []
  const seen = new Set<string>()
  let cur = byId.get(id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return out
}
