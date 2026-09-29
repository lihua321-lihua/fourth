import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { dbConfigured, saveSubscriber } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ email: z.string().email().max(200) });

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(ip, 5, 60_000)) {
    return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  if (!dbConfigured()) {
    return Response.json({ error: '数据库未配置（缺少 DATABASE_URL），暂时无法订阅' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '邮箱格式不正确' }, { status: 400 });
  }
  const email = (parsed.data.email as string).toLowerCase();

  try {
    const result = await saveSubscriber(email);
    if (!result) {
      return Response.json({ error: '数据库操作失败，请稍后重试' }, { status: 500 });
    }
    if (!result.ok) {
      return Response.json({ error: '该邮箱已订阅过' }, { status: 409 });
    }
    return Response.json({ ok: true, message: '订阅成功' });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '订阅失败' }, { status: 500 });
  }
}