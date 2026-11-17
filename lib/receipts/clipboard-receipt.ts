import { isReceiptDropFile } from "./receipt-file";

export type ReceiptInputSource = "drop" | "paste";

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export interface ClipboardItemLike {
  kind: string;
  type: string;
  getAsFile: () => File | null;
}

export interface ClipboardDataLike {
  files: ArrayLike<File>;
  items: ArrayLike<ClipboardItemLike>;
}

export function unsupportedReceiptMessage(source: ReceiptInputSource): string {
  switch (source) {
    case "drop":
      return "画像またはPDFをドロップしてください。";
    case "paste":
      return "画像またはPDFを貼り付けてください。";
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }
  return name.slice(dot + 1).toLowerCase();
}

function withInferredMime(file: File): File {
  if (!GENERIC_MIME_TYPES.has(file.type)) {
    return file;
  }
  const mime = MIME_BY_EXTENSION[extensionOf(file.name)];
  if (!mime) {
    return file;
  }
  return new File([file], file.name || "receipt", {
    type: mime,
    lastModified: file.lastModified,
  });
}

function filesFromClipboard(data: ClipboardDataLike): File[] {
  const listed = Array.from(data.files);
  const fromItems = Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File);
  return [...listed, ...fromItems].map(withInferredMime);
}

/**
 * 画像・PDFを優先して返す。
 * それ以外のファイルしか無いときは、拒否メッセージ用にそのファイルを返す。
 * ファイルが無ければ null（テキスト貼り付けは無視）。
 */
export function fileFromClipboard(data: ClipboardDataLike | null): File | null {
  if (!data) {
    return null;
  }
  const files = filesFromClipboard(data);
  return files.find((file) => isReceiptDropFile(file)) ?? files[0] ?? null;
}

function elementFromEventTarget(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Text) {
    return target.parentElement;
  }
  return null;
}

/** 文字入力中の Ctrl+V / ⌘V は、領収書貼り付けで奪わない。 */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  const element = elementFromEventTarget(target);
  if (!element) {
    return false;
  }
  const field = element.closest("input, textarea, select, [contenteditable]");
  if (!field) {
    return false;
  }
  if (field instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(field.type);
  }
  if (
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (field instanceof HTMLElement && field.isContentEditable) {
    return true;
  }
  const editable = field.getAttribute("contenteditable");
  return editable != null && editable.toLowerCase() !== "false";
}
