import { z } from 'zod';
import type { FormInput, QuestionAnswer, Sentiment } from './types';

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';
const MAX_TOKENS = 4000;

const questionsSchema = z.object({
  questions: z.array(z.string()).length(10),
});

const answersSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number(),
      question: z.string(),
      answer: z.string(),
      sources: z.array(z.string()).optional(),
      mentions: z.array(
        z.object({
          brand: z.string(),
          rank: z.number(),
          sentiment: z.number().int().min(-2).max(2),
        }),
      ),
    }),
  ),
});

function buildQuestionsPrompt(form: FormInput): string {
  const comps = form.competitors.filter(Boolean).join('、') || '（无）';
  return [
    `你是一名市场研究助手。请为「${form.industry}」行业的采购决策者生成恰好 10 个他们可能会向 AI 提问的真实问题，`,
    `问题用于考察品牌「${form.brand}」以及竞品「${comps}」在 AI 回答中是否被推荐。`,
    `只输出 JSON，格式：{"questions": ["...", "..."]}（恰好 10 个字符串）。`,
  ].join('\n');
}

function buildAnswersPrompt(form: FormInput, questions: string[]): string {
  const comps = form.competitors.filter(Boolean).map((c) => `"${c}"`).join('、') || '（无）';
  const qLines = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return [
    `以下是 10 个买家问题，请以 AI 助手的口吻逐一回答（每题 150 字以内），回答时自然提及并推荐合适的工具/品牌。`,
    `品牌「${form.brand}」，竞品：${comps}。`,
    `对每题，检测回答中提到的品牌（含「${form.brand}」与竞品），按首次出现顺序给 rank（1 起），并给 sentiment（-2 到 2）。`,
    `只输出 JSON，格式：{"questions":[{"id":1,"question":"...","answer":"...","sources":["..."] ,"mentions":[{"brand":"...","rank":1,"sentiment":1}]}]}`,
    `问题列表：\n${qLines}`,
  ].join('\n');
}

async function postDeepSeek(key: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek API ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export function extractJson(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/** 供 Agentic Chat 等场景使用的通用单轮 JSON 对话 */
export async function chatCompletion(messages: { role: string; content: string }[]): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('未配置 DEEPSEEK_API_KEY');
  return postDeepSeek(key, messages);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** 真实调用 DeepSeek，两步生成：问题 → 回答。失败抛错，交由调用方降级。 */
export async function runDeepSeek(form: FormInput): Promise<QuestionAnswer[]> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('未配置 DEEPSEEK_API_KEY');

  const questions = await withRetry(async () => {
    const raw = await postDeepSeek(key, [{ role: 'user', content: buildQuestionsPrompt(form) }]);
    return questionsSchema.parse(JSON.parse(extractJson(raw))).questions;
  });

  const answers = await withRetry(async () => {
    const raw = await postDeepSeek(key, [{ role: 'user', content: buildAnswersPrompt(form, questions) }]);
    return answersSchema.parse(JSON.parse(extractJson(raw))).questions;
  });

  // 规整：确保 id 顺序、mentions 默认值，规避 API 遗漏字段
  return answers.map((a, i) => ({
    id: a.id ?? i + 1,
    question: a.question,
    answer: a.answer,
    sources: a.sources ?? [],
    mentions: (a.mentions ?? []).map((m) => ({
      brand: m.brand,
      rank: m.rank,
      sentiment: m.sentiment as Sentiment,
    })),
  }));
}