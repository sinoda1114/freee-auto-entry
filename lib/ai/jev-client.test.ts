import { afterEach, describe, expect, it, vi } from "vitest";
import { JevApiError, parseJevChoiceAnswer, runJevChoice } from "./jev-client";

describe("parseJevChoiceAnswer", () => {
  it("reads choice, confidence, and probabilities", () => {
    expect(
      parseJevChoiceAnswer(
        {
          answers: {
            account_bucket: {
              type: "choice",
              choice: "comms",
              confidence: 0.81,
              probabilities: { comms: 0.88, travel: 0.12 },
            },
          },
        },
        "account_bucket",
      ),
    ).toEqual({
      choice: "comms",
      confidence: 0.81,
      probabilities: { comms: 0.88, travel: 0.12 },
    });
  });

  it("rejects missing choice or confidence", () => {
    expect(
      parseJevChoiceAnswer({ answers: { account_bucket: { choice: "comms" } } }, "account_bucket"),
    ).toBeNull();
    expect(parseJevChoiceAnswer({ answers: {} }, "account_bucket")).toBeNull();
  });
});

describe("runJevChoice", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts a TypeSafe-compatible Choice request", async () => {
    vi.stubEnv("JEV_API_KEY", "secret-key");
    vi.stubEnv("JEV_BASE_URL", "https://example.test/systemone");
    vi.stubEnv("JEV_MODEL", "jev-latest");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answers: {
          account_bucket: {
            choice: "travel",
            confidence: 0.9,
            probabilities: { travel: 1 },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const answer = await runJevChoice({
      state: "摘要: Suica",
      questionId: "account_bucket",
      instructions: "大分類を選ぶ",
      criteria: { travel: "旅費交通費", comms: "通信費" },
    });

    expect(answer.choice).toBe("travel");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/systemone");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-key",
    });
    expect(init.signal).toBeDefined();
    const body = JSON.parse(String(init.body));
    expect(body.questions.account_bucket.type).toBe("choice");
    expect(Object.keys(body.questions.account_bucket.criteria)).toHaveLength(2);
  });

  it("rejects Choice lists over the 255-less cap", async () => {
    vi.stubEnv("JEV_API_KEY", "secret-key");
    const criteria: Record<string, string> = {};
    for (let index = 0; index < 255; index += 1) {
      criteria[`k${index}`] = `label ${index}`;
    }
    await expect(
      runJevChoice({
        state: "x",
        questionId: "account_bucket",
        instructions: "選ぶ",
        criteria,
      }),
    ).rejects.toBeInstanceOf(JevApiError);
  });
});
