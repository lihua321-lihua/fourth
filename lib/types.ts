// 全局共享类型定义 —— 前后端、Mock 与真实 API 必须严格实现这些类型

/** 情感倾向：-2 到 +2 */
export type Sentiment = -2 | -1 | 0 | 1 | 2;

/** 输入表单 */
export interface FormInput {
  brand: string;
  competitors: string[];
  industry: string;
  websiteUrl?: string;
}

/** 单条回答中某个品牌的提及 */
export interface BrandMention {
  brand: string;
  /** 在回答中第一次出现的顺位，1 起 */
  rank: number;
  sentiment: Sentiment;
}

/** 一个问题 + 回答 + 结构化提及 */
export interface QuestionAnswer {
  id: number;
  question: string;
  answer: string;
  /** 引用来源（原回答中的链接/来源） */
  sources?: string[];
  mentions: BrandMention[];
}

export type ModelId = 'deepseek' | 'chatgpt' | 'gemini';

/** 某个模型对 10 个问题的完整结果 */
export interface ModelResult {
  model: ModelId;
  /** deepseek 为真实 API，其余为 Mock */
  isReal: boolean;
  questions: QuestionAnswer[];
}

/** 实体存在信号（Wikipedia / Wikidata） */
export interface EntitySignal {
  exists: boolean;
  /** 匹配到的实体名称 */
  label?: string;
  url?: string;
  note?: string;
}

/** robots.txt 爬虫可访问性 */
export interface RobotsBotResult {
  bot: string;
  /** null 表示该 bot 未在 robots.txt 中声明（默认允许） */
  allowed: boolean | null;
}

export interface RobotsSignal {
  /** 是否实际执行了检查（无官网 URL 时为 false） */
  checked: boolean;
  /** 是否找到了 robots.txt 文件本身 */
  found: boolean;
  bots: RobotsBotResult[];
  note?: string;
}

export interface PublicSignal {
  wikipedia: EntitySignal;
  wikidata: EntitySignal;
  robots: RobotsSignal;
}

/** 评分维度明细 */
export interface ScoreDimension {
  key: string;
  label: string;
  /** 权重 0~1 */
  weight: number;
  /** 该维度得分 0~100 */
  score: number;
  /** 加权分 = score * weight */
  weighted: number;
  /** 计算过程说明 */
  detail: string;
}

export interface ScoreBreakdown {
  /** 总分 0~100 */
  total: number;
  dimensions: ScoreDimension[];
  degraded: boolean;
  note?: string;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  input: FormInput;
  models: ModelResult[];
  publicSignal: PublicSignal;
  breakdown: ScoreBreakdown;
  degraded: boolean;
  degradedReason?: string;
}

export type AnalysisStatus = 'input' | 'loading' | 'result' | 'error';

export interface AnalysisState {
  status: AnalysisStatus;
  form: FormInput;
  result: AnalysisResult | null;
  error: string | null;
  /** 到达 result 后，UI 是否隐藏 Mock 数据（toggleMock 指令） */
  hideMock: boolean;
}

/** Agentic Chat：LLM 输出的结构化指令（白名单） */
export type ChatCommand =
  | { action: 'updateForm'; payload: Partial<FormInput> }
  | { action: 'rerunAnalysis' }
  | { action: 'toggleMock'; payload: { enabled: boolean } }
  | { action: 'generateShareText' }
  | { action: 'resetForm' };

/** 传给 /api/chat 的摘要（不传完整问答，避免 token 爆炸） */
export interface ChatSummary {
  status: AnalysisStatus;
  form: FormInput;
  totalScore?: number;
  questionCount?: number;
}

/** /api/analyze 的请求体 */
export interface AnalyzeRequest {
  input: FormInput;
}

/** /api/analyze 的响应体 */
export interface AnalyzeResponse {
  result: AnalysisResult;
}

/** /api/chat 的响应体 */
export interface ChatResponse {
  commands?: ChatCommand[];
  reply?: string;
  error?: string;
}

/** 分享报告的精简载荷（只含核心字段，不含完整问答正文） */
export interface ShareEntityRow {
  name: string;
  mentionedCount: number;
  avgRank: number | null;
  avgSent: number | null;
}

export interface ShareModelRow {
  model: ModelId;
  isReal: boolean;
  mentionedCount: number;
  avgRank: number | null;
  total: number;
}

export interface ShareReportData {
  brand: string;
  competitors: string[];
  industry: string;
  websiteUrl?: string;
  total: number;
  dimensions: { label: string; score: number; weight: number; weighted: number }[];
  models: ShareModelRow[];
  entities: ShareEntityRow[];
  degraded: boolean;
  degradedReason?: string;
  createdAt: string;
}