import { afterEach, describe, expect, it, vi } from "vitest";
import { listExistingSuicaFingerprints } from "./suica-existing";
import { suicaFingerprint } from "@/lib/suica/dedupe";

describe("listExistingSuicaFingerprints", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects Suica expense fingerprints across pages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          deals: [
            {
              issue_date: "2026-07-12",
              amount: 188,
              details: [
                { description: "Suica 運賃 相模鉄道 横浜→西谷（残10553）" },
              ],
            },
            {
              issue_date: "2026-07-12",
              amount: 500,
              details: [{ description: "コーヒー" }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deals: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    // first page returns 2 deals (<100) so only one page
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        deals: [
          {
            issue_date: "2026-07-12",
            amount: 188,
            details: [
              { description: "Suica 運賃 相模鉄道 横浜→西谷（残10553）" },
            ],
          },
        ],
      }),
    });

    const set = await listExistingSuicaFingerprints(
      { accessToken: "t", companyId: "1" },
      "2026-07-01",
      "2026-07-31",
    );
    expect(set.has(suicaFingerprint("2026-07-12", 188, "Suica 運賃 相模鉄道 横浜→西谷"))).toBe(
      true,
    );
    expect(set.size).toBe(1);
  });
});
