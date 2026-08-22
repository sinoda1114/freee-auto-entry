/** AI相談ヘッダー用の小さな線画アイコン（外部アイコン依存なし） */

const ICON_PROPS = {
  "aria-hidden": true as const,
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function FontSizeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 20 9 4h2l5 16" />
      <path d="M6.5 14h6" />
      <path d="M15 20h5" />
      <path d="M17.5 14v6" />
    </svg>
  );
}

export function ClearChatIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ExpandIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 3H3v6" />
      <path d="M15 3h6v6" />
      <path d="M21 15v6h-6" />
      <path d="M3 15v6h6" />
      <path d="M3 9 9 3" />
      <path d="m21 9-6-6" />
      <path d="m3 15 6 6" />
      <path d="m21 15-6 6" />
    </svg>
  );
}

export function CompressIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 3v6H3" />
      <path d="M15 3v6h6" />
      <path d="M21 15h-6v6" />
      <path d="M3 15h6v6" />
      <path d="M9 9 3 3" />
      <path d="m15 9 6-6" />
      <path d="m9 15-6 6" />
      <path d="m15 15 6 6" />
    </svg>
  );
}

export function PopoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="8" width="13" height="13" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </svg>
  );
}

/** ポップアウト窓から本体FABへ戻す */
export function DockBackIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="8" y="3" width="13" height="13" rx="2" />
      <path d="M16 16v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
