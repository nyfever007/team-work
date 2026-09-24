import "server-only";

export const DEFAULT_MODEL = "gpt-4.1-mini";

export function openAIConfigured() {
  return !!process.env.OPENAI_API_KEY?.trim();
}

export function openAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Minimal Chat Completions call (no SDK). Throws with a readable Korean message on failure. */
export async function chatCompletion(messages: { role: "system" | "user"; content: string }[], opts?: { model?: string; maxTokens?: number; json?: boolean }): Promise<{ content: string; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env에 키를 추가하고 서버를 재시작하세요.");
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = opts?.model ?? openAIModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: opts?.maxTokens ?? 2000, ...(opts?.json ? { response_format: { type: "json_object" } } : {}) }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(e instanceof Error && e.name === "AbortError" ? "OpenAI 응답이 90초 안에 오지 않았습니다." : "OpenAI에 연결할 수 없습니다. 네트워크 또는 OPENAI_BASE_URL을 확인하세요.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? "";
    } catch {}
    if (res.status === 401) throw new Error("OpenAI 인증에 실패했습니다. OPENAI_API_KEY를 확인하세요.");
    if (res.status === 429) throw new Error("OpenAI 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요.");
    throw new Error(`OpenAI 오류 (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  const json = (await res.json()) as { model?: string; choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI가 빈 응답을 반환했습니다.");
  return { content, model: json.model ?? model };
}
