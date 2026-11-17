import { describe, expect, it } from "vitest";
import {
  fileFromClipboard,
  isTextEditingTarget,
  unsupportedReceiptMessage,
} from "./clipboard-receipt";

function item(file: File | null, kind = "file", type = file?.type ?? "") {
  return {
    kind,
    type,
    getAsFile: () => file,
  };
}

describe("fileFromClipboard", () => {
  it("reads a screenshot image that is only on clipboard items", () => {
    const file = new File(["png"], "image.png", { type: "image/png" });
    expect(
      fileFromClipboard({
        files: [],
        items: [item(file)],
      }),
    ).toBe(file);
  });

  it("prefers an image when a text file is also on the clipboard", () => {
    const text = new File(["a"], "notes.txt", { type: "text/plain" });
    const image = new File(["b"], "shot.png", { type: "image/png" });
    expect(
      fileFromClipboard({
        files: [text, image],
        items: [],
      }),
    ).toBe(image);
  });

  it("accepts a copied PDF and infers MIME when the OS omits it", () => {
    const pdf = new File(["%PDF"], "receipt.PDF", {
      type: "application/octet-stream",
    });
    const result = fileFromClipboard({ files: [pdf], items: [] });
    expect(result?.type).toBe("application/pdf");
    expect(result?.name).toBe("receipt.PDF");
  });

  it("returns a non-image file so the form can explain the rejection", () => {
    const text = new File(["a"], "notes.txt", { type: "text/plain" });
    expect(fileFromClipboard({ files: [text], items: [] })).toBe(text);
  });

  it("ignores plain text", () => {
    expect(
      fileFromClipboard({
        files: [],
        items: [item(null, "string", "text/plain")],
      }),
    ).toBeNull();
    expect(fileFromClipboard(null)).toBeNull();
  });
});

describe("isTextEditingTarget", () => {
  it("treats text-entry fields as editable", () => {
    const input = document.createElement("input");
    input.type = "text";
    const date = document.createElement("input");
    date.type = "date";
    const area = document.createElement("textarea");
    const rich = document.createElement("div");
    rich.setAttribute("contenteditable", "true");
    const text = document.createTextNode("abc");
    rich.appendChild(text);

    expect(isTextEditingTarget(input)).toBe(true);
    expect(isTextEditingTarget(date)).toBe(true);
    expect(isTextEditingTarget(area)).toBe(true);
    expect(isTextEditingTarget(text)).toBe(true);
  });

  it("does not treat buttons, file inputs, or the page as text entry", () => {
    const button = document.createElement("button");
    const file = document.createElement("input");
    file.type = "file";
    expect(isTextEditingTarget(button)).toBe(false);
    expect(isTextEditingTarget(file)).toBe(false);
    expect(isTextEditingTarget(document.body)).toBe(false);
  });
});

describe("unsupportedReceiptMessage", () => {
  it("uses a paste-specific message", () => {
    expect(unsupportedReceiptMessage("paste")).toBe(
      "画像またはPDFを貼り付けてください。",
    );
    expect(unsupportedReceiptMessage("drop")).toBe(
      "画像またはPDFをドロップしてください。",
    );
  });
});
