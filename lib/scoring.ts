import type {
  BrandMention,
  PublicSignal,
  QuestionAnswer,
  ScoreBreakdown,
  ScoreDimension,
  Sentiment,
} from './types';

/** 排名考量的总位置数（top N） */
const RANK_N = 10;

/** 情感倾向 → 0~100 */
const SENTIMENT_SCORE: Record<Sentiment, number> = {
  [-2]: 0,
  [-1]: 25,
  0: 50,
  1: 75,
  2: 100,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 品牌在某题中是否被提及（at least once） */
export function brandMentionIn(brand: string, question: QuestionAnswer): BrandMention | undefined {
  return question.mentions.find((m) => m.brand === brand);
}

/** 提及率：至少提及一次的问题数 / 总问题数 × 100 */
export function scoreMentionRate(brand: string, questions: QuestionAnswer[]): number {
  if (questions.length === 0) return 0;
  const hit = questions.filter((q) => brandMentionIn(brand, q)).length;
  return (hit / questions.length) * 100;
}

/** 排名得分：每题 100×(N-rank+1)/N，未提及记 0，十题平均 */
export function scoreRank(brand: string, questions: QuestionAnswer[]): number {
  if (questions.length === 0) return 0;
  let sum = 0;
  for (const q of questions) {
    const m = brandMentionIn(brand, q);
    if (!m) continue;
    const r = Math.min(m.rank, RANK_N);
    sum += (100 * (RANK_N - r + 1)) / RANK_N;
  }
  return sum / questions.length;
}

/** 描述倾向：品牌所有提及的情感均值 → 0~100，未提及则中性 50 */
export function scoreSentiment(brand: string, questions: QuestionAnswer[]): number {
  const all = questions.flatMap((q) => q.mentions.filter((m) => m.brand === brand));
  if (all.length === 0) return 50;
  const avg = all.reduce((s, m) => s + SENTIMENT_SCORE[m.sentiment], 0) / all.length;
  return avg;
}

/** 实体存在：Wikipedia 有=60 + Wikidata 有=40（都不是=0） */
export function scoreEntity(signal: PublicSignal): number {
  let s = 0;
  if (signal.wikipedia.exists) s += 60;
  if (signal.wikidata.exists) s += 40;
  return s;
}

/** 爬虫可访问：放行 bot 数 / 总 bot 数 × 100 */
export function scoreRobots(signal: PublicSignal): number {
  const { bots } = signal.robots;
  if (bots.length === 0) return 0;
  const allowed = bots.filter((b) => b.allowed !== false).length;
  return (allowed / bots.length) * 100;
}

/** 展示用摘要：被提到次数、平均排名 */
export function summarizeBrand(brand: string, questions: QuestionAnswer[]) {
  let mentionedCount = 0;
  let rankSum = 0;
  let rankCount = 0;
  for (const q of questions) {
    const m = brandMentionIn(brand, q);
    if (m) {
      mentionedCount += 1;
      rankSum += m.rank;
      rankCount += 1;
    }
  }
  const avgRank = rankCount > 0 ? rankSum / rankCount : null;
  return { mentionedCount, avgRank, total: questions.length };
}

/** 核心评分：五维度加权，不可用维度剔除后重新归一化权重 */
export function computeScore(opts: {
  brand: string;
  deepseekQuestions: QuestionAnswer[];
  publicSignal: PublicSignal;
  degraded: boolean;
}): ScoreBreakdown {
  const { brand, deepseekQuestions, publicSignal, degraded } = opts;
  const qs = deepseekQuestions;
  const dims: ScoreDimension[] = [];

  if (!degraded) {
    dims.push({
      key: 'mention',
      label: '品牌提及率',
      weight: 0.4,
      score: round1(scoreMentionRate(brand, qs)),
      weighted: 0,
      detail: `至少提及一次的问题数 ${summarizeBrand(brand, qs).mentionedCount} / ${qs.length} × 100`,
    });
    dims.push({
      key: 'rank',
      label: '平均排名',
      weight: 0.25,
      score: round1(scoreRank(brand, qs)),
      weighted: 0,
      detail: `每题按提及顺位 100×(${RANK_N}-名次+1)/${RANK_N}，未提及记 0，十题平均`,
    });
    dims.push({
      key: 'sentiment',
      label: '描述倾向',
      weight: 0.15,
      score: round1(scoreSentiment(brand, qs)),
      weighted: 0,
      detail: '品牌被提及处的平均情感倾向（-2~+2 → 0/25/50/75/100）',
    });
  }

  dims.push({
    key: 'entity',
    label: '实体存在',
    weight: 0.1,
    score: round1(scoreEntity(publicSignal)),
    weighted: 0,
    detail: `Wikipedia ${publicSignal.wikipedia.exists ? '有(60)' : '无(0)'} + Wikidata ${
      publicSignal.wikidata.exists ? '有(40)' : '无(0)'
    }`,
  });

  const robotsChecked = publicSignal.robots.checked;
  if (robotsChecked) {
    dims.push({
      key: 'robots',
      label: 'AI 爬虫可访问性',
      weight: 0.1,
      score: round1(scoreRobots(publicSignal)),
      weighted: 0,
      detail: `放行 ${publicSignal.robots.bots.filter((b) => b.allowed !== false).length} / ${
        publicSignal.robots.bots.length
      } 个 AI 爬虫 × 100`,
    });
  }

  // 重新归一化权重（剔除不可用维度，如降级后的 LLM 维度、无官网 URL 的爬虫维度）
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const dimensions: ScoreDimension[] = dims.map((d) => {
    const w = totalWeight > 0 ? d.weight / totalWeight : 0;
    return { ...d, weight: w, weighted: round1(d.score * w) };
  });

  const total = round1(dimensions.reduce((s, d) => s + d.weighted, 0));

  return {
    total,
    dimensions,
    degraded,
    note: degraded
      ? 'AI 问答生成失败，当前为公开信号基础版评分，维度权重已重新归一化。'
      : undefined,
  };
}