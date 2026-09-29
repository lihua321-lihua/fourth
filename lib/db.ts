import { Pool } from 'pg';

/**
 * 订阅 / 注册的存储层。使用外接 Postgres（Neon/Supabase 免费层）。
 * - 未配置 DATABASE_URL 时 query() 返回 null（调用方优雅降级，提示需配置）
 * - 启动时惰性建表：subscribers（订阅邮箱）、users（轻量账号）
 */

const cached: { pool: Pool | null } = { pool: null };

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (cached.pool) return cached.pool;
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  cached.pool = pool;
  return pool;
}

/** 通用查询；未配置数据库返回 null */
async function query(text: string, params?: unknown[]): Promise<unknown[] | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query(text, params);
  return res.rows;
}

async function initDb(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function saveSubscriber(email: string): Promise<{ ok: boolean; reason: 'duplicate' } | null> {
  await initDb();
  const rows = await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id', [email]);
  if (!rows) return null;
  return { ok: rows.length > 0, reason: 'duplicate' };
}

export async function createAccount(
  email: string,
  passwordHash: string,
): Promise<{ ok: boolean; reason: 'duplicate' } | null> {
  await initDb();
  const rows = await query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
    [email, passwordHash],
  );
  if (!rows) return null;
  return { ok: rows.length > 0, reason: 'duplicate' };
}

/** 是否已配置数据库 */
export function dbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/** 按邮箱查询账号（返回密码哈希，供登录校验） */
export async function findUserByEmail(
  email: string,
): Promise<{ email: string; password_hash: string } | null | undefined> {
  await initDb();
  const rows = await query('SELECT email, password_hash FROM users WHERE email = $1 LIMIT 1', [email]);
  if (!rows) return null; // 未配置数据库
  return rows.length ? (rows[0] as { email: string; password_hash: string }) : undefined;
}