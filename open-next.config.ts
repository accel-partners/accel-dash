import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare テスト版用。R2 などのキャッシュは使わない（最小構成）。
export default defineCloudflareConfig({});
