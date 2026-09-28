import type { AnalysisResult, ShareReportData } from './types';
import { summarizeBrand } from './scoring';

/**
 * 分享载荷：仅内嵌核心字段（总分/维度/模型摘要/竞品摘要），
 * 不包含完整问答正文，控制 URL 长度。编码采用 UTF-8 + base64url。
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeReport(data: ShareReportData): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeReport(s: string): ShareReportData | null {
  try {
    const bytes = base64UrlToBytes(s);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as ShareReportData;
  } catch {
    return null;
  }
}

/** 由完整分析结果构建精简分享载荷 */
export function buildShareReport(result: AnalysisResult): ShareReportData {
  const deepseek = result.models.find((m) => m.model === 'deepseek');
  const questions = deepseek?.questions ?? [];

  const models = result.models.map((m) => {
    const s = summarizeBrand(result.input.brand, m.questions);
    return { model: m.model, isReal: m.isReal, mentionedCount: s.mentionedCount, avgRank: s.avgRank, total: s.total };
  });

  const names = [result.input.brand, ...result.input.competitors.filter(Boolean)];
  const entities = names.map((name) => {
    const s = summarizeBrand(name, questions);
    const mentions = questions.flatMap((q) => q.mentions.filter((x) => x.brand === name));
    const avgSent = mentions.length
      ? mentions.reduce((sum, x) => sum + x.sentiment, 0) / mentions.length
      : null;
    return { name, mentionedCount: s.mentionedCount, avgRank: s.avgRank, avgSent: avgSent };
  });

  return {
    brand: result.input.brand,
    competitors: result.input.competitors.filter(Boolean),
    industry: result.input.industry,
    websiteUrl: result.input.websiteUrl,
    total: result.breakdown.total,
    dimensions: result.breakdown.dimensions.map((d) => ({
      label: d.label,
      score: d.score,
      weight: d.weight,
      weighted: d.weighted,
    })),
    models,
    entities,
    degraded: result.degraded,
    degradedReason: result.degradedReason,
    createdAt: result.createdAt,
  };
}