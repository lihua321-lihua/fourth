import { z } from 'zod';
import type { AnalyzeResponse, FormInput, ModelResult, QuestionAnswer } from '@/lib/types';
import { runDeepSeek } from '@/lib/deepseek';
import { generateSampleQuestions } from '@/lib/sampleAnalysis';
import { generateMockModelResult } from '@/lib/mock';
import { lookupWikipedia, lookupWikidata } from '@/lib/wikipedia';
import { checkRobots } from '@/lib/robots';
import { computeScore } from '@/lib/scoring';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  input: z.object({
    brand: z.string().min(1),
    competitors: z.array(z.string()).max(3),
    industry: z.string().min(1),
    websiteUrl: z.string().optional(),
  }),
});

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(ip, 5, 60_000)) {
    return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '参数不合法，请检查品牌/竞品/行业' }, { status: 400 });
  }

  const input: FormInput = {
    brand: parsed.data.input.brand.trim(),
    competitors: parsed.data.input.competitors.filter(Boolean).map((c) => c.trim()).slice(0, 3),
    industry: parsed.data.input.industry.trim(),
    websiteUrl: parsed.data.input.websiteUrl?.trim() || undefined,
  };

  const hasKey = !!process.env.DEEPSEEK_API_KEY;
  let deepseekQ: QuestionAnswer[] = [];
  let degraded = false;
  let degradedReason: string | undefined;

  if (hasKey) {
    try {
      deepseekQ = await runDeepSeek(input);
      if (deepseekQ.length === 0) throw new Error('DeepSeek 返回空回答');
    } catch (e) {
      degraded = true;
      degradedReason = `DeepSeek 调用失败：${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    // 无 API Key：使用示例问答保证主流程可本地完整跑通，页面明确标注非真实调用
    deepseekQ = generateSampleQuestions(input);
    degradedReason = '未配置 DEEPSEEK_API_KEY，当前使用示例问答数据（非真实 DeepSeek 调用）';
  }

  // 并行查询公开信号（确定性真实数据）
  const [wikipedia, wikidata, robots] = await Promise.all([
    lookupWikipedia(input.brand, input.industry),
    lookupWikidata(input.brand, input.industry),
    checkRobots(input.websiteUrl),
  ]);

  const deepseekModel: ModelResult = {
    model: 'deepseek',
    isReal: hasKey && !degraded,
    questions: deepseekQ,
  };

  const mockQuestions = deepseekQ.map((q) => ({ id: q.id, question: q.question }));
  const mockModels: ModelResult[] =
    mockQuestions.length > 0
      ? [
          generateMockModelResult('chatgpt', mockQuestions, input.brand, input.competitors),
          generateMockModelResult('gemini', mockQuestions, input.brand, input.competitors),
        ]
      : [
          { model: 'chatgpt', isReal: false, questions: [] },
          { model: 'gemini', isReal: false, questions: [] },
        ];

  const breakdown = computeScore({
    brand: input.brand,
    deepseekQuestions: deepseekQ,
    publicSignal: { wikipedia, wikidata, robots },
    degraded,
  });

  const result = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    models: [deepseekModel, ...mockModels],
    publicSignal: { wikipedia, wikidata, robots },
    breakdown,
    degraded,
    degradedReason,
  };

  return Response.json({ result } satisfies AnalyzeResponse);
}