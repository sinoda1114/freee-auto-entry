"use client";

import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { PageHeader } from "@/app/components/PageHeader";
import { PageShell } from "@/app/components/PageShell";
import { RelatedSupportThreads } from "@/app/components/RelatedSupportThreads";
import type { ConsultationTargetKind } from "@/lib/ai/consultation-target";
import type {
  SupportThreadCategory,
  SupportThreadStatus,
} from "@/lib/db/support-threads";
import {
  isSupportThreadCategory,
  SUPPORT_THREAD_CATEGORIES,
} from "@/lib/support/categories";
import { takeSupportDraft } from "@/lib/support/draft-handoff";
import {
  importSupportEmailAction,
  saveSupportThreadAction,
  type ImportSupportEmailState,
  type SaveSupportThreadState,
} from "./actions";

const importInitial: ImportSupportEmailState = { status: "idle" };
const saveInitial: SaveSupportThreadState = { status: "idle" };

type Draft = {
  subject: string;
  category: SupportThreadCategory;
  status: SupportThreadStatus;
  questionSummary: string;
  answerSummary: string;
  background: string;
  conclusion: string;
  tags: string[];
  freeeTargetKind: ConsultationTargetKind | null;
  freeeTargetId: number | null;
  rawEmail: string;
  sourceUrl: string | null;
  isMemo: boolean;
};

function SupportSaveDraftForm({
  companyId,
  draft,
  investigationId,
  saveAction,
  savePending,
  saveError,
}: {
  companyId: string;
  draft: Draft;
  investigationId: string;
  saveAction: (payload: FormData) => void;
  savePending: boolean;
  saveError: string | null;
}) {
  const [category, setCategory] = useState(draft.category);
  const [status, setStatus] = useState(draft.status);
  const [targetKind, setTargetKind] = useState(draft.freeeTargetKind ?? "");

  return (
    <form action={saveAction} className="panel mt-4 space-y-3 px-4 py-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="rawEmail" value={draft.rawEmail} />
      <input type="hidden" name="sourceUrl" value={draft.sourceUrl ?? ""} />
      <input type="hidden" name="isMemo" value={String(draft.isMemo)} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="freeeTargetKind" value={targetKind} />
      {investigationId ? (
        <input type="hidden" name="investigationId" value={investigationId} />
      ) : null}
      <p className="text-sm font-semibold text-[var(--freee-text)]">
        整形結果を確認・編集して保存
      </p>
      <Input
        name="subject"
        label="件名"
        defaultValue={draft.subject}
        variant="bordered"
        isRequired
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="カテゴリ"
          selectedKeys={new Set([category])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            if (isSupportThreadCategory(value)) {
              setCategory(value);
            }
          }}
          variant="bordered"
        >
          {SUPPORT_THREAD_CATEGORIES.map((item) => (
            <SelectItem key={item.value}>{item.label}</SelectItem>
          ))}
        </Select>
        <Select
          label="状態"
          selectedKeys={new Set([status])}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            if (typeof value === "string") {
              setStatus(value as SupportThreadStatus);
            }
          }}
          variant="bordered"
        >
          <SelectItem key="open">未解決</SelectItem>
          <SelectItem key="resolved">解決済み</SelectItem>
          <SelectItem key="follow_up">要フォロー</SelectItem>
        </Select>
      </div>
      <Textarea
        name="questionSummary"
        label="質問要約"
        defaultValue={draft.questionSummary}
        minRows={2}
        variant="bordered"
        isRequired
      />
      <Textarea
        name="answerSummary"
        label="回答要約"
        defaultValue={draft.answerSummary}
        minRows={2}
        variant="bordered"
      />
      <Textarea
        name="background"
        label="背景"
        defaultValue={draft.background}
        minRows={2}
        variant="bordered"
      />
      <Textarea
        name="conclusion"
        label="結論・アクション"
        defaultValue={draft.conclusion}
        minRows={2}
        variant="bordered"
      />
      <Input
        name="tags"
        label="タグ（カンマ区切り）"
        defaultValue={draft.tags.join(", ")}
        variant="bordered"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="freee対象種別"
          selectedKeys={targetKind ? new Set([targetKind]) : new Set()}
          onSelectionChange={(keys) => {
            const value = Array.from(keys)[0];
            setTargetKind(typeof value === "string" ? value : "");
          }}
          variant="bordered"
        >
          <SelectItem key="wallet_txn">口座明細</SelectItem>
          <SelectItem key="transfer">口座振替</SelectItem>
          <SelectItem key="deal">取引</SelectItem>
        </Select>
        <Input
          name="freeeTargetId"
          label="freee対象ID"
          defaultValue={
            draft.freeeTargetId != null ? String(draft.freeeTargetId) : ""
          }
          variant="bordered"
        />
      </div>
      {saveError ? (
        <p role="alert" className="text-sm text-danger">
          {saveError}
        </p>
      ) : null}
      <Button type="submit" color="primary" isLoading={savePending}>
        保存する
      </Button>
    </form>
  );
}

const emptySubscribe = () => () => {};

// SSR / ハイドレーション時は false、クライアント確定後に true。
// これで sessionStorage 読み取りをハイドレーション後だけに限定でき、
// setState-in-effect を使わずに不整合も避けられる。
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function SupportNewView({
  companyId,
  investigationId = "",
}: {
  companyId: string;
  investigationId?: string;
}) {
  // クライアント確定後に key を切り替えて子を再マウントし、
  // その初回マウント時のみ sessionStorage の下書きを取り込む。
  const isClient = useIsClient();
  return (
    <SupportNewForm
      key={isClient ? "client" : "ssr"}
      companyId={companyId}
      investigationId={investigationId}
      enableDraft={isClient}
    />
  );
}

function SupportNewForm({
  companyId,
  investigationId,
  enableDraft,
}: {
  companyId: string;
  investigationId: string;
  enableDraft: boolean;
}) {
  const router = useRouter();
  const [importState, importAction, importPending] = useActionState(
    importSupportEmailAction,
    importInitial,
  );
  const [saveState, saveAction, savePending] = useActionState(
    saveSupportThreadAction,
    saveInitial,
  );
  // 調査結果からの下書きは URL ではなく sessionStorage 経由で受け取る。
  // クライアント確定後の初回マウント時のみ取り出し、同時にストアから消す。
  const [initialDraft] = useState(() =>
    enableDraft ? takeSupportDraft() : "",
  );
  const [rawEmail, setRawEmail] = useState(initialDraft);
  const [sourceUrl, setSourceUrl] = useState("");
  const [isMemo, setIsMemo] = useState(initialDraft.length > 0);

  useEffect(() => {
    if (saveState.status === "success") {
      router.push(`/support/${saveState.threadId}`);
    }
  }, [saveState, router]);

  const draft = importState.status === "preview" ? importState.draft : null;

  return (
    <PageShell width="lg">
      <PageHeader
        title="メールを取り込む"
        description="freeeサポートのメールスレッドを貼り付けて、AIで整形して保存します"
        actions={
          <Button as={NextLink} href="/support" size="sm" variant="light">
            一覧へ
          </Button>
        }
      />

      <form action={importAction} className="panel mt-4 space-y-3 px-4 py-4">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="isMemo" value={String(isMemo)} />
        <Input
          name="sourceUrl"
          type="url"
          label="Gmailの元メールURL"
          description="Gmailで対象メールを開き、ブラウザのアドレスをコピーしてください"
          placeholder="https://mail.google.com/mail/u/0/#inbox/..."
          value={sourceUrl}
          onValueChange={setSourceUrl}
          variant="bordered"
          isRequired={!isMemo}
          isDisabled={isMemo}
        />
        <Checkbox
          isSelected={isMemo}
          onValueChange={setIsMemo}
          size="sm"
        >
          メールではなくメモとして保存（Gmail URL不要）
        </Checkbox>
        <Textarea
          aria-label="メール本文"
          name="rawEmail"
          label="メール本文"
          placeholder="件名・本文をそのまま貼り付け"
          value={rawEmail}
          onValueChange={setRawEmail}
          minRows={10}
          variant="bordered"
          isRequired
        />
        {importState.status === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {importState.message}
          </p>
        ) : null}
        <Button
          type="submit"
          color="primary"
          isLoading={importPending}
          isDisabled={!rawEmail.trim() || (!isMemo && !sourceUrl.trim())}
        >
          AIで整形する
        </Button>
      </form>

      {draft ? (
        <SupportSaveDraftForm
          key={`${draft.subject}-${draft.rawEmail.length}`}
          companyId={companyId}
          draft={draft}
          investigationId={investigationId}
          saveAction={saveAction}
          savePending={savePending}
          saveError={saveState.status === "error" ? saveState.message : null}
        />
      ) : null}

      {importState.status === "preview" && importState.similar.length > 0 ? (
        <div className="panel mt-4 px-4 py-4">
          <RelatedSupportThreads
            title="似ている過去の問い合わせ"
            items={importState.similar.map((item) => ({
              id: item.threadId,
              subject: item.subject,
              status: "resolved",
              category: "other",
              questionSummary: item.reason,
              createdAt: "",
              reason: item.reason,
            }))}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
