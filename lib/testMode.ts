/**
 * Cloudflare テスト版かどうか。
 * NEXT_PUBLIC_DEPLOY_TARGET はビルド時に埋め込まれるので、クライアントからも import してよい。
 * 本番（Vercel）では未設定なので false。
 */
export const IS_TEST_DEPLOY = process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'cloudflare-test'

export const TEST_DISABLED_MESSAGE = 'テスト版では使えません'
