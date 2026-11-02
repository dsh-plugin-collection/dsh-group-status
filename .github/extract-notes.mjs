#!/usr/bin/env node
/**
 * 生成 GitHub Release 正文，**对齐 dsh-later 的写法**。骨架不是想象出来的，是从
 * dsh-later v1.2.0 / v1.3.0 / v1.4.0 三条已发布 Release 里提出来的：
 *
 *   <package.json 的 description>
 *   ## 安装                     dsh plugin --profile web add <name> + 重启提示
 *   预构建产物随包发布，npm 安装无需本地构建或构建授权。
 *   ## 功能                     跨版本累积的全量能力清单
 *   ## 本版本变更               ### feat / ### fix / ### refactor / …
 *   ## 说明                     License / 仓库 / 完整更新日志 三条
 *
 * 三条来自实测的规则：
 *
 * 1. 「## 功能」优先取**上一条 Release 的同名小节** —— later 的清单就是这样单调累积的
 *    （1.3.0 十条 → 1.4.0 十一条，一条没删），取不到才退回 README 的特性小节。
 *    注意排除"本次这个版本自己"，否则重跑同一条 Release 会把自己的正文当历史累积。
 * 2. 「## 本版本变更」的条数是**取舍**，不由脚本替你决定。约定：在版本小节里写
 *    `### 发布摘要` 子节，脚本只用它、且不改写文字；没有该子节时全量收录并打告警。
 *    参照：later 的 Release 是 3~7 条 / 2.2~2.5k 字，而其 CHANGELOG 条目本身是带嵌套
 *    子条目的长论证 —— 说明 Release 是人工压过的。脚本按 `：` 或首句机械压缩会**压坏
 *    句子**（实测把 `声明 \`pulse: true\`` 从代码段中间切开），所以这里不做任何改写。
 * 3. 版本小节缺失时不许静默出空正文：默认打一条显式警告进正文，`--strict` 直接失败。
 *
 * 支持的 CHANGELOG 约定（三个仓库各一种）：
 *   ## 未发布           +  ## 1.3.0 — 2026-10-10      (dsh-later)
 *   ## [Unreleased]     +  ## [0.5.0] - 2026-10-10    (dsh-suggest-ghost)
 *   ## 未发布           +  ## 0.2.0-rc.2-fork1        (dsh-group-status，无日期)
 *
 * 用法：node .github/extract-notes.mjs <version> [--strict] [--full]
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FEATURE_HEADINGS = ['## 功能', '## 特性一览', '## Features'];
/** 分组顺序照 later：feat / fix 在前，表外的类型排最后并按名字排序。 */
// breaking 放最前：它是用户最需要先看到的；其余照 later 的习惯 feat/fix 在前。
const TYPE_ORDER = ['breaking', 'feat', 'fix', 'refactor', 'perf', 'a11y', 'docs', 'test', 'chore', 'build', 'ci', 'style', 'i18n'];

const [rawVer, ...flags] = process.argv.slice(2);
const ver = String(rawVer || '').replace(/^v/, '');
if (!ver) {
  console.error('用法：extract-notes.mjs <version> [--strict]');
  process.exit(2);
}

/* ─────────── CHANGELOG 解析 ─────────── */

/** 节 = 一行 `## xxx` 到下一条 `## xxx`。`###` 是节内小节，不能当节边界。 */
function sections(md) {
  const lines = md.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const h = /^##[ \t]+(?!#)(.*)$/.exec(l);
    if (h) heads.push({ title: h[1], start: i + 1 });
  });
  return heads.map((hd, k) => ({
    title: hd.title,
    lines: lines.slice(hd.start, k + 1 < heads.length ? heads[k + 1].start - 1 : lines.length),
  }));
}

/**
 * 取标题开头的版本 token，剥掉可能的外层方括号：
 *   `1.3.0 — 2026-10-10` → 1.3.0     `[0.5.0] - 2026-10-10` → 0.5.0
 *   `0.2.0-rc.2-fork1` → 原样保留（所以裸 0.2.0 不会误命中它）
 */
function versionOf(title) {
  const m = /^\s*\[?\s*([^\s\]—–]+)/.exec(title);
  return m ? m[1] : null;
}

/** 把一段行切成顶层条目（`- …` 连带其后缩进续行；`###` 与空行不切断条目）。 */
function items(lines) {
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (/^- /.test(l)) {
      if (cur) out.push(cur.join('\n'));
      cur = [l];
    } else if (cur && (/^\s+\S/.test(l) || l.trim() === '')) {
      cur.push(l);
    } else if (cur) {
      out.push(cur.join('\n'));
      cur = null;
    }
  }
  if (cur) out.push(cur.join('\n'));
  return out.map((t) => t.replace(/\s+$/, ''));
}

const typeOf = (item) => {
  // 类型名允许数字（a11y / i18n），也允许 Conventional Commits 的 scope 写法：
  // `feat(kernel)` 取基础类型 feat —— 否则整条落进 other（dsh-later 1.11.0 就发生过）。
  const m = /^-\s+\*\*([a-zA-Z0-9]+)(?:\(([a-zA-Z0-9-]+)\))?\*\*/.exec(item);
  return m ? m[1].toLowerCase() : 'other';
};

/** 只去掉 `- **feat** ` 这个类型前缀，其余文字一字不改。 */
const stripType = (item) => item.replace(/^-\s+\*\*[a-zA-Z0-9]+(?:\([a-zA-Z0-9-]+\))?\*\*\s*/, '- ');

/**
 * 把一条 CHANGELOG 条目收成 Release 里的一行：**取条目自带结构里的 `标题：首句`，
 * 丢弃嵌套子条目**。不改写、不换词，只是不搬运论证部分。
 *
 * 为什么这么做（实测出来的）：later 的 CHANGELOG 条目本身就是 `- **type** 标题：一句话`
 * （约 120 字），而 group-status 的条目是带 5 个嵌套子条的 459 字论证 —— Release 只是
 * 忠实继承了源头的密度。拿这条规则回测 later 的 1.3.0：生成的 7 条与他们**已发布**的 7 条
 * 几乎逐条对应（4 条一致，3 条他们只是手工把标题再缩几字、并把两条调了序）。
 *
 * 安全边界：只在**全角** `：` 与 `。` 处切；若冒号前有奇数个反引号，说明它落在代码段里
 * （如 `pulse: true` 用的是半角冒号，或全角冒号写在 code span 内），不切 —— 上一版我按
 * 半角 `:` 切并在外面重建加粗，把句子压坏了，已撤销。
 */
function releaseLine(item) {
  // 先把条目**自己的段落**拼起来：CHANGELOG 里的条目常常折行（续行缩进两格），
  // 只取首行会把句子从中间切断 —— dsh-later 1.8.0 的 breaking 条就断在「…的」，
  // 发布出去成了一条读不通的句子。嵌套子条目（缩进的 `- ` 论证）仍然丢弃。
  // 首行 + 其后的折行续行；**遇到第一个嵌套子条目（缩进的 `- `）就停** ——
  // 子条目连同它自己的续行都是论证，不进 Release。
  const paraLines = [];
  for (const l of item.split('\n')) {
    if (/^\s+-\s/.test(l)) break;
    paraLines.push(l);
  }
  // 折行拼接：中文与中文之间不插空格（否则「…的 类型面…」这种断裂式空格会进 Release），
  // 其余情况按空格拼。
  const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
  const para = paraLines.map((l) => l.trim()).filter(Boolean).reduce((acc, cur) => {
    if (!acc) return cur;
    // 边界字符要跳过强调/代码符号：续行常以 `**` 开头，直接比会误判成"非中文"
    const a = acc.replace(/[*_~`]+$/, '').slice(-1);
    const b = cur.replace(/^[*_~`]+/, '')[0] ?? '';
    return acc + (CJK.test(a) && CJK.test(b) ? '' : ' ') + cur;
  }, '');
  const line = para
    .replace(/^-\s+(?:\*\*[a-zA-Z0-9]+(?:\([a-zA-Z0-9-]+\))?\*\*\s*)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const inCode = (t, i) => ((t.slice(0, i).match(/`/g) ?? []).length) % 2 === 1;

  const ci = line.indexOf('：');
  const pi = line.indexOf('。');
  let head;
  let rest = '';
  if (ci > 0 && ci <= 70 && !inCode(line, ci)) {
    head = line.slice(0, ci);
    rest = line.slice(ci + 1);
  } else if (pi > 0) {
    head = line.slice(0, pi);
  } else {
    head = line;
  }

  let expl = '';
  if (rest.trim()) {
    const k = rest.indexOf('。');
    expl = (k >= 0 ? rest.slice(0, k + 1) : rest).trim();
    // 解释句太长时优先在第一处分句处收住：group-status 自己的 Release 平均条目 95 字，
    // 我们照搬 CHANGELOG 会把平均拉到 130+ 且更多条目撞上 240 字截断。
    if (expl.length > 120) {
      const m2 = expl.search(/[，；]/);
      if (m2 > 40) expl = expl.slice(0, m2 + 1);
    }
  }
  // 标题里若已有 `**`（如 `跨插件状态改为**协议**：…`），整段再加粗会产出
  // `**…****…**` 这种断掉的加粗。剥掉标题内部的重音符后再整体加粗——词一字不改。
  const headPlain = head.replaceAll('*'.repeat(2), '').trim();
  let out = head ? `**${headPlain}**${expl ? `：${expl}` : ''}` : `- ${line}`;
  if (out.length > 240) {
    let t = out.slice(0, 240);
    // 括号感知：截断点若落在没闭合的「（」里，回溯到那个括号之前再收尾 ——
    // 否则会产出「（搜索 wire 常量、拖拽状态机、…」这种半截括号。
    const open = t.lastIndexOf('（');
    if (open > 60 && (t.slice(open).match(/（/g) ?? []).length > (t.slice(open).match(/）/g) ?? []).length) {
      t = t.slice(0, open);
    }
    const at = Math.max(t.lastIndexOf('、'), t.lastIndexOf('，'), t.lastIndexOf('）'));
    out = (at > 90 ? t.slice(0, at + 1) : t).replace(/[、，]$/, '') + '…';
  }
  return '- ' + out;
}

/* ─────────── 素材 ─────────── */

let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
} catch { /* 没有 package.json 就少几行固定文案 */ }

let sectionLines = null;
try {
  const hit = sections(fs.readFileSync('CHANGELOG.md', 'utf8')).find((s) => versionOf(s.title) === ver);
  sectionLines = hit ? hit.lines : null;
} catch {
  sectionLines = null;
}

let missingSection = false;
if (sectionLines === null) {
  if (flags.includes('--strict')) {
    console.error(`CHANGELOG 里没有 ${ver} 小节 —— 发版要先跑：rel.mjs rename ${ver}`);
    process.exit(2);
  }
  // 占位文字**不能**塞进 sectionLines：下面按 `^- ` 取条目会把它过滤掉，正文就只剩
  // 「本版无条目」—— 最该喊的地方反而不喊。单独记一个标记。
  missingSection = true;
  sectionLines = [];
}

/** 上一条 Release 的「## 功能」小节（排除本次自己，避免自我吞并）。 */
function previousReleaseFeatures(currentVersion) {
  const gh = (args) =>
    // 必须带超时：把取历史 tag 改成 gh api 之后，遇到不可达/虚构的 github remote
    // 会无限等网络（测试里就挂死过整轮）。8s 足够正常情况，且失败会被上层 catch。
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1 << 24,
      timeout: 8000,
      env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' },
    });
  try {
    // 取历史 tag 用 API 而不是 `gh release list --json`：本机这版 gh 的 release list
    // 不支持 --json，会抛错 → 被 catch 吞掉 → 静默退化到 README 的特性小节（少继承几条）。
    // 实测后果：dsh-later 1.5.0 第一次生成时功能清单只有 8 条，而 v1.4.0 那条有 11 条。
    let tags;
    try {
      tags = JSON.parse(gh(['api', 'repos/{owner}/{repo}/releases?per_page=20', '--jq',
        '[.[].tag_name]'])).map(String);
    } catch {
      tags = gh(['release', 'list', '--limit', '20']).split('\n')
        .map((l) => (l.match(/^\S+\s+\S*\s*(v[0-9][^\s]*)/) ?? [])[1])
        .filter(Boolean);
    }
    const prev = tags.map((t) => String(t).replace(/^v/, '')).find((t) => t && t !== currentVersion);
    if (!prev) return [];
    const body = gh(['release', 'view', 'v' + prev, '--json', 'body', '--jq', '.body']);
    const lines = body.split('\n');
    const start = lines.findIndex((l) => /^##\s+功能\s*$/.test(l.trim()));
    if (start < 0) return [];
    const res = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) break;
      if (/^- /.test(lines[i])) res.push(lines[i]);
    }
    return res;
  } catch (e) {
    process.stderr.write(`· 取不到上一条 Release 的功能清单（${String(e.message).split('\n')[0]}），退化到 README\n`);
    return [];
  }
}

/** README 的特性小节（上一条 Release 取不到时兜底）。 */
function readmeFeatures() {
  for (const f of ['README.md', 'README.en.md']) {
    let text;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    const start = lines.findIndex((l) => FEATURE_HEADINGS.some((h) => l.trim().startsWith(h)));
    if (start < 0) continue;
    const out = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (/^#{2,3} /.test(lines[i])) break;
      if (/^- /.test(lines[i])) out.push(lines[i]);
    }
    if (out.length) return out;
  }
  return [];
}

/* ─────────── 本版本变更的取材 ─────────── */

let changeItems = items(sectionLines).filter((t) => /^-\s/.test(t));

// `### 发布摘要` 子节是给人做的取舍：有就只用它，且不改写一个字。
const summaryIdx = sectionLines.findIndex((l) => /^###\s+发布摘要\s*$/.test(l));
if (summaryIdx >= 0) {
  const block = [];
  for (let i = summaryIdx + 1; i < sectionLines.length; i++) {
    if (/^#{2,4}\s/.test(sectionLines[i])) break;
    block.push(sectionLines[i]);
  }
  const picked = items(block).filter((t) => /^-\s/.test(t));
  if (picked.length) {
    changeItems = picked;
    process.stderr.write(`· 「## 本版本变更」取自「### 发布摘要」子节：${picked.length} 条（未改写文字）。\n`);
  }
} else if (changeItems.length > 10) {
  process.stderr.write(
    `⚠ 没有「### 发布摘要」子节，Release 将收录全部 ${changeItems.length} 条 CHANGELOG 条目。\n` +
      `  同组织参照：later 的 Release 是 3~7 条 / 2.2~2.5k 字。要压到那个密度，请在本版本小节\n` +
      `  里加「### 发布摘要」并写入选要的条目 —— 脚本不替你删，也不改写句子（机械压缩实测会\n` +
      '  把「声明 pulse: true」这类写法从代码段中间切开）。\n',
  );
}

const groups = new Map();
for (const it of changeItems) {
  const k = typeOf(it);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(flags.includes('--full') ? stripType(it) : releaseLine(it));
}
const orderedTypes = [
  ...TYPE_ORDER.filter((t) => groups.has(t)),
  ...[...groups.keys()].filter((t) => !TYPE_ORDER.includes(t)).sort(),
];

/* ─────────── 功能清单 ─────────── */

const fromPrev = previousReleaseFeatures(ver);
const featureLines = fromPrev.length ? fromPrev : readmeFeatures();
const featureSource = fromPrev.length ? '上一条 Release' : 'README 特性小节';
const feats = items(sectionLines).filter((t) => /^-\s+\*\*feat\*\*/.test(t));
if (feats.length) {
  process.stderr.write(
    `· 「## 功能」来源=${featureSource}，共 ${featureLines.length} 条。本版有 ${feats.length} 条 feat\n` +
      `  尚未出现在功能清单里 —— 请把**面向使用者的说法**（不是 CHANGELOG 原句）并进 README 的\n` +
      `  特性小节或上一条 Release，否则功能清单会一直落后。\n`,
  );
}

/* ─────────── 组装 ─────────── */

const repoUrl = (() => {
  const u = pkg.homepage || pkg.repository?.url || '';
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(u);
  return m ? `https://github.com/${m[1]}/${m[2]}` : u;
})();

const block = [];
if (pkg.description) block.push(pkg.description, '');
block.push(
  '## 安装',
  '',
  '```sh',
  `dsh plugin --profile web add ${pkg.name ?? '<pkg>'}`,
  '# 重启 dsh web 后生效',
  '```',
  '',
  '预构建产物随包发布，npm 安装无需本地构建或构建授权。',
  '',
  '## 功能',
  '',
  featureLines.length ? featureLines.join('\n') : '- _(README 特性小节与上一条 Release 都取不到：请补功能清单后重跑)_',
  '',
  '## 本版本变更',
  '',
);

if (missingSection) {
  block.push(
    `> ⚠️ **CHANGELOG 里没有 ${ver} 这一小节。** 正文因此不完整：把「未发布」小节改名为 ${ver}` +
      '（跑 release-infra/bin/rel.mjs rename ' + ver + '）后重跑本脚本并更新这条 Release。',
    '',
  );
}
for (const t of orderedTypes) block.push(`### ${t}`, '', ...groups.get(t), '');
if (!orderedTypes.length && !missingSection) block.push('_(本版无条目)_', '');

block.push('## 说明', '', `- License: ${pkg.license ?? '—'}`);
if (repoUrl) block.push(`- 仓库：${repoUrl}`, `- 完整更新日志：${repoUrl}/blob/main/CHANGELOG.md`);

process.stdout.write(block.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
