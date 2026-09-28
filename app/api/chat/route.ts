import type { ChatResponse, ChatSummary } from '@/lib/types';
import { chatCompletion, extractJson } from '@/lib/deepseek';
import { COMMAND_SPEC, validateChatOutput } from '@/lib/commands';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildPrompt(state: ChatSummary | undefined, message: string): string {
  const brand = state?.form.brand ?? '（未填写）';
  const competitors = state?.form.competitors.filter(Boolean).join('、') || '（无）';
  const industry = state?.form.industry ?? '（未填写）';
  const status = state?.status ?? 'input';
  const total = state?.totalScore;
  const count = state?.questionCount ?? 0;

  return [
    '你是「AI 可见度检查器」页面内的操作助手。根据用户指令，输出一个 JSON 指令让前端执行以修改页面。',
    '可用指令（action）如下：',
    COMMAND_SPEC,
    '',
    '当前页面状态：',
    `品牌：${brand}`,
    `竞品：${competitors}`,
    `行业：${industry}`,
    `页面状态：${status}`,
    total != null ? `当前可见度总分：${total}` : '当前尚无分析结果',
    `已生成问题数：${count}`,
    '',
    '输出格式（严格 JSON）：{"commands":[{...}],"reply":"给用户的简短中文确认"}',
    '若用户既要修改输入又要重新分析，则 commands 依次包含 updateForm 和 rerunAnalysis。',
    '仅修改字段时不要自动 rerunAnalysis。generateShareText 时 reply 直接写分享文案。',
    'competitors 必须始终是字符串数组（最多 3 个），禁止用字符串或用对象。若用户要你「生成/推荐竞品」，由你从该行业挑选 3 个真实、有代表性的直接填入，这没问题。',
    '只有当你无法把用户意图映射为任何 updateForm / rerunAnalysis / toggleMock / generateShareText / resetForm 时才考虑拒绝，否则永远输出合法指令。',
    `用户指令：${message}`,
  ].join('\n');
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(ip, 5, 60_000)) {
    return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return Response.json({ error: '消息不能为空' }, { status: 400 });
  }
  const state = (body.state ?? undefined) as ChatSummary | undefined;

  try {
    const raw = await chatCompletion([{ role: 'user', content: buildPrompt(state, message) }]);
    let json: unknown;
    try {
      json = JSON.parse(extractJson(raw));
    } catch {
      console.error('[chat] LLM 输出非 JSON:', raw.slice(0, 500));
      return Response.json({ error: 'AI 回复格式异常，请换种说法重试' } satisfies ChatResponse);
    }
    const out = validateChatOutput(json);
    if (!out || !out.commands.length) {
      const reason = out?.error ? `（${out.error}）` : '';
      return Response.json({
        error: `指令无法执行${reason}。试试直接说具体内容，例如「竞品填：猿辅导、学而思、作业帮」，而不是「随机生成」。`,
      } satisfies ChatResponse);
    }
    return Response.json({ commands: out.commands, reply: out.reply } satisfies ChatResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI 对话失败';
    console.error('[chat] 对话异常:', msg);
    return Response.json({ error: msg } satisfies ChatResponse);
  }
}