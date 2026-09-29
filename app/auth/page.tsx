'use client';

import { useState } from 'react';
import Link from 'next/link';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async () => {
    if (!email.trim() || !password.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const endpoint = mode === 'register' ? '/api/register' : '/api/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? (mode === 'register' ? '注册失败' : '登录失败'));
      setResult({ ok: true, msg: data.message ?? (mode === 'register' ? '注册成功' : '登录成功') });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : '操作失败，请重试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        GrowthLens 账号
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
        注册开启每周自动监控、历史趋势与竞品变化告警
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          {(
            [
              ['login', '登录'],
              ['register', '注册'],
            ] as [Mode, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === key
                  ? 'border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">邮箱</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={mode === 'register' ? '设置密码（至少 6 位）' : '输入密码'}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          {result && (
            <p className={`text-sm ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.msg}</p>
          )}

          <button
            onClick={submit}
            disabled={busy || !email.trim() || !password.trim()}
            className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? '处理中…' : mode === 'register' ? '注册' : '登录'}
          </button>

          <Link
            href="/"
            className="block text-center text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}