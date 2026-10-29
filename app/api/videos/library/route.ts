import { NextRequest } from 'next/server'
import { library } from '@/lib/vimeo'
import { videosRoute } from '@/lib/videosApi'

export const dynamic = 'force-dynamic'

/** 社内動画の一覧：親フォルダの中のフォルダ（大カテ・小カテ）と動画を全部。画面側で絞り込み・検索する */
export async function GET(req: NextRequest) {
  return videosRoute(req, async () => {
    const lib = await library(req.nextUrl.searchParams.get('refresh') === '1')
    return lib ?? { root: null, folders: [], videos: [] }
  })
}
