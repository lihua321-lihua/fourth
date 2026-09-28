'use client';

import { useEffect, useState } from 'react';

const STEPS = ['正在生成问题', '询问 DeepSeek', '解析品牌提及', '查询公开信号'];

/**
 * 加载态：假动画——按固定节奏逐个“完成”步骤，高亮当前步。
 * 仅做视觉进度反馈，不与真实后台时序强绑定。
 */
export default function LoadingState() {
  // current 为当前“播放到”的步骤下标；-1 表示尚未开始
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => {
        if (c < STEPS.length - 1) return c + 1;
        return c; // 播到最后一步后停留
      });
    }, 1300);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl py-16 text-center">
      <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">分析进行中…</h2>
      <ul className="mx-auto mt-6 max-w-xs space-y-3 text-sm">
        {STEPS.map((step, i) => {
          const done = current > i;
          const active = current === i;
          return (
            <li
              key={step}
              className={`flex items-center justify-center gap-2 transition-colors ${
                done
                  ? 'text-zinc-400 dark:text-zinc-500'
                  : active
                    ? 'font-medium text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-300 dark:text-zinc-600'
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                  done
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : active
                      ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                      : 'border-zinc-300 text-transparent dark:border-zinc-700'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              {step}
              {active && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}