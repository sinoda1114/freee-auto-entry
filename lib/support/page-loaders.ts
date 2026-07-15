import { parseConsultationTarget } from "@/lib/ai/consultation-target";
import {
  getSupportThread,
  searchSupportThreads,
  type SupportThread,
} from "@/lib/db/support-threads";
import { getDatabase } from "@/lib/db/turso";
import { isSupportThreadCategory } from "@/lib/support/categories";

// これらは Server Action ("use server") ではなく、RSC からのみ import される
// サーバー専用ローダー。companyId は必ず呼び出し側でセッション (auth.companyId) を
// 渡すこと。クライアントから任意の companyId で呼べる経路を作らないため、
// actions.ts (公開 Server Action) には置かない。
export async function loadSupportThreadsForPage(input: {
  companyId: string;
  query?: string;
  status?: string;
  category?: string;
  target?: string;
}): Promise<SupportThread[]> {
  const target = input.target ? parseConsultationTarget(input.target) : null;
  return searchSupportThreads(getDatabase(), input.companyId, {
    query: input.query,
    status:
      input.status === "open" ||
      input.status === "resolved" ||
      input.status === "follow_up"
        ? input.status
        : "all",
    category: isSupportThreadCategory(input.category)
      ? input.category
      : "all",
    targetKind: target?.kind,
    targetId: target?.id,
    limit: 50,
  });
}

export async function getSupportThreadForPage(
  companyId: string,
  id: string,
): Promise<SupportThread | null> {
  return getSupportThread(getDatabase(), companyId, id);
}
