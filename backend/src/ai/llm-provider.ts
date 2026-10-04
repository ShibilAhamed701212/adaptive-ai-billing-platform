import { ENV } from '../config/env';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  inlineData?: {
    mimeType: string;
    data: string; // Base64
  };
}

/** Per-request cap: a hung provider must not hold the API request (and its socket) open. */
const LLM_TIMEOUT_MS = 30_000;

/** An AI response that should have been JSON but wasn't: report it as a bad gateway, not a crash. */
export function parseLlmJson<T = any>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw Object.assign(new Error('The AI service returned an unreadable response. Please try again.'), { statusCode: 502, code: 'AI_BAD_RESPONSE' });
  }
}

/** Raised when an AI-only feature is used without any provider configured or reachable. */
export function aiUnavailableError(): Error {
  return Object.assign(new Error('AI features are unavailable right now. Try again later or contact your administrator.'), { statusCode: 503, code: 'AI_UNAVAILABLE' });
}

export async function callLLM(messages: LLMMessage[], options?: { json?: boolean; temperature?: number }): Promise<string | null> {
  const geminiKey = process.env.GEMINI_API_KEY || ENV.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || ENV.OPENAI_API_KEY;

  // 1. Try Gemini if configured
  if (geminiKey && geminiKey.trim().length > 0) {
    try {
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => {
          const parts: any[] = [{ text: m.content }];
          if (m.inlineData) {
            parts.push({
              inline_data: {
                mime_type: m.inlineData.mimeType,
                data: m.inlineData.data,
              },
            });
          }
          return {
            role: m.role === 'user' ? 'user' : 'model',
            parts,
          };
        });

      const systemMsg = messages.find((m) => m.role === 'system');
      const systemInstruction = systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined;

      // Try standard active Gemini models in priority order
      const modelsToTry = [
        'gemini-3.6-flash',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
      ];

      // Overall budget across model fallbacks so one request can't run for minutes.
      const deadline = Date.now() + 45_000;
      for (const model of modelsToTry) {
        if (Date.now() > deadline) break;
        // Attempt call with 1 retry on 503 (transient overload)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // Key in a header, not the URL, so it never lands in proxy or error logs.
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
              signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
              body: JSON.stringify({
                contents,
                systemInstruction,
                generationConfig: {
                  temperature: options?.temperature ?? 0.2,
                  responseMimeType: options?.json ? 'application/json' : 'text/plain',
                },
              }),
            });

            if (res.ok) {
              const data: any = await res.json();
              let text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                text = text.trim();
                if (options?.json) {
                  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                }
                return text;
              }
            } else if (res.status === 503 && attempt === 0) {
              // Wait briefly before retry on temporary high demand
              await new Promise((r) => setTimeout(r, 600));
              continue;
            } else {
              console.warn(`Gemini API call (${model}) returned status:`, res.status);
              break; // Try next model in list
            }
          } catch (fetchErr) {
            console.warn(`Network error calling Gemini (${model}):`, fetchErr);
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Gemini API request error, falling back:', err);
    }
  }

  // 2. Try OpenAI if configured
  if (openaiKey && openaiKey.trim().length > 0) {
    try {
      // OpenAI takes images as image_url parts; it cannot read PDFs this way.
      const openaiMessages = messages.map((m) =>
        m.inlineData && m.inlineData.mimeType.startsWith('image/')
          ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: `data:${m.inlineData.mimeType};base64,${m.inlineData.data}` } }] }
          : { role: m.role, content: m.content }
      );
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openaiMessages,
          temperature: options?.temperature ?? 0.2,
          response_format: options?.json ? { type: 'json_object' } : undefined,
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text.trim();
      } else {
        console.warn('OpenAI API call failed with status:', res.status, await res.text());
      }
    } catch (err) {
      console.warn('OpenAI API request error, falling back:', err);
    }
  }

  // No LLM configured (or all providers failed) — return null so callers fall back to
  // their deterministic heuristics. AI is an enhancement, never a hard dependency: core
  // billing must work without an API key. Callers that genuinely require the LLM check
  // for null and raise a proper 503 themselves.
  const configured = Boolean((geminiKey && geminiKey.trim()) || (openaiKey && openaiKey.trim()));
  if (!configured) {
    console.warn('LLM_NOT_CONFIGURED: set GEMINI_API_KEY or OPENAI_API_KEY to enable AI features; using deterministic fallbacks.');
  }
  return null;
}
