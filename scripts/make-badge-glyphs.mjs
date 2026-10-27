/**
 * 生成 README 表格里的三枚状态图标（docs/media/glyph-*.svg）。
 *
 * ## 为什么要有这个脚本，而不是手画一张图
 *
 * README 的徽标读法表原来只用文字写「黄点 / 转圈 / 绿点」。文字列一眼扫不出形状，
 * 而换成图标就有两个坑：随手用 emoji 会把 `ongoing`（灰色转圈）画成沙漏或蓝点，
 * 与 UI 不是同一枚；从截图裁一小块 PNG 又会把行背景的方块一起带进表格。
 * 所以这里画的是**复刻**：形状来自组件本体，颜色来自实机像素，两边都可复查。
 *
 * ## 形状来源（不是估的）
 *
 * `@deepseek-ai/dsh-client-ui-primitives@0.2.1-rc.2` 的 `lib/StateDot.module.css`
 * 与 `lib/index.js`：
 *
 * - 实心状态：10px 布局槽位，`::after { inset: 20%; border-radius: 50% }` →
 *   **6px 实心核心**，颜色是 `currentColor`
 * - `ongoing`：`<svg width=14 height=14 viewBox="0 0 24 24">`，两个 `r=9.5` 的圆，
 *   `stroke-width: 2`、`stroke-linecap: round`；轨道 `opacity: 0.25`；
 *   弧线 `stroke-dasharray: 12 150`（周长 2π·9.5 ≈ 59.7，12 单位 ≈ 72° 的弧），
 *   外层 `dsh-state-dot-spin 1.5s linear infinite`
 *
 * SVG 只用表现属性（`fill` / `stroke` / `opacity`），不写 `<style>`：GitHub 会给
 * 用户内容里的 SVG 过一道消毒，`<style>` 块不在可依赖的范围内。
 *
 * ## 颜色来源（也不是估的）
 *
 * 仓库自带的两张实机截图（暗色主题）取像素，坐标准备写在下面：
 *
 * | 档位 | 色值 | 取处 |
 * |---|---|---|
 * | `warning` | `#F59E0B` | `docs/media/screenshot-hover.png` (19,112) 的 4×4 核心（外圈是抗锯齿） |
 * | `done` | `#22C55E` | `docs/media/screenshot-folders.png` (217,16) 的 6×6 核心 |
 * | `ongoing` | `#9AA0A5` | 同图 (198,12)-(211,25) 的环，弧线最亮像素 `#9EA2A7`，轨道实测 ≈ 该色的 25% 叠在 `#1B1B1C` 行背景上 |
 *
 * **亮色主题下的色值没有取过，所以不假装知道**：这三枚图标与 README 里的截图同属暗色
 * 主题，README 的图标列下面写了这句话。UI 才是权威，本包不复制一份颜色表。
 *
 * ## 可复现
 *
 * 产物随源码提交（与 `lib/` 同一条纪律），`tests/readme-facts.node.test.mjs` 会把它们
 * 重新生成到临时目录逐字节比对。改了组件的几何或换主题截图，就该重跑本脚本再提交。
 *
 * 用法：`node scripts/make-badge-glyphs.mjs`
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(dirname(import.meta.url)), '..')
const outDir = join(root, 'docs', 'media')

/** 与 StateDot.module.css 同源的几何，集中在这里，别散进 SVG 字符串。 */
const SOLID = { slot: 10, core: 6 }
const SPINNER = { edge: 14, box: 24, center: 12, radius: 9.5, stroke: 2, dash: '12 150', trackOpacity: 0.25 }

const COLORS = {
  warning: '#F59E0B',
  done: '#22C55E',
  ongoing: '#9AA0A5',
}

/** 实心点：10px 槽位里的 6px 圆，等价于 `::after { inset: 20% }`。 */
const solidDot = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SOLID.slot}" height="${SOLID.slot}" viewBox="0 0 ${SOLID.slot} ${SOLID.slot}" role="img">
  <circle cx="${SOLID.slot / 2}" cy="${SOLID.slot / 2}" r="${SOLID.core / 2}" fill="${color}"/>
</svg>
`

/**
 * 转圈的**一帧**：轨道环 + 约 72° 的弧。
 *
 * 弧线用 `stroke-dasharray` 的原值、再转 90° 让起点落在 12 点方向（组件里整组在转，
 * 静态图取哪一帧都一样），静止就是 reduced-motion 下用户实际看到的样子。
 */
const spinner = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SPINNER.edge}" height="${SPINNER.edge}" viewBox="0 0 ${SPINNER.box} ${SPINNER.box}" role="img">
  <g transform="rotate(90 ${SPINNER.center} ${SPINNER.center})">
    <circle cx="${SPINNER.center}" cy="${SPINNER.center}" r="${SPINNER.radius}" fill="none" stroke="${color}" stroke-opacity="${SPINNER.trackOpacity}" stroke-width="${SPINNER.stroke}" stroke-linecap="round"/>
    <circle cx="${SPINNER.center}" cy="${SPINNER.center}" r="${SPINNER.radius}" fill="none" stroke="${color}" stroke-width="${SPINNER.stroke}" stroke-linecap="round" stroke-dasharray="${SPINNER.dash}"/>
  </g>
</svg>
`

const files = {
  'glyph-pending.svg': solidDot(COLORS.warning),
  'glyph-completed.svg': solidDot(COLORS.done),
  'glyph-running.svg': spinner(COLORS.ongoing),
}

mkdirSync(outDir, { recursive: true })
for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(outDir, name), body, 'utf8')
  console.log(`docs/media/${name}`)
}
