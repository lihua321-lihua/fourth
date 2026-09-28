'use client';

import type { FormInput } from '@/lib/types';

interface InputFormProps {
  form: FormInput;
  onChange: (patch: Partial<FormInput>) => void;
  onRandomSample: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function InputForm({
  form,
  onChange,
  onRandomSample,
  onSubmit,
  loading,
}: InputFormProps) {
  const setCompetitor = (index: number, value: string) => {
    const competitors = [...form.competitors];
    while (competitors.length < 3) competitors.push('');
    competitors[index] = value;
    onChange({ competitors });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          AI 可见度检查器
        </h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          输入品牌、竞品和行业，检查 AI 在回答买家问题时，是否推荐了你的品牌。
        </p>
      </header>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-5">
          <Field label="品牌名称" required>
            <input
              value={form.brand}
              onChange={(e) => onChange({ brand: e.target.value })}
              placeholder="例如：Acme"
              className={inputCls}
            />
          </Field>

          <Field label="竞品（最多 3 个）">
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <input
                  key={i}
                  value={form.competitors[i] ?? ''}
                  onChange={(e) => setCompetitor(i, e.target.value)}
                  placeholder={`竞品 ${i + 1}`}
                  className={inputCls}
                />
              ))}
            </div>
          </Field>

          <Field label="行业" required>
            <input
              value={form.industry}
              onChange={(e) => onChange({ industry: e.target.value })}
              placeholder="例如：项目管理"
              className={inputCls}
            />
          </Field>

          <Field label="官网 URL（可选，用于 robots.txt 检查）">
            <input
              value={form.websiteUrl ?? ''}
              onChange={(e) => onChange({ websiteUrl: e.target.value })}
              placeholder="https://example.com"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={onSubmit}
            disabled={loading || !form.brand.trim() || !form.industry.trim()}
            className="flex-1 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? '正在检查…' : '开始检查'}
          </button>
          <button
            onClick={onRandomSample}
            className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            🎲 随机示例
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500';