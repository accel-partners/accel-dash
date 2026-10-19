import type { Metadata } from "next";
import "./globals.css";
import { IS_TEST_DEPLOY, TEST_ALLOW_DOCS_AND_IMAGES } from "@/lib/testMode";

export const metadata: Metadata = {
  title: "アクセルダッシュ",
  description: "アプリ管理ポータル",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {IS_TEST_DEPLOY && (
          <div
            role="note"
            style={{
              background: "#fef3c7",
              color: "#78350f",
              borderBottom: "1px solid #f59e0b",
              padding: "8px 16px",
              fontSize: "13px",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            {TEST_ALLOW_DOCS_AND_IMAGES
              ? "Cloudflare テスト版です。MF連携・未入金通知は使えません。資料置き場と画像は試せますが、データは本番と同じです。試しの登録は『テスト』と分かる名前にして、終わったら消してください。"
              : "Cloudflare テスト版です。MF連携・未入金通知・資料置き場の登録や削除は使えません。データは本番と同じなので、試しの登録は『テスト』と分かる名前で。"}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
