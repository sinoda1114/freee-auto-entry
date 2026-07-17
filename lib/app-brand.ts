export const APP_NAME = "マイ経理 for freee";

export const APP_DESCRIPTION =
  "freeeの未処理明細と定型請求をまとめて管理";

export function appPageTitle(page: string): string {
  return `${page} | ${APP_NAME}`;
}
