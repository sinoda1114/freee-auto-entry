import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "./ExpenseForm";

const ocrReceiptActionMock = vi.fn();
const prepareMock = vi.fn(async (file: File) => file);
const notifyErrorMock = vi.fn();

vi.mock("./actions", () => ({
  createExpenseAction: vi.fn(),
  ocrReceiptAction: (...args: unknown[]) => ocrReceiptActionMock(...args),
}));

vi.mock("@/lib/receipts/prepare-receipt-file", () => ({
  prepareReceiptFileForUpload: (file: File) => prepareMock(file),
}));

vi.mock("@/lib/ui/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: (...args: unknown[]) => notifyErrorMock(...args),
}));

const accountItems = [{ id: 10, name: "消耗品費", defaultTaxCode: 136 }];
const taxCodes = [{ code: 136, name: "課対仕入10%" }];

function renderForm() {
  return render(
    <ExpenseForm
      companyId="11122591"
      accountItems={accountItems}
      taxCodes={taxCodes}
    />,
  );
}

function clipboardWith(file: File) {
  return {
    files: [file],
    items: [
      {
        kind: "file",
        type: file.type,
        getAsFile: () => file,
      },
    ],
  };
}

function pasteOn(target: EventTarget, clipboard: ReturnType<typeof clipboardWith> | {
  files: File[];
  items: Array<{ kind: string; type: string; getAsFile: () => File | null }>;
}) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboard });
  target.dispatchEvent(event);
  return event;
}

describe("ExpenseForm clipboard paste", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => "blob:receipt-preview");
    URL.revokeObjectURL = vi.fn();
    ocrReceiptActionMock.mockResolvedValue({
      status: "success",
      receiptId: 42,
      ocrResult: {
        issueDate: "2026-07-01",
        amount: 1100,
        description: "タクシー利用",
        accountItemName: "消耗品費",
        taxName: "課対仕入10%",
      },
    });
  });

  it("sends a pasted image through the existing upload flow", async () => {
    renderForm();
    const file = new File(["png"], "shot.png", { type: "image/png" });

    pasteOn(document.body, clipboardWith(file));

    expect(await screen.findByAltText("選択した領収書のプレビュー")).toHaveAttribute(
      "src",
      "blob:receipt-preview",
    );
    await waitFor(() => {
      expect(prepareMock).toHaveBeenCalledWith(file);
    });
    await waitFor(() => {
      expect(ocrReceiptActionMock).toHaveBeenCalledTimes(1);
    });
    const formData = ocrReceiptActionMock.mock.calls[0]?.[0] as FormData;
    expect(formData.get("file")).toBe(file);
    expect(await screen.findByDisplayValue("1100")).toBeInTheDocument();
    expect(screen.getByDisplayValue("タクシー利用")).toBeInTheDocument();
  });

  it("keeps file selection on the same upload flow", async () => {
    renderForm();
    const file = new File(["png"], "picked.png", { type: "image/png" });
    const input = document.querySelector(
      'input[accept="image/*,application/pdf"]',
    );
    expect(input).toBeInstanceOf(HTMLInputElement);

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(prepareMock).toHaveBeenCalledWith(file);
      expect(ocrReceiptActionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not intercept paste while a text field is focused", async () => {
    renderForm();
    const description = screen.getByPlaceholderText("空欄でも登録できます");
    const file = new File(["png"], "shot.png", { type: "image/png" });

    pasteOn(description, clipboardWith(file));

    expect(
      screen.queryByAltText("選択した領収書のプレビュー"),
    ).not.toBeInTheDocument();
    expect(prepareMock).not.toHaveBeenCalled();
    expect(description).toHaveValue("");
  });

  it("explains a non-image file paste and ignores plain text", async () => {
    renderForm();
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    pasteOn(document.body, clipboardWith(textFile));

    expect(
      await screen.findByText("画像またはPDFを貼り付けてください。"),
    ).toBeInTheDocument();
    expect(notifyErrorMock).toHaveBeenCalledWith(
      "このファイルは使えません",
      "画像またはPDFを貼り付けてください。",
    );
    expect(prepareMock).not.toHaveBeenCalled();

    notifyErrorMock.mockClear();
    pasteOn(document.body, {
      files: [],
      items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
    });

    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(prepareMock).not.toHaveBeenCalled();
  });
});
