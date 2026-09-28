import type { EntitySignal } from './types';

const TIMEOUT_MS = 6000;

async function fetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'AI-Visibility-Checker/1.0 (+growth-lens)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface WikiSearchHit {
  title: string;
}

/** 搜索 Wikipedia，返回第一条结果，找不到返回 null */
async function searchWikipedia(query: string): Promise<WikiSearchHit | null> {
  const q = encodeURIComponent(query.trim());
  if (!q) return null;
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=1&format=json`;
  const data = await fetchJson(url);
  return data?.query?.search?.[0] ?? null;
}

/** Wikipedia：用「品牌 + 行业」消歧义，兜底用品牌名单独搜索 */
export async function lookupWikipedia(brand: string, industry: string): Promise<EntitySignal> {
  let hit = await searchWikipedia(`${brand} ${industry}`);
  if (!hit) hit = await searchWikipedia(brand);
  if (!hit) {
    return { exists: false, note: '未在 Wikipedia 找到匹配条目' };
  }
  return {
    exists: true,
    label: hit.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(hit.title).replace(/ /g, '_'))}`,
  };
}

interface WikidataHit {
  id: string;
  label?: string;
  description?: string;
}

async function searchWikidata(query: string): Promise<WikidataHit[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${q}&language=en&format=json&limit=5&uselang=en`;
  const data = await fetchJson(url);
  return (data?.search ?? []) as WikidataHit[];
}

function isOrgLike(description: string): boolean {
  const d = description.toLowerCase();
  return /company|brand|software|organization|business|product|service|corporation|startup|platform/.test(d);
}

/** Wikidata：实体搜索，优先匹配公司/品牌类实体，兜底品牌名单独搜索 */
export async function lookupWikidata(brand: string, industry: string): Promise<EntitySignal> {
  let items = await searchWikidata(`${brand} ${industry}`);
  if (items.length === 0) items = await searchWikidata(brand);

  const org = items.find((it) => isOrgLike(it.description ?? ''));
  const pick = org ?? items[0];
  if (!pick) {
    return { exists: false, note: '未在 Wikidata 找到匹配实体' };
  }
  return {
    exists: true,
    label: pick.label ?? pick.id,
    url: `https://www.wikidata.org/wiki/${pick.id}`,
    note: org ? undefined : '实体匹配可能偏差（描述未体现公司/品牌特征）',
  };
}