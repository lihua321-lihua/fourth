import Link from 'next/link';

const LIMITATIONS = [
  [
    'AI 数据来源',
    '分数基于真实调用的 DeepSeek API；ChatGPT 与 Gemini 展示的均为「模拟」结果，仅作形象示意，不代表它们的真实表现。',
  ],
  [
    '公开信号与网络',
    'Wikipedia / Wikidata / robots.txt 依赖外部网络，请求超时会自动跳过并将该维度标记为不可用，分数随之重新归一化。',
  ],
  [
    '语音输入',
    '语音识别依赖浏览器（Chrome / Edge 体验最佳），需要授权麦克风；目前不支持长句自动续识别。',
  ],
  [
    '登录与注册',
    '登录/注册仅为演示：能校验并写入账号，但不维护会话状态——登录后不会保持登录态，也没有个人中心或历史记录。',
  ],
  [
    '订阅邮件',
    '订阅仅将邮箱写入数据库，尚未真正定时发送任何邮件。',
  ],
  [
    '分数性质',
    '可见度分数是启发式估算，供创业团队快速参考，不是权威度量，不应作为唯一决策依据。',
  ],
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-400 underline underline-offset-4 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        ← 返回
      </Link>

      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        产品说明
      </h1>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-200">这是什么</h2>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          输入你的品牌、竞品与行业，几秒钟内算出一个「在 AI 里的可见度分数」，帮你快速了解品牌在 AI
          回答中被提及的概率，以及与竞品的相对位置。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-200">如何使用</h2>
        <ol className="list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>填入品牌名与行业（可选：竞品、官网网址）。</li>
          <li>点击「计算可见度」，等待分析完成。</li>
          <li>查看分数与明细，或使用对话助手、分享、导出、订阅与登录注册。</li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-200">它能给出什么</h2>
        <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>0–100 总分与五维度权重拆解，说明得分依据。</li>
          <li>品牌在 AI 回答中被提及的概率，及与竞品的对比。</li>
          <li>DeepSeek 真实问答，与 ChatGPT / Gemini 模拟结果（均已标注）的对照。</li>
          <li>公开信号补充：百科收录、官网是否允许 AI 爬取。</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-medium text-zinc-800 dark:text-zinc-200">限制与未实现</h2>
        <ul className="space-y-2">
          {LIMITATIONS.map(([title, desc]) => (
            <li key={title} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{title}：</span>
              <span className="text-zinc-500 dark:text-zinc-400">{desc}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}