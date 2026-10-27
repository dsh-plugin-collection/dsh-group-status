/**
 * Test setup for the vendored upstream client specs.
 *
 * `tests/` is a copy of the upstream package's suite (see `docs/upgrading.md`).
 * Three of its imports only resolve inside the DSH monorepo; the aliases and
 * the resolver below bridge them for this standalone repository, so rebasing
 * upstream leaves the specs untouched:
 *
 * 1. Self reference — specs import this fork by its published name
 *    (`@deepseek-ai/dsh-client-ui-workspace/client`) instead of a relative path.
 * 2. Common locale dictionaries — the published locale package ships types only
 *    (see `tests/support/common-locale.ts`).
 * 3. Sibling monorepo path — `../../shortcuts/src/client/registry.ts` is the
 *    same class the published `@deepseek-ai/dsh-client-shortcuts/client` exports.
 * 4. `import.meta.url` — the one spec that reads sibling files off disk gets the
 *    served URL under Vite, which `new URL()` rejects; hand it the file URL.
 *
 * Nine specs are skipped (`MONOREPO_ONLY_SPECS`), in two groups — both are
 * properties of the published packages, not of this repository, and neither is
 * fixable by stubbing without turning the assertion into a test of the stub:
 *
 * (a) `@deepseek-ai/dsh-client-test-runtime` imports *source files* of
 *     `dsh-client-ui-renderer` / `dsh-api-session-controller`
 *     (`…/src/client/bind.ts`, `scoped-slots.tsx`, `scope.ts`). Those packages
 *     ship no `src/`, not even in the newest `0.2.1-alpha`, and their bundles
 *     export neither `bindSnapshotSelector` nor `createSlotRenderer`.
 * (b) Specs that import *runtime values* from a published `…/client` entry get
 *     that package's closure bundle, whose `require` graph expects the host app
 *     to preload its externals (e.g. `dsh-client-ui-primitives` declares no
 *     dependencies at all, yet requires shiki / katex / the micromark tree).
 *     Running those means installing the DSH app's whole dependency closure as
 *     devDependencies of a sidebar plugin.
 *
 * Everything else runs locally, including `tests/group-status.client.spec.ts`,
 * the fork-owned spec for the aggregation this package adds.
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { configDefaults, defineConfig, type Plugin } from 'vitest/config'

const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

/** Specs whose imports only resolve inside the DSH monorepo — see the header. */
const MONOREPO_ONLY_SPECS = [
  // (a) test-runtime deep-imports unpublished renderer / session-controller sources.
  'tests/rows.client.spec.tsx',
  'tests/workspace-browser.client.spec.tsx',
  'tests/workspace-picker.client.spec.tsx',
  // (b) runtime values out of published client bundles whose externals live in the app.
  'tests/apply.client.spec.ts',
  'tests/shortcuts.client.spec.ts',
  'tests/workspaces-service.client.spec.ts',
  'tests/session-actions.client.spec.tsx',
  'tests/host-home-staleness.client.spec.tsx',
  'tests/rename-assembly.client.spec.tsx',
]

/** Bridge the one cross-package *relative* import upstream used in its monorepo. */
const shortcutsMonorepoShim: Plugin = {
  name: 'shortcuts-monorepo-shim',
  resolveId(source) {
    if (source !== '../../shortcuts/src/client/registry.ts') return null
    return this.resolve('@deepseek-ai/dsh-client-shortcuts/client', undefined, { skipSelf: true })
  },
}

/** Give test modules a real `file:` URL, which `new URL(..., import.meta.url)` needs. */
const fileUrlPlugin: Plugin = {
  name: 'tests-file-url',
  enforce: 'pre',
  transform(code, id) {
    if (!id.startsWith(local('./tests/')) || !code.includes('import.meta.url')) return null
    return {
      code: code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(pathToFileURL(id).href)),
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [shortcutsMonorepoShim, fileUrlPlugin],
  resolve: {
    alias: [
      {
        find: /^@deepseek-ai\/dsh-client-ui-workspace\/client$/,
        replacement: local('./src/client/index.ts'),
      },
      {
        find: /^@deepseek-ai\/dsh-client-locale\/src\/locales\/(en|zh)\.ts$/,
        replacement: local('./tests/support/common-locale.ts'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/support/setup.ts'],
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: [...configDefaults.exclude, ...MONOREPO_ONLY_SPECS],
  },
})
