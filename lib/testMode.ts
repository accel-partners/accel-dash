/**
 * Cloudflare テスト版かどうか。
 * NEXT_PUBLIC_DEPLOY_TARGET はビルド時に埋め込まれるので、クライアントからも import してよい。
 * 本番（Vercel）では未設定なので false。
 */
export const IS_TEST_DEPLOY = process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'cloudflare-test'

export const TEST_DISABLED_MESSAGE = 'テスト版では使えません'

/**
 * テスト段階1（資料置き場・画像）で、テスト版でも使えるようにするか。
 * true：資料置き場の登録・編集・削除、画像のアップロード・検索をテスト版でも使える。
 * 段階1が終わって止めたいときは false にして push する。
 * 本番（Vercel）には関係しない（本番はもともと止めていない）。
 */
export const TEST_ALLOW_DOCS_AND_IMAGES = true
