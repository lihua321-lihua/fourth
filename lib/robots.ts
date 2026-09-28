import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { RobotsBotResult, RobotsSignal } from './types';

/** 与页面展示的三个模型对齐的 AI 爬虫 */
export const AI_BOTS = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'PerplexityBot'] as const;

const TIMEOUT_MS = 6000;

/**
 * 解析 robots.txt 内容，判断各 bot 是否被完全禁止（Disallow: / 或 Disallow: *）。
 * 返回 allowed：true=放行、false=禁止、null=无明确规则（默认允许）。
 */
export function parseRobotsContent(content: string, bots: readonly string[]): RobotsBotResult[] {
  interface Group {
    agents: string[];
    disallowAll: boolean;
    sawDirective: boolean;
  }

  const groups: Group[] = [];
  let cur: Group | null = null;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();

    if (key === 'user-agent') {
      if (cur && cur.agents.length > 0 && !cur.sawDirective) {
        // 连续的 User-agent 行属于同一组
        cur.agents.push(val.toLowerCase());
      } else {
        cur = { agents: [val.toLowerCase()], disallowAll: false, sawDirective: false };
        groups.push(cur);
      }
    } else if (cur) {
      cur.sawDirective = true;
      if (key === 'disallow' && (val === '/' || val === '*')) {
        cur.disallowAll = true;
      }
    }
  }

  return bots.map((bot) => {
    const lower = bot.toLowerCase();
    const exact = groups.find((g) => g.agents.includes(lower));
    const wildcard = groups.find((g) => g.agents.includes('*'));
    const group = exact ?? wildcard;
    if (!group) return { bot, allowed: null };
    return { bot, allowed: !group.disallowAll };
  });
}

/** 判断 IP 是否属于私网/回环/链路本地等不可访问地址 */
function isPrivateAddress(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true;
  if (ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // 链路本地 / 唯一本地地址
  }
  const ipv4 = ip.split('.').map((n) => Number(n));
  if (ipv4.length === 4 && ipv4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = ipv4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

/** 校验官网 URL：仅 http/https，且解析后不得指向私网地址（SSRF 防护） */
async function validatePublicUrl(raw: string): Promise<{ ok: boolean; hostname?: string; error?: string }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: '官网 URL 格式无效' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: '官网 URL 仅支持 http/https' };
  }
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: '官网 URL 不允许指向本地/内网地址' };
  }
  if (isIP(host)) {
    return isPrivateAddress(host)
      ? { ok: false, error: '官网 URL 不允许指向私网地址' }
      : { ok: true, hostname: host };
  }
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.some((a) => isPrivateAddress(a.address))) {
      return { ok: false, error: '官网 URL 解析到私网地址，已阻止' };
    }
  } catch {
    // DNS 解析失败：交由后续 fetch 处理，超时兜底
  }
  return { ok: true, hostname: host };
}

/** 实际抓取并解析目标官网的 robots.txt */
export async function checkRobots(websiteUrl?: string): Promise<RobotsSignal> {
  if (!websiteUrl || !websiteUrl.trim()) {
    return { checked: false, found: false, bots: [], note: '未提供官网 URL' };
  }

  const validate = await validatePublicUrl(websiteUrl.trim());
  if (!validate.ok) {
    return { checked: false, found: false, bots: [], note: validate.error };
  }

  let origin: string;
  try {
    const u = new URL(websiteUrl.trim());
    origin = u.origin;
  } catch {
    return { checked: false, found: false, bots: [], note: '官网 URL 格式无效' };
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AI-Visibility-Checker/1.0' },
    });

    if (res.status === 404) {
      // robots.txt 不存在 → 默认允许
      return {
        checked: true,
        found: false,
        bots: AI_BOTS.map((bot) => ({ bot, allowed: true })),
        note: '未找到 robots.txt，默认允许所有 AI 爬虫',
      };
    }

    if (!res.ok) {
      return {
        checked: false,
        found: false,
        bots: [],
        note: `robots.txt 获取失败（HTTP ${res.status}），按无法计算处理`,
      };
    }

    const content = await res.text();
    const bots = parseRobotsContent(content, AI_BOTS);
    return { checked: true, found: true, bots };
  } catch {
    return {
      checked: false,
      found: false,
      bots: [],
      note: 'robots.txt 获取超时或网络错误，按无法计算处理',
    };
  } finally {
    clearTimeout(t);
  }
}