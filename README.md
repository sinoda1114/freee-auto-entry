# freee-auto-entry

freee(会計・請求書)への経費登録・請求書作成をブラウザから行うためのGUIアプリ。

## 背景

freeeの経費登録・請求書発行はAPIで自動化できるが、CUI(Claude Code経由でのAPI呼び出し)では都度の内容確認・入力体験が悪い。ブラウザのフォームから直接操作できるようにする。

## できること / できないこと

- **経費登録**: freee会計API (`POST /api/1/deals`) で取引を登録する。
- **請求書作成**: freee請求書API (`POST /invoices`) で請求書を作成する。
- **請求書の送付(メール送信)は非対応**: freee請求書APIには送信をトリガーするエンドポイントが存在しないため、作成後にfreee画面上の確認URLを提示し、送信はfreee側の画面から手動で行う。

## 認証

freee Developers で発行した独自OAuthアプリ(Client ID/Secret)を使い、OAuth 2.0 Authorization Code Grant でfreeeと連携する。シークレットは `.env.local` (ローカル) / Vercelのプロジェクト設定 (本番) にのみ保持し、リポジトリには含めない。

## 開発

```bash
npm install
npm run dev
```

`.env.local` の設定内容は `.env.example` を参照。

## 運用ルール

開発フロー・デプロイ規律・タスク管理などは [`AGENTS.md`](./AGENTS.md) を正本とする。
