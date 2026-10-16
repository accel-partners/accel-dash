# Cloudflare テスト版（accel-dash-test）

accel-dash を OpenNext で Cloudflare Workers に載せ、/jitsumu などが動くかを試すためのテスト版。
ブランチ `cloudflare-test` だけで使う。本番（Vercel・accel-dash.com・main）には影響しない。

## 本番との違い

| | 本番（Vercel） | テスト版（Cloudflare） |
|---|---|---|
| URL | accel-dash.com | `accel-dash-test.<アカウント>.workers.dev`（仮URL） |
| ログイン | .accel-dash.com の Cookie で CRM などと共有 | workers.dev 単独でログイン（パスワード） |
| データ | Supabase（本番） | **同じ Supabase（本番データ）** |
| MF 連携（/api/mf/connect・callback・sync） | 使える | 止めている（403） |
| チャットワークのテスト送信・未入金通知 | 使える | 止めている（403） |
| 資料置き場の登録・編集・削除・並べ替え | 使える | 止めている（「テスト版では使えません」） |
| 画像のアップロード・画像検索（/api/upload・/api/images） | 使える | 止めている（403） |
| 定期実行（Cron） | Vercel Cron（MF 同期 1:00 UTC、未入金通知 1:30 UTC） | なし（wrangler.jsonc に書かない） |

- テスト版の画面上部に、テスト版であることを知らせる帯が出る。
- データは本番と同じ。テスト版で登録・変更・削除すると本番にも反映される。試しの登録は「テスト」と分かる名前にして、あとで消す。
- テスト版の切り替えは `NEXT_PUBLIC_DEPLOY_TARGET=cloudflare-test`（`lib/testMode.ts`）。ビルド時に埋め込まれる。本番では未設定。

## Workers Builds の設定（Cloudflare の画面）

Workers & Pages → 作成 → リポジトリをインポート（GitHub は accel-dash だけ許可）。

- 本番ブランチ（Production branch）：`cloudflare-test`
- ビルドコマンド：`npm run cf:build`
- デプロイコマンド：`npx opennextjs-cloudflare deploy`
- Worker 名：`accel-dash-test`（wrangler.jsonc の name と同じにする）

### Build variables（ビルド時の変数）

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`SUPABASE_SERVICE_ROLE_KEY` はビルド時には入れない。`lib/supabaseAdmin.ts` が読み込み時に鍵を必要とするため、`cf:build` は未設定なら仮の値（build-placeholder）でビルドする。仮の値はビルド結果に残らず、動くときは下の Worker の Secret が使われる。

### Worker の変数（Settings → Variables and Secrets）

- `NEXT_PUBLIC_SUPABASE_URL`（テキスト）
- `SUPABASE_SERVICE_ROLE_KEY`（**Secret**。本人が Cloudflare の画面に直接入力する。チャットや GitHub には貼らない）
- `NEXT_PUBLIC_APP_URL`（テキスト。テスト版の仮URL）

`NEXT_PUBLIC_DEPLOY_TARGET` は wrangler.jsonc と cf:build で設定済みなので入れなくてよい。

### 入れないもの

`MF_CLIENT_ID` / `MF_CLIENT_SECRET` / `MF_REDIRECT_URI` / `CHATWORK_API_TOKEN` / `CRON_SECRET` / `UNSPLASH_ACCESS_KEY`

## 手元での確認

```bash
npm install
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run cf:build
# .dev.vars に SUPABASE_SERVICE_ROLE_KEY=...（git には入らない）
npx wrangler dev
```

## Vercel 側

`vercel.json` の `git.deploymentEnabled` で `cloudflare-test` を除外している。
Vercel のプレビュー版ではテスト版の機能停止が効かないため、このブランチを Vercel で作らない。

## 元に戻す

GitHub で `cloudflare-test` ブランチを削除し、Cloudflare の Worker `accel-dash-test` を削除する。

## 実際の設定メモ（2026-10-16）

- リポジトリは GitHub Organization に移した：`accel-partners/accel-dash`（旧 `ninomiyalisting-glitch/accel-dash` は自動転送）
- Cloudflare の GitHub 連携は accel-partners に許可（accel-dash のみ）
- 作成時の簡易画面にはブランチの欄がなく、最初のビルドは main で動いて失敗する（main には cf:build がないため。正常）
- Settings → Builds の「Production branch」を `cloudflare-test` に変更
- Deploy command は既定の `npx wrangler deploy` のままで動く
- ビルド時の変数：Settings → Builds の「Variables and secrets」
- 動くときの変数：Settings の「Runtime variables and secrets」（秘密鍵は Secret。Supabase の新形式の secret key `cloudflare_test` を作って使用）
- 新しくビルドしたいときは cloudflare-test に push する（Retry build は失敗したときのブランチ・コミットのまま作り直す）
