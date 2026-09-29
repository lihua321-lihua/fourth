import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { rateLimit } from '@/lib/rateLimit';
import { dbConfigured, findUserByEmail } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!rateLimit(ip, 5, 60_000)) {
    return Response.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  if (!dbConfigured()) {
    return Response.json({ error: '数据库未配置（缺少 DATABASE_URL），暂时无法登录' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: '邮箱或密码格式不正确' }, { status: 400 });
  }
  const email = (parsed.data.email as string).toLowerCase();
  const password = parsed.data.password as string;

  try {
    const user = await findUserByEmail(email);
    if (user === null) {
      return Response.json({ error: '数据库操作失败，请稍后重试' }, { status: 500 });
    }
    if (user === undefined) {
      // 统一报错，避免暴露账号是否存在
      return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return Response.json({ error: '邮箱或密码错误' }, { status: 401 });
    }
    // 轻量登录：仅返回成功，不做会话
    return Response.json({ ok: true, message: '登录成功', email });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '登录失败' }, { status: 500 });
  }
}