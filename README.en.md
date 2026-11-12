<div align="center">

<img src="icon.svg" width="72" alt="dsh-group-status"/>

# dsh-group-status: aggregated status badge for collapsed groups

[中文](./README.md) | **English**

[![version](https://img.shields.io/badge/version-0.5.4-0EA5E9)](https://github.com/dsh-plugin-collection/dsh-group-status)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

</div>

> In the DSH sidebar, collapsing a workspace group hides the status of every session inside it: running sessions, sessions awaiting approval, sessions awaiting an answer. This plugin adds one aggregated badge to the collapsed folder row (yellow dot for pending, spinner for running, green dot for unread completed, optional external status glyphs, plus a count). Hovering the row lists each tier separately. Nothing is drawn while the group is expanded; its child rows already show their own state.

---

## Feature overview

- **Visible while collapsed**: the badge appears only on collapsed groups; once expanded, each child row carries its own state. Nested groups aggregate the whole subtree.
- **Same source of truth as session rows**: the three state dots reuse the stock `StateDot` and the row-level derivation. Blank and archived sessions are skipped.
- **Optional cross-plugin aggregation**: other plugins register their own status sources (scheduled tasks, waiting PR reviews). This plugin contains no branch keyed on a specific source.
- **Usable with zero config**: 5 settings cover the three tiers, hover details, and the count threshold. All of them default to "show".
- **No stock files modified**: this package registers the same slot and disables the stock row in the profile patch. Not one file of the published upstream package is touched.
- **Localized**: follows the DSH UI language (中文 / English). Wording for an external status source comes from that source's own plugin.
- **Accessible**: the badge is `role="img"`, its `aria-label` matches the hover `title`, and state differences are not carried by color alone.

---

## Preview

The `tmp` group below holds 1 running session (spinner), 1 completed (green dot), and 1 scheduled task (clock), counting `3`:

<p align="center">
<img src="docs/media/screenshot-folders.png" width="267" alt="Collapsed tmp group in the sidebar: spinner, green dot, clock glyph and the number 3"/>
</p>

Hovering the folder row appends the per-tier lines under the path and creation time:

<p align="center">
<img src="docs/media/screenshot-hover.png" width="300" alt="Hover card: 1 waiting for answer · 1 running"/>
</p>

---

## Install

```bash
dsh plugin --profile web add dsh-group-status
```

The sidebar is replaced as a whole bundle, so **`dsh web` must restart** after an install. Saving a setting applies immediately and needs no restart.

To remove it (both profile patch entries are withdrawn together and the stock session row comes back; restart again):

```bash
dsh plugin --profile web remove dsh-group-status
```

This package changes no file inside the published upstream package: it registers the same slot and disables the stock `ui-workspace` row in the profile patch. For the local `link:` install used while editing code, see [Development](#development).

---

## Verify

1. Collapse a group that contains a running or pending session: the badge appears after the folder name.
2. Hover the folder row: the detail lines appear, with the same wording as the badge `aria-label`.
3. Expand the group: the badge disappears.
4. The browser console reports no errors.

---

## When the badge does not show

| Symptom | Cause |
|---|---|
| Nothing changed after install | `dsh web` was not restarted (the sidebar is replaced as a whole bundle) |
| The package was never loaded | The DSH kernel is outside `engines.dsh`, so the kernel answers `skipping profile bundle` (verified on `0.2.0-rc.2`) and the sidebar keeps stock behavior |
| The group does have running or pending sessions, but no badge while collapsed | All four counted tiers are 0 (pending, running, completed, external contributions). Blank and archived sessions are not counted |
| Dots but no number | The count is below `countThreshold` (default 2) |
| No scheduled-task or waiting-review glyph | The companion plugin is not installed, not enabled, or it turned that status source off itself (visibility of an external source belongs to its owner) |

---

## Reading the badge

This plugin draws three session state tiers:

| Icon | Shape | Meaning | Color source |
|---|---|---|---|
| <img src="docs/media/glyph-pending.svg" width="10" height="10" alt=""/> | Yellow dot | The group has a session awaiting approval, plan review, or an answer | `StateDot` `warning`, same as session rows |
| <img src="docs/media/glyph-running.svg" width="14" height="14" alt=""/> | Spinner | The group has a running session (including running subagents) | `StateDot` `ongoing` |
| <img src="docs/media/glyph-completed.svg" width="10" height="10" alt=""/> | Green dot | The group has a completed session that is still unread | `StateDot` `done`, same as session rows |

The icons are reconstructions: geometry follows `StateDot` (a 6px core inside a 10px slot, and a 14px ring with an arc of about 72 degrees), colors are sampled from the two real screenshots above, both taken in the dark theme. [scripts/make-badge-glyphs.mjs](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/scripts/make-badge-glyphs.mjs) generates them. In the UI the spinner keeps rotating (one turn per 1.5s), so a static image can only be one frame. The running UI is the authority on colors; this package keeps no color table of its own.

External status sources supply their own glyph and color tier. This plugin decides neither their shape nor whether they pulse, so those two glyphs are not reconstructed here: they belong to the plugins that own them.

- **Count** = pending + running (including running subagents) + completed + whatever each external source reports. Above 99 it shows `99+`; below `countThreshold` the number is omitted and only the dots are drawn.
- **Order**: pending, running, external sources, completed. The relative order among external sources comes from their own `order`. Hover details use the same order as the dots, one line per tier, for example `1 waiting for answer · 1 running`. The waiting-review line carries the PR number and remaining time, supplied by its owner.
- **Collapsed only**: no badge is drawn while a group is expanded. Nested groups aggregate the whole subtree, so a collapsed parent reports the sum over all descendant groups.
- **Accessibility**: the badge is `role="img"`, the `aria-label` and the hover `title` carry the same localized wording, and states such as "overdue" are distinguished by wording, not by color alone.
- **Pulse is per source**: whether an external source pulses is declared by that source. It never affects the whole badge, the count, or the host session state dot.

---

## Settings

Sidebar **Plugins** → **dsh-group-status** (the config form on the bundle page):

| Field | Default | Description |
|---|---|---|
| `showRunningInBadge` | `true` | Whether the collapsed badge shows the running spinner |
| `showPendingInBadge` | `true` | Whether it shows the yellow dot for approval / plan review / waiting for answer |
| `showCompletedInBadge` | `true` | Whether it shows the green completed dot |
| `showHoverDetails` | `true` | Whether the hover card shows the aggregated detail lines |
| `countThreshold` | `2` | Show the number only when the count reaches this value; set 1 to always show it |

Turning a tier off removes it from the collapsed row entirely: no dot, no contribution to the count, no hover line, and it no longer keeps the badge visible. The state dot on a session row is unaffected, because that is row-level state. With `showHoverDetails` off, the hover card shows only the title, path, and creation time.

Saving applies immediately. The Host writes the values into the `config` of the `dsh-group-status` entry in the profile patch, so they survive a reload. When the settings cannot be read (for example the Host exposes no settings service), the defaults apply: unread is not the same as turned off. Unknown fields left over in a profile are not read, so their effect equals the default.

External sources deliberately have no switch on this page: this plugin knows no specific source, so its config surface must not carry another plugin's domain names or icon shapes either. To silence a source, use that plugin's own settings card; when it turns the source off it stops registering, and the badge loses that item. See "Who owns visibility" in [`docs/facet-protocol.md`](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/facet-protocol.md) (Chinese only).

---

## Companion plugins (optional)

| Plugin | What the collapsed badge gains | Availability |
|---|---|---|
| [dsh-later](https://github.com/dsh-plugin-collection/dsh-later) | Scheduled tasks in the group (clock glyph; color tier and wording owned by dsh-later) | Public npm |
| `dsh-gitea-dispatch` | PRs awaiting review in the group (hourglass glyph; color tier and wording owned by dsh-gitea-dispatch) | Not published to public npm, see its own repository |

The plugin works normally with neither installed. The waiting-review data comes entirely from the facet that `dsh-gitea-dispatch` registers; this plugin maintains no wording or color tier for it.

---

## Compatibility

| Item | Value |
|---|---|
| DSH kernel | `engines.dsh: >=0.2.1-rc.2 <0.2.2-0 \|\| >=0.2.2-alpha.2 <0.2.3-0` |
| Verified generations | `0.2.1-rc.2` / `rc.3` / `rc.4` / `0.2.2-rc.1` (gating, cold boot assembly, type check and the full suite pass on all; real GUI acceptance was additionally done on `0.2.1-rc.2`. The development dependency line has been `0.2.2-rc.1` since 2026-11-11). On `0.2.2-rc.2` the **type surface, the spec surface and the host contract guard** were verified (one-off isolated run on 2026-11-12: type check, the whole spec suite and the contract guard all green). **Gating, cold boot assembly and real GUI were not tested on that generation**, so the development dependency line stays at `0.2.2-rc.1` |
| Peer dependencies | `@deepseek-ai/cordis ~4.1.0` (follows the kernel; a 0.2.1 generation kernel ships `~4.0.5`) plus 12 `@deepseek-ai/dsh-*` packages (range `^0.2.1-rc.2 \|\| ^0.2.2-rc.1`) |
| Upstream baseline | `@deepseek-ai/dsh-client-ui-workspace 0.2.2-rc.1`, source taken from the published package into this repo's `src/` |

On `rc.4` the **behavior** has drifted from the baseline (blank session reuse and draft initialization semantics). This package's fork still follows the baseline generation, so those improvements do not reach users: loading cleanly is not the same as behaving identically. The per-item differences and the triggers to act on them live in [docs/upgrading.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/upgrading.md), section "上游代次跟踪".

On `0.2.2-rc.2` the Host added `renderFactorySlot` to the injected face and switched its own group row and session row to render the shared `contextMenu.button` factory. This package **aligns that injected face through its types and props, but deliberately does not consume the factory**: its row menu is self-drawn (an in-row Menu plus its own `sidebar.workspaces.session.menu.item` list slot) and never joins the Host's shared contextMenus system. The resulting difference: on Host rc.2, contributions that other plugins register through the shared context-menu system (`contextMenus.register` actions, `contextMenu.content` custom content, `contextMenu.button` factory occurrences) **do not appear** in this package's group rows or session rows, while menu items registered into `sidebar.workspaces.session.menu.item` **still appear** in this package's local menu (this package renders that very slot). Migrating fully to the shared menu system is an optional later step. The per-symbol review, the decision rationale, and the verification record live in the same section of [docs/upgrading.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/upgrading.md).

The 12 peer entries are not metadata. Kernels that do not read `engines.dsh` decide compatibility from the peer ranges alone, and a missing entry lets an old kernel load this package and fail the whole page. The mechanism is recorded in [docs/upgrading.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/upgrading.md), section "兼容声明为什么长这样".

---

## For plugin authors: registering a status source

A collapsed group badge can show state owned by another plugin, and the direction is inverted: **the owner registers its facts in**, while this plugin's aggregation and render paths know no specific source.

```js
const gs = require('dsh-group-status/client')
const unregister = gs?.registerGroupStatusFacet?.({
  protocol: gs.GROUP_STATUS_FACET_PROTOCOL_VERSION,
  id: 'my-plugin.review',        // '<package>.<state>'
  subscribe: store.subscribe,    // an external store surface, not a React hook
  getSnapshot: store.getSnapshot,
  fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
  label, renderIcon, order,      // optional: wording, glyph and order belong to the provider
})
ctx.effect(() => () => unregister?.(), 'my-plugin: group status facet')
```

- The five required members (`protocol` / `id` / `subscribe` / `getSnapshot` / `fold`) already render: `N Needs attention` plus a generic dot colored by tone. Your internal id is never read out to the user.
- Glyph and wording belong to the provider: what the state looks like, and whether an overdue one should stay still or pulse, is the provider's knowledge.
- `fold` returns structured `data`, not text, because a collapsed parent group covers the whole subtree and same-named folds have to be merged again. Text cannot be merged.
- When this plugin is not installed or not enabled, `require` throws. Catching that error is enough.
- Same-id conflicts resolve by origin, independent of registration order: the state owner always wins over a stand-in registrant.
- Cross-plugin **value imports** do not work in this project (the client bundle is a self-contained closure factory), so providers use only the runtime symbols from `require('dsh-group-status/client')` and never import this package's types.

The full contract, every `FacetFold` field, the default merge, lifecycle and degradation, and the version rules are in [docs/facet-protocol.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/facet-protocol.md) (Chinese only), including why the surface is `subscribe` / `getSnapshot` rather than a React hook.

---

## Development

```sh
pnpm install
pnpm build        # tsc type check + tsdown bundle → lib/
pnpm watch        # rebuild on src/ changes (a dsh web restart is still required)
pnpm test         # test:node (node --test, 66 cases) + test:spec (vitest + jsdom, 199 cases)
pnpm test:spec    # spec suite only
pnpm check-upstream   # upstream generation tracking (add --latest for the highest published version)
```

### Local install while developing

You do not need to publish a package to test changes; mount this checkout into the local profile with `link:`:

```bash
git clone https://github.com/dsh-plugin-collection/dsh-group-status.git
cd dsh-group-status
pnpm install && pnpm build
dsh plugin --profile web add "link:$PWD"
```

`pnpm watch` rebuilds on `src/` changes, and each rebuild still requires a `dsh web` restart.

Besides the vendored upstream copies, `tests/` holds this repository's own cases for the aggregation: counting, mutual exclusion among pending kinds, subagents, blank and archived skipping, external source registration and unregistration, hover wording. 9 upstream specs only run inside the DSH monorepo; the reasons are listed one by one at the top of [vitest.config.ts](vitest.config.ts).

The part of the host contract that can **fail silently** (the pending-kind set this plugin accepts, and the two state facts read from the host) is compared against the locked host implementation by [tests/host-pending-kinds.node.test.mjs](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/tests/host-pending-kinds.node.test.mjs), so a host change turns it red. README facts that drift with the code (version badge, setting fields and defaults, test case counts, forbidden wording) are guarded by [tests/readme-facts.node.test.mjs](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/tests/readme-facts.node.test.mjs).

---

## Known limitations

- **An upstream generation change needs a manual rebase**: this package vendors upstream source and does not use a stable public API. When the host changes a slot name, component signature, or context contract, follow [docs/upgrading.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/upgrading.md).
- **One more full measurement pass per state change**: the aggregate count shares its derivation with the expanded state, so an expanded group must be measured too, because its ancestors use its numbers. On very large groups (hundreds of sessions) that pass costs one more traversal plus an upward roll, guarded by the performance cases in `tests/group-status.client.spec.ts`.
- **External glyphs depend entirely on their providers**: a missing companion plugin simply means one fewer glyph; it never affects the core badge. When a provider ships no wording, the line falls back to the generic "needs attention".
- **The count is coarser than the details**: an external source contributes the number it reports, and this plugin does not redefine another source's counting basis.
- **Sidebar collapsed state only**: neither the session state machine nor the row-level badge rules change.
- **Countdown precision is one minute**: the badge re-renders only when a provider's store notifies, so a second-level readout would sit stale on an old value.

---

## Documentation

- [docs/facet-protocol.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/facet-protocol.md): the cross-plugin status source protocol (required reading for providers)
- [docs/upgrading.md](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/docs/upgrading.md): upstream baseline, local change list, rebase and verification, generation tracking, why the compatibility declaration looks like this
- [src/client/cross-plugin-summary.ts](https://github.com/dsh-plugin-collection/dsh-group-status/blob/main/src/client/cross-plugin-summary.ts): the provider-side template, with its design notes in the file header

Both documents are currently Chinese only.

## License

MIT (inherited from the upstream `@deepseek-ai/dsh-client-ui-workspace`).

---

<div align="center">

<img src="icon.svg" width="48" alt="dsh-group-status"/>

</div>
