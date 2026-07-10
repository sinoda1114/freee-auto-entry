import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_MEMO_TAG_NAME, getAppMemoTagId } from "./memo-tag";

const auth = { accessToken: "token-abc", companyId: "999" };

describe("getAppMemoTagId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the existing tag id when the tag already exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tags: [
          { id: 1, name: "other" },
          { id: 2, name: APP_MEMO_TAG_NAME },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const id = await getAppMemoTagId(auth);

    expect(id).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates the tag when it does not exist yet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tags: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tag: { id: 3, name: APP_MEMO_TAG_NAME } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const id = await getAppMemoTagId(auth);

    expect(id).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, createInit] = fetchMock.mock.calls[1];
    const body = JSON.parse(createInit.body as string);
    expect(body.name).toBe(APP_MEMO_TAG_NAME);
    expect(body.company_id).toBe(999);
  });
});
