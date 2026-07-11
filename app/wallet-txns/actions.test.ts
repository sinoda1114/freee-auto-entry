import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidFreeeAuthMock = vi.fn();
const getUserMatchersMock = vi.fn();
const createUserMatcherMock = vi.fn();
const claimMatcherCreationMock = vi.fn();

vi.mock("@/lib/freee/session-client", () => ({
  getValidFreeeAuth: () => getValidFreeeAuthMock(),
}));
vi.mock("@/lib/freee/wallet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/freee/wallet")>();
  return {
    ...actual,
    getUserMatchers: (...args: unknown[]) => getUserMatchersMock(...args),
    createUserMatcher: (...args: unknown[]) => createUserMatcherMock(...args),
  };
});
vi.mock("@/lib/db/turso", () => ({
  getDatabase: vi.fn(() => ({ execute: vi.fn() })),
}));
vi.mock("@/lib/db/matcher-creation", () => ({
  claimMatcherCreation: (...args: unknown[]) =>
    claimMatcherCreationMock(...args),
  markMatcherCreationStarted: vi.fn(),
  completeMatcherCreation: vi.fn(),
  releaseMatcherCreation: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createMatcherAction } from "./actions";

function matcherFormData() {
  const formData = new FormData();
  formData.set("companyId", "11122591");
  formData.set("description", "Microsoft 365");
  formData.set("entrySide", "expense");
  formData.set("condition", "3");
  formData.set("accountItemName", "通信費");
  formData.set("taxName", "課対仕入10%");
  formData.set("walletable", "Waalsforceカード");
  formData.set("confirmed", "on");
  return formData;
}

describe("createMatcherAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValidFreeeAuthMock.mockResolvedValue({
      accessToken: "token",
      companyId: "11122591",
    });
  });

  it("rejects a stale form from another active company", async () => {
    const formData = matcherFormData();
    formData.set("companyId", "11040830");

    const result = await createMatcherAction({ status: "idle" }, formData);

    expect(result.status).toBe("error");
    expect(createUserMatcherMock).not.toHaveBeenCalled();
  });

  it("prevents duplicate automatic registration rules", async () => {
    getUserMatchersMock.mockResolvedValue([
      {
        id: 9,
        entrySide: "expense",
        description: "Microsoft 365",
        condition: 3,
        priority: 1,
        act: 1,
        active: true,
      },
    ]);

    const result = await createMatcherAction(
      { status: "idle" },
      matcherFormData(),
    );

    expect(result).toEqual({
      status: "error",
      message: "同じ条件の自動登録ルールがすでにあります。",
    });
    expect(createUserMatcherMock).not.toHaveBeenCalled();
  });

  it("prevents concurrent creation after the persistent claim is taken", async () => {
    getUserMatchersMock.mockResolvedValue([]);
    claimMatcherCreationMock.mockResolvedValue(null);

    const result = await createMatcherAction(
      { status: "idle" },
      matcherFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("作成済み、または作成処理中");
    expect(createUserMatcherMock).not.toHaveBeenCalled();
  });
});
