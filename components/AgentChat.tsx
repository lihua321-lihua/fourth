'use client';

import { useState } from 'react';
import type { AnalysisState, ChatCommand, ChatSummary, FormInput } from '@/lib/types';
import type { StateAction } from '@/lib/state';
import { SAMPLE_FORM } from '@/lib/sampleData';
import { buildShareReport, encodeReport } from '@/lib/compress';
import { summarizeBrand } from '@/lib/scoring';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

interface AgentChatProps {
  state: AnalysisState;
  dispatch: React.Dispatch<StateAction>;
  onAnalyze: (form: FormInput) => void;
}

export default function AgentChat({ state, dispatch, onAnalyze }: AgentChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(true);

  const summary: ChatSummary = {
    status: state.status,
    form: state.form,
    totalScore: state.result?.breakdown.total,
    questionCount: state.result?.models.find((m) => m.model === 'deepseek')?.questions.length ?? 0,
  };

  const buildShareText = (): string => {
    const r = state.result;
    if (!r) return '当前还没有分析结果，请先完成一次检查。';
    const encoded = encodeReport(buildShareReport(r));
    const link = `${window.location.origin}/report/${encoded}`;
    const s = r.models.find((m) => m.model === 'deepseek');
    const mention = s ? summarizeBrand(r.input.brand, s.questions) : null;
    return `${r.input.brand} 的 AI 可见度：${r.breakdown.total}/100 分（DeepSeek 真实调用${
      mention ? `，被提及 ${mention.mentionedCount}/${mention.total} 次` : ''
    }）。来看看你的品牌有没有被 AI 推荐：${link}`;
  };

  const execute = (commands: ChatCommand[], reply: string): string => {
    let form = state.form;
    let changed = false;
    let rerun = false;
    let shareText: string | null = null;

    for (const cmd of commands) {
      switch (cmd.action) {
        case 'updateForm':
          form = { ...form, ...cmd.payload };
          changed = true;
          break;
        case 'resetForm':
          dispatch({ type: 'RESET' });
          form = SAMPLE_FORM;
          break;
        case 'toggleMock':
          dispatch({ type: 'SET_HIDE_MOCK', payload: !cmd.payload.enabled });
          break;
        case 'rerunAnalysis':
          rerun = true;
          break;
        case 'generateShareText':
          shareText = buildShareText();
          break;
      }
    }

    if (changed) dispatch({ type: 'LOAD_FORM', payload: form });
    if (rerun) onAnalyze(form);
    if (shareText != null) return shareText;
    return reply || '已完成。';
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || loading) return;
    setInput('');
    setLoading(true);
    setMessages((m) => [...m, { role: 'user', text: message }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, state: summary }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        setMessages((m) => [...m, { role: 'assistant', text: `⚠️ ${data.error}` }]);
      } else {
        const finalReply = execute(data.commands ?? [], data.reply ?? '已完成。');
        setMessages((m) => [...m, { role: 'assistant', text: finalReply }]);
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: '⚠️ 对话失败，请稍后重试。' }]);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <button
        onClick={() => setMinimized((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        <span>🤖 AI 操作助手</span>
        <span>{minimized ? '展开 ▲' : '收起 ▼'}</span>
      </button>

      {!minimized && (
        <>
          <div className="h-56 space-y-2 overflow-y-auto border-t border-zinc-100 px-4 py-3 text-sm dark:border-zinc-800">
            {messages.length === 0 && (
              <p className="text-zinc-400">
                你可以用自然语言修改页面，例如：“把竞品改成 Notion、Slack、Asana，重新分析。”
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-1'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => copy(m.text)}
                    className="self-start rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    title="复制"
                  >
                    复制
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="用自然语言操作页面…"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? '…' : '发送'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}