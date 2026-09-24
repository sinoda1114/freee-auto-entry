# スマート経理 Suica（Android）

物理 Suica をかざして交通履歴を読み、ブラウザでスマート経理の経費登録画面を開くミニアプリです。

## 前提

- Android Studio Ladybug 以降
- NFC 対応 Android 端末
- 物理 Suica（モバイル Suica の自己読取は非対応）
- ブラウザでスマート経理にログイン済み（Custom Tabs / 既定ブラウザの Cookie を利用）

## ビルド

既定の接続先 URL は `gradle.properties` の `SITE_URL` で管理します（build スクリプトにはハードコードしません）。本番向けはそのままビルドできます:

```bash
cd android-suica
# Android Studio で Open、または:
./gradlew :app:assembleDebug
```

ローカル Web（エミュレータからホスト）は `-PSITE_URL` で上書き:

```bash
./gradlew :app:assembleDebug -PSITE_URL=http://10.0.2.2:3000
```

実機から PC の `next dev` へは、PC の LAN IP を `SITE_URL` に指定してください。

## 使い方

1. アプリを起動し、物理 Suica をかざす
2. 経費候補の明細を選択（初期は全選択）
3. 「スマート経理で登録」→ ブラウザで `/expenses/suica?p=...` が開く
4. 勘定科目を確認して登録

NFC が使えない場合は「デモデータを表示」で UI と引き渡し URL を確認できます。

## 実機スモーク

1. Debug APK を端末にインストール
2. 物理 Suica をかざし、日付・金額が妥当か確認
3. 1件だけ選んで Web を開き、ログイン済みなら明細が表示されること
4. 経費登録後、freee 会計に取引が残ること

## 技術メモ

- FeliCa `NfcF` + Read Without Encryption（サービス `0x090F`、最大20件）
- 運賃は残額の差分（新しい履歴 → 1つ古い履歴）
- ペイロード仕様は Web の `lib/suica/history.ts` と同一（`v:1` + base64url JSON）
