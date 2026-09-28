import { hashSeed, mulberry32 } from './mock';
import type { BrandMention, FormInput, QuestionAnswer, Sentiment } from './types';

/**
 * 开发/无 API Key 场景下的示例问答生成器。
 * 只有 DEEPSEEK_API_KEY 未配置时才使用，结果需在页面明确标注「示例数据（非真实 DeepSeek）」
 */

const TEMPLATES = [
  '「{industry}」领域有哪些值得推荐的工具？',
  '针对「{industry}」，性价比最高的产品是什么？',
  '小型团队做「{industry}」应该选什么工具？',
  '「{industry}」里最流行的解决方案有哪些？',
  '如果要替代传统的「{industry}」方式，有哪些现代工具？',
  '适合企业级的「{industry}」平台有哪些推荐？',
  '预算有限的情况下，「{industry}」有什么合适选择？',
  '「{industry}」领域有哪些上手快的工具？',
  '团队协作场景下，「{industry}」工具怎么选？',
  '「{industry}」里口碑最好、最常被推荐的产品是哪个？',
];

function pickSentiment(rng: () => number): Sentiment {
  const v = rng();
  if (v < 0.1) return -2;
  if (v < 0.25) return -1;
  if (v < 0.5) return 0;
  if (v < 0.8) return 1;
  return 2;
}

const WORD: Record<Sentiment, string> = {
  [-2]: '综合表现偏弱，需慎重',
  [-1]: '存在明显短板',
  0: '中规中矩',
  1: '表现不错，值得考虑',
  2: '是该领域较优选择',
};

export function generateSampleQuestions(form: FormInput): QuestionAnswer[] {
  const { brand, industry } = form;
  const competitors = form.competitors.filter(Boolean);
  const seed = hashSeed(`${brand}|${industry}|${competitors.join(',')}`);
  const rng = mulberry32(seed);
  const pool = [brand, ...competitors];

  return TEMPLATES.map((tpl, i) => {
    const question = tpl.replace('{industry}', industry);
    const mentions: BrandMention[] = [];
    let order = 0;
    for (const name of pool) {
      // 主品牌以略高于竞品的概率被提及，确保示例数据有区分度
      const p = name === brand ? 0.5 : 0.4;
      if (rng() < p) {
        order += 1;
        mentions.push({ brand: name, rank: order, sentiment: pickSentiment(rng) });
      }
    }

    const ordered = [...mentions].sort((a, b) => a.rank - b.rank);
    const list = ordered.map((m) => `${m.brand}（${WORD[m.sentiment]}）`).join('、');
    const brandNote = ordered.find((m) => m.brand === brand);
    const answer = brandNote
      ? `就「${question}」而言，可重点关注：${list}。其中 ${brand} ${WORD[brandNote.sentiment]}。`
      : `就「${question}」而言，可重点关注：${list};${brand} 本次未被提及。`;

    return { id: i + 1, question, answer, sources: [], mentions };
  });
}