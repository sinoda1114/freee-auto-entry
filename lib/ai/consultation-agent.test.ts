import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConsultationSystemPrompt,
  parseConsultationHistoryJson,
} from "./consultation-agent";

describe("parseConsultationHistoryJson", () => {
  it("keeps only valid user/assistant turns and caps length", () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg-${i}`,
    }));
    const parsed = parseConsultationHistoryJson(JSON.stringify(turns));
    expect(parsed).toHaveLength(8);
    expect(parsed[0]?.content).toBe("msg-4");
    expect(parsed.at(-1)?.content).toBe("msg-11");
  });

  it("returns empty on invalid JSON", () => {
    expect(parseConsultationHistoryJson("not-json")).toEqual([]);
    expect(parseConsultationHistoryJson("")).toEqual([]);
  });
});

describe("buildConsultationSystemPrompt", () => {
  it("keeps core free of consumption-tax domain terms", () => {
    const system = buildConsultationSystemPrompt("損益計算書を表示して");
    expect(system).not.toContain("消費税");
    expect(system).not.toContain("みなし仕入");
    expect(system).not.toContain("販売管理費");
    expect(system).not.toContain("追加ガイド");
  });

  it("appends consumption-tax recipe when matched", () => {
    const system = buildConsultationSystemPrompt(
      "一般課税と簡易課税どっちが得？",
    );
    expect(system).toContain("## 追加ガイド（consumption-tax）");
    expect(system).toContain("概算・要確認");
  });

  it("keeps recipe from history on vague follow-up", () => {
    const system = buildConsultationSystemPrompt("それを調べて", [
      { role: "user", content: "簡易課税と一般課税の比較" },
      { role: "assistant", content: "みなし仕入率を教えてください" },
    ]);
    expect(system).toContain("## 追加ガイド（consumption-tax）");
  });
});

describe("runConsultationAgent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns a stub report in E2E mode without calling Gemini", async () => {
    vi.stubEnv("E2E_TEST_MODE", "1");
    const { runConsultationAgent } = await import("./consultation-agent");
    const report = await runConsultationAgent({
      auth: { accessToken: "t", companyId: "1" },
      question: "なぜ現金？",
      history: [{ role: "user", content: "前の質問" }],
    });
    expect(report.summary).toContain("E2E");
    expect(report.mode).toBe("investigate");
  });
});
