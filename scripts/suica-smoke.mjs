#!/usr/bin/env node
/**
 * Suica 連携の自動スモーク（端末不要）。
 * - 履歴パーサ / 引き渡しペイロード
 * - Web 経費 URL の組み立て
 *
 * 実機かざしは android-suica/README.md の手順で確認する。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "npx",
  ["vitest", "run", "lib/suica/history.test.ts"],
  { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`
Suica parser smoke: PASS

次の実機手順（本人端末）:
1. android-suica を Android Studio でビルドし端末へインストール
2. 物理 Suica をかざし、履歴が表示されることを確認
3. 明細を選んで「スマート経理で登録」→ /expenses/suica が開くこと
4. ログイン済みなら明細が出て、1件登録できること
`);
