# Cloudflare 版 accel-dash（Worker：accel-dash-test）

accel-dash を OpenNext で Cloudflare Workers に載せたもの。Vercel から Cloudflare への引っ越しのために作った。
2026-10-23 に、テスト用のしかけ（機能の停止・上部の黄色い帯・NEXT_PUBLIC_DEPLOY_TARGET）を外した。今は本番と同じ中身で動く。

- Worker 名は `accel-dash-test` のまま（wrangler.jsonc の name）。名前の整理は引っ越しが全部終わってから。
- データは本番と同じ Supabase。テスト版の URL で登録・変更・削除すると本番にも反映される。試しの登録は「テスト」と分かる名前にして、あとで消す。

## Vercel との関係

| | Vercel | Cloudflare |
|---|---|---|
| 読むブランチ | main | 今は `cloudflare-test`（main にマージした後は main に変える） |
| URL | accel-dash.com（切替まで） | `accel-dash-test.signup-3e3.workers.dev`。切替の日に accel-dash.com を付ける |
| 定期実行（MF 同期 1:00 UTC・未入金通知 1:30 UTC） | **動く**（vercel.json の crons） | **作らない**（wrangler.jsonc に triggers を書かない。二重に動かさないため） |

- Vercel は 2026年11月末まで予備として残す。
- Vercel の定期実行は、Vercel 自身の住所（`*.vercel.app`）を呼ぶ。accel-dash.com を Cloudflare に切り替えても止まらない。
- `vercel.json` の `git.deploymentEnabled` で `cloudflare-test` ブランチを Vercel で作らないようにしている（main には影響しない）。

## ビルドの設定（Cloudflare の Settings → Builds）

- Production branch：`cloudflare-test`（main にマージした後は `main`）
- Build command：`npm run cf:build`
- Deploy command：`npx wrangler deploy`
- 新しくビルドしたいときは、そのブランチに push する。Retry build は失敗したときのブランチ・コミットのまま作り直すので使わない。

## 変数の入れ場所（2か所あるので注意）

**Settings → Builds の「Variables and secrets」**（ビルドのときに使う）
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_*` はビルドのときに埋め込まれる。値を変えたら作り直しが要る。

**Settings の「Runtime variables and secrets」**（動くときに使う。画面のいちばん上）
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（Secret）
- 秘密の鍵は本人が Cloudflare の画面に直接入力する。チャット・文書・GitHub には書かない。

`SUPABASE_SERVICE_ROLE_KEY` はビルドの欄には入れない。`lib/supabaseAdmin.ts` が読み込み時に鍵を必要とするため、`cf:build` は未設定なら仮の値（build-placeholder）でビルドする。仮の値はビルド結果に残らない。

wrangler.jsonc の `keep_vars: true` で、画面で入れた変数がデプロイのたびに消えないようにしている。

## Cloudflare にまだ入れていない鍵と、そのため使えない機能

| 鍵 | 使えない機能 |
|---|---|
| `MF_CLIENT_ID` / `MF_CLIENT_SECRET` | /mf の接続・手動の同期（画面に「未設定」と出る）。請求書の作成 |
| `CRON_SECRET` | 定期実行用（Cloudflare では動かさないので不要）。そのため /mf に「自動同期は止まっています」と出るが、実際の自動同期は Vercel で動いている |
| `CHATWORK_API_TOKEN` | チャットワークのテスト送信・未入金通知（通知は Vercel の定期実行が送る） |
| `BILLING_API_SECRET` | 請求書のアドマネージャー連携、**資料置き場の書き出し（/api/docs/export。アドマネージャーの claude.ai 接続が使う）** |
| `SMTP_*` / `MAIL_*` | 請求書のメール送信 |
| `UNSPLASH_ACCESS_KEY` | 画像のフリー素材検索 |
| `NEXT_PUBLIC_APP_URL` | 未設定のときは https://accel-dash.com として扱う（MF 連携・書き出しの URL） |

入れるときは、元の値の控えがなければ新しく発行する。`BILLING_API_SECRET` はアドマネージャーと同じ値にする必要がある（24文字以上）。

## 手元での確認

```bash
npm install
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run cf:build
# .dev.vars に SUPABASE_SERVICE_ROLE_KEY=...（git には入らない）
npx wrangler dev
```

Vercel 用のビルド（`npm run build`）も通ることを確かめてから main に入れる。

## 切替と戻し方

- 切替：Cloudflare の Worker → Domains → Add Domain で accel-dash.com を付ける。
- 戻す：Worker から accel-dash.com を外し、DNS に Vercel 向けの行（CNAME @ → Vercel の値）を入れ直す。数分で Vercel に戻る。
- Cloudflare 版をやめるとき：Worker `accel-dash-test` を削除する。Vercel はそのまま動く。

## 経緯

- 2026-10-16：テスト版を作成（OpenNext、Next 16.4.1）。MF 連携・通知・資料置き場の登録などを止めて試した。
- 2026-10-19〜20：資料置き場・画像・実務従事・チャットワーク（テスト用ルームだけ）を確認。
- 2026-10-23：最新の main を取り込み、テスト用のしかけを外した。資料置き場のファイル添付・共有 URL・画像アップロードを確認。
