'use client';

import { useCallback, useReducer, useState } from 'react';
import { initialState, reducer } from '@/lib/state';
import { sampleIndex, randomSample } from '@/lib/sampleData';
import { buildShareReport, encodeReport } from '@/lib/compress';
import InputForm from '@/components/InputForm';
import LoadingState from '@/components/LoadingState';
import ResultView from '@/components/ResultView';
import AgentChat from '@/components/AgentChat';

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toast, setToast] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (form = state.form) => {
      dispatch({ type: 'START_LOADING' });
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: form }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `请求失败（${res.status}）`);
        dispatch({ type: 'SET_RESULT', payload: data.result });
      } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e instanceof Error ? e.message : '分析失败' });
      }
    },
    [state.form],
  );

  const handleShare = useCallback(async () => {
    if (!state.result) return;
    const encoded = encodeReport(buildShareReport(state.result));
    const url = `${window.location.origin}/report/${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast('分享链接已复制');
    } catch {
      setToast(`复制失败，请手动复制：${url}`);
    }
    setTimeout(() => setToast(null), 2500);
  }, [state.result]);

  return (
    <main className="flex-1 w-full px-4 py-12">
      <a
        href="/about"
        className="fixed top-4 right-4 text-sm text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        产品说明
      </a>
      {state.status === 'input' && (
        <InputForm
          form={state.form}
          onChange={(patch) => dispatch({ type: 'UPDATE_FORM', payload: patch })}
          onRandomSample={() => {
            const next = randomSample(sampleIndex(state.form));
            dispatch({ type: 'LOAD_FORM', payload: next });
          }}
          onSubmit={() => runAnalysis()}
          loading={false}
        />
      )}

      {state.status === 'loading' && <LoadingState />}

      {state.status === 'result' && state.result && (
        <div>
          <ResultView
            result={state.result}
            hideMock={state.hideMock}
            onRerun={() => runAnalysis()}
            onBack={() => dispatch({ type: 'RESET' })}
            onShare={handleShare}
          />
        </div>
      )}

      {state.status === 'error' && (
        <div className="mx-auto w-full max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">出错了</p>
          <p className="mt-1">{state.error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => runAnalysis()}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500"
            >
              重试
            </button>
            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
            >
              返回输入
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}

      <AgentChat state={state} dispatch={dispatch} onAnalyze={runAnalysis} />
    </main>
  );
}