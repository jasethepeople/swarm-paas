import { afterEach, describe, expect, it, vi } from "vitest";

describe("streamLLMText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("forwards upstream SSE token deltas and returns consolidated content", async () => {
    process.env.BUILT_IN_FORGE_API_KEY = "test-key";
    process.env.BUILT_IN_FORGE_API_URL = "https://forge.test";
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const { streamLLMText } = await import("./_core/llm");
    const tokens: string[] = [];
    const result = await streamLLMText({ model: "gpt-5-mini", messages: [{ role: "user", content: "Say hello" }] }, token => tokens.push(token));
    expect(result).toMatchObject({ content: "hello world", usage: { prompt_tokens: 3, completion_tokens: 2 } });
    expect(tokens).toEqual(["hello ", "world"]);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({ stream: true, model: "gpt-5-mini" });
  });
});
