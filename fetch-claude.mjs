// GitHub の自動実行で動かす中継スクリプト。
// Claude・Anthropic 関連の新着を集めて feeds.json に書き出す。
// 集めるのはタイトル・リンク・日時・サムネイルと、冒頭の短い抜粋だけ。
import { readFile, writeFile } from "node:fs/promises";

const OUT = new URL("./feeds.json", import.meta.url);
const OLSHANSK = "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/";

const SOURCES = [
  { id: "news", url: OLSHANSK + "feed_anthropic_news.xml" },
  { id: "engineering", url: OLSHANSK + "feed_anthropic_engineering.xml" },
  { id: "research", url: OLSHANSK + "feed_anthropic_research.xml" },
  { id: "claude-code", url: "https://github.com/anthropics/claude-code/releases.atom", changelog: true },
  { id: "status", url: "https://status.claude.com/history.rss", alt: "https://status.anthropic.com/history.rss", per: 15 },
  { id: "youtube", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA", per: 15 },
  { id: "hn", url: "https://hnrss.org/newest?q=Claude+OR+Anthropic&points=100&count=30" },
  { id: "reddit", url: "https://www.reddit.com/r/ClaudeAI/top/.rss?t=week", per: 20 },
  { id: "zenn", url: "https://zenn.dev/topics/claudecode/feed", alt: "https://zenn.dev/topics/claude/feed" },
  { id: "qiita", url: "https://qiita.com/tags/claudecode/feed", alt: "https://qiita.com/tags/claude/feed" }
];
const PER_SOURCE = 30;

const decode = (s = "") =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};
const attr = (block, re) => decode(block.match(re)?.[1] ?? "");
const plain = (html) => decode(html.replace(/<li[^>]*>/gi, "\n- ").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function parse(xml) {
  const isAtom = /<feed[\s>]/.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/g : /<item[\s>][\s\S]*?<\/item>/g) ?? [];
  return blocks.map((b) => {
    const html = tag(b, "content:encoded") || tag(b, "content") || tag(b, "media:description") || tag(b, "description");
    const link = isAtom
      ? attr(b, /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || attr(b, /<link[^>]*href="([^"]+)"/)
      : tag(b, "link");
    const img =
      attr(b, /<media:thumbnail[^>]*url="([^"]+)"/) ||
      attr(b, /<enclosure[^>]*url="([^"]+\.(?:png|jpe?g|webp|gif)[^"]*)"/i) ||
      (html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? "");
    const date = Date.parse(tag(b, "published") || tag(b, "dc:date") || tag(b, "pubDate") || tag(b, "updated")) || 0;
    const usable = img.startsWith("https://") && !img.includes("avatars.githubusercontent.com");
    return { title: tag(b, "title"), link, date, img: usable ? img : "", text: plain(html) };
  }).filter((it) => it.title && it.link.startsWith("https://"));
}

// GitHub のリリース一覧が読めない時は CHANGELOG.md から版ごとに切り出す。
// CHANGELOG には日付がないので、前回見つけた日時を引き継ぎ、初めて見た版は今の時刻にする。
async function claudeCodeFromChangelog(prev) {
  const res = await fetch("https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md");
  if (!res.ok) throw new Error("CHANGELOG HTTP " + res.status);
  const md = await res.text();
  const now = Date.now();
  return md.split(/^## /m).slice(1, PER_SOURCE + 1).map((sec, i) => {
    const ver = sec.split("\n")[0].trim();
    const link = "https://github.com/anthropics/claude-code/releases/tag/v" + ver;
    return { title: "v" + ver, link, date: prev.get(link)?.date ?? now - i * 60000, img: "", text: sec.slice(ver.length).trim() };
  });
}

async function fetchFeed(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (claude-dispatch feed reader)" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const items = parse(await res.text());
  if (!items.length) throw new Error("記事が見つかりませんでした");
  return items;
}

async function fetchSource(s, prev) {
  try {
    return await fetchFeed(s.url);
  } catch (e) {
    if (s.alt) return fetchFeed(s.alt);
    if (s.changelog) return claudeCodeFromChangelog(prev);
    throw e;
  }
}

// ---- 本体 ----

const prevData = await readFile(OUT, "utf8").then(JSON.parse).catch(() => ({ items: [] }));
const prev = new Map(prevData.items.map((it) => [it.link, it]));

const out = { updatedAt: Date.now(), sources: {}, items: [] };
for (const s of SOURCES) {
  try {
    const items = (await fetchSource(s, prev)).slice(0, s.per ?? PER_SOURCE);
    out.sources[s.id] = { ok: true, count: items.length };
    for (const { text, ...it } of items) out.items.push({ src: s.id, ...it, desc: clip(text.replace(/\n/g, " "), 200) });
  } catch (e) {
    // 読めなかった情報源は前回の内容を残す
    out.sources[s.id] = { ok: false, error: String(e.message || e) };
    out.items.push(...prevData.items.filter((it) => it.src === s.id));
  }
  console.log(s.id, JSON.stringify(out.sources[s.id]));
}

const seen = new Set();
out.items = out.items.filter((it) => (seen.has(it.link) ? false : seen.add(it.link))).sort((a, b) => b.date - a.date);

await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
