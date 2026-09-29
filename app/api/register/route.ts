import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rateLimit';
import { createAccount, dbConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(128),
});

const SALT_ROUNDS = 10;

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(ip, 5, 60_000)) {
    return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  if (!dbConfigured()) {
    return Response.json({ error: '数据库未配置（缺少 DATABASE_URL），暂时无法注册' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '邮箱或密码不符合要求（密码至少 6 位）' }, { status: 400 });
  }
  const email = (parsed.data.email as string).toLowerCase();
  const password = parsed.data.password as string;

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await createAccount(email, hash);
    if (!result) {
      return Response.json({ error: '数据库操作失败，请稍后重试' }, { status: 500 });
    }
    if (!result.ok) {
      return Response.json({ error: '该邮箱已注册' }, { status: 409 });
    }
    return Response.json({ ok: true, message: '注册成功' });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '注册失败' }, { status: 500 });
  }
}