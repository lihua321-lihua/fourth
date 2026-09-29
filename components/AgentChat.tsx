'use client';

import { useRef, useState } from 'react';
import type { AnalysisState, ChatCommand, ChatSummary, FormInput } from '@/lib/types';
import type { StateAction } from '@/lib/state';
import { SAMPLE_FORM } from '@/lib/sampleData';
import { buildShareReport, encodeReport } from '@/lib/compress';
import { summarizeBrand } from '@/lib/scoring';

interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error?: string; message?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

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
  const [listening, setListening] = useState(false);
  const [speechErr, setSpeechErr] = useState('');
  const recRef = useRef<Rec | null>(null);

  // 长按持续输入：按住开始识别，松开停止
  const startListening = () => {
    if (listening) return;
    setSpeechErr('');
    const win = window as unknown as {
      SpeechRecognition?: new () => Rec;
      webkitSpeechRecognition?: new () => Rec;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setSpeechErr('当前浏览器不支持语音输入，请使用 Chrome / Edge');
      return;
    }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    // 连续识别：说话停顿（无语音阶段）不自动结束，直到用户松手停止
    rec.continuous = true;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput((prev) => (prev ? prev + text : text));
    };
    rec.onerror = (e) => {
      setListening(false);
      recRef.current = null;
      const code = e?.error ?? 'unknown';
      console.log('[speech] error:', code, e?.message ?? '');
      let msg = '未能识别语音，请重试';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        msg = '麦克风权限未授权，请在浏览器地址栏允许麦克风访问后重试';
      } else if (code === 'network') {
        msg = '语音识别服务无法连接（可能需要网络/代理），请检查网络或改用文字输入';
      } else if (code === 'no-speech') {
        msg = '没有检测到声音，请靠近麦克风再试';
      } else if (code === 'audio-capture') {
        msg = '未检测到可用麦克风，请检查设备';
      }
      setSpeechErr(msg);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setListening(false);
      recRef.current = null;
      console.log('[speech] start error:', err);
      setSpeechErr('未能启动语音识别');
    }
  };

  // 松手停止识别
  const stopListening = () => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    setListening(false);
  };

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
            <button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerCancel={stopListening}
              onPointerLeave={stopListening}
              onContextMenu={(e) => e.preventDefault()}
              disabled={loading}
              title="按住说话，松开结束"
              className={`shrink-0 select-none touch-none rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                listening
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-red-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {listening ? '🔴' : '🎤'}
            </button>
            <p
              className={`flex shrink-0 items-center rounded-lg px-3 text-sm transition-colors ${
                listening
                  ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              {listening ? '松开停止' : '按住说话'}
            </p>
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
          {speechErr && (
            <p className="px-3 pb-2 text-xs text-red-500">{speechErr}</p>
          )}
        </>
      )}
    </div>
  );
}