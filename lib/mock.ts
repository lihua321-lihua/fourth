import type { BrandMention, ModelId, ModelResult, QuestionAnswer, Sentiment } from './types';

/**
 * 确定性 Mock：只为 ChatGPT / Gemini 生成「回答 + 提及」，
 * 复用 DeepSeek 生成的 10 个问题，保证对比基于相同问题。
 * 使用 FNV-1a 32 位哈希作为种子，相同输入结果稳定、不同输入结果不同。
 */

export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SENTIMENT_WORDS: Record<Sentiment, string> = {
  [-2]: '明显不太适合',
  [-1]: '不太适合',
  0: '中性',
  1: '较为适合',
  2: '非常值得推荐',
};

const MENTION_BASE_PROB: Record<ModelId, number> = {
  deepseek: 0, // 不用（真实）
  chatgpt: 0.42,
  gemini: 0.32,
};

function pickSentiment(rng: () => number): Sentiment {
  const v = rng();
  if (v < 0.15) return -2;
  if (v < 0.3) return -1;
  if (v < 0.55) return 0;
  if (v < 0.85) return 1;
  return 2;
}

/**
 * 生成某个模型（chatgpt/gemini）的完整结果，复用传入的问题。
 */
export function generateMockModelResult(
  model: Exclude<ModelId, 'deepseek'>,
  questions: { id: number; question: string }[],
  brand: string,
  competitors: string[],
): ModelResult {
  const seed = hashSeed(`${model}|${brand}|${competitors.join(',')}`);
  const rng = mulberry32(seed);
  const pool = [brand, ...competitors.filter(Boolean)];

  const answers: QuestionAnswer[] = questions.map((q) => {
    const mentions: BrandMention[] = [];
    let mentionOrder = 0;

    for (const name of pool) {
      const isBrand = name === brand;
      const p = isBrand
        ? MENTION_BASE_PROB[model] + (rng() * 0.2 - 0.1)
        : 0.3 + (rng() * 0.2 - 0.1);
      if (rng() < p) {
        mentionOrder += 1;
        mentions.push({ brand: name, rank: mentionOrder, sentiment: pickSentiment(rng) });
      }
    }

    const answer = buildMockAnswer(q.question, brand, mentions);

    return {
      id: q.id,
      question: q.question,
      answer,
      sources: [],
      mentions,
    };
  });

  return { model, isReal: false, questions: answers };
}

function buildMockAnswer(question: string, brand: string, mentions: BrandMention[]): string {
  if (mentions.length === 0) {
    return `针对「${question}」，暂无明确推荐对象，建议结合实际需求进一步评估。`;
  }
  const ordered = [...mentions].sort((a, b) => a.rank - b.rank);
  const list = ordered
    .map((m) => `${m.brand}（${SENTIMENT_WORDS[m.sentiment]}）`)
    .join('、');
  const brandMention = ordered.find((m) => m.brand === brand);
  const brandNote = brandMention
    ? `${brand} 的表现：${SENTIMENT_WORDS[brandMention.sentiment]}。`
    : `${brand} 未被提及。`;
  return `针对「${question}」，推荐参考：${list}。${brandNote}`;
}