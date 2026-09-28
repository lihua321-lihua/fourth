'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { decodeReport } from '@/lib/compress';
import type { ShareModelRow, ShareReportData } from '@/lib/types';

const MODEL_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [data, setData] = useState<ShareReportData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const decoded = decodeReport(id);
    if (decoded) setData(decoded);
    else setError(true);
  }, [id]);

  if (error) {
    return (
      <main className="flex-1 w-full px-4 py-16">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          报告链接无效或已损坏。
          <div className="mt-4">
            <Link href="/" className="text-red-600 underline">
              返回首页
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 w-full px-4 py-24 text-center text-sm text-zinc-500">正在解析报告…</main>
    );
  }

  return (
    <main className="flex-1 w-full px-4 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            这是「{data.brand}」的 AI 可见度报告
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {data.industry} · 生成于 {new Date(data.createdAt).toLocaleString('zh-CN')}
          </p>
        </header>

        {data.degradedReason && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            ⚠️ {data.degradedReason}
          </div>
        )}

        {/* 总分 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-sm text-zinc-500">AI 可见度分数</div>
          <div className="mt-1 text-5xl font-bold text-zinc-900 dark:text-zinc-50">{data.total}</div>
          <div className="mt-1 text-xs text-zinc-400">满分 100 · AI 生成结果，仅供参考</div>
        </section>

        {/* 模型对比摘要 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">多模型对比</h2>
          <div className="mt-4 space-y-3">
            {data.models.map((m) => (
              <ModelLine key={m.model} m={m} brand={data.brand} />
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            ⚠️ 总分仅基于 DeepSeek 真实回答，ChatGPT/Gemini 为模拟数据、不参与评分。
          </p>
        </section>

        {/* 竞品摘要 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">竞品对比</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
                  <th className="py-2 pr-3 font-medium">品牌</th>
                  <th className="py-2 pr-3 font-medium">被提到次数</th>
                  <th className="py-2 pr-3 font-medium">平均排名</th>
                  <th className="py-2 font-medium">描述倾向</th>
                </tr>
              </thead>
              <tbody>
                {data.entities.map((e) => (
                  <tr key={e.name} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3 font-medium text-zinc-800 dark:text-zinc-200">{e.name}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{e.mentionedCount}/{data.models[0]?.total ?? 10}</td>
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">
                      {e.avgRank != null ? e.avgRank.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-300">
                      {e.avgSent != null ? `${e.avgSent >= 0 ? '+' : ''}${e.avgSent.toFixed(1)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 计算过程 */}
        <Details data={data} />

        <p className="text-center text-xs text-zinc-400">
          本报告为精简版（不含完整逐题详情），演示用途、可被篡改，不作为正式审计依据。
        </p>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-block rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            检查你自己的品牌
          </Link>
        </div>
      </div>
    </main>
  );
}

function ModelLine({ m, brand }: { m: ShareModelRow; brand: string }) {
  const avg = m.avgRank != null ? m.avgRank.toFixed(1) : '—';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
      <span className="font-medium text-zinc-900 dark:text-zinc-50">{MODEL_NAMES[m.model]}</span>
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
        {m.model === 'deepseek' ? (m.isReal ? '✅ 真实' : '⚠️ 示例（未接入 API）') : '⚠️ 模拟结果'}
      </span>
      <span className="text-sm text-zinc-600 dark:text-zinc-300">
        {brand} 被提到 {m.mentionedCount}/{m.total} 次，平均排名 {avg}
      </span>
    </div>
  );
}

function Details({ data }: { data: ShareReportData }) {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
        展开计算过程
      </summary>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700">
              <th className="py-2 pr-3 font-medium">维度</th>
              <th className="py-2 pr-3 font-medium">权重</th>
              <th className="py-2 pr-3 font-medium">得分</th>
              <th className="py-2 font-medium">加权分</th>
            </tr>
          </thead>
          <tbody>
            {data.dimensions.map((d) => (
              <tr key={d.label} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">{d.label}</td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{(d.weight * 100).toFixed(0)}%</td>
                <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{d.score.toFixed(1)}</td>
                <td className="py-2 text-zinc-800 dark:text-zinc-200">{d.weighted.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}