'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalysisResult, ModelResult, QuestionAnswer, Sentiment } from '@/lib/types';
import { summarizeBrand } from '@/lib/scoring';

const MODEL_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

const SENT_LABEL: Record<Sentiment, string> = {
  [-2]: '-2',
  [-1]: '-1',
  0: '0',
  1: '+1',
  2: '+2',
};

interface ResultViewProps {
  result: AnalysisResult;
  hideMock: boolean;
  onRerun: () => void;
  onBack: () => void;
  onShare: () => void;
}

export default function ResultView({ result, hideMock, onRerun, onBack, onShare }: ResultViewProps) {
  const brand = result.input.brand;
  const deepseek = result.models.find((m) => m.model === 'deepseek');
  const visibleModels = result.models.filter((m) => m.isReal || !hideMock);

  // 导出当前结果为 Markdown 文件
  const downloadMarkdown = () => {
    const { breakdown, input } = result;
    const mention = deepseek ? summarizeBrand(input.brand, deepseek.questions) : null;
    const lines: string[] = [];
    lines.push(`# ${input.brand} 的 AI 可见度报告`);
    lines.push('');
    lines.push(`- 行业：${input.industry}`);
    lines.push(`- 竞品：${input.competitors.join('、') || '未填写'}`);
    lines.push(`- 官网：${input.websiteUrl || '未填写'}`);
    lines.push(`- 总分：**${breakdown.total} / 100**`);
    if (mention) lines.push(`- 被提及：${mention.mentionedCount}/${mention.total} 次`);
    if (result.degradedReason) lines.push(`- 提示：${result.degradedReason}`);
    lines.push('');
    lines.push('## 计算过程');
    lines.push('');
    lines.push('| 维度 | 权重 | 得分 | 加权分 |');
    lines.push('| --- | --- | --- | --- |');
    for (const d of breakdown.dimensions) {
      lines.push(`| ${d.label} | ${d.weight} | ${d.score} | ${d.weighted} |`);
    }
    lines.push('');
    lines.push('## 多模型对比');
    lines.push('');
    for (const m of visibleModels) {
      const q = m.questions;
      const mCount = q ? summarizeBrand(input.brand, q) : null;
      lines.push(`### ${MODEL_NAMES[m.model] ?? m.model}（${m.isReal ? '真实' : '模拟'}）`);
      if (mCount) lines.push(`- 提及：${mCount.mentionedCount}/${mCount.total} 次`);
      if (m.isReal) {
        lines.push('');
        for (const qa of q) {
          lines.push(`**${qa.question}**`);
          lines.push('');
          lines.push(qa.answer);
          lines.push('');
        }
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
    lines.push(`*由 AI 可见度检查器生成，仅供参考*`);
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${input.brand}-AI-可见度报告.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* 数据来源提示 */}
      {result.degradedReason && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          ⚠️ {result.degradedReason}
        </div>
      )}

      {/* 总分卡 */}
      <ScoreCard result={result} />

      {/* 多模型对比 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          DeepSeek 可见度 + ChatGPT/Gemini 模拟对比
        </h2>
        <div className="mt-4 space-y-3">
          {visibleModels.map((m) => (
            <ModelLine key={m.model} model={m} brand={brand} />
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          ⚠️ 不同 AI 平台的知识覆盖存在结构性差异。总分仅基于 DeepSeek 真实回答，ChatGPT 和 Gemini
          为模拟数据、不参与评分。本工具展示多模型交叉结果，不声称任何单一模型代表「AI 搜索的真相」。
        </p>
      </section>

      {/* 竞品对比表 */}
      {deepseek && deepseek.questions.length > 0 && (
        <CompetitorTable result={result} />
      )}

      {/* 逐题详情 */}
      {deepseek && deepseek.questions.length > 0 && (
        <QuestionDetails deepseek={deepseek} />
      )}

      {/* 操作区 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onRerun}
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          用相同问题重新运行
        </button>
        <button
          onClick={onShare}
          className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          复制分享链接
        </button>
        <button
          onClick={downloadMarkdown}
          className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          导出报告
        </button>
        <button
          onClick={onBack}
          className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          更换输入
        </button>
      </div>

      {/* 转化区 */}
      <ConversionSection />

      {/* 数据说明与已知限制 */}
      <Limitations />
    </div>
  );
}

function ScoreCard({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(false);
  const { breakdown } = result;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">AI 可见度分数</div>
          <div className="mt-1 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {breakdown.total}
          </div>
          <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">满分 100 · AI 生成结果，仅供参考</div>
        </div>
      </div>

      {breakdown.degraded && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          注意：AI 问答生成失败，当前为公开信号基础版评分，维度权重已重新归一化。
        </p>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
      >
        {open ? '收起' : '展开'}计算过程
      </button>

      {open && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
                <th className="py-2 pr-3 font-medium">维度</th>
                <th className="py-2 pr-3 font-medium">权重</th>
                <th className="py-2 pr-3 font-medium">得分</th>
                <th className="py-2 font-medium">加权分</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.dimensions.map((d) => (
                <tr key={d.key} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-zinc-800 dark:text-zinc-200">{d.label}</div>
                    <div className="text-xs text-zinc-400">{d.detail}</div>
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                    {(d.weight * 100).toFixed(0)}%
                  </td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{d.score.toFixed(1)}</td>
                  <td className="py-2 font-medium text-zinc-800 dark:text-zinc-200">
                    {d.weighted.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ModelLine({ model, brand }: { model: ModelResult; brand: string }) {
  const s = summarizeBrand(brand, model.questions);
  const avg = s.avgRank != null ? s.avgRank.toFixed(1) : '—';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
      <span className="font-medium text-zinc-900 dark:text-zinc-50">{MODEL_NAMES[model.model]}</span>
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
        {model.model === 'deepseek' ? (model.isReal ? '✅ 真实' : '⚠️ 示例（未接入 API）') : '⚠️ 模拟结果'}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-300">
        {brand} 被提到 {s.mentionedCount}/{s.total} 次，平均排名 {avg}
      </span>
      {model.model !== 'deepseek' && (
        <span className="text-xs text-zinc-400">（不参与评分）</span>
      )}
    </div>
  );
}

function CompetitorTable({ result }: { result: AnalysisResult }) {
  const deepseek = result.models.find((m) => m.model === 'deepseek')!;
  const names = [result.input.brand, ...result.input.competitors.filter(Boolean)];

  const rows = names.map((name) => {
    const s = summarizeBrand(name, deepseek.questions);
    const mentions = deepseek.questions.flatMap((q) => q.mentions.filter((m) => m.brand === name));
    const avgSent = mentions.length
      ? mentions.reduce((sum, m) => sum + m.sentiment, 0) / mentions.length
      : null;
    return { name, ...s, avgSent };
  });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">竞品对比</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
              <th className="py-2 pr-3 font-medium">品牌</th>
              <th className="py-2 pr-3 font-medium">被提到次数</th>
              <th className="py-2 pr-3 font-medium">平均排名</th>
              <th className="py-2 font-medium">描述倾向</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-200">{r.name}</td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                  {r.mentionedCount}/{r.total}
                </td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                  {r.avgRank != null ? r.avgRank.toFixed(1) : '—'}
                </td>
                <td className="py-2 text-zinc-600 dark:text-zinc-300">
                  {r.avgSent != null ? `${r.avgSent >= 0 ? '+' : ''}${r.avgSent.toFixed(1)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuestionDetails({ deepseek }: { deepseek: ModelResult }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        逐题详情（DeepSeek 原始回答，默认折叠）
      </h2>
      <div className="mt-4 space-y-3">
        {deepseek.questions.map((q) => (
          <QuestionItem key={q.id} q={q} />
        ))}
      </div>
    </section>
  );
}

function QuestionItem({ q }: { q: QuestionAnswer }) {
  const ordered = [...q.mentions].sort((a, b) => a.rank - b.rank);
  return (
    <details className="group rounded-lg border border-zinc-200 dark:border-zinc-700">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span>
          {q.id}. {q.question}
        </span>
        <span className="text-zinc-400">▾</span>
      </summary>
      <div className="space-y-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div>
          <div className="text-xs font-medium text-zinc-500">AI 原始回答</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{q.answer}</p>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">引用来源</div>
          {q.sources && q.sources.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
              {q.sources.map((s, i) => (
                <li key={i} className="break-all">{s}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">（无引用）</p>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">品牌/竞品提及</div>
          {ordered.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {ordered.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {m.brand} · 第 {m.rank} 位 · 倾向 {SENT_LABEL[m.sentiment]}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">（未提及）</p>
          )}
        </div>
      </div>
    </details>
  );
}

function ConversionSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);

  const doSubscribe = async () => {
    if (!email.trim() || subBusy) return;
    setSubBusy(true);
    setSubscribed(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '订阅失败');
      setSubscribed(data.message ?? '订阅成功');
    } catch (e) {
      setSubscribed(e instanceof Error ? e.message : '订阅失败，请重试');
    } finally {
      setSubBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">解锁更完整的 AI 可见度</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">免费订阅报告</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">每周接收报告，无需注册，门槛最低</p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>每周围绕你的品牌自动生成</li>
            <li>记录你的 AI 可见度分数变化</li>
            <li>只需邮箱，随时可退订</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={doSubscribe}
              disabled={subBusy || !email.trim()}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {subBusy ? '…' : '订阅'}
            </button>
          </div>
          {subscribed && <p className="mt-2 text-sm text-emerald-600">{subscribed}</p>}
        </div>

        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-600 dark:bg-zinc-800/40">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">创建 GrowthLens 账号</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">解锁完整监控与协作功能</p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <li>每周自动监控与历史趋势</li>
            <li>竞品变化实时告警</li>
            <li>团队协作与分享</li>
          </ul>
          <Link
            href="/auth"
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            注册 GrowthLens
          </Link>
          <p className="mt-2 text-center text-sm text-zinc-400">
            已有账号？{' '}
            <Link href="/auth" className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300">
              立即登录
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Limitations() {
  const items = [
    'LLM 回答具有随机性，同一输入两次运行可能略有差异。',
    '本工具使用 DeepSeek 真实 API，ChatGPT/Gemini 为模拟数据（不参与评分）。',
    '中文模型对海外品牌覆盖可能偏低，这是训练数据分布决定的。',
    'API 调用结果与网页端结果可能存在差异。',
    '本工具不声称覆盖所有 AI 平台。',
    '分享报告为演示用途，可被篡改，不作为正式审计依据。',
  ];
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
        数据说明与已知限制
      </summary>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </details>
  );
}