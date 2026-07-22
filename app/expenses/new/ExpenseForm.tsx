"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Autocomplete, AutocompleteItem, Button, Skeleton, Spinner } from "@heroui/react";
import type { AccountItem, TaxCode } from "@/lib/freee/accounting";
import type { OcrResult } from "@/lib/ai/receipt-ocr";
import { ProcessingStatus } from "@/app/components/ProcessingStatus";
import {
  createExpenseAction,
  ocrReceiptAction,
  type ExpenseFormState,
} from "./actions";

const initialState: ExpenseFormState = { status: "idle" };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

const fieldClassName =
  "rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function ExpenseForm({
  accountItems,
  taxCodes,
}: {
  accountItems: AccountItem[];
  taxCodes: TaxCode[];
}) {
  const [state, setState] = useState<ExpenseFormState>(initialState);
  const [isPending, startSubmitTransition] = useTransition();
  const [isOcrPending, startOcrTransition] = useTransition();

  const [issueDate, setIssueDate] = useState(todayIsoDate());
  const [accountItemId, setAccountItemId] = useState("");
  const [accountInputValue, setAccountInputValue] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrFilledLabels, setOcrFilledLabels] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSuccessDealId, setLastSuccessDealId] = useState<number | null>(
    null,
  );

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const ocrRequestIdRef = useRef(0);
  const selectedFileRef = useRef<File | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetFormFields() {
    selectedFileRef.current = null;
    setSelectedFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIssueDate(todayIsoDate());
    setAccountItemId("");
    setAccountInputValue("");
    setTaxCode("");
    setAmount("");
    setDescription("");
    setReceiptId(null);
    setOcrError(null);
    setOcrDone(false);
    setOcrFilledLabels([]);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function handleAccountItemChange(value: string) {
    setAccountItemId(value);
    const item = accountItems.find((i) => String(i.id) === value);
    setAccountInputValue(item?.name ?? "");
    if (item) {
      const defaultTax = taxCodes.find((t) => t.code === item.defaultTaxCode);
      if (defaultTax) {
        setTaxCode(String(defaultTax.code));
      }
    }
  }

  function applyOcrResult(ocr: OcrResult) {
    const filled: string[] = [];

    if (ocr.issueDate) {
      setIssueDate(ocr.issueDate);
      filled.push("発生日");
    }
    if (ocr.amount) {
      setAmount(String(ocr.amount));
      filled.push("金額");
    }
    if (ocr.description) {
      setDescription(ocr.description);
      filled.push("摘要");
    }

    const matchedAccount =
      ocr.accountItemName != null
        ? accountItems.find((item) => item.name === ocr.accountItemName)
        : undefined;

    if (matchedAccount) {
      setAccountItemId(String(matchedAccount.id));
      setAccountInputValue(matchedAccount.name);
      filled.push("勘定科目");
    }

    let nextTax =
      ocr.taxName != null
        ? taxCodes.find((tax) => tax.name === ocr.taxName)
        : undefined;

    if (!nextTax && matchedAccount) {
      nextTax = taxCodes.find(
        (tax) => tax.code === matchedAccount.defaultTaxCode,
      );
    }

    if (nextTax) {
      setTaxCode(String(nextTax.code));
      filled.push("税区分");
    }

    setOcrFilledLabels(filled);
  }

  function runOcr(file: File) {
    const requestId = ++ocrRequestIdRef.current;
    setOcrError(null);
    setOcrDone(false);
    setOcrFilledLabels([]);
    setReceiptId(null);

    startOcrTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const result = await ocrReceiptAction(fd);

      if (requestId !== ocrRequestIdRef.current) return;

      if (result.status === "error") {
        setOcrError(result.message ?? "OCR読み取りに失敗しました。");
        return;
      }

      if (result.receiptId) setReceiptId(result.receiptId);
      if (result.ocrResult) applyOcrResult(result.ocrResult);
      setOcrDone(true);
    });
  }

  function handleFileSelected(file: File | undefined) {
    if (!file) return;

    selectedFileRef.current = file;
    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return isImageFile(file) ? URL.createObjectURL(file) : null;
    });
    runOcr(file);
  }

  function handleRetryOcr() {
    const file = selectedFileRef.current;
    if (!file) {
      setOcrError("ファイルを選択してください。");
      return;
    }
    runOcr(file);
  }

  function handleSubmit(formData: FormData) {
    startSubmitTransition(async () => {
      const result = await createExpenseAction(state, formData);
      setState(result);
      if (result.status === "success" && result.dealId) {
        setLastSuccessDealId(result.dealId);
        resetFormFields();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          領収書・証憑（任意）
        </span>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            handleFileSelected(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => {
            handleFileSelected(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            color="primary"
            isDisabled={isOcrPending}
            isLoading={isOcrPending}
            onPress={() => cameraInputRef.current?.click()}
          >
            カメラで撮影
          </Button>
          <Button
            type="button"
            size="sm"
            variant="bordered"
            isDisabled={isOcrPending}
            className="border-[var(--freee-border)] text-[var(--freee-text)]"
            onPress={() => galleryInputRef.current?.click()}
          >
            写真を選ぶ
          </Button>
        </div>

        {selectedFile ? (
          <div className="flex flex-col gap-2">
            {previewUrl ? (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob preview URL */}
                <img
                  src={previewUrl}
                  alt="選択した領収書のプレビュー"
                  className={`max-h-48 w-auto rounded border border-zinc-200 object-contain dark:border-zinc-700 ${
                    isOcrPending ? "opacity-50" : ""
                  }`}
                />
                {isOcrPending ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded bg-black/45 px-3 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    <Spinner size="md" color="white" />
                    <span className="text-sm font-medium text-white">
                      領収書を読み取り中…
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedFile.name}
                </p>
                {isOcrPending ? (
                  <ProcessingStatus label="領収書を読み取り中…" />
                ) : null}
              </div>
            )}

            {isOcrPending && previewUrl ? (
              <ProcessingStatus label="勘定科目・金額などを解析しています…" />
            ) : null}

            {ocrError ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {ocrError}
                </p>
                <button
                  type="button"
                  disabled={isOcrPending}
                  onClick={handleRetryOcr}
                  className="w-fit text-sm text-zinc-600 underline hover:text-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  再読み取り
                </button>
              </div>
            ) : null}

            {ocrDone && !ocrError ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {ocrFilledLabels.length > 0
                      ? `読み取り完了。${ocrFilledLabels.join("・")}を入力しました。内容を確認してから登録してください。`
                      : "読み取り完了。入力できる項目が見つかりませんでした。手動で入力してください。"}
                  </p>
                  <button
                    type="button"
                    disabled={isOcrPending}
                    onClick={handleRetryOcr}
                    className="text-sm text-zinc-500 underline hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    再読み取り
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            撮影または選択すると自動で読み取ります。
          </p>
        )}

        {receiptId ? (
          <input type="hidden" name="receiptId" value={receiptId} />
        ) : null}
      </div>

      {isOcrPending ? (
        <div
          className="flex flex-col gap-3"
          aria-busy="true"
          aria-label="読み取り結果の入力欄を準備中"
        >
          <ProcessingStatus label="フォームへ反映する準備中…" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-10 w-1/2 rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : (
        <>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          発生日
        </span>
        <input
          type="date"
          name="issueDate"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div className="flex flex-col gap-1">
        <input type="hidden" name="accountItemId" value={accountItemId} />
        <Autocomplete
          label="勘定科目"
          aria-label="勘定科目"
          placeholder="科目名で検索"
          selectedKey={accountItemId || null}
          inputValue={accountInputValue}
          onInputChange={(value) => {
            setAccountInputValue(value);
            if (!value) {
              setAccountItemId("");
            }
          }}
          onSelectionChange={(key) => {
            handleAccountItemChange(key?.toString() ?? "");
          }}
          isRequired
          size="sm"
          variant="bordered"
          classNames={{
            base: "text-sm",
            listboxWrapper: "max-h-56",
          }}
          inputProps={{
            classNames: {
              inputWrapper:
                "border-[var(--freee-border)] bg-[var(--freee-surface)]",
            },
          }}
        >
          {accountItems.map((item) => (
            <AutocompleteItem key={String(item.id)} textValue={item.name}>
              {item.name}
            </AutocompleteItem>
          ))}
        </Autocomplete>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          税区分
        </span>
        <select
          name="taxCode"
          value={taxCode}
          onChange={(e) => setTaxCode(e.target.value)}
          required
          className={fieldClassName}
        >
          <option value="">選択してください</option>
          {taxCodes.map((tax) => (
            <option key={tax.code} value={tax.code}>
              {tax.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          金額（円）
        </span>
        <input
          type="number"
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          摘要
        </span>
        <input
          type="text"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={isPending || isOcrPending}
        className="rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
      >
        {isPending ? "登録中..." : "登録する"}
      </button>
        </>
      )}

      {!isOcrPending && lastSuccessDealId ? (
        <div className="flex flex-col gap-2 rounded border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
          <p className="text-sm text-green-700 dark:text-green-300">
            登録しました（取引ID: {lastSuccessDealId}）。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              color="primary"
              onPress={() => cameraInputRef.current?.click()}
            >
              続けて登録（カメラ）
            </Button>
            <Button
              as="a"
              size="sm"
              variant="bordered"
              href={`https://secure.freee.co.jp/deals#deal_id=${lastSuccessDealId}`}
              target="_blank"
              rel="noreferrer"
            >
              freeeで確認
            </Button>
          </div>
        </div>
      ) : null}
      {state.status === "error" && (
        <p className="text-red-600 dark:text-red-400">{state.message}</p>
      )}
    </form>
  );
}
