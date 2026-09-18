import { ENV } from '../config/env';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  inlineData?: {
    mimeType: string;
    data: string; // Base64
  };
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

      // Try standard active Gemini models
      const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const model of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        } else {
          console.warn(`Gemini API call (${model}) returned status:`, res.status);
        }
      }
    } catch (err) {
      console.warn('Gemini API request error, falling back:', err);
    }
  }

  // 2. Try OpenAI if configured
  if (openaiKey && openaiKey.trim().length > 0) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
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

  // Return null to allow caller to use smart deterministic heuristics
  throw new Error('LLM_NOT_CONFIGURED: You must provide a valid GEMINI_API_KEY or OPENAI_API_KEY in .env to use AI features.');
}
