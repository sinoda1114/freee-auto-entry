import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/typescript-6-eslint");
const target = path.join(
  root,
  "node_modules/eslint-config-next/node_modules/typescript-eslint/node_modules/typescript",
);

if (!fs.existsSync(source)) {
  console.warn("[postinstall] typescript-6-eslint not found; skip ESLint TS link");
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.rmSync(target, { recursive: true, force: true });
fs.symlinkSync(source, target, "junction");
