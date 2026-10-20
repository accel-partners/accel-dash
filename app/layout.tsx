import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallAppButton from "@/components/InstallAppButton";

export const metadata: Metadata = {
  title: "アクセルダッシュ",
  description: "アプリ管理ポータル",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  // Dock・タスクバーに置けるアプリ（PWA）として入れるための設定
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "アクセルダッシュ", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <InstallAppButton />
      </body>
    </html>
  );
}
