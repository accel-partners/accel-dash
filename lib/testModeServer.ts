import { NextResponse } from 'next/server'
import { IS_TEST_DEPLOY, TEST_DISABLED_MESSAGE } from './testMode'

/**
 * テスト版では止める API の先頭で呼ぶ。テスト版なら 403 を返し、本番なら null。
 *   const blocked = blockInTestDeploy(); if (blocked) return blocked
 */
export function blockInTestDeploy(headers?: HeadersInit): NextResponse | null {
  if (!IS_TEST_DEPLOY) return null
  return NextResponse.json({ error: TEST_DISABLED_MESSAGE }, { status: 403, headers })
}
