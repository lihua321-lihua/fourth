import type { FormInput } from './types';

/** 预置示例数据（第一组为默认值） */
export const SAMPLE_FORM: FormInput = {
  brand: 'Acme',
  competitors: ['Notion', 'Slack', 'Asana'],
  industry: '项目管理',
  websiteUrl: '',
};

/** 示例数据池：多组真实感示例，供「随机示例」按钮抽取 */
export const SAMPLE_DATASETS: FormInput[] = [
  SAMPLE_FORM,
  // 项目管理（SaaS）
  {
    brand: '飞书项目',
    competitors: ['Teambition', 'Worktile', 'PingCode'],
    industry: '项目协作',
    websiteUrl: 'https://www.feishu.cn',
  },
  // 客服系统（SaaS）
  {
    brand: '网易七鱼',
    competitors: ['智齿科技', '环信', 'Udesk'],
    industry: '智能客服',
    websiteUrl: 'https://qiyukf.com',
  },
  // 在线教育（K12）
  {
    brand: '作业帮',
    competitors: ['猿辅导', '学而思网校', '作业盒子'],
    industry: '在线教育',
    websiteUrl: 'https://www.zybang.com',
  },
  // 协同办公 IM
  {
    brand: '飞书',
    competitors: ['钉钉', '企业微信', 'Slack'],
    industry: '协同办公',
    websiteUrl: 'https://www.feishu.cn',
  },
  // 数据分析 / BI
  {
    brand: 'FineBI',
    competitors: ['Tableau', 'Power BI', '帆软'],
    industry: '商业智能',
    websiteUrl: 'https://www.finebi.com',
  },
  // 视频会议
  {
    brand: '腾讯会议',
    competitors: ['Zoom', '飞书会议', 'Teams'],
    industry: '视频会议',
    websiteUrl: 'https://meeting.tencent.com',
  },
  // 云存储 / 网盘
  {
    brand: '百度网盘',
    competitors: ['阿里云盘', '腾讯微云', 'OneDrive'],
    industry: '个人云存储',
    websiteUrl: 'https://pan.baidu.com',
  },
  // API 测试工具
  {
    brand: 'Apifox',
    competitors: ['Postman', 'Apipost', 'Swagger'],
    industry: '接口测试',
    websiteUrl: 'https://apifox.com',
  },
  // 低代码 / 表单
  {
    brand: '腾讯问卷',
    competitors: ['问卷星', '金数据', '麦客'],
    industry: '在线问卷',
    websiteUrl: 'https://wj.qq.com',
  },
];

/** 返回某组表单在示例池中的下标，未命中返回 -1（用于避免连续抽到同一组） */
export function sampleIndex(form: FormInput): number {
  return SAMPLE_DATASETS.findIndex(
    (d) =>
      d.brand === form.brand &&
      d.industry === form.industry &&
      JSON.stringify(d.competitors) === JSON.stringify(form.competitors),
  );
}

/** 从示例池中抽取一组（避免重复返回同一组，便于轮换） */
export function randomSample(afterIndex?: number): FormInput {
  const n = SAMPLE_DATASETS.length;
  if (n <= 1) return SAMPLE_DATASETS[0];
  let idx = Math.floor(Math.random() * n);
  if (afterIndex != null && n > 1 && idx === afterIndex) {
    idx = (idx + 1) % n;
  }
  return SAMPLE_DATASETS[idx];
}