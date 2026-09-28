import { z } from 'zod';
import type { ChatCommand } from './types';

/**
 * Agentic 指令白名单：LLM 只能输出以下动作，前端/后端二次校验后方可执行。
 */

const formPayloadSchema = z.object({
  brand: z.string().optional(),
  competitors: z.array(z.string()).max(3).optional(),
  industry: z.string().optional(),
  websiteUrl: z.string().optional(),
});

const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('updateForm'), payload: formPayloadSchema }),
  z.object({ action: z.literal('rerunAnalysis') }),
  z.object({ action: z.literal('toggleMock'), payload: z.object({ enabled: z.boolean() }) }),
  z.object({ action: z.literal('generateShareText') }),
  z.object({ action: z.literal('resetForm') }),
]);

const chatOutputSchema = z.object({
  commands: z.array(commandSchema).min(1),
  reply: z.string(),
});

/**
 * 归一化常见 LLM 输出错误，提升容错：
 * - competitors 若被写成逗号/顿号分隔的单个字符串 → 拆成字符串数组
 * - competitors 若是对象数组 → 尝试抽取字符串字段
 */
function normalizeCommands(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.map((c) => {
    if (c && typeof c === 'object' && (c as Record<string, unknown>).action === 'updateForm') {
      const payload = (c as Record<string, unknown>).payload as Record<string, unknown> | undefined;
      if (payload && typeof payload === 'object') {
        const comps = payload.competitors;
        if (typeof comps === 'string') {
          payload.competitors = comps
            .split(/[,，、;；]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (Array.isArray(comps)) {
          // 若元素是对象，尝试取其 name/text/label 字段
          payload.competitors = comps.map((x) =>
            x && typeof x === 'object'
              ? String((x as Record<string, unknown>).name ?? (x as Record<string, unknown>).label ?? '')
              : String(x),
          );
        }
      }
    }
    return c;
  });
}

export interface ChatOutputResult {
  commands: ChatCommand[];
  reply: string;
  /** 校验失败时的具体原因（供日志与调试） */
  error?: string;
}

/** 校验 LLM 返回的结构化 JSON 指令（含容错归一化，失败时返回 null 并附带原因） */
export function validateChatOutput(json: unknown): ChatOutputResult | null {
  const normalized = { ...(json as object), commands: normalizeCommands((json as { commands?: unknown })?.commands) };
  const r = chatOutputSchema.safeParse(normalized);
  if (r.success) {
    return { commands: r.data.commands, reply: r.data.reply };
  }
  // 提取可读的错误路径（用于日志定位：竞品格式 / 非法 action 等）
  const flat = z.flattenError(r.error);
  const issues = flat
    .formErrors.concat(flat.fieldErrors ? Object.values(flat.fieldErrors).flat() : [])
    .join('; ');
  console.error('[chat] 指令校验失败:', issues, '原始JSON=', JSON.stringify(json));
  return { commands: [], reply: '', error: issues };
}

/** 供 prompt 使用的指令说明 */
export const COMMAND_SPEC = [
  'updateForm：payload 为 {brand?, competitors?, industry?, websiteUrl?}，仅包含要修改的字段',
  'rerunAnalysis：无 payload，重新运行分析',
  'toggleMock：payload 为 {enabled: boolean}，true 显示、false 隐藏模拟数据',
  'generateShareText：无 payload，生成分享文案',
  'resetForm：无 payload，重置表单',
].join('\n');