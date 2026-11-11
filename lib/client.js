window.__ModuleLoader__.load({
	id: "dsh-group-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		//#region src/client/contract/slots.ts
		/**
		* Bind the row's render occurrence into the entries' `useMenuOpenState` hook:
		* the owner supplies its open-state pair as the occurrence's `hookContext`,
		* and the hook hands that pair back.
		* @param _standard - framework standard props (unused).
		* @param state - the menu's open-state pair from the render occurrence.
		* @returns the hook the entry calls.
		*/
		const menuOpenStateFactory = (_standard, state) => () => state;
		//#endregion
		//#region src/client/shortcuts.ts
		/**
		* Create the private browser request source shared by commands and controls.
		* @returns observable state and its complete mutation callbacks.
		*/
		function createWorkspaceShortcutControls() {
			const state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				searchRequest: 0,
				addRequested: false,
				directoryBusy: false,
				renameTarget: null
			});
			return {
				state,
				search: () => {
					state.set({
						...state.getSnapshot(),
						searchRequest: state.getSnapshot().searchRequest + 1
					});
				},
				add: () => {
					state.set(state.getSnapshot().directoryBusy ? state.getSnapshot() : {
						...state.getSnapshot(),
						addRequested: true
					});
				},
				closeAdd: () => {
					state.set({
						...state.getSnapshot(),
						addRequested: false
					});
				},
				directoryBusy: (busy) => {
					state.set({
						...state.getSnapshot(),
						directoryBusy: busy
					});
				},
				rename: (sessionId, currentTitle) => {
					state.set({
						...state.getSnapshot(),
						renameTarget: {
							sessionId,
							currentTitle
						}
					});
				},
				closeRename: () => {
					state.set({
						...state.getSnapshot(),
						renameTarget: null
					});
				}
			};
		}
		/**
		* Register navigation commands against the existing workspace owner.
		* Rename requires a nonblank main Conversation with no modal obscuring it.
		* @param ctx - plugin context with the shortcut, locale, and model services.
		* @param navigation - session creation and forking from the pointer controls' navigation service.
		* @param controls - browser-owned opening requests.
		* @param archiveSession - shared archive action, including running-work confirmation and notices.
		* @param reportForkFailure - publish a classified failure through the frame-wide notice channel.
		*/
		function installWorkspaceShortcuts(ctx, navigation, controls, archiveSession, reportForkFailure) {
			const t = ctx.locale.bind("workspace");
			const current = () => Object.values(ctx.sessions.list.getSnapshot().byId).find((row) => (row.retainedBy.mainView ?? 0) > 0);
			const addReason = () => ctx.slots.entries("sidebar.workspaces.directoryFlow").length === 0 ? t("shortcut.noPicker") : controls.state.getSnapshot().directoryBusy ? t("shortcut.directoryBusy") : null;
			const register = (id, label, aliases, code, modifiers, webModifiers, resolve) => {
				ctx.effect(() => ctx.shortcuts.register({
					id,
					label,
					aliases,
					defaults: {
						"desktop:macos": {
							code,
							modifiers
						},
						"desktop:windows": {
							code,
							modifiers
						},
						"desktop:linux": {
							code,
							modifiers
						},
						"web:macos": {
							code,
							modifiers: webModifiers
						},
						"web:windows": {
							code,
							modifiers: webModifiers
						}
					},
					regions: ["page", "editable"],
					modals: [],
					resolve
				}), `ui-workspace: ${id}`);
			};
			register("session.new", () => t("session.new"), ["new session", "new chat"], "KeyN", ["primary"], ["primary", "alt"], () => ({
				status: "handled",
				run: () => {
					navigation.startSession();
				}
			}));
			register("session.search", () => t("search.sessions.aria"), ["search sessions"], "KeyK", ["primary"], ["primary", "alt"], () => ({
				status: "handled",
				run: controls.search
			}));
			register("workspace.add", () => t("workspace.add"), ["add workspace", "open folder"], "KeyO", ["primary"], ["primary", "alt"], () => {
				const reason = addReason();
				return reason === null ? {
					status: "handled",
					run: controls.add
				} : {
					status: "blocked",
					reason
				};
			});
			register("session.rename", () => t("rename.session.title"), ["rename session"], "KeyG", ["primary", "alt"], ["primary", "alt"], (context) => {
				const target = current();
				return target === void 0 || target.blank || context.modal !== null || ctx.layout.panelInfo.getSnapshot().activePanelId !== null ? {
					status: "blocked",
					reason: t("shortcut.noSession")
				} : {
					status: "handled",
					run: () => {
						controls.rename(target.id, target.title?.trim() ?? "");
					}
				};
			});
			register("session.fork", () => t("menu.fork"), ["fork session"], "KeyF", ["primary", "alt"], ["primary", "shift"], () => {
				const target = current();
				if (target === void 0) return {
					status: "blocked",
					reason: t("shortcut.noSession")
				};
				if (target.blank) return {
					status: "blocked",
					reason: t("shortcut.noCompletedTurn")
				};
				return {
					status: "handled",
					run: () => {
						navigation.forkSession(target.id).catch((error) => {
							const unavailable = (error instanceof Error && error.name === "SessionForkError" ? error : void 0)?.rpcError.code === "session/fork-unavailable";
							reportForkFailure(unavailable ? "unavailable" : "failed");
							if (!unavailable) console.warn("session fork rejected:", error);
						});
					}
				};
			});
			register("session.archive", () => t("menu.archiveSession"), ["archive session"], "KeyA", ["primary", "shift"], ["primary", "alt"], () => {
				const target = current();
				return target === void 0 ? {
					status: "blocked",
					reason: t("shortcut.noSession")
				} : {
					status: "handled",
					run: () => {
						archiveSession(target.id);
					}
				};
			});
		}
		//#endregion
		//#region src/client/badge-settings.ts
		/**
		* 插件设置读取（折叠徽标显示偏好）。
		*
		* 数据流：apply 时先建一个**稳定**的标准 props 源并经 `provideRoot` 挂上（此时还不知道
		* 设置面在不在），再用 `ctx.inject(['configForms'], …)` 等宿主设置服务就绪——就绪后
		* 订阅本条目设置面，把快照推给源。设置页保存 → 宿主替换快照 → 源通知 → 徽标即时重渲染。
		*
		* 为什么不在 apply 里直接 `ctx.get('configForms')`：服务可能在**本插件之后**才注册，
		* 那时读到的 undefined 会永久生效（设置被静默忽略，直到刷新）。`ctx.inject` 是非阻塞的
		* 嵌套插件，服务永不到达也不会影响本插件其余功能。
		*
		* 为什么源必须一开始就存在：标准 props 的 hook 调用顺序必须稳定——挂上/摘掉
		* `useBadgeSettings` 会改变调用顺序而崩渲染。故源恒在，只有它的**值**随设置变化。
		*
		* 稳定性约定（React 外部存储，见 dsh-later 的同名 hook）：`getSnapshot` 必须返回稳定
		* 引用——每次都构造新对象会让选择器的 `Object.is` 比较永不成立，触发
		* 「Maximum update depth exceeded」死循环（React #185），折叠行徽标会整块崩掉。
		*
		* 设置面缺席或未就绪时，回落到**默认全部显示**，与 `Config` 各字段的 schema 默认值同源：
		* 读不到配置不是「关掉」。
		*/
		/** Loader 条目 id —— 设置页的寻址键，也是宿主 `describe()` 的 ns。 */
		const ENTRY_ID = "dsh-group-status";
		/** 默认值：与 `Config` 各字段的 schema 默认同源（全部显示，数字阈值 2 即 count=1 时省略）。 */
		const DEFAULT_BADGE_SETTINGS = Object.freeze({
			showCompletedInBadge: true,
			showRunningInBadge: true,
			showPendingInBadge: true,
			showHoverDetails: true,
			countThreshold: 2
		});
		/** 两个设置对象是否逐字段相等（用于发布前比较，避免无谓通知）。 */
		function settingsEqual(a, b) {
			return a.showCompletedInBadge === b.showCompletedInBadge && a.showRunningInBadge === b.showRunningInBadge && a.showPendingInBadge === b.showPendingInBadge && a.showHoverDetails === b.showHoverDetails && a.countThreshold === b.countThreshold;
		}
		/** 从原始快照派生：只有**显式 false** 才隐藏，缺失/非法一律显示（countThreshold 默认 2）。 */
		function resolveFromSnapshot(snap) {
			if (snap === void 0 || snap.status !== "ready") return DEFAULT_BADGE_SETTINGS;
			const value = snap.value;
			if (value === void 0 || value === null || typeof value !== "object") return DEFAULT_BADGE_SETTINGS;
			const getBool = (field, def) => {
				const v = value[field];
				return typeof v === "boolean" ? v : def;
			};
			const getNumber = (field, def) => {
				const v = value[field];
				return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
			};
			return {
				showCompletedInBadge: getBool("showCompletedInBadge", true),
				showRunningInBadge: getBool("showRunningInBadge", true),
				showPendingInBadge: getBool("showPendingInBadge", true),
				showHoverDetails: getBool("showHoverDetails", true),
				countThreshold: getNumber("countThreshold", 2)
			};
		}
		/**
		* 建一个恒在、取值稳定的徽标设置源。
		*
		* `getSnapshot` 是**纯读**（无副作用、无订阅），因此可以安全地在渲染期间被反复调用，
		* 也满足外部存储的引用稳定要求；订阅只由 {@link MutableBadgeSettingsSource.publish}
		* 在取值真正变化时触发。
		* @returns 源；调用方持有它并在设置面就绪后 `publish`。
		*/
		function createBadgeSettingsSource() {
			const listeners = /* @__PURE__ */ new Set();
			let resolved = DEFAULT_BADGE_SETTINGS;
			let seen;
			let seenSet = false;
			return {
				getSnapshot: () => resolved,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				publish: (snapshot) => {
					if (seenSet && snapshot === seen) return;
					seen = snapshot;
					seenSet = true;
					const next = resolveFromSnapshot(snapshot);
					if (settingsEqual(next, resolved)) return;
					resolved = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		//#endregion
		//#region src/client/facets.ts
		/** 本协议文件的协议版本。provider 必须原样填这个常量。 */
		const GROUP_STATUS_FACET_PROTOCOL_VERSION = 1;
		/** tone 之间的优先级（越大越紧急），用于多层合并时取更高档。 */
		const FACET_TONE_RANK = Object.freeze({
			info: 0,
			warn: 1,
			error: 2
		});
		/**
		* 同 id 冲突时**由来源决胜，与注册顺序无关**。
		*
		* 宿主不保证插件 apply 的先后。过渡期内"本插件代 provider 写的适配器"与"provider
		* 自己注册的 facet"会撞同一个 id：若靠顺序决胜，同一份部署今天显示、明天不显示。
		* `provider` 恒胜 `legacy`：所有者一接入，代管方立刻让位，且不重复计数。迁移因此
		* 不需要协商发布顺序。
		*/
		const FACET_ORIGIN_RANK = Object.freeze({
			legacy: 0,
			provider: 1
		});
		/** 一个 facet 的来源；缺省按 `provider`（最保守的假设：别人主动注册就是所有者）。 */
		function facetOrigin(facet) {
			return facet.origin === "legacy" ? "legacy" : "provider";
		}
		/**
		* 检查一个 facet 是否符合协议 v1。
		* @returns 拒绝原因；`undefined` 表示可用。
		*/
		function facetRejection(facet) {
			if (typeof facet !== "object" || facet === null) return "not-an-object";
			const candidate = facet;
			if (candidate.protocol !== 1) return "protocol-mismatch";
			if (typeof candidate.id !== "string" || candidate.id === "") return "missing-id";
			if (typeof candidate.subscribe !== "function" || typeof candidate.getSnapshot !== "function" || typeof candidate.fold !== "function") return "missing-methods";
		}
		/**
		* 缺省折果合并：数量相加、色档取更紧急的一档、脉冲取或。
		*
		* ⚠️ 它**不**合并 `data`（本插件不知道 `data` 是什么）。需要合并原始事实的 facet
		* 必须自己实现 {@link GroupStatusFacet.merge}。
		*/
		function defaultMergeFold(a, b) {
			const toneA = FACET_TONE_RANK[a.tone] ?? -1;
			const toneB = FACET_TONE_RANK[b.tone] ?? -1;
			return {
				count: a.count + b.count,
				tone: toneB > toneA ? b.tone : a.tone,
				pulse: a.pulse || b.pulse
			};
		}
		/** 创建一张登记表面（测试用；生产走模块级单例 {@link registry}）。 */
		function createFacetRegistry() {
			const entries = /* @__PURE__ */ new Map();
			const listeners = /* @__PURE__ */ new Set();
			let sequence = 0;
			let sorted = [];
			const resort = () => {
				sorted = [...entries.values()].sort((x, y) => {
					const declaredX = x.facet.order !== void 0;
					const declaredY = y.facet.order !== void 0;
					if (declaredX !== declaredY) return declaredX ? -1 : 1;
					if (declaredX && declaredY) return x.facet.order - y.facet.order;
					return x.sequence - y.sequence;
				});
			};
			let notifying = false;
			let pending = false;
			/**
			* 通知订阅者，并把**重入合并成一轮补跑**。
			*
			* 订阅者在自己的回调里登记/注销 facet 是完全合法的（消费方常在收到变更后立即
			* 补登记一个派生来源）。直接递归会有两个问题：嵌套深度由订阅者数量决定（两个互相
			* 触发的订阅者就是无界递归），而且中间那轮通知看到的登记面是**改到一半**的。
			* 所以内层调用只置脏标志，外层跑完一轮后再补一轮，直到没有新的改动 —— 每个订阅者
			* 都看得到最终状态，递归深度恒为 1。
			*/
			const notify = () => {
				if (notifying) {
					pending = true;
					return;
				}
				notifying = true;
				try {
					do {
						pending = false;
						for (const listener of [...listeners]) try {
							listener();
						} catch {}
					} while (pending);
				} finally {
					notifying = false;
					pending = false;
				}
			};
			return {
				register: (facet) => {
					const reason = facetRejection(facet);
					const id = typeof facet?.id === "string" ? facet.id : "";
					if (reason !== void 0) return {
						ok: false,
						id,
						reason
					};
					const existing = entries.get(id);
					const nextRank = FACET_ORIGIN_RANK[facetOrigin(facet)];
					if (existing !== void 0 && FACET_ORIGIN_RANK[facetOrigin(existing.facet)] > nextRank) return {
						ok: false,
						id,
						reason: "superseded"
					};
					sequence += 1;
					entries.set(id, {
						facet,
						sequence
					});
					resort();
					notify();
					return {
						ok: true,
						id
					};
				},
				remove: (id, facet) => {
					const current = entries.get(id);
					if (current === void 0) return false;
					if (facet !== void 0 && current.facet !== facet) return false;
					entries.delete(id);
					resort();
					notify();
					return true;
				},
				list: () => sorted,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				}
			};
		}
		/**
		* 挂在 `globalThis` 上的登记表面的键名。
		*
		* 它同时是**现场诊断入口**：宿主里可以直接
		* `globalThis.__dshGroupStatusFacetRegistry__.list().map(e => e.facet.id)` 读出"此刻到底
		* 有哪些状态源登记上了"——「我注册了为什么没显示」不该只能靠猜（协议文档点名的那类
		* 不可诊断失败）。
		*/
		const SHARED_REGISTRY_KEY = "__dshGroupStatusFacetRegistry__";
		/**
		* 取（并首次创建）**进程级**共享的登记表面。
		*
		* ## 为什么不能是模块级
		*
		* 提供方把 facet 注册进来是一次性的：它在自己的 `apply` 里 `require` 本插件的 client
		* 入口、登记完就把注销函数挂在 effect 上。而宿主的热替换（HMR、`reload(id, rev)`）
		* **只换代被替换的那个模块**——`dsh-client-modules` 的 `invalidate()` 只删自己那一行的
		* factory 与 loadCache，不级联到"谁 require 过它"（依赖方不会重跑 apply）。
		*
		* 于是模块级单例在这里必然失效：本插件被换成新实例 → 新实例建一张**空表** → 提供方
		* 那份注册留在被丢弃的旧表上 → 徽标从此少一家，且**只有刷新页面才好**。开发环境天天
		* 重建 `lib/`，这条几乎必然发生。
		*
		* 挂到 `globalThis` 上之后，换代只是"再拿一次同一张表"：注册跨换代存活，`facetStore()`
		* 在新实例里 `rewire()` 时照样订阅到那些来源。提供方被换代时按同 id 覆盖登记（见
		* {@link FacetRegistry.register} 的来源决胜），不会重复计数。
		*
		* @returns 全进程唯一的登记表面。
		*/
		function sharedFacetRegistry() {
			const host = globalThis;
			const existing = host[SHARED_REGISTRY_KEY];
			if (existing !== void 0) return existing;
			const created = createFacetRegistry();
			host[SHARED_REGISTRY_KEY] = created;
			return created;
		}
		/**
		* 生产用的单例登记表面。
		*
		* 与 {@link createFacetRegistry} 分开，是为了让测试能对着一张干净的表断言协议行为，
		* 而不会被别的用例或别的插件登记的 facet 污染。
		*
		* ⚠️ 它只是 {@link sharedFacetRegistry} 在**本模块首次加载时**取到的那份引用；跨模块实例
		* 存活的是 globalThis 上那一张，所以运行期一律经 {@link sharedFacetRegistry} 现取。
		*/
		const registry = sharedFacetRegistry();
		/**
		* 本插件 client 入口对外的登记函数（provider 侧唯一需要认识的符号）。
		*
		* @param facet - 待登记的 facet。
		* @returns 注销函数；**注册失败时返回一个空操作**，同时把原因写进 console——
		*   返回值形状保持稳定，provider 的 dispose 路径不必区分成败。
		*/
		function registerGroupStatusFacet(facet) {
			const target = sharedFacetRegistry();
			const result = target.register(facet);
			if (!result.ok) {
				if (!(result.reason === "superseded" && facetOrigin(facet) === "legacy")) reportRejection(result);
				return () => void 0;
			}
			return () => {
				target.remove(result.id, facet);
			};
		}
		/**
		* 把注册失败写成一条可诊断的日志。
		*
		* 刻意不抛错：状态显示是增强功能，一个插件协议填错不该把宿主界面渲染打断；
		* 但也不静默——"注册了却没显示"必须能查出原因。
		*/
		function reportRejection(rejection) {
			const detail = rejection.reason === "protocol-mismatch" ? `本插件只接受 protocol: 1` : rejection.reason === "missing-methods" ? "subscribe / getSnapshot / fold 三个方法必须齐备" : rejection.reason === "missing-id" ? "id 必须是非空字符串，建议 '<包名>.<状态名>'" : rejection.reason === "superseded" ? "同 id 上已有更高来源的登记；两个不同插件用了同一个 id，请各自换名" : "facet 必须是一个对象";
			console.warn(`dsh-group-status: 拒绝登记状态 facet "${rejection.id}"（${rejection.reason}）：${detail}`);
		}
		//#endregion
		//#region src/client/facet-store.ts
		/**
		* facet 的**消费侧**：把「登记表面 + 每个 facet 自己的外部存储」压成一份 React 可订阅的
		* 单一存储。
		*
		* ## 为什么必须是一个存储，而不是逐个 hook
		*
		* 见 `./facets.ts` 的文件头：hook 数量在同一个组件里必须逐次渲染恒定，而 facet 是运行
		* 时注册/注销的。所以这里只暴露一个**版本号**（数字，引用天然稳定）给
		* `useSyncExternalStore`，实际的快照读取与折叠都发生在渲染期。
		*
		* ## 快照读取为什么放在渲染期
		*
		* `getSnapshot` 必须返回稳定引用，而「每个 facet 的快照」是一个对象图：为它造一个
		* 缓存就需要判定失效，而判定失效又要读快照本身。改成「版本号变 → 重新渲染 → 现读现折」
		* 之后，缓存问题消失，代价是一次 O(facet × 组内会话) 的纯计算，量级与原有实现相同。
		*
		* @module dsh-group-status/client/facet-store
		*/
		/**
		* 创建 facet 存储。
		*
		* 对登记面做一次订阅，并在登记变化时**重新接线**各 facet 的 `subscribe`：provider 热替换
		* 实现（同 id 再注册）或运行中启用/停用插件，都只会走到这里一次，不会留下野订阅。
		*
		* @param source - 登记表面；缺省用模块级单例，测试传入自建实例以隔离。
		*/
		function createFacetStore(source = registry) {
			const listeners = /* @__PURE__ */ new Set();
			const links = /* @__PURE__ */ new Map();
			let version = 0;
			let disposed = false;
			/** 任一来源变化都要让消费方重新渲染，因此统一 bump。 */
			const bump = () => {
				if (disposed) return;
				version += 1;
				for (const listener of [...listeners]) try {
					listener();
				} catch {}
			};
			/** 把 links 对齐到当前登记项：新增接线、移除退订、替换重接。 */
			const rewire = () => {
				if (disposed) return;
				const current = new Map(source.list().map((entry) => [entry.facet.id, entry.facet]));
				for (const [id, link] of [...links]) {
					if (current.get(id) === link.facet) continue;
					try {
						link.unsubscribe();
					} catch {}
					links.delete(id);
				}
				for (const [id, facet] of current) {
					if (links.has(id)) continue;
					links.set(id, {
						facet,
						unsubscribe: facet.subscribe(bump)
					});
				}
			};
			const unsubscribeRegistry = source.subscribe(() => {
				rewire();
				bump();
			});
			rewire();
			return {
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				getVersion: () => version,
				getServerVersion: () => 0,
				list: () => source.list(),
				dispose: () => {
					if (disposed) return;
					disposed = true;
					for (const link of links.values()) try {
						link.unsubscribe();
					} catch {}
					links.clear();
					unsubscribeRegistry();
					listeners.clear();
				}
			};
		}
		/**
		* 生产用的单例存储：消费侧（`WorkspaceBrowser`）订阅它，
		* `apply` 的 effect 结束时用 {@link disposeFacetStore} 释放全部接线。
		*
		* 单例而非每次渲染新建，是因为它持有**对每个 facet 存储的订阅**；随渲染重建会把
		* provider 的 store 拖进无谓的退订/重订，也让"快照在两个文件夹行之间读数不同"成为可能。
		*/
		let singleton;
		/** 取（并首次创建）单例存储。 */
		function facetStore() {
			if (singleton === void 0) singleton = createFacetStore();
			return singleton;
		}
		/** 释放单例存储（插件卸载时调用；下次 {@link facetStore} 会重建）。 */
		function disposeFacetStore() {
			if (singleton === void 0) return;
			singleton.dispose();
			singleton = void 0;
		}
		//#endregion
		//#region src/client/badge-field.ts
		/**
		* 每个开关控制的是徽标上的哪一枚点。
		*
		* 单一事实来源：设置卡片里给每行画的**预览点**与折叠徽标实际画的那三枚点，都从这里取。
		* 两处各写一套的话迟早会漂，而漂了的后果不是"多一个点少一个点"，是**卡片预览与徽标说的
		* 不是一回事**（同一族毛病：#25① 修过点行与明细的顺序，#37 又发现配置面里混着别人家的语义）。
		*
		* 对应关系与 `rows/GroupBadge.tsx` 一致：待审批 = warning 黄点、进行中 = ongoing 转圈、
		* 已完成 = done 绿点。外部来源的点**不在这里** —— 它们由来源自己画（`renderIcon`），
		* 也不在本插件的卡片上（显隐归来源自己）。
		*/
		const BADGE_FIELD_DOT_STATE = {
			showPendingInBadge: "warning",
			showRunningInBadge: "ongoing",
			showCompletedInBadge: "done"
		};
		/**
		* 卡片字段名（与 `src/index.ts` 的 `Config` 同名同义）。
		*
		* ⚠️ 只有本插件自己的语义。曾有 `showScheduledInBadge` / `showWaitingReviewInBadge`
		* 两个字段替 dsh-later / dsh-gitea-dispatch 写死名字与图标形状，现已删除：外部来源的
		* 显隐归来源自己（不注册就是不显示）。
		*/
		const BADGE_FIELDS = {
			showCompletedInBadge: "showCompletedInBadge",
			showRunningInBadge: "showRunningInBadge",
			showPendingInBadge: "showPendingInBadge",
			showHoverDetails: "showHoverDetails",
			countThreshold: "countThreshold"
		};
		/**
		* 草稿文本解析成开关状态：比较的是模型给的**文本**，不是存储值 ——
		* 别把字符串 `'false'` 当成布尔 `false`（`'false' !== false` 恒真）。
		*/
		function isDraftEnabled(text) {
			return text !== "false";
		}
		/**
		* 构造一个布尔字段的字段转换规格。
		*
		* `parse` 只接受 `'true'` / `'false'`：空串、任意其它文本都返回 `undefined`，
		* 让模型把字段判为 invalid 并拒绝保存（官方模型的既定行为）。
		*
		* @param field - 字段名（与 Config 同名）。
		* @param defaultValue - 缺失值时的默认（true = 默认显示，false = 默认隐藏）。
		*/
		function makeBooleanField(field, defaultValue) {
			return {
				field,
				format: (value) => {
					return (value === void 0 || value === null || typeof value !== "boolean" ? defaultValue : value) ? "true" : "false";
				},
				parse: (text) => text === "true" ? {
					kind: "set",
					value: true
				} : text === "false" ? {
					kind: "set",
					value: false
				} : void 0
			};
		}
		/** 各字段的字段转换规格。 */
		const showCompletedField = makeBooleanField(BADGE_FIELDS.showCompletedInBadge, true);
		const showRunningField = makeBooleanField(BADGE_FIELDS.showRunningInBadge, true);
		/**
		* 所有字段规格。
		*
		* ⚠️ 顺序**必须**与徽标画点的顺序一致（`rows/GroupBadge.tsx`：待审批 → 进行中 → 已完成；
		* 外部来源排在已完成之前，但它们不在本插件的卡片上）。用户操作场景就是"我看到徽标第 N
		* 个图标，想关掉它"，卡片顺序错位会让人怀疑两处是两套事实 —— 同一族毛病 #25① 已经在
		* 点行与明细之间修过一次。回归用例：`tests/badge-settings-card.client.spec.tsx`。
		*/
		const ALL_BADGE_FIELDS = [
			makeBooleanField(BADGE_FIELDS.showPendingInBadge, true),
			showRunningField,
			showCompletedField,
			makeBooleanField(BADGE_FIELDS.showHoverDetails, true),
			{
				field: BADGE_FIELDS.countThreshold,
				format: (value) => {
					const n = value === void 0 || value === null || typeof value !== "number" || !Number.isFinite(value) ? 2 : Math.floor(value);
					return String(n < 0 ? 0 : n);
				},
				parse: (text) => {
					const n = Number(text);
					if (!Number.isFinite(n) || n < 0 || n !== Math.floor(n)) return void 0;
					return {
						kind: "set",
						value: n
					};
				}
			}
		];
		//#endregion
		//#region \0dsh-css:src/client/BadgeSettingsCard.module.css.mjs
		const css$4 = ".dhp54G_section{min-width:0;padding:16px 0}.dhp54G_section:last-child{padding-bottom:0}.dhp54G_heading{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:600;line-height:1.5}.dhp54G_badgeField{gap:6px;padding:12px 0;display:grid}.dhp54G_badgeToggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:flex-start;gap:16px;font-size:13px;line-height:1.5;display:flex}.dhp54G_badgeSpecimen{vertical-align:-2px;align-items:center;margin-right:6px;display:inline-flex}.dhp54G_badgeToggleLabel{flex:1;min-width:0}.dhp54G_badgeNumberControl{align-items:center;gap:4px;display:flex}.dhp54G_badgeNumberButton{width:28px;height:28px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-elevated,#2a2a2a);border:1px solid var(--dsw-alias-border-primary,#555);cursor:pointer;user-select:none;border-radius:6px;justify-content:center;align-items:center;padding:0;font-size:16px;font-weight:600;line-height:1;display:flex}.dhp54G_badgeNumberButton:hover:not(:disabled){border-color:var(--dsw-alias-border-focus,#0078d4);background:var(--dsw-alias-bg-hover,#3a3a3a)}.dhp54G_badgeNumberButton:active:not(:disabled){background:var(--dsw-alias-bg-active,#4a4a4a)}.dhp54G_badgeNumberButton:disabled{opacity:.3;cursor:not-allowed}.dhp54G_badgeNumberValue{text-align:center;min-width:24px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}.dhp54G_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}";
		const tagId$4 = "dsh-group-status/BadgeSettingsCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-group-status";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var BadgeSettingsCard_module_css_default = {
			"badgeField": "dhp54G_badgeField",
			"badgeNumberButton": "dhp54G_badgeNumberButton",
			"badgeNumberControl": "dhp54G_badgeNumberControl",
			"badgeNumberValue": "dhp54G_badgeNumberValue",
			"badgeSpecimen": "dhp54G_badgeSpecimen",
			"badgeToggleLabel": "dhp54G_badgeToggleLabel",
			"badgeToggleRow": "dhp54G_badgeToggleRow",
			"heading": "dhp54G_heading",
			"hint": "dhp54G_hint",
			"section": "dhp54G_section"
		};
		//#endregion
		//#region src/client/BadgeSettingsCard.tsx
		/**
		* 折叠徽标的设置卡片：插件 → dsh-group-status（bundle 详情页的配置表单）。
		*
		* 为什么需要这张卡片：0.2.0 起宿主把插件 `Config`（`src/index.ts`，根节点
		* `.volatile()`）投影到客户端 `configForms` 服务上，但**不会**自动把表单画进
		* 「插件」页——插件页只在客户端往 `plugins.bundle.config` 注册了卡片时才渲染
		* （见 dsh-later / dsh-gitea-dispatch 的同款做法）。没有它，README「设置项」一节
		* 描述的配置表单在 GUI 里根本不存在。
		*
		* 视觉与交互**不自造**，全部交给官方组件（`@deepseek-ai/dsh-client-ui-primitives`）：
		*  - `SettingsForm`：表单框架——只读提示、不可用提示、保存按钮、失败行、间距；
		*  - `SettingsFormModel`：分步草稿与保存（revision 围栏、宿主拒绝时不丢草稿）；
		*  - `Switch`：开关本体。
		* 官方设置页（设置 → 内置插件 → 子智能体 / 网页搜索）用的就是这三件，本卡片的
		* 类名与取值也逐条对齐它们的 CSS（见 `BadgeSettingsCard.module.css` 头部）。
		*
		* 字段定义在 `badge-field.ts`（纯逻辑，可单测）；这里只管把它们接到模型与槽位上。
		*/
		/**
		* 渲染折叠徽标的设置表单。
		*
		* 模型与投影都按 `scope` 记忆：宿主换一份表单（条目重新服务）时整体重建，旧模型
		* 在 effect 清理里 `dispose()`，不会留下悬挂订阅。
		* @param props - 宿主设置表单与文案取值器。
		* @returns 官方表单框架包着本插件的开关字段。
		*/
		function BadgeSettingsCard({ scope, t }) {
			const model = (0, react.useMemo)(() => new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, ALL_BADGE_FIELDS), [scope]);
			(0, react.useEffect)(() => () => {
				model.dispose();
			}, [model]);
			const store = (0, react.useMemo)(() => model.bind(() => ({
				...model.shell(),
				fields: ALL_BADGE_FIELDS.map((spec) => ({
					field: spec.field,
					text: model.field(spec.field).text
				}))
			})), [model]);
			const state = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
			const actions = (0, react.useMemo)(() => model.actions(), [model]);
			const badgeSectionId = (0, react.useId)();
			const hoverSectionId = (0, react.useId)();
			const countSectionId = (0, react.useId)();
			const labels = {
				unavailable: t("settings.unavailable"),
				readOnly: t("settings.readOnly"),
				saveFailed: t("settings.saveFailed"),
				save: t("settings.save"),
				saving: t("settings.saving")
			};
			const fieldText = (field) => {
				return state.fields.find((f) => f.field === field)?.text ?? "true";
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
				labels,
				state,
				onSave: () => {
					actions.save();
				},
				onDiscard: () => {
					actions.discard();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: BadgeSettingsCard_module_css_default.section,
						"aria-labelledby": badgeSectionId,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: BadgeSettingsCard_module_css_default.heading,
								id: badgeSectionId,
								children: t("settings.badge.section")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
								field: BADGE_FIELDS.showPendingInBadge,
								text: fieldText(BADGE_FIELDS.showPendingInBadge),
								label: t("settings.badge.showPending"),
								hint: t("settings.badge.showPendingHint"),
								state,
								actions,
								specimen: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
									state: BADGE_FIELD_DOT_STATE.showPendingInBadge,
									size: 12
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
								field: BADGE_FIELDS.showRunningInBadge,
								text: fieldText(BADGE_FIELDS.showRunningInBadge),
								label: t("settings.badge.showRunning"),
								hint: t("settings.badge.showRunningHint"),
								state,
								actions,
								specimen: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
									state: BADGE_FIELD_DOT_STATE.showRunningInBadge,
									size: 12
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
								field: BADGE_FIELDS.showCompletedInBadge,
								text: fieldText(BADGE_FIELDS.showCompletedInBadge),
								label: t("settings.badge.showCompleted"),
								hint: t("settings.badge.showCompletedHint"),
								state,
								actions,
								specimen: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
									state: BADGE_FIELD_DOT_STATE.showCompletedInBadge,
									size: 12
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: BadgeSettingsCard_module_css_default.section,
						"aria-labelledby": hoverSectionId,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: BadgeSettingsCard_module_css_default.heading,
							id: hoverSectionId,
							children: t("settings.hover.section")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
							field: BADGE_FIELDS.showHoverDetails,
							text: fieldText(BADGE_FIELDS.showHoverDetails),
							label: t("settings.hover.showDetails"),
							hint: t("settings.hover.showDetailsHint"),
							state,
							actions
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: BadgeSettingsCard_module_css_default.section,
						"aria-labelledby": countSectionId,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: BadgeSettingsCard_module_css_default.heading,
							id: countSectionId,
							children: t("settings.count.section")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NumberRow, {
							field: BADGE_FIELDS.countThreshold,
							text: fieldText(BADGE_FIELDS.countThreshold),
							label: t("settings.count.threshold"),
							hint: t("settings.count.thresholdHint"),
							decreaseLabel: t("settings.count.decrease"),
							increaseLabel: t("settings.count.increase"),
							state,
							actions
						})]
					})
				]
			});
		}
		/** 单行开关：label + Switch + hint。`specimen` 是行首那枚预览点（可选）。 */
		function ToggleRow({ field, text, label, hint, state, actions, specimen }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BadgeSettingsCard_module_css_default.badgeField,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: BadgeSettingsCard_module_css_default.badgeToggleRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: BadgeSettingsCard_module_css_default.badgeToggleLabel,
						children: [specimen !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: BadgeSettingsCard_module_css_default.badgeSpecimen,
							children: specimen
						}), label]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: isDraftEnabled(text),
						label,
						disabled: !state.writable || state.saving,
						onChange: (next) => {
							actions.edit(field, next ? "true" : "false");
						}
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: BadgeSettingsCard_module_css_default.hint,
					children: hint
				})]
			});
		}
		/** 单行数字输入：label + 带加减按钮的数字输入 + hint。 */
		function NumberRow({ field, text, label, hint, decreaseLabel, increaseLabel, state, actions }) {
			const disabled = !state.writable || state.saving;
			const currentValue = Number(text) || 0;
			const decrement = () => {
				if (!disabled && currentValue > 0) actions.edit(field, String(currentValue - 1));
			};
			const increment = () => {
				if (!disabled) actions.edit(field, String(currentValue + 1));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: BadgeSettingsCard_module_css_default.badgeField,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: BadgeSettingsCard_module_css_default.badgeToggleRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: BadgeSettingsCard_module_css_default.badgeToggleLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: BadgeSettingsCard_module_css_default.badgeNumberControl,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BadgeSettingsCard_module_css_default.badgeNumberButton,
								disabled: disabled || currentValue <= 0,
								onClick: decrement,
								"aria-label": decreaseLabel,
								children: "−"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: BadgeSettingsCard_module_css_default.badgeNumberValue,
								children: text
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BadgeSettingsCard_module_css_default.badgeNumberButton,
								disabled,
								onClick: increment,
								"aria-label": increaseLabel,
								children: "+"
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: BadgeSettingsCard_module_css_default.hint,
					children: hint
				})]
			});
		}
		//#endregion
		//#region src/client/toast/Toast.tsx
		/** Shared Workspace notice presentation and keyed business adapters. */
		/**
		* Render one notice using the shared Factory.
		* @param props - keyed payload, injected display mapping, locale, and Factory renderer.
		* @returns the shared Toast occurrence.
		*/
		function ToastEntry(props) {
			const { dismissToast, display, t, renderFactorySlot, seq } = props;
			return renderFactorySlot("workspace.toast.content", {
				...display({ ...props }, t, dismissToast),
				seq,
				onDone: dismissToast
			});
		}
		/**
		* Keep the archive filter action reactive without subscribing unrelated notices.
		* @param props - archive notice, display mapping, and the existing viewing store.
		* @returns the shared Toast occurrence with its current actions.
		*/
		function ArchiveToastEntry(props) {
			const { dismissToast, display, filterAction, useStore, t, renderFactorySlot, seq } = props;
			const archivedVisible = useStore((state) => (state.archivedFilter ?? "default") !== "default");
			const fields = display({ ...props }, t, dismissToast);
			return renderFactorySlot("workspace.toast.content", {
				...fields,
				actions: [...fields.actions ?? [], ...archivedVisible ? [] : [filterAction(t, dismissToast)]],
				seq,
				onDone: dismissToast
			});
		}
		/**
		* Present plain display data with the shared primitive's timing and portal.
		* @param props - localized display fields, display identity, and dismissal.
		* @returns one Toast, remounted only for a new display identity.
		*/
		function WorkspaceToast({ seq, text, tone, holdMs, actions, onDone }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text,
				onDone,
				...tone === "success" ? { tone: "success" } : {},
				...tone === "warning" ? { icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}) } : {},
				...holdMs === void 0 ? {} : { holdMs },
				...actions === void 0 ? {} : { actions }
			}, seq);
		}
		//#endregion
		//#region src/client/toast/register.tsx
		/**
		* Wrap a business display mapping without making the slot component generic.
		* @param display - 该键的纯文案映射；`notice` 的类型由键决定，写错字段即编译失败。
		*/
		function plainToast(display) {
			return () => ({ display });
		}
		/**
		* 一条普通通知的登记数据：键与它自己的 display 成对。
		*
		* 键必须作为泛型实参先写出来，`display` 的 `notice` 才有类型——单看 display 推断不出
		* K，只能退回全部通知的联合。存下来的 `inject` 按 {@link KeyedToastInjected} 抹掉键
		* 负载：键 → 负载 的对应关系在入参这一侧已经校验过。
		*/
		function plainToastRow(key, display) {
			return {
				key,
				inject: plainToast(display)
			};
		}
		const ARCHIVE_TOASTS = [{
			key: "archived",
			text: "toast.archived"
		}, {
			key: "stoppedAndArchived",
			text: "toast.stoppedAndArchived"
		}];
		/**
		* Register notice presentations with their business-owned display fields and actions.
		* @param ctx - workspace plugin context.
		* @param viewStore - viewing store, read only by archive notices.
		* @param actions - archive and source-opening callbacks.
		*/
		function registerToasts(ctx, viewStore, actions) {
			const toastEntry = ToastEntry;
			const archiveToastEntry = ArchiveToastEntry;
			const archiveFilterAction = (t, dismiss) => ({
				prefix: t("toast.archivedOr"),
				label: t("toast.archivedFilter"),
				onClick: () => {
					dismiss();
					actions.showArchived();
				}
			});
			const plainToasts = [
				plainToastRow("sessionIdCopied", (_notice, t) => ({
					text: t("toast.sessionIdCopied"),
					tone: "success"
				})),
				plainToastRow("sessionIdCopyFailed", (_notice, t) => ({
					text: t("toast.sessionIdCopyFailed"),
					tone: "warning"
				})),
				plainToastRow("pinFailed", (_notice, t) => ({
					text: t("toast.pinFailed"),
					tone: "warning"
				})),
				plainToastRow("unpinFailed", (_notice, t) => ({
					text: t("toast.unpinFailed"),
					tone: "warning"
				})),
				plainToastRow("archivedNotOpenable", (_notice, t) => ({
					text: t("toast.archivedNotOpenable"),
					tone: "warning"
				})),
				plainToastRow("defaultWorkspaceFailed", (_notice, t) => ({
					text: t("defaultWorkspace.failed"),
					tone: "warning"
				})),
				plainToastRow("shortcutForkFailed", (notice, t) => ({
					text: t(notice.reason === "unavailable" ? "shortcut.noCompletedTurn" : "shortcut.forkFailed"),
					tone: "plain"
				})),
				plainToastRow("createFailed", (notice, t) => ({
					text: t("toast.createFailed", { message: notice.message }),
					tone: "warning",
					holdMs: 6e3
				})),
				plainToastRow("forkRequiresOpen", (notice, t, dismiss) => ({
					text: t("toast.forkRequiresOpen"),
					tone: "warning",
					holdMs: 6e3,
					actions: [{
						label: t("toast.openForkSource"),
						onClick: () => {
							dismiss();
							actions.openForkSource(notice.sessionId);
						}
					}]
				}))
			];
			ctx.slots.registerFactory({
				name: "workspace.toast.content",
				scope: "root"
			}, WorkspaceToast);
			ctx.slots.inject("workspace.toast", function* () {
				for (const { key, inject } of plainToasts) yield ctx.slots.register({
					name: "workspace.toast",
					key,
					locale: "workspace",
					inject
				}, toastEntry);
				for (const { key, text } of ARCHIVE_TOASTS) yield ctx.slots.register({
					name: "workspace.toast",
					key,
					locale: "workspace",
					store: viewStore,
					inject: () => ({
						display: (notice, t, dismiss) => ({
							text: t(text),
							tone: "success",
							holdMs: 6e3,
							actions: [{
								label: t("toast.archivedUndo"),
								onClick: () => {
									dismiss();
									actions.undoArchive(notice.sessionId);
								}
							}]
						}),
						filterAction: archiveFilterAction
					})
				}, archiveToastEntry);
			});
		}
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+dsh-util-values@0.2.2-rc.1_@deepseek-ai+cordis@4.1.0/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
		/**
		* Lazily scanned view of one JSON object's top-level fields, built from text
		* that may still be streaming or from an already parsed object. Nothing is
		* scanned until a reader asks; the view remembers every question it answered
		* and reports changed answers when the owner refreshes for publication.
		* Used for model tool-call arguments: a row reads the fields it
		* cares about at whatever granularity it displays, at every stage of the call.
		* @module @deepseek-ai/dsh-util-values/src/partial-json
		*/
		const SIMPLE_ESCAPES = {
			"\"": "\"",
			"\\": "\\",
			"/": "/",
			b: "\b",
			f: "\f",
			n: "\n",
			r: "\r",
			t: "	"
		};
		const CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
		function isWhitespace(c) {
			return c === " " || c === "\n" || c === "\r" || c === "	";
		}
		function isHex(c) {
			return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
		}
		(class PartialArguments {
			/** The view of a call with no arguments available. */
			static EMPTY = PartialArguments.fromObject({});
			/**
			* View finished argument text without scanning it until a reader asks.
			* @param text - the complete argument JSON text.
			* @returns a sealed view.
			*/
			static fromText(text) {
				const view = new PartialArguments();
				view.append(text);
				view.sealed = true;
				return view;
			}
			/**
			* View an already parsed argument payload, such as a PTC dispatch object.
			* @param value - the parsed argument value.
			* @returns a sealed view; a non-object payload has no fields.
			*/
			static fromObject(value) {
				const view = new PartialArguments();
				view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
				view.sealed = true;
				return view;
			}
			/**
			* The source: text so far or a parsed object, plus whether it can still grow.
			* These are the only enumerable fields, so two views over the same source
			* compare equal structurally however far each has been read.
			*/
			chunks = [];
			object;
			sealed = false;
			#ends = [];
			#size = 0;
			#consumed = 0;
			#mode = "root";
			#escape = false;
			#keyStart = 0;
			#keyEscaped = false;
			#key = "";
			#current = null;
			#nestedEnds = [];
			#nestedInString = false;
			#invalidAt;
			#invalidValue = false;
			#entries = /* @__PURE__ */ new Map();
			#order = [];
			#reads = /* @__PURE__ */ new Map();
			/** Whether this view rejects further appends; does not scan text or register reads. */
			get isSealed() {
				return this.sealed;
			}
			/** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
			get invalid() {
				this.scan();
				return this.#mode === "invalid" || this.#invalidValue;
			}
			/**
			* Retain streamed argument text without scanning or comparing observed answers.
			* @param fragment - the text following every fragment appended before.
			*/
			append(fragment) {
				if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
				if (fragment.length === 0) return;
				this.chunks.push(fragment);
				this.#size += fragment.length;
				this.#ends.push(this.#size);
			}
			/**
			* Reconcile a streamed prefix with authoritative complete text without joining the fragments.
			* @param text - the final argument text, which replaces missing or conflicting deltas.
			* @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
			*/
			settle(text) {
				if (this.object !== void 0 || text.length !== this.#size) return PartialArguments.fromText(text);
				let offset = 0;
				for (const chunk of this.chunks) {
					if (!text.startsWith(chunk, offset)) return PartialArguments.fromText(text);
					offset += chunk.length;
				}
				this.chunks = text.length === 0 ? [] : [text];
				this.#ends = text.length === 0 ? [] : [text.length];
				this.sealed = true;
				return this;
			}
			/**
			* Compare observed answers and advance their publication baseline. Unread views remain unscanned.
			* @returns whether any observed answer changed since its first read or the preceding refresh.
			*/
			refresh() {
				if (this.#reads.size === 0) return false;
				this.scan();
				let changed = false;
				let completions = false;
				for (const read of this.#reads.values()) {
					if (read.completion) {
						completions = true;
						continue;
					}
					changed = this.refreshRead(read) || changed;
				}
				if (completions) {
					for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
				}
				if (this.sealed) this.#reads.clear();
				return changed;
			}
			refreshRead(read) {
				const now = read.answer();
				if (Object.is(now, read.last)) return false;
				read.last = now;
				return true;
			}
			/**
			* Check whether no further fields can arrive.
			* @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
			*/
			closed() {
				return this.remember("closed", "", () => this.closedNow());
			}
			/**
			* List discovered fields in first-appearance order.
			* @returns top-level keys seen so far, in first-appearance order.
			*/
			keys() {
				return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
			}
			/**
			* Check whether a top-level field has appeared.
			* @param key - argument name.
			* @returns whether the field has appeared (a string opened or another value began).
			*/
			has(key) {
				return this.remember("has", key, () => this.hasNow(key));
			}
			/**
			* Check whether a field's closing delimiter has arrived, without validating its contents.
			* @param key - argument name.
			* @returns whether its delimiter arrived and no content reader has reported an error for this value.
			*/
			complete(key) {
				return this.remember("complete", key, () => this.completeNow(key));
			}
			/**
			* Read string length without materializing its text.
			* @param key - argument name.
			* @param options - change granularity for a streaming string.
			* @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
			*/
			stringLength(key, options) {
				const step = Math.max(1, Math.floor(options?.step ?? 1));
				const offset = options?.offset ?? 0;
				return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
			}
			/**
			* Check a string against a decoded UTF-16 length limit without materializing it.
			* @param key - argument name.
			* @param maxLength - decoded UTF-16 limit, floored to at least zero.
			* @returns whether the string is longer than the limit; false when absent or not a string.
			*/
			stringExceeds(key, maxLength) {
				const limit = Math.max(0, Math.floor(maxLength));
				return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
			}
			/**
			* Read a decoded string, including a streaming prefix.
			* @param key - argument name.
			* @returns the string field's decoded text so far; undefined when absent or not a string.
			*/
			text(key) {
				return this.remember("text", key, () => this.textNow(key));
			}
			/**
			* Read at most the first decoded UTF-16 units of a string.
			* @param key - argument name.
			* @param maxLength - maximum decoded UTF-16 length, floored to at least one.
			* @returns the bounded string prefix; undefined when absent or not a string.
			*/
			textPrefix(key, maxLength) {
				const limit = Math.max(1, Math.floor(maxLength));
				return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
			}
			/**
			* Read a completed non-string argument.
			* @param key - argument name.
			* @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
			*/
			value(key) {
				return this.remember("value", key, () => this.valueNow(key));
			}
			/** Answer a question and, on a streaming view, remember it for change detection. */
			remember(kind, key, read, comparison) {
				this.scan();
				const result = read();
				if (!this.sealed) {
					const id = `${kind}/${key}`;
					if (!this.#reads.has(id)) this.#reads.set(id, {
						completion: kind === "complete",
						answer: comparison === void 0 ? read : () => comparison(read()),
						last: comparison === void 0 ? result : comparison(result)
					});
				}
				return result;
			}
			closedNow() {
				return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
			}
			keysNow() {
				return this.object === void 0 ? this.#order : Object.keys(this.object);
			}
			hasNow(key) {
				return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
			}
			completeNow(key) {
				if (this.object !== void 0) return Object.hasOwn(this.object, key);
				const entry = this.#entries.get(key);
				return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
			}
			lengthNow(key, limit = Number.POSITIVE_INFINITY) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field.length : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
				const read = entry.length ??= {
					at: entry.start,
					length: 0,
					text: ""
				};
				this.readString(entry, read, limit, false);
				return read.length;
			}
			textNow(key) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
					let text;
					try {
						text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
					} catch (_error) {}
					if (text !== void 0) entry.text = {
						at: entry.end,
						length: text.length,
						text
					};
				}
				const read = entry.text ??= {
					at: entry.start,
					length: 0,
					text: ""
				};
				this.readString(entry, read, Number.POSITIVE_INFINITY, true);
				return read.text;
			}
			textPrefixNow(key, maxLength) {
				if (this.object !== void 0) {
					const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
					return typeof field === "string" ? field.slice(0, maxLength) : void 0;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "string") return void 0;
				const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
				let read = prefixes.get(maxLength);
				if (read === void 0) {
					read = {
						at: entry.start,
						length: 0,
						text: ""
					};
					prefixes.set(maxLength, read);
				}
				this.readString(entry, read, maxLength, true);
				return read.text;
			}
			valueNow(key) {
				if (this.object !== void 0) {
					if (!Object.hasOwn(this.object, key)) return void 0;
					const field = this.object[key];
					return typeof field === "string" ? void 0 : field;
				}
				const entry = this.#entries.get(key);
				if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
				if (entry.parsed === void 0) try {
					entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
				} catch (_error) {
					entry.invalid = true;
					this.#invalidValue = true;
				}
				return entry.parsed;
			}
			chunkAt(at) {
				let low = 0;
				let high = this.#ends.length;
				while (low < high) {
					const mid = low + high >>> 1;
					if (this.#ends[mid] <= at) low = mid + 1;
					else high = mid;
				}
				return low;
			}
			/** Materialize only a requested range, never the cumulative source. */
			slice(start, end) {
				if (start >= end) return "";
				const first = this.chunkAt(start);
				const last = this.chunkAt(end - 1);
				const base = first === 0 ? 0 : this.#ends[first - 1];
				if (first === last) return this.chunks[first].slice(start - base, end - base);
				const parts = [this.chunks[first].slice(start - base)];
				for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
				parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
				return parts.join("");
			}
			readString(entry, read, limit, materialize) {
				const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
				if (!entry.needsDecoding) {
					const length = Math.min(end - read.at, limit - read.length);
					if (length <= 0) return;
					if (materialize) read.text += this.slice(read.at, read.at + length);
					read.at += length;
					read.length += length;
					return;
				}
				let chunkIndex = this.chunkAt(read.at);
				while (read.at < end && read.length < limit) {
					const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
					const chunk = this.chunks[chunkIndex];
					const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
					const boundary = remaining.search(CONTENT_ESCAPE);
					const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
					if (length > 0) {
						if (materialize) read.text += remaining.slice(0, length);
						read.at += length;
						read.length += length;
						if (read.at === base + chunk.length) chunkIndex++;
						continue;
					}
					const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
					let decoded;
					let width = 2;
					if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
					if (remaining[0] === "\\" && type === "u") {
						const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
						let valid = true;
						for (let i = 0; i < hex.length; i++) if (!isHex(hex[i])) valid = false;
						if (valid) {
							if (hex.length < 4 && entry.end < 0) return;
							if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
						}
						width = 6;
					} else if (remaining[0] === "\\" && type !== void 0) decoded = SIMPLE_ESCAPES[type];
					if (decoded === void 0) {
						entry.invalidAt = read.at;
						this.#invalidValue = true;
						return;
					}
					if (materialize) read.text += decoded;
					read.length++;
					read.at += width;
					while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
				}
			}
			/** Locate new field ranges without decoding or parsing their contents. */
			scan() {
				if (this.object !== void 0 || this.#consumed === this.#size) return;
				for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
					const pending = this.chunks[i];
					const base = i === 0 ? 0 : this.#ends[i - 1];
					for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
						if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
							const end = this.stringBoundary(pending, index);
							this.#consumed += end - index;
							index = end;
							if (index === pending.length) break;
						}
						this.step(pending[index], this.#consumed);
						this.#consumed++;
					}
				}
			}
			/** Only raw quotes and their preceding backslash runs can terminate a string. */
			stringBoundary(fragment, start) {
				let at = start;
				while (true) {
					const quote = fragment.indexOf("\"", at);
					const end = quote < 0 ? fragment.length : quote;
					if (this.#mode === "string") {
						const entry = this.#current;
						if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
					}
					let slashStart = end;
					while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
					const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
					this.#escape = quote < 0 && escaped;
					if (quote < 0 || !escaped) return end;
					at = quote + 1;
				}
			}
			step(c, at) {
				switch (this.#mode) {
					case "root":
						if (isWhitespace(c)) return;
						if (c === "{") {
							this.#mode = "key-or-end";
							return;
						}
						this.fail();
						return;
					case "key-or-end":
						if (isWhitespace(c)) return;
						if (c === "}") {
							this.#mode = "closed";
							return;
						}
						if (c === "\"") {
							this.beginKey(at);
							return;
						}
						this.fail();
						return;
					case "key-only":
						if (isWhitespace(c)) return;
						if (c === "\"") {
							this.beginKey(at);
							return;
						}
						this.fail();
						return;
					case "key":
						this.stepKey(c, at);
						return;
					case "colon":
						if (isWhitespace(c)) return;
						if (c === ":") {
							this.#mode = "value";
							return;
						}
						this.fail();
						return;
					case "value":
						this.beginValue(c, at);
						return;
					case "string": {
						const entry = this.#current;
						entry.end = at;
						this.#current = null;
						this.#mode = "comma-or-end";
						return;
					}
					case "scalar":
						this.stepScalar(c, at);
						return;
					case "nested":
						this.stepNested(c, at);
						return;
					case "comma-or-end":
						if (isWhitespace(c)) return;
						if (c === ",") {
							this.#mode = "key-only";
							return;
						}
						if (c === "}") {
							this.#mode = "closed";
							return;
						}
						this.fail();
						return;
					case "closed":
						if (isWhitespace(c)) return;
						this.fail();
						return;
					/* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
					case "invalid": return;
					/* v8 ignore next 2 -- Every scanner mode has a handler above. */
					default: assertNever$1(this.#mode);
				}
			}
			fail() {
				this.#invalidAt = this.#consumed;
				this.#mode = "invalid";
				this.#current = null;
			}
			beginKey(at) {
				this.#mode = "key";
				this.#keyStart = at + 1;
				this.#keyEscaped = false;
				this.#escape = false;
			}
			stepKey(c, at) {
				if (c < " ") {
					this.fail();
					return;
				}
				if (this.#escape) {
					this.#escape = false;
					return;
				}
				if (c === "\\") {
					this.#escape = true;
					this.#keyEscaped = true;
					return;
				}
				if (c !== "\"") return;
				const raw = this.slice(this.#keyStart, at);
				if (this.#keyEscaped) try {
					this.#key = JSON.parse(`"${raw}"`);
				} catch (_error) {
					this.fail();
					return;
				}
				else this.#key = raw;
				this.#mode = "colon";
			}
			open(entry) {
				if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
				this.#entries.set(this.#key, entry);
				this.#current = entry;
			}
			beginValue(c, at) {
				if (isWhitespace(c)) return;
				if (c === "\"") {
					this.open({
						kind: "string",
						start: at + 1,
						end: -1,
						needsDecoding: false,
						invalidAt: void 0,
						length: void 0,
						text: void 0,
						prefixes: void 0
					});
					this.#escape = false;
					this.#mode = "string";
					return;
				}
				if (c === "}" || c === "," || c === ":" || c === "]") {
					this.fail();
					return;
				}
				this.open({
					kind: "value",
					start: at,
					end: -1,
					parsed: void 0,
					invalid: false
				});
				if (c === "{" || c === "[") {
					this.#mode = "nested";
					this.#nestedEnds = [c === "{" ? "}" : "]"];
					this.#nestedInString = false;
					this.#escape = false;
					return;
				}
				this.#mode = "scalar";
			}
			stepScalar(c, at) {
				if (c !== "," && c !== "}" && !isWhitespace(c)) return;
				this.closeValue(at);
				this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
			}
			stepNested(c, at) {
				if (this.#nestedInString) {
					this.#nestedInString = false;
					return;
				}
				if (c === "\"") {
					this.#nestedInString = true;
					return;
				}
				if (c === "{" || c === "[") {
					this.#nestedEnds.push(c === "{" ? "}" : "]");
					return;
				}
				if (c === "}" || c === "]") {
					if (this.#nestedEnds.pop() !== c) {
						this.fail();
						return;
					}
					if (this.#nestedEnds.length === 0) {
						this.closeValue(at + 1);
						this.#mode = "comma-or-end";
					}
				}
			}
			closeValue(end) {
				const entry = this.#current;
				entry.end = end;
				this.#current = null;
			}
		});
		/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
		/**
		* Mark an unreachable closed-union branch.
		* @param value - impossible value; an unhandled typed variant fails at the call site.
		* @param context - optional switch-site label included in the failure message.
		* @returns never; a runtime value that escaped its type always throws.
		*/
		function assertNever$1(value, context) {
			const rendered = JSON.stringify(value) ?? String(value);
			throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
		}
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+dsh-util-workspace-path@0.2.2-rc.1_@deepseek-ai+cordis@4.1.0/node_modules/@deepseek-ai/dsh-util-workspace-path/lib/index.js
		/**
		* Browser-safe Workspace path and display helpers.
		* @module @deepseek-ai/dsh-util-workspace-path
		*/
		/** Whether a path uses a Windows drive or UNC prefix. */
		function isWindowsStylePath(value) {
			return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
		}
		/**
		* Abbreviate a POSIX home directory for display.
		* @param path - Absolute or already-short display path.
		* @param home - Host account home; absent skips abbreviation.
		* @returns `~` or `~/…` for the POSIX home and its descendants, otherwise `path`.
		*/
		function abbreviateHomePath(path, home) {
			if (home === void 0 || home === "") return path;
			if (isWindowsStylePath(path) || isWindowsStylePath(home)) return path;
			const root = home.replace(/\/+$/, "");
			if (root === "" || root === "/") return path;
			if (path.replace(/\/+$/, "") === root) return "~";
			if (path.startsWith(`${root}/`)) return `~${path.slice(root.length)}`;
			return path;
		}
		/**
		* Read the final non-empty segment of a Workspace path for display.
		* Workspace-label surfaces use this helper instead of deriving another basename.
		* @param path - Workspace directory path using POSIX or Windows separators.
		* @returns the final segment, or an empty string for a separator-only path.
		*/
		function workspaceTitleOf(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return trimmed.slice(separator + 1);
		}
		/**
		* Resolve the Workspace browser group that owns one Session.
		* @param workspaces - authoritative Workspace membership.
		* @param sessionId - Session whose browser group is required.
		* @returns owning Workspace id, or {@link UNGROUPED_KEY} when no Workspace accounts for it.
		*/
		function owningGroupKey(workspaces, sessionId) {
			return workspaces.find((workspace) => workspace.sessionIds.includes(sessionId))?.workspaceId ?? "";
		}
		/** 宿主认的 kind 集合（查表用）。 */
		const PENDING_INTERACTION_KIND_SET = /* @__PURE__ */ new Set([
			"approval",
			"plan-review",
			"question"
		]);
		function mainSessionId(list) {
			return Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
		}
		/**
		* Directory display label: basename of the path (both separators accepted).
		* Ungrouped-bucket fallback for surfaces without a workspace title.
		* @param cwd - directory path, or undefined for the ungrouped bucket.
		* @returns basename, the raw cwd when it has no basename, or an empty ungrouped marker.
		*/
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return "";
			const base = workspaceTitleOf(cwd);
			return base !== "" ? base : cwd;
		}
		/**
		* Project known account members by current Session recency.
		* @param sessionIds - authoritative account membership.
		* @param summaries - current Session summaries; members without a summary are omitted until it arrives.
		* @returns known members newest first, with Session identity as the deterministic tie-break.
		*/
		function orderByRecency(sessionIds, summaries) {
			return sessionIds.flatMap((id) => {
				const summary = summaries[id];
				if (summary === void 0) return [];
				return [{
					id,
					rank: summary.updatedAt
				}];
			}).sort((a, b) => {
				if (a.rank !== b.rank) return b.rank - a.rank;
				return a.id < b.id ? -1 : 1;
			}).map((member) => member.id);
		}
		/**
		* Reconcile a browser-local manual order with current account membership.
		* New ordinary forks precede their sources without changing saved entries' relative order.
		* @param memberIds - authoritative account membership.
		* @param savedOrder - previously saved browser-local order.
		* @param summaries - current Session metadata; unknown new members wait for their summaries.
		* @param rowState - global pin and archive membership; only account members can supplement the order.
		* @returns saved relative positions plus missing members ordered by pin, fork source, recency, and archive status.
		*/
		function reconcileManualOrder(memberIds, savedOrder, summaries, rowState) {
			const members = new Map(memberIds.map((id) => [id, id]));
			const included = /* @__PURE__ */ new Set();
			const ordered = [];
			for (const key of savedOrder ?? []) {
				const id = members.get(key);
				if (id === void 0 || included.has(key)) continue;
				ordered.push(id);
				included.add(key);
			}
			const archived = new Set(rowState?.archivedSessionIds);
			const pins = [];
			for (const sessionId of rowState?.pinnedSessionIds ?? []) {
				const id = members.get(sessionId);
				if (id === void 0 || included.has(id) || archived.has(id) || summaries[id] === void 0) continue;
				pins.push(id);
				included.add(id);
			}
			const ordinary = [];
			const archives = [];
			for (const id of orderByRecency([...members.values()].filter((id) => !included.has(id)), summaries)) if (archived.has(id)) archives.push(id);
			else ordinary.push(id);
			const result = [
				...pins,
				...ordered,
				...ordinary,
				...archives
			];
			const pending = new Set(ordinary);
			const placeFork = (id) => {
				if (!pending.delete(id)) return;
				const parentId = summaries[id]?.parentId;
				if (parentId === void 0 || parentId === id || !result.includes(parentId)) return;
				placeFork(parentId);
				result.splice(result.indexOf(id), 1);
				result.splice(result.indexOf(parentId), 0, id);
			};
			for (const id of [...ordinary].reverse()) placeFork(id);
			return result;
		}
		/**
		* Keep the selected provisional New Session ahead of either base order.
		* @param order - recency or reconciled manual order.
		* @param currentBlank - selected blank Session in this account, when present.
		* @returns a copy with the selected blank first and no duplicate slot.
		*/
		function pinCurrentBlank(order, currentBlank) {
			if (currentBlank === void 0) return [...order];
			return [currentBlank, ...order.filter((id) => id !== currentBlank)];
		}
		/**
		* Ordinary sessions are visible; among blank sessions, only the current one
		* is visible. Subagent children use their parent header catalog; archived
		* sessions follow the archived filter, while their accounting slots remain
		* either way so unarchiving restores position.
		*/
		function sessionVisible(session, current, archived, archivedFilter) {
			if (session.origin === "subagent") return false;
			if (session.blank && session.id !== current) return false;
			switch (archivedFilter) {
				case "default": return !archived.has(session.id);
				case "show": return true;
				case "only": return archived.has(session.id);
				/* v8 ignore next 2 -- closed-union backstop; only reached if the filter is forged */
				default: return assertNever$1(archivedFilter);
			}
		}
		/**
		* Keep the visible New Session placeholder first, then partition pinned and
		* ordinary rows without changing either partition's caller order.
		*/
		function sectionMembers(members, pinned, archived) {
			const placeholders = [];
			const leading = [];
			const rest = [];
			for (const member of members) if (member.blank) placeholders.push(member);
			else if (!archived.has(member.id) && pinned.has(member.id)) leading.push(member);
			else rest.push(member);
			return [
				...placeholders,
				...leading,
				...rest
			];
		}
		/**
		* A blank session is the selected Workspace's provisional New Session row;
		* its canonical title never enters search (blank rows are query-excluded)
		* and the renderer localizes its display label. Unnamed history also yields an
		* empty title for localization and does not match a directory-name title search.
		*/
		function sessionTitle(session) {
			return session.blank ? "" : session.title?.trim() ?? "";
		}
		/** Build one group without projecting session lineage into presentation. */
		function buildGroup(key, workspaceId, cwd, createdAt, label, members) {
			return {
				key,
				workspaceId,
				cwd,
				createdAt,
				label,
				sessions: [...members]
			};
		}
		/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
		function orderedUngrouped(members, stored, summaries) {
			const byId = new Map(members.map((session) => [session.id, session]));
			return (stored === void 0 ? orderByRecency(members.map((session) => session.id), summaries) : reconcileManualOrder(members.map((session) => session.id), stored, summaries)).flatMap((id) => {
				const session = byId.get(id);
				/* v8 ignore next -- ids are projected exclusively from the members used to build byId. */
				return session === void 0 ? [] : [session];
			});
		}
		/**
		* Group Sessions by Workspace: one group per caller-ordered entity, with
		* members resolved from caller-ordered sessionIds. Sessions outside every
		* Workspace trail in the browser-local Ungrouped order, which falls back to
		* recency before that order is initialized.
		*/
		function groupByWorkspace(list, workspaces, archived, archivedFilter, ungroupedOrder) {
			const current = mainSessionId(list);
			const groups = [];
			const accounted = /* @__PURE__ */ new Set();
			for (const workspace of workspaces) {
				const members = [];
				for (const id of workspace.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0) continue;
					accounted.add(id);
					if (!sessionVisible(summary, current, archived, archivedFilter)) continue;
					members.push(summary);
				}
				if (archivedFilter === "only" && members.length === 0) continue;
				groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members));
			}
			const stray = list.ids.map((id) => list.byId[id]).filter((s) => s !== void 0 && !accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter));
			if (stray.length > 0) groups.push(buildGroup("", void 0, void 0, void 0, "", orderedUngrouped(stray, ungroupedOrder, list.byId)));
			return groups;
		}
		/** Keep navigation presentation independent from domain-owned interaction objects. */
		function visiblePendingKind(kind) {
			return kind !== void 0 && PENDING_INTERACTION_KIND_SET.has(kind) ? kind : void 0;
		}
		function runningChildCount(list, parentId, statuses) {
			return list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count, child) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0;
		}
		function sessionNode(s, list, statuses, pinned, archived) {
			const status = statuses.get(s.id);
			const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: status?.running ?? s.running,
				runningSubagentCount: runningChildCount(list, s.id, statuses),
				completed: status?.completionUnread === true,
				pinned: !archived.has(s.id) && pinned.has(s.id),
				archived: archived.has(s.id),
				updatedAt: s.updatedAt,
				...pendingInteraction === void 0 ? {} : { pendingInteraction }
			};
		}
		/**
		* Derive the workspace browser groups with every session as a top-level row.
		*
		* Every group shows, except that the archived-only filter drops groups
		* without visible members; sessions populate under expanded groups with
		* pinned rows leading in the selected local order. Blank sessions are
		* excluded except for the selected provisional New Session row; archived
		* sessions keep their slots and appear per the archived filter. Content
		* search lives outside this derivation (see {@link deriveSearchResults}).
		* @param list - sessions list snapshot (`mainView` retention feeds containsCurrent).
		* @param workspaces - real Workspaces in Host group order with caller-projected Session order.
		* @param rowState - registry-global pin and archive sets plus the archived filter.
		* @param statuses - unified UI status by Session.
		* @param view - local expansion arrays.
		* @returns group sections in render order.
		*/
		function deriveGroups(list, workspaces, rowState, statuses, view) {
			const archived = new Set(rowState.archivedSessionIds);
			const pinned = new Set(rowState.pinnedSessionIds);
			const expandedGroups = new Set(view.expandedGroups);
			const current = mainSessionId(list);
			const currentGroup = current === void 0 ? void 0 : owningGroupKey(workspaces, current);
			const groups = [];
			for (const g of groupByWorkspace(list, workspaces, archived, rowState.archivedFilter, view.ungroupedOrder)) {
				const expanded = expandedGroups.has(g.key);
				const members = sectionMembers(g.sessions, pinned, archived).map((session) => sessionNode(session, list, statuses, pinned, archived));
				groups.push({
					key: g.key,
					workspaceId: g.workspaceId,
					cwd: g.cwd,
					createdAt: g.createdAt,
					label: g.label,
					sessionCount: g.sessions.length,
					expanded,
					containsCurrent: g.key === currentGroup,
					sessions: members
				});
			}
			return groups;
		}
		/**
		* Select complete flat-list membership, independently of archive visibility.
		* @param list - sessions list snapshot.
		* @returns known ordinary Session ids, including archives and only the current blank.
		*/
		function sessionMemberIds(list) {
			return visibleSessionIds(list, [], "show");
		}
		/**
		* Select visible flat-list members without deriving row presentation or ordering.
		* @param list - sessions list snapshot.
		* @param archivedSessionIds - registry-global archive set.
		* @param archivedFilter - archived-row visibility choice.
		* @returns known visible Session ids in list order, including ordinary forks and only the current blank.
		*/
		function visibleSessionIds(list, archivedSessionIds, archivedFilter) {
			const archived = new Set(archivedSessionIds);
			const current = mainSessionId(list);
			return list.ids.filter((id) => {
				const s = list.byId[id];
				return s !== void 0 && sessionVisible(s, current, archived, archivedFilter);
			});
		}
		/**
		* Derive flat rows from the browser's complete ordered Session ids, with
		* pinned rows fronted ahead of the supplied order.
		* @param list - sessions list snapshot used to select the ids.
		* @param sessionIds - complete account members in the selected order, including hidden archives.
		* @param rowState - registry-global pin and archive sets plus the archived filter.
		* @param statuses - unified UI status by Session.
		* @returns flat rows in sectioned order with current status indicators.
		*/
		function deriveFlat(list, sessionIds, rowState, statuses) {
			const archived = new Set(rowState.archivedSessionIds);
			const pinned = new Set(rowState.pinnedSessionIds);
			const current = mainSessionId(list);
			return sectionMembers(sessionIds.flatMap((id) => {
				const session = list.byId[id];
				return session !== void 0 && sessionVisible(session, current, archived, rowState.archivedFilter) ? [session] : [];
			}), pinned, archived).map((session) => sessionNode(session, list, statuses, pinned, archived));
		}
		/**
		* Merge immediate title/Workspace substring matches with ranked Host content
		* matches. Local rows lead newest-first, content-only rows retain backend
		* order, and duplicate sessions receive the backend snippet in place.
		* @param list - session metadata authority.
		* @param workspaces - Workspace membership and display labels.
		* @param query - caller text; surrounding whitespace is ignored.
		* @param archivedSessionIds - registry-global archive set (members match per the archived filter).
		* @param archivedFilter - archived-row visibility choice; search follows it.
		* @param statuses - unified UI status by Session.
		* @param content - ranked Host content-search page.
		* @param limit - protocol-owned maximum merged row count.
		* @returns bounded deduplicated flat rows and a refine-query hint bit.
		*/
		function deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, content, limit) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				items: [],
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			const current = mainSessionId(list);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title);
			const labelOf = (summary) => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
			const contentBySession = /* @__PURE__ */ new Map();
			for (const item of content.items) if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, current, archived, archivedFilter)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			const localById = new Map(local.map((summary) => [summary.id, summary]));
			const orderedLocal = orderByRecency(local.map((summary) => summary.id), list.byId).map((id) => localById.get(id));
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of orderedLocal) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, current, archived, archivedFilter)) include(summary);
			}
			return {
				items: ordered.slice(0, limit).map((summary) => {
					const match = contentBySession.get(summary.id);
					const status = statuses.get(summary.id);
					const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
					return {
						id: summary.id,
						title: sessionTitle(summary),
						workspace: labelOf(summary),
						running: status?.running ?? summary.running,
						runningSubagentCount: runningChildCount(list, summary.id, statuses),
						...pendingInteraction === void 0 ? {} : { pendingInteraction },
						completed: status?.completionUnread === true,
						archived: archived.has(summary.id),
						...match === void 0 ? {} : { snippet: match.snippet }
					};
				}),
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/** Normalize separators for comparison without interpreting POSIX backslashes as separators. */
		function folderPath(path) {
			return (/^[A-Za-z]:[/\\]/.test(path) || path.startsWith("\\\\") ? path.replaceAll("\\", "/") : path).replace(/\/+$/, "");
		}
		/**
		* Find the nearest registered ancestor, excluding the Workspace directory itself.
		* Paths use Host spelling; matching is case-sensitive, like Workspace identity.
		* @param path - Workspace directory.
		* @param parents - registered Workspace directory paths.
		* @returns the owning parent path, or undefined when no parent contains the Workspace.
		*/
		function owningParentFolder(path, parents) {
			const child = folderPath(path);
			let owner;
			let length = -1;
			for (const parent of parents) {
				const root = folderPath(parent);
				if (root.length > length && child !== root && child.startsWith(`${root}/`)) {
					owner = parent;
					length = root.length;
				}
			}
			return owner;
		}
		//#endregion
		//#region src/client/stores.ts
		/**
		* The workspace browser's viewing store: the session-list grouping mode,
		* persisted across reloads. Module level exports the factory only (a
		* module-level handle would pin the store identity across plugin reloads);
		* register() receives the factory and the browser derives its PropsStore
		* share from the return type.
		*/
		/** Browser-local order account for the hierarchy-free flat Session list. */
		const FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
		/** Copy read-only projections into the persisted mutable store representation. */
		function copySessionOrders(orders) {
			return Object.fromEntries(Object.entries(orders).map(([key, order]) => [key, [...order]]));
		}
		/**
		* Create the workspace browser viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createWorkspaceViewStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					groupBy: "workspace",
					orderBy: "updated",
					groupExpansion: {},
					sessionOrderByAccount: {},
					archivedFilter: "default"
				}),
				persist: "dsh.workspace.view.v5",
				actions: {
					setGroupBy: (d, mode) => {
						d.groupBy = mode;
					},
					setOrderBy: (d, mode, initialOrders) => {
						if (mode === d.orderBy) return;
						d.sessionOrderByAccount = mode === "manual" ? copySessionOrders(initialOrders) : {};
						d.orderBy = mode;
					},
					setGroupExpanded: (d, key, expanded) => {
						d.groupExpansion[key] = expanded;
					},
					retainAccountKeys: (d, workspaceKeys) => {
						const retained = new Set(workspaceKeys);
						d.groupExpansion = Object.fromEntries(Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)));
						d.sessionOrderByAccount = Object.fromEntries(Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)));
						delete d.sessionUpdatedAtByAccount;
					},
					syncSessionOrders: (d, orders) => {
						if (d.orderBy !== "manual") return;
						Object.assign(d.sessionOrderByAccount, copySessionOrders(orders));
					},
					setSessionOrder: (d, accountKey, order, initialOrders) => {
						if (d.orderBy === "updated") d.sessionOrderByAccount = copySessionOrders(initialOrders);
						else Object.assign(d.sessionOrderByAccount, copySessionOrders(initialOrders));
						d.orderBy = "manual";
						d.sessionOrderByAccount[accountKey] = [...order];
					},
					pinSessionOrder: (d, sessionId, accountKeys, source) => {
						const selected = new Set(accountKeys);
						d.sessionOrderByAccount = Object.fromEntries(Object.entries(source.members).map(([key, members]) => {
							const order = reconcileManualOrder(members, d.sessionOrderByAccount[key], source.summaries, source.rowState);
							return [key, selected.has(key) ? [sessionId, ...order.filter((id) => id !== sessionId)] : order];
						}));
					},
					setArchivedFilter: (d, filter) => {
						d.archivedFilter = filter;
					}
				}
			});
		}
		//#endregion
		//#region src/client/pin-order.ts
		/**
		* Every account's complete membership: each Workspace, Ungrouped, and the flat list.
		* @param workspaces - current Host Workspaces.
		* @param list - current Session list snapshot.
		* @param rowState - registry-global pin and archive sets.
		* @returns the order source for one pin write.
		*/
		function pinOrderSource(workspaces, list, rowState) {
			const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
			return {
				members: Object.fromEntries([
					...workspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds]),
					["", list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id))],
					[FLAT_SESSION_ORDER_KEY, sessionMemberIds(list)]
				]),
				summaries: list.byId,
				rowState
			};
		}
		/**
		* The accounts a pinned Session leads: its group (or Ungrouped) and the flat list.
		* @param workspaces - current Host Workspaces.
		* @param sessionId - the Session being pinned.
		* @returns the account keys `pinSessionOrder` fronts.
		*/
		function pinOrderAccounts(workspaces, sessionId) {
			return [owningGroupKey(workspaces, sessionId), FLAT_SESSION_ORDER_KEY];
		}
		//#endregion
		//#region src/client/navigation.ts
		/** Workspace archive and directory UI capability. */
		/** Structured directory failure exposed to directory UI consumers. */
		var DirectoryBrowseError = class extends Error {
			rpcError;
			name = "DirectoryBrowseError";
			/** @param rpcError - Host directory business failure. */
			constructor(rpcError) {
				super(`directory browse failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
			}
		};
		/** Implements Workspace archive and directory UI operations. */
		var UiWorkspaceService = class extends _deepseek_ai_cordis.Service {
			directoryPicker;
			workspaces;
			sessions;
			view;
			notify;
			connecting = /* @__PURE__ */ new Map();
			lifetime = new AbortController();
			selection = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({}, { persist: { name: "dsh.sessions.current" } });
			mainReference;
			/**
			* @param ctx - Client root Context.
			* @param directoryPicker - the directory-picking Remote namespace.
			* @param workspaces - pure Workspace Controller.
			* @param sessions - pure Session Controller.
			* @param view - the browser's viewing-store write set (one instance shared with its registration).
			* @param notify - show one notice through the Workspace notice channel.
			*/
			constructor(ctx, directoryPicker, workspaces, sessions, view, notify) {
				super(ctx, "uiWorkspace");
				this.directoryPicker = directoryPicker;
				this.workspaces = workspaces;
				this.sessions = sessions;
				this.view = view;
				this.notify = notify;
				ctx.effect(() => {
					const stop = this.watchNavigation();
					return () => {
						stop();
						this.lifetime.abort();
						const reference = this.mainReference;
						this.mainReference = void 0;
						reference?.release();
					};
				}, "ui-workspace: Workspace navigation policy");
			}
			connectWorkspace(workspaceId, options = {}) {
				return this.connectBlank(workspaceId, options);
			}
			/**
			* @param reuse - preset for the reused or created blank; absent creates a fresh Session.
			*/
			async connectBlank(workspaceId, reuse) {
				const workspace = this.workspaces.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId);
				if (workspace === void 0) throw new Error(`uiWorkspace.connectWorkspace: unknown workspace ${workspaceId}`);
				if (reuse === void 0) return this.sessions.create({ workspaceId });
				const inflight = this.connecting.get(workspaceId);
				if (inflight !== void 0 && inflight.agentPreset === reuse.agentPreset) return inflight.attempt;
				const attempt = this.createInWorkspace(workspace, reuse).finally(() => {
					if (this.connecting.get(workspaceId)?.attempt === attempt) this.connecting.delete(workspaceId);
				});
				this.connecting.set(workspaceId, {
					agentPreset: reuse.agentPreset,
					attempt
				});
				return attempt;
			}
			createInWorkspace(workspace, options) {
				const archived = this.workspaces.list.getSnapshot().archivedSessionIds;
				const sessions = this.sessions.list.getSnapshot();
				const blank = sessions.ids.find((id) => {
					const summary = sessions.byId[id];
					if (summary === void 0 || !summary.blank || summary.cwd !== workspace.path) return false;
					if (!workspace.sessionIds.includes(id) || archived.includes(id)) return false;
					const recorded = summary.projectionValues?.agentPreset;
					return typeof recorded !== "string" || recorded === options.agentPreset;
				});
				return this.createNamed({
					workspaceId: workspace.workspaceId,
					...blank === void 0 ? {} : { sessionId: blank },
					...options.agentPreset === void 0 ? {} : { agentPreset: options.agentPreset }
				});
			}
			/**
			* Create through the Host. A named blank the Host declined may still read as
			* blank from stale cached list metadata, which hides it from the Session tree;
			* its projections are reloaded so the row reflects its log.
			*/
			async createNamed(request) {
				const sessionId = await this.sessions.create(request);
				const named = request.sessionId;
				if (named !== void 0 && named !== sessionId) this.sessions.refreshProjections(named).catch((reason) => {
					console.warn("declined blank Session projection reload failed:", reason);
				});
				return sessionId;
			}
			/**
			* Reopen a saved blank Session under the preset its log recorded, or under
			* the Host default once that preset no longer activates. Listed values are
			* cached hints that can lag the log after an unclean Host exit, so the
			* Session's projections are reloaded before the preset is read; a Session
			* that still awaits a format migration reloads only those cached hints.
			*/
			async restoreBlank(workspaceId, sessionId) {
				await this.sessions.refreshProjections(sessionId);
				const recorded = this.sessions.list.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset;
				const request = {
					workspaceId,
					sessionId
				};
				if (typeof recorded !== "string") return this.createNamed(request);
				try {
					return await this.createNamed({
						...request,
						agentPreset: recorded
					});
				} catch (error) {
					const code = sessionCreateErrorOf(error)?.rpcError.code;
					if (code !== "agent-preset/not-found" && code !== "agent-preset/invalid") throw error;
					return this.createNamed(request);
				}
			}
			openSession(target) {
				this.replaceMain(target, this.lifetime.signal, "reveal");
			}
			openWorkspace(workspaceId, beforeOpen, options = {}) {
				return this.openWorkspaceSession(workspaceId, beforeOpen, options);
			}
			async openWorkspaceSession(workspaceId, beforeOpen, reuse) {
				const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
				let sessionId;
				try {
					sessionId = await this.connectBlank(workspaceId, reuse);
				} catch (error) {
					if (!navigation.aborted) this.notify({
						kind: "createFailed",
						message: creationFailureMessage(error)
					});
					throw error;
				}
				if (navigation.aborted) return;
				this.replaceMain(sessionId, navigation, "reveal", beforeOpen);
			}
			forkSession(sessionId, onCreated, options) {
				return this.sessions.fork({
					sessionId,
					increaseTitle: true,
					...onCreated === void 0 ? {} : { onCreated },
					...options?.allowMigration === void 0 ? {} : { allowMigration: options.allowMigration }
				});
			}
			startSession(workspaceId, options) {
				const { agentPreset, ...draft } = options ?? {};
				const draftOptions = options === void 0 ? void 0 : draft;
				const initializeDraft = draftOptions !== void 0 && (draft.prompt !== void 0 || draft.clearPreviousDraft === true || draft.whenDraftExists !== void 0);
				const workspace = this.workspaces.list.getSnapshot();
				const sessions = this.sessions.list.getSnapshot();
				const current = this.mainReference?.sessionId;
				const currentWorkspaceId = current === void 0 ? void 0 : workspace.items.find((item) => item.sessionIds.includes(current))?.workspaceId;
				const recent = workspace.phase === "ready" && sessions.phase === "ready" ? recentWorkspace(workspace.items, sessions.byId) : void 0;
				const target = workspaceId ?? currentWorkspaceId ?? recent;
				if (target === void 0) {
					if (initializeDraft) {
						this.notify({
							kind: "createFailed",
							message: this.ctx.locale.bind("workspace")("draft.workspaceRequired")
						});
						return;
					}
					this.clearMain();
					return;
				}
				(draftOptions === void 0 ? this.openWorkspaceSession(target, void 0, void 0) : this.openWorkspace(target, initializeDraft ? (sessionId) => {
					const binding = this.sessions.binding(sessionId) ?? this.draftPreparationFailed();
					this.prepareDraft(binding, draftOptions);
				} : void 0, agentPreset === void 0 ? {} : { agentPreset })).catch((reason) => {
					console.warn("new session failed:", reason);
				});
			}
			prepareDraft(binding, options) {
				if ((this.ctx.get("conversation") ?? this.draftPreparationFailed()).input.requestDraftInitialization(binding, options) === "blocked") this.draftPreparationFailed();
			}
			draftPreparationFailed() {
				const message = this.ctx.locale.bind("workspace")("draft.initializationFailed");
				this.notify({
					kind: "createFailed",
					message
				});
				throw new Error(message);
			}
			async archiveSession(sessionId, options = {}) {
				await this.workspaces.archiveSession(sessionId, options);
				if (this.mainReference?.sessionId === sessionId) this.clearMain();
			}
			async unarchiveSession(sessionId) {
				await this.workspaces.unarchiveSession(sessionId);
			}
			async pinSession(sessionId) {
				await this.workspaces.pinSession(sessionId);
				const { items, pinnedSessionIds, archivedSessionIds } = this.workspaces.list.getSnapshot();
				this.view.pinSessionOrder(sessionId, pinOrderAccounts(items, sessionId), pinOrderSource(items, this.sessions.list.getSnapshot(), {
					pinnedSessionIds,
					archivedSessionIds
				}));
			}
			async unpinSession(sessionId) {
				await this.workspaces.unpinSession(sessionId);
			}
			async pickDirectory() {
				const result = await this.directoryPicker.pick();
				if (!result.ok) throw new Error(`directory picker failed: ${result.error.message}`);
				return result.value;
			}
			async listDirectory(path, signal) {
				const result = await this.directoryPicker.list(path, signal);
				if (!result.ok) throw new DirectoryBrowseError(result.error);
				return result.value;
			}
			async createDirectory(path, name) {
				const result = await this.directoryPicker.createDirectory(path, name);
				if (!result.ok) throw new DirectoryBrowseError(result.error);
				return result.value;
			}
			watchNavigation() {
				let initial = "waiting";
				const reconcile = () => {
					if (this.lifetime.signal.aborted) return;
					if (this.clearArchivedCurrent()) return;
					if (initial !== "waiting") return;
					const workspace = this.workspaces.list.getSnapshot();
					const sessions = this.sessions.list.getSnapshot();
					if (workspace.phase !== "ready" || sessions.phase !== "ready") return;
					if (this.mainReference !== void 0) {
						initial = "done";
						return;
					}
					initial = "connecting";
					this.restoreSelection(workspace, sessions).then(() => {
						initial = "done";
					}, (reason) => {
						if (this.lifetime.signal.aborted) return;
						initial = "waiting";
						console.warn("initial Session restoration failed:", reason);
					});
				};
				const disposeWorkspaces = this.workspaces.list.subscribe(reconcile);
				const disposeSessions = this.sessions.list.subscribe(reconcile);
				reconcile();
				return () => {
					this.lifetime.abort();
					disposeSessions();
					disposeWorkspaces();
				};
			}
			async restoreSelection(workspaces, sessions) {
				const saved = this.selection.getSnapshot();
				if (saved.subagentAddress !== void 0) {
					this.replaceMain(saved.subagentAddress, this.lifetime.signal, "preserve");
					return;
				}
				const summary = saved.sessionId === void 0 ? void 0 : sessions.byId[saved.sessionId];
				const workspace = summary === void 0 ? void 0 : workspaces.items.find((item) => item.sessionIds.includes(summary.id));
				if (summary !== void 0 && (!summary.blank || workspace === void 0)) {
					this.replaceMain(summary.id, this.lifetime.signal, "preserve");
					return;
				}
				const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
				let sessionId;
				if (summary !== void 0 && workspace !== void 0 && summary.cwd === workspace.path && !workspaces.archivedSessionIds.includes(summary.id)) sessionId = await this.restoreBlank(workspace.workspaceId, summary.id);
				let target = workspace?.workspaceId ?? recentWorkspace(workspaces.items, sessions.byId);
				if (target === void 0 && workspaces.items.length === 0 && sessions.ids.length === 0) {
					const prepared = await this.initializeDefaultWorkspace(navigation);
					if (navigation.aborted) return;
					target = prepared?.workspaceId;
				}
				if (sessionId === void 0 && target !== void 0) sessionId = await this.connectWorkspace(target);
				if (sessionId !== void 0 && !navigation.aborted) this.replaceMain(sessionId, navigation, "preserve");
			}
			async initializeDefaultWorkspace(signal) {
				try {
					return await this.workspaces.initializeDefault(signal);
				} catch (_error) {
					if (!signal.aborted) this.notify({ kind: "defaultWorkspaceFailed" });
					return;
				}
			}
			/** @returns true when an archived current selection was cleared. */
			clearArchivedCurrent() {
				const current = this.mainReference?.sessionId;
				if (current === void 0 || !this.workspaces.list.getSnapshot().archivedSessionIds.includes(current)) return false;
				this.clearMain();
				return true;
			}
			clearMain() {
				const previous = this.mainReference;
				this.mainReference = void 0;
				this.selection.set({});
				previous?.release();
				this.ctx.layout.selectPanel(null);
			}
			replaceMain(target, signal, panel, beforeOpen) {
				signal.throwIfAborted();
				const reference = this.sessions.retain(target, { source: "mainView" });
				try {
					signal.throwIfAborted();
					beforeOpen?.(reference.sessionId);
					if (signal.aborted) {
						reference.release();
						return;
					}
					const subagentAddress = typeof target === "string" ? this.sessions.subagentAddress(reference.sessionId) : target;
					this.selection.set({
						sessionId: reference.sessionId,
						...subagentAddress === void 0 ? {} : { subagentAddress }
					});
				} catch (error) {
					reference.release();
					throw error;
				}
				const previous = this.mainReference;
				this.mainReference = reference;
				previous?.release();
				if (panel === "reveal") this.ctx.layout.selectPanel(null);
			}
		};
		/**
		* `error` as the Session Controller's creation failure, or undefined when it
		* is not one. Client plugin bundles do not share error-class identity, so the
		* name decides.
		*/
		function sessionCreateErrorOf(error) {
			return error instanceof Error && error.name === "SessionCreateError" ? error : void 0;
		}
		/**
		* The words a failed Session creation is reported in: a Host refusal keeps its
		* stable code and message; any other failure keeps its own message.
		*/
		function creationFailureMessage(error) {
			const refused = sessionCreateErrorOf(error);
			if (refused !== void 0) return `${refused.rpcError.code}: ${refused.rpcError.message}`;
			return error instanceof Error ? error.message : String(error);
		}
		/** Stable tie-breaking follows Host Workspace order. */
		function recentWorkspace(workspaces, sessions) {
			let selected;
			let selectedTime = Number.NEGATIVE_INFINITY;
			for (const workspace of workspaces) {
				let latest = Number.NEGATIVE_INFINITY;
				for (const sessionId of workspace.sessionIds) {
					const session = sessions[sessionId];
					if (session !== void 0) latest = Math.max(latest, session.updatedAt);
				}
				if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt);
				if (selected === void 0 || latest > selectedTime) {
					selected = workspace.workspaceId;
					selectedTime = latest;
				}
			}
			return selected;
		}
		//#endregion
		//#region node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		/**
		* The text one Workspace is labeled with. A Workspace still carrying the
		* automatic first-use title reads as the caller's localized default name; every
		* other title reads verbatim in every language. A title the user typed as
		* exactly {@link DEFAULT_WORKSPACE_DIRECTORY} is labeled as the default too;
		* nothing else depends on the distinction.
		* @param title - stored Workspace title.
		* @param localizedDefault - the default Workspace name in the active language.
		* @returns the title to display.
		*/
		function workspaceDisplayTitle(title, localizedDefault) {
			return title === "default-workspace" ? localizedDefault : title;
		}
		//#endregion
		//#region \0dsh-css:src/client/WorkspacePicker.module.css.mjs
		const css$3 = ".S_JYgq_modalAction{min-width:72px}.S_JYgq_modalError,.S_JYgq_menuStatus{margin-top:8px;font-size:12px;line-height:18px}.S_JYgq_modalError{color:var(--dsw-alias-state-error-primary)}.S_JYgq_menuStatus{color:var(--dsw-alias-label-secondary)}";
		const tagId$3 = "dsh-group-status/WorkspacePicker.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-group-status";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var WorkspacePicker_module_css_default = {
			"menuStatus": "S_JYgq_menuStatus",
			"modalAction": "S_JYgq_modalAction",
			"modalError": "S_JYgq_modalError"
		};
		//#endregion
		//#region src/client/WorkspacePicker.tsx
		const ADD_WORKSPACE = "::add-workspace";
		/**
		* Render the pick menu plus the adoption error dialog.
		* @param props - owner-controlled flow props.
		* @returns menu + dialog elements.
		*/
		function WorkspacePickFlow({ t, open, anchorRef, useWorkspaces, createWorkspace, useDirectoryFlow, renderDirectoryFlow, onPick, onClose, addOnly = false, onBusyChange, side = "bottom", selectedId }) {
			const workspaceSnapshot = useWorkspaces((state) => state);
			const workspaces = workspaceSnapshot.items;
			const getAnchorRect = (0, react.useCallback)(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
			const [errorOpen, setErrorOpen] = (0, react.useState)(false);
			const [modalError, setModalError] = (0, react.useState)(null);
			const [flowOpen, setFlowOpen] = (0, react.useState)(false);
			const [pickingFolder, setPickingFolder] = (0, react.useState)(false);
			const flowBusy = flowOpen || pickingFolder;
			(0, react.useEffect)(() => {
				onBusyChange?.(flowBusy);
			}, [flowBusy, onBusyChange]);
			const flowAvailable = useDirectoryFlow((occupied) => occupied);
			(0, react.useEffect)(() => {
				if (flowOpen && !flowAvailable) setFlowOpen(false);
			}, [flowOpen, flowAvailable]);
			const addEntries = flowAvailable ? [{
				id: ADD_WORKSPACE,
				label: t("menu.addWorkspace"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 16 }),
				disabled: flowBusy
			}] : [];
			const pinAdd = !addOnly && workspaces.length > 0;
			const items = pinAdd ? workspaces.map((workspace) => ({
				id: workspace.workspaceId,
				label: workspaceDisplayTitle(workspace.title, t("workspace.defaultName")),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, { size: 16 }),
				disabled: flowBusy
			})) : addEntries;
			const menuIsEmpty = items.length === 0;
			const closeModal = () => {
				setErrorOpen(false);
				setModalError(null);
			};
			/** Adopt a picked directory; failures land in the folder-error dialog (Choose again reopens the flow). */
			const adoptDirectory = (path) => createWorkspace({ path }).then((workspace) => {
				setFlowOpen(false);
				onPick(workspace.workspaceId);
			}).catch((reason) => {
				setModalError(reason instanceof Error ? reason.message : String(reason));
				setFlowOpen(false);
				setErrorOpen(true);
			});
			const openDirectoryFlow = (0, react.useCallback)(() => {
				onClose();
				setErrorOpen(false);
				setModalError(null);
				setFlowOpen(true);
			}, [onClose]);
			const listSettled = addOnly || workspaceSnapshot.phase === "ready";
			const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
			(0, react.useEffect)(() => {
				if (open && addIsTheOnlyEntry && !flowBusy) openDirectoryFlow();
			}, [
				open,
				addIsTheOnlyEntry,
				flowBusy,
				openDirectoryFlow
			]);
			/** Owner side of the flow conversation: adopt keeps the flow open (busy) until the Host answers. */
			const flowOwner = {
				open: flowOpen,
				busy: pickingFolder,
				onPicked: (path) => {
					setPickingFolder(true);
					adoptDirectory(path).finally(() => {
						setPickingFolder(false);
					});
				},
				onCancel: () => {
					setFlowOpen(false);
				},
				onError: (message) => {
					setFlowOpen(false);
					setModalError(message);
					setErrorOpen(true);
				}
			};
			const handleSelect = (id) => {
				if (id === ADD_WORKSPACE) {
					openDirectoryFlow();
					return;
				}
				onPick(id);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open: open && !addIsTheOnlyEntry && !menuIsEmpty,
					anchor: null,
					items,
					...pinAdd ? { footer: addEntries } : {},
					selectedId,
					onSelect: handleSelect,
					onClose,
					side,
					portal: true,
					getAnchorRect
				}),
				open && !addIsTheOnlyEntry && !menuIsEmpty && workspaceSnapshot.phase === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: WorkspacePicker_module_css_default.menuStatus,
					role: "status",
					children: t("picker.loading")
				}),
				renderDirectoryFlow(flowOwner),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: errorOpen,
					onClose: closeModal,
					closeLabel: t("close"),
					title: t("folderError.title"),
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: WorkspacePicker_module_css_default.modalAction,
						onClick: closeModal,
						children: t("cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: WorkspacePicker_module_css_default.modalAction,
						disabled: !flowAvailable,
						onClick: openDirectoryFlow,
						children: t("folderError.retry")
					})] }),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspacePicker_module_css_default.modalError,
						role: "alert",
						children: modalError
					})
				})
			] });
		}
		/**
		* The conversation empty-state registration: adapts the owner share to the
		* core flow (all state and semantics live in the flow / the owner).
		* @param props - empty-state slot props (owner share + injected creation callback).
		* @returns the flow element.
		*/
		function WorkspacePicker({ open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, useDirectoryFlow, renderSlot, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
				t,
				open,
				anchorRef,
				useWorkspaces,
				createWorkspace,
				useDirectoryFlow,
				renderDirectoryFlow: (owner) => renderSlot("conversation.hero.workspace.directoryFlow", owner),
				selectedId,
				onPick,
				onClose
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/rows/WorkspaceBrowser.module.css.mjs
		const css$2 = ".QAYkWG_root{--dsh-session-list-edge-inset:var(--dsh-sidebar-inline-padding);--dsh-session-list-scrollbar-width:5px;--dsh-session-list-scrollbar-offset:2px;box-sizing:border-box;min-height:0;padding-right:var(--dsh-session-list-edge-inset);flex-direction:column;flex:1;display:flex}.QAYkWG_root.QAYkWG_rail{padding-right:0}.QAYkWG_iconButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.QAYkWG_iconButton:focus-visible,.QAYkWG_searchButton:focus-visible,.QAYkWG_clearButton:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.QAYkWG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.QAYkWG_viewOptionsMenu{min-width:200px}.QAYkWG_sectionHeader{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:flex-end;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;display:flex;overflow:hidden}.QAYkWG_root:not(.QAYkWG_rail) .QAYkWG_sectionHeader{margin-top:2px;margin-right:-4px}.QAYkWG_sectionLabel{white-space:nowrap;opacity:1;visibility:visible;min-width:0;max-width:45%;transition:max-width .18s var(--ds-ease-in-out), margin-right .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;line-height:20px;overflow:hidden}.QAYkWG_sectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.QAYkWG_searchSlot{box-sizing:border-box;min-width:0;max-width:28px;transition:max-width .18s var(--ds-ease-in-out), padding-left .18s var(--ds-ease-in-out);flex:1;align-items:center;margin-left:auto;padding-left:0;display:flex}.QAYkWG_searchSlotExpanded{max-width:100%;padding-left:0}.QAYkWG_headerActions{opacity:1;visibility:visible;max-width:60px;transition:max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.QAYkWG_headerActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.QAYkWG_search{box-sizing:border-box;border-radius:var(--dsw-radius-sm);cursor:text;width:100%;height:28px;color:var(--dsw-alias-label-secondary);transition:width .18s var(--ds-ease-in-out), padding .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out), background-color .18s var(--ds-ease-in-out);background:0 0;border:none;flex:none;align-items:center;gap:0;margin:0;padding:0;display:flex;overflow:hidden}.QAYkWG_searchExpanded{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:calc(100% + 4px);height:30px;color:var(--dsw-alias-label-caption);background:0 0;margin-inline:-2px;padding:0 4px 0 0}.QAYkWG_searchButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:inherit;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.QAYkWG_searchExpanded .QAYkWG_searchButton{width:28px;height:30px}.QAYkWG_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.QAYkWG_searchExpanded .QAYkWG_searchButton:hover{background:0 0}.QAYkWG_searchInput{opacity:0;pointer-events:none;width:0;min-width:0;color:var(--dsw-alias-label-primary);transition:opacity .12s var(--ds-ease-in-out);background:0 0;border:none;outline:none;flex:1;font-size:13px;line-height:18px}.QAYkWG_searchExpanded .QAYkWG_searchInput{opacity:1;pointer-events:auto;margin-left:-2px}.QAYkWG_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.QAYkWG_clearButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.QAYkWG_clearButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.QAYkWG_rail .QAYkWG_sectionHeader{justify-content:flex-start;gap:0;margin-bottom:12px;padding-left:0}.QAYkWG_rail .QAYkWG_headerActions{max-width:none}.QAYkWG_rail .QAYkWG_iconButton{border-radius:var(--dsw-radius-md);width:36px;height:36px;color:var(--dsw-alias-label-primary)}.QAYkWG_rail .QAYkWG_search{border-radius:var(--dsw-radius-md);background:0 0;border-color:#0000;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.QAYkWG_rail .QAYkWG_searchButton{border-radius:var(--dsw-radius-md);width:36px;height:36px;color:var(--dsw-alias-label-primary)}.QAYkWG_rail .QAYkWG_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.QAYkWG_listArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-session-list-edge-inset));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.QAYkWG_rail .QAYkWG_listArea{margin-left:0;margin-right:0;padding-left:0}.QAYkWG_treeBody{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.QAYkWG_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}[data-platform=darwin] .QAYkWG_fade{display:none}.QAYkWG_wide{animation:QAYkWG_wide-in .2s var(--ds-ease-in-out)}@keyframes QAYkWG_wide-in{0%{opacity:0}}.QAYkWG_list{min-height:0;margin-left:-4px;margin-right:var(--dsh-session-list-scrollbar-offset);padding-left:4px;padding-right:calc(var(--dsh-session-list-edge-inset) - var(--dsh-session-list-scrollbar-width) - var(--dsh-session-list-scrollbar-offset));scrollbar-gutter:stable;flex:1;padding-bottom:16px;overflow-y:auto}.QAYkWG_flatList>*+*,.QAYkWG_searchTree>[role=treeitem]+[role=treeitem],.QAYkWG_groupSection>*+*{margin-top:2px}.QAYkWG_searchStatus{color:var(--dsw-alias-label-tertiary);padding:10px 12px;font-size:12px;line-height:18px}.QAYkWG_skeletonRow{box-sizing:border-box;align-items:flex-start;gap:8px;min-height:48px;padding:6px 8px 7px;display:flex}.QAYkWG_skeletonDot{corner-shape:round;border-radius:50%;flex:none;width:16px;height:16px}.QAYkWG_skeletonBars{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}.QAYkWG_skeletonDot,.QAYkWG_skeletonBar{background:var(--dsw-alias-bg-skeleton);animation:2s cubic-bezier(.36,0,.64,1) infinite QAYkWG_search-skeleton}.QAYkWG_skeletonBar{border-radius:var(--dsw-radius-xs);width:65%;height:16px}.QAYkWG_skeletonBarWide{width:90%;height:13px}@keyframes QAYkWG_search-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}.QAYkWG_groupSection{position:relative}.QAYkWG_groupSection+.QAYkWG_groupSection{margin-top:4px}.QAYkWG_listTopDropIndicator,.QAYkWG_workspaceDropBefore:before,.QAYkWG_workspaceDropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:0}.QAYkWG_listTopDropIndicator{top:-8px;left:0;right:var(--dsh-session-list-edge-inset)}.QAYkWG_listTopDropActive>.QAYkWG_workspaceDropBefore:first-child:before{display:none}.QAYkWG_workspaceDropBefore:before{top:-8px}.QAYkWG_workspaceDropAfter:after{bottom:-8px}.QAYkWG_sessionOverflowButton{border-radius:var(--dsw-radius-sm);width:100%;height:28px;padding:0 12px 0 calc(28px + var(--dsh-workspace-indent,0px));cursor:pointer;text-align:left;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;font-size:12px}.QAYkWG_groupSection>.QAYkWG_sessionOverflowButton{margin-top:0}.QAYkWG_sessionOverflowButton:hover{color:var(--dsw-alias-label-secondary);background:0 0}.QAYkWG_empty{color:var(--dsw-alias-label-tertiary);padding:16px 12px;font-size:13px}.QAYkWG_emptyState{color:var(--dsw-alias-label-tertiary);flex-direction:column;align-items:center;gap:8px;margin-top:80px;padding:0 12px;font-size:13px;line-height:20px;display:flex}.QAYkWG_emptyState>svg{color:var(--dsw-alias-label-caption);margin-bottom:4px}.QAYkWG_emptyAction{cursor:pointer;color:var(--dsw-alias-link);background:0 0;border:none;padding:0;font-size:13px;line-height:20px}.QAYkWG_renameInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.QAYkWG_renameInput:disabled{color:var(--dsw-alias-label-dimmed)}.QAYkWG_renameError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}.QAYkWG_deleteAction:not(:disabled){color:var(--dsw-alias-state-error-primary)}.QAYkWG_deleteStatus{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.QAYkWG_archiveActivity{color:var(--dsw-alias-label-primary);margin:0 0 8px;padding-left:18px;font-size:13px;line-height:20px}.QAYkWG_archiveActivity li{overflow-wrap:anywhere}@media (prefers-reduced-motion:reduce){.QAYkWG_wide,.QAYkWG_skeletonDot,.QAYkWG_skeletonBar{animation:none}.QAYkWG_search,.QAYkWG_sectionLabel,.QAYkWG_searchSlot,.QAYkWG_searchInput,.QAYkWG_headerActions{transition:none}}";
		const tagId$2 = "dsh-group-status/WorkspaceBrowser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-group-status";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var WorkspaceBrowser_module_css_default = {
			"archiveActivity": "QAYkWG_archiveActivity",
			"clearButton": "QAYkWG_clearButton",
			"deleteAction": "QAYkWG_deleteAction",
			"deleteStatus": "QAYkWG_deleteStatus",
			"empty": "QAYkWG_empty",
			"emptyAction": "QAYkWG_emptyAction",
			"emptyState": "QAYkWG_emptyState",
			"fade": "QAYkWG_fade",
			"flatList": "QAYkWG_flatList",
			"groupSection": "QAYkWG_groupSection",
			"headerActions": "QAYkWG_headerActions",
			"headerActionsHidden": "QAYkWG_headerActionsHidden",
			"iconButton": "QAYkWG_iconButton",
			"list": "QAYkWG_list",
			"listArea": "QAYkWG_listArea",
			"listTopDropActive": "QAYkWG_listTopDropActive",
			"listTopDropIndicator": "QAYkWG_listTopDropIndicator",
			"rail": "QAYkWG_rail",
			"renameError": "QAYkWG_renameError",
			"renameInput": "QAYkWG_renameInput",
			"root": "QAYkWG_root",
			"search": "QAYkWG_search",
			"search-skeleton": "QAYkWG_search-skeleton",
			"searchButton": "QAYkWG_searchButton",
			"searchExpanded": "QAYkWG_searchExpanded",
			"searchInput": "QAYkWG_searchInput",
			"searchSlot": "QAYkWG_searchSlot",
			"searchSlotExpanded": "QAYkWG_searchSlotExpanded",
			"searchStatus": "QAYkWG_searchStatus",
			"searchTree": "QAYkWG_searchTree",
			"sectionHeader": "QAYkWG_sectionHeader",
			"sectionLabel": "QAYkWG_sectionLabel",
			"sectionLabelHidden": "QAYkWG_sectionLabelHidden",
			"sessionOverflowButton": "QAYkWG_sessionOverflowButton",
			"skeletonBar": "QAYkWG_skeletonBar",
			"skeletonBarWide": "QAYkWG_skeletonBarWide",
			"skeletonBars": "QAYkWG_skeletonBars",
			"skeletonDot": "QAYkWG_skeletonDot",
			"skeletonRow": "QAYkWG_skeletonRow",
			"treeBody": "QAYkWG_treeBody",
			"viewOptionsMenu": "QAYkWG_viewOptionsMenu",
			"wide": "QAYkWG_wide",
			"wide-in": "QAYkWG_wide-in",
			"workspaceDropAfter": "QAYkWG_workspaceDropAfter",
			"workspaceDropBefore": "QAYkWG_workspaceDropBefore"
		};
		/** Keep controlled input and RPC payload inside the session.search wire contract. */
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= 500) return withoutNul;
			let end = 500;
			const last = withoutNul.charCodeAt(end - 1);
			const next = withoutNul.charCodeAt(end);
			if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
			return withoutNul.slice(0, end);
		}
		/**
		* Accept the native drag at document level while a row drag is active: row
		* hover still owns the insertion marker, and releasing outside the list must
		* not be rendered as a rejected drop before dragend commits that last marker.
		*/
		function useNativeDragAcceptance(active) {
			(0, react.useEffect)(() => {
				if (!active) return;
				const acceptDrag = (event) => {
					event.preventDefault();
					if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
				};
				const acceptDrop = (event) => {
					event.preventDefault();
				};
				document.addEventListener("dragover", acceptDrag);
				document.addEventListener("drop", acceptDrop);
				return () => {
					document.removeEventListener("dragover", acceptDrag);
					document.removeEventListener("drop", acceptDrop);
				};
			}, [active]);
		}
		/** Apply a visible drop to the complete account without removing hidden members. */
		function sessionDragOrder(order, rows, drag, over) {
			const source = rows.find((row) => row.id === drag.sessionId);
			const target = rows.find((row) => row.id === over.id);
			if (source === void 0 || target === void 0 || source.blank || source.pinned !== drag.pinned || target.pinned !== drag.pinned || source.id === target.id || !order.includes(source.id)) return;
			const section = rows.filter((row) => row.pinned === drag.pinned);
			const sourceIndex = section.findIndex((row) => row.id === source.id);
			if (section.filter((row) => row.id !== source.id).findIndex((row) => row.id === target.id) + (over.half === "after" ? 1 : 0) === sourceIndex) return;
			const next = order.filter((id) => id !== source.id);
			const targetIndex = next.indexOf(target.id);
			if (targetIndex === -1) return;
			next.splice(targetIndex + (over.half === "after" ? 1 : 0), 0, source.id);
			return pinCurrentBlank(next, rows.find((row) => row.blank)?.id);
		}
		/** Resolve an insertion side across the Workspace header, descendants, and Sessions. */
		function workspaceGroupHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/**
		* Session the main view currently retains, if any.
		*
		* All three list bodies and the shell need this same scan, and `Object.values`
		* allocates a fresh array each time; the call sites memoise it against the list
		* identity rather than re-scanning on every render.
		* @param list - always-mounted Session list snapshot.
		* @returns the retained Session id, or undefined when the main view holds none.
		*/
		function mainViewSessionId(list) {
			return Object.values(list.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
		}
		//#endregion
		//#region src/client/rows/ViewOptionsMenu.tsx
		/**
		* Grouping, ordering, and archived-filter menu for the section header.
		*
		* Own open state so it resets with the wide chrome; the trigger button is the
		* menu's own anchor, so the header does not thread a callback down for it.
		*/
		/** Grouping, ordering, and archived-filter menu; own open state so it resets with the wide chrome. */
		function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [
					{
						type: "label",
						id: "group-by",
						text: t("groupBy.label")
					},
					{
						id: "workspace",
						label: t("groupBy.workspace"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
					},
					{
						id: "workspace-tree",
						label: t("groupBy.workspaceTree"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWorkspaceTreeOutlineRegular, {})
					},
					{
						id: "flat",
						label: t("groupBy.flat"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFlatListOutlineRegular, {})
					},
					{
						type: "separator",
						id: "order-by-separator"
					},
					{
						type: "label",
						id: "order-by",
						text: t("orderBy.label")
					},
					{
						id: "manual",
						label: t("orderBy.manual"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronsUpDownOutlineRegular, {})
					},
					{
						id: "updated",
						label: t("orderBy.updated"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, {})
					},
					{
						type: "separator",
						id: "archived-filter-separator"
					},
					{
						type: "label",
						id: "filter-by",
						text: t("filterBy.label")
					},
					{
						id: "hide-archived",
						label: t("viewOptions.hideArchived"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOffOutlineRegular, {})
					},
					{
						id: "show-archived",
						label: t("viewOptions.showArchived"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, {})
					},
					{
						id: "only-archived",
						label: t("viewOptions.onlyArchived"),
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveCheckOutlineRegular, {})
					}
				],
				selectedIds: [
					groupBy,
					orderBy,
					{
						default: "hide-archived",
						show: "show-archived",
						only: "only-archived"
					}[archivedFilter]
				],
				onSelect: (id) => {
					if (id === "workspace" || id === "workspace-tree" || id === "flat") onGroupPick(id);
					else if (id === "manual" || id === "updated") onOrderPick(id);
					else if (id === "hide-archived") onArchivedFilterPick("default");
					else if (id === "show-archived") onArchivedFilterPick("show");
					else if (id === "only-archived") onArchivedFilterPick("only");
					setOpen(false);
				},
				align: "end",
				dense: true,
				listClassName: WorkspaceBrowser_module_css_default.viewOptionsMenu,
				portal: true,
				anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("viewOptions.label"),
					side: "bottom",
					delayMs: 500,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(WorkspaceBrowser_module_css_default.iconButton, WorkspaceBrowser_module_css_default.wide),
						"aria-label": t("viewOptions.label"),
						onClick: () => {
							setOpen((v) => !v);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSlidersTwoOutlineRegular, {})
					})
				})
			});
		}
		/**
		* Zero-valued sentinel for {@link GroupLiveStatus}.
		*
		* Used when a group has nothing to report. Kept as a frozen constant so the
		* reference is stable across renders — `Object.is` comparisons in React selectors
		* never trigger spurious re-renders on it.
		*/
		const EMPTY_LIVE_STATUS = Object.freeze({
			running: 0,
			approval: 0,
			planReview: 0,
			question: 0,
			done: 0,
			subagents: 0,
			facets: /* @__PURE__ */ new Map()
		});
		/**
		* 一份**没有任何贡献**的折果：六个计数全 0 且没有外部来源。
		*
		* 它在合并里是加法单位元，所以「加它」不该产生新对象——见 {@link mergeLiveStatus}。
		*/
		function isIdleStatus(status) {
			return status.running === 0 && status.approval === 0 && status.planReview === 0 && status.question === 0 && status.done === 0 && status.subagents === 0 && status.facets.size === 0;
		}
		/**
		* 合并两份分组折果：本插件自己的计数相加，外部状态来源**按 facet 各自合并**。
		*
		* 用于多层聚合：折叠的父文件夹要覆盖整棵子树，而子树里每一层都已各自折过一遍。
		* `FacetFold.data` 怎么合归该 facet 自己决定，本模块从不解释。
		*
		* 加法单位元走**引用原样返回**：值不变时换一个新对象，会让"同一棵空闲子树"在两轮
		* 计算之间有不同的身份。`EMPTY_LIVE_STATUS` 留在这个模块里的理由就是身份稳定（见其
		* 注释），合并这一层不该每加一次零就把那个理由作废。返回的是入参本身（不改写、不
		* 拷贝），因此与逐字段相加的结果等值。
		*/
		function mergeLiveStatus(a, b) {
			if (isIdleStatus(b)) return a;
			if (isIdleStatus(a)) return b;
			return {
				running: a.running + b.running,
				approval: a.approval + b.approval,
				planReview: a.planReview + b.planReview,
				question: a.question + b.question,
				done: a.done + b.done,
				subagents: a.subagents + b.subagents,
				facets: mergeFacets(a.facets, b.facets)
			};
		}
		/** 按 facet id 合并两侧折果；只有一侧有的来源原样带过。 */
		function mergeFacets(a, b) {
			if (a.size === 0) return b;
			if (b.size === 0) return a;
			const merged = new Map(a);
			for (const [id, entry] of b) {
				const own = merged.get(id);
				merged.set(id, own === void 0 ? entry : {
					facet: own.facet,
					fold: own.facet.merge?.(own.fold, entry.fold) ?? defaultMergeFold(own.fold, entry.fold)
				});
			}
			return merged;
		}
		/**
		* Fold every member row of a group into counts so a collapsed folder can hint at
		* hidden live sessions. Mirrors the session-row status priority (pending
		* outranks running outranks completed) at the counting level; labels resolve with
		* locale at render time.
		*
		* @param nodes - member rows of the group.
		* @param sessionIds - the same members' Session ids (facets address their own data by id).
		* @param facets - the registered status sources to fold over this group.
		* @param now - one clock reading for the whole pass, so sibling facets cannot disagree
		*   about which deadlines are still ahead.
		*/
		function summarizeGroupStatus(nodes, sessionIds, facets = [], now = Date.now()) {
			let running = 0;
			let approval = 0;
			let planReview = 0;
			let question = 0;
			let done = 0;
			let subagents = 0;
			for (const n of nodes) {
				if (n.blank || n.archived) continue;
				const hasSubagents = n.runningSubagentCount > 0;
				if (n.pendingInteraction === "approval") {
					approval += 1;
					subagents += n.runningSubagentCount;
					continue;
				}
				if (n.pendingInteraction === "plan-review") {
					planReview += 1;
					subagents += n.runningSubagentCount;
					continue;
				}
				if (n.pendingInteraction === "question") {
					question += 1;
					subagents += n.runningSubagentCount;
					continue;
				}
				if (n.running) {
					running += 1;
					subagents += n.runningSubagentCount;
					continue;
				}
				if (hasSubagents) {
					subagents += n.runningSubagentCount;
					continue;
				}
				if (n.completed) done += 1;
			}
			const folded = /* @__PURE__ */ new Map();
			for (const { facet } of facets) {
				let snapshot;
				try {
					snapshot = facet.getSnapshot();
				} catch {
					snapshot = void 0;
				}
				try {
					const result = facet.fold(snapshot, sessionIds, now);
					if (result !== void 0 && result.count > 0) folded.set(facet.id, {
						facet,
						fold: result
					});
				} catch {}
			}
			if (running === 0 && approval === 0 && planReview === 0 && question === 0 && done === 0 && subagents === 0 && folded.size === 0) return EMPTY_LIVE_STATUS;
			return {
				running,
				approval,
				planReview,
				question,
				done,
				subagents,
				facets: folded
			};
		}
		/**
		* Measure each group's own members, as the input to {@link aggregateGroupStatuses}.
		*
		* Every group is measured, expanded ones included. A folder row shows no badge while
		* it is expanded, but its sessions still need attention and a collapsed ancestor must
		* keep counting them — so expansion is a rendering fact, never an input to the
		* aggregation. Short-circuiting expanded groups to `EMPTY_LIVE_STATUS` (the shape this
		* had before the tree-wide aggregator existed, harmless while nothing aggregated) makes
		* every collapsed parent undercount by the size of its expanded descendants.
		*
		* @param groups - derived groups, each with its member rows already populated.
		* @param facets - registered sources, already filtered by the visibility settings.
		* @param now - one clock reading shared by every group in the pass.
		*/
		function directStatusesForGroups(groups, facets = [], now = Date.now()) {
			const map = /* @__PURE__ */ new Map();
			for (const group of groups) map.set(group.key, summarizeGroupStatus(group.sessions, group.sessions.map((s) => s.id), facets, now));
			return map;
		}
		/**
		* Fold every group's DIRECT status up the workspace tree, so a collapsed folder
		* counts every descendant session. A group's own row shows no badge while it is
		* expanded, but its sessions still need attention and its collapsed ancestor must
		* keep counting them — so the walk never depends on a group's expanded state.
		*
		* @param direct - each group's own-member status, keyed by group key.
		* @param childrenByParent - the rendered tree: parent key (`undefined` = roots) → children.
		* @returns aggregated status per group key: own members plus the whole subtree.
		*/
		function aggregateGroupStatuses(direct, childrenByParent) {
			const aggregated = /* @__PURE__ */ new Map();
			const visiting = /* @__PURE__ */ new Set();
			const fold = (key) => {
				const cached = aggregated.get(key);
				if (cached !== void 0) return cached;
				if (visiting.has(key)) return direct.get(key) ?? EMPTY_LIVE_STATUS;
				visiting.add(key);
				let total = direct.get(key) ?? EMPTY_LIVE_STATUS;
				for (const child of childrenByParent.get(key) ?? []) total = mergeLiveStatus(total, fold(child.key));
				visiting.delete(key);
				aggregated.set(key, total);
				return total;
			};
			for (const children of childrenByParent.values()) for (const child of children) fold(child.key);
			return aggregated;
		}
		/**
		* Attach each group's subtree-wide status, in derivation order. This is the producer
		* the sidebar renders from.
		*
		* Expanded groups carry their status too: their own row draws no badge (a decision
		* inside `groupLiveBadge`), but a collapsed ancestor still has to count them, so
		* expansion never suppresses the measurement.
		*
		* @param groups - derived rows, in the order they render.
		* @param direct - each group's own-member status, from {@link directStatusesForGroups}.
		* @param childrenByParent - the rendered tree: parent key (`undefined` = roots) → children.
		*/
		function withAggregatedStatus(groups, direct, childrenByParent) {
			const aggregated = aggregateGroupStatuses(direct, childrenByParent);
			return groups.map((group) => ({
				...group,
				liveStatus: aggregated.get(group.key) ?? EMPTY_LIVE_STATUS
			}));
		}
		/**
		* The blank row plus the first `watermark` non-blank rows, in list order.
		* @param sessions - one group's rows, whose blank placeholder(s) lead the list
		*   (`sectionMembers` puts every blank session ahead of the pinned/ordinary partitions).
		* @param watermark - highest non-blank row index that stays visible; `0` keeps only blank rows.
		*/
		function watermarkRows(sessions, watermark) {
			const rows = [];
			let count = 0;
			for (const session of sessions) {
				if (session.blank) {
					rows.push(session);
					continue;
				}
				if (count >= watermark) break;
				count += 1;
				rows.push(session);
			}
			return {
				rows,
				hiddenCount: sessions.length - rows.length
			};
		}
		/**
		* Smallest watermark that covers every non-blank row within the automatic maximum that is running, has a running
		* child, awaits the user, carries an unread completion, or is current, and the reveal target at any position.
		* @param sessions - one group's ordered Session rows.
		* @param current - Session retained by the main view, if the sidebar is the active surface.
		* @param revealSessionId - Session selected from search and required to be visible.
		* @returns the group's baseline non-blank row count.
		*/
		function requiredWatermark(sessions, current, revealSessionId) {
			let index = 0;
			let required = 0;
			for (const session of sessions) {
				if (session.blank) continue;
				index += 1;
				if (index <= 50 && (session.running || session.runningSubagentCount > 0 || session.pendingInteraction !== void 0 || session.completed || session.id === current) || session.id === revealSessionId) required = index;
			}
			return required;
		}
		/**
		* Raise each listed group's watermark to its requirement; returns `marks` itself when nothing rises.
		* @param marks - watermarks stored by the current browser tree.
		* @param required - required baselines, in group order.
		* @returns either the unchanged input or a new object containing only raised groups.
		*/
		function raiseWatermarks(marks, required) {
			let raised;
			for (const [key, watermark] of required) {
				if (watermark <= ((raised ?? marks)[key] ?? 5)) continue;
				raised ??= { ...marks };
				raised[key] = watermark;
			}
			return raised ?? marks;
		}
		//#endregion
		//#region src/client/use-registered-facets.ts
		/**
		* 把登记面读成「这一轮渲染该折哪些来源」的**唯一**一处接线。
		*
		* ## 为什么单独成文
		*
		* 这一步此前直接写在 `rows/WorkspaceBrowser.tsx` 里，两行：
		*
		* ```ts
		* useSyncExternalStore(facetsStore.subscribe, facetsStore.getVersion, …)   // 返回值丢掉
		* const facets = useMemo(() => visibleFacets(facetsStore.list(), settings), [settings])
		* ```
		*
		* 看着没问题——订阅了、也 memo 了。实际是**订阅通知只重渲染、不重算**：
		* `useSyncExternalStore` 的返回值被丢掉，`useMemo` 的依赖里就没有任何东西随登记面变化，
		* 于是那次重渲染原样拿回**上一次**的登记面。提供方在自己的 `apply` 里注册，而宿主不保证
		* `apply` 与本组件首渲染的先后：注册**晚于**首渲染时，facet 明明登记上了，却永远进不了
		* 徽标——不报错、不红测试（能渲染这条路径的那份上游 spec 在本仓库是跳过的，见
		* `vitest.config.ts` 的 `MONOREPO_ONLY_SPECS`），只能靠刷新页面碰运气。
		*
		* 版本号必须**同时**当两件事用：① 触发重渲染的信号，② memo 的依赖。这里把它收进一个
		* hook，让「只用①、丢掉②」在结构上写不出来，并且让这条接缝能被 `@testing-library/react`
		* 直接覆盖（本文件零宿主 import，宿主依赖闭包进不来）。
		*
		* ## 为什么现在不再按设置筛
		*
		* 旧版本这里会过一道 `visibleFacets(list, settings)`，按 `facet.settingKey` 查本插件的
		* 布尔开关。那意味着**本插件的配置面里写着别人家的语义**（`showScheduledInBadge` /
		* `showWaitingReviewInBadge`，连图标形状都替对方写死），与"本插件不认识任何来源"直接
		* 矛盾。现在外部来源的显隐归**来源自己**：它想被关掉就不注册 facet，登记面即所见。
		* 本插件的开关只管自己那三档会话状态（见 `badge-settings.ts`）。
		*
		* @module dsh-group-status/client/use-registered-facets
		*/
		/**
		* 当前登记的来源，按登记面顺序（已按 `order` 排好）。
		*
		* 引用在版本号不变时保持稳定：登记面是低频事件，重算成本 = O(facet × 组内会话)。
		*
		* @param store - facet 消费侧存储（`facetStore()` 单例）。
		*/
		function useRegisteredFacets(store) {
			const version = (0, react.useSyncExternalStore)(store.subscribe, store.getVersion, store.getServerVersion);
			return (0, react.useMemo)(() => [...store.list()], [version]);
		}
		//#endregion
		//#region src/client/badge-labels.ts
		/**
		* 把侧栏行的翻译位交给 facet。
		*
		* 这里有一次**故意的放宽**：协议的 `t` 收任意字符串键，而行位只收本插件 `workspace`
		* 命名空间的键。放宽是安全的——宿主 locale 服务对未注册的键一律**原样回显键名**（不是
		* 抛错），所以外来 facet 传了自己命名空间的键，最坏读出的是那串键名而不是崩渲染。
		* 要正确本地化，provider 应当闭包自己的翻译函数、忽略这里传入的 `t`。
		*/
		function asFacetTranslate(t) {
			return (key, options) => t(key, options);
		}
		/** 该 facet 贡献进徽标数字的条数。 */
		function facetCountTotal(s) {
			let total = 0;
			for (const entry of s.facets.values()) total += entry.fold.count;
			return total;
		}
		/**
		* 每个外部状态来源的那句话，按登记顺序。
		*
		* facet 没实现 `label` 时**不能**退化成 `2 dsh-later.schedule` 这种读法，所以给一句
		* 通用措辞兜底：只说有几个来源在响，具体语义等该来源自己补文案。
		*/
		function facetLines(s, t, now) {
			const translate = asFacetTranslate(t);
			const lines = [];
			for (const entry of s.facets.values()) {
				const text = entry.facet.label?.(entry.fold, {
					now,
					t: translate
				});
				lines.push(text === void 0 || text === "" ? `${entry.fold.count} ${t("status.needsAttention")}` : text);
			}
			return lines;
		}
		/**
		* Accessible label for a folded group's aggregated status, reusing the
		* session-row locale keys so both surfaces read identically.
		*
		* 按设置过滤：本插件那三档会话状态按设置逐项过滤；**外部来源不参与过滤** —— 登记了就
		* 一定出现在这里，没登记就不在折果里，所以 `aria-label` 与徽标视觉天然一致，不必在这里
		* 再判一次设置（本插件也没有替别人家存的开关）。
		*/
		function groupLiveLabel(s, t, settings, now = Date.now()) {
			const parts = [];
			if (settings.showPendingInBadge) {
				if (s.approval > 0) parts.push(`${s.approval} ${t("status.waitingApproval")}`);
				if (s.planReview > 0) parts.push(`${s.planReview} ${t("status.planReview")}`);
				if (s.question > 0) parts.push(`${s.question} ${t("status.waitingAnswer")}`);
			}
			if (settings.showRunningInBadge) {
				if (s.running > 0) parts.push(`${s.running} ${t("status.running")}`);
				if (s.subagents > 0) parts.push(t(s.subagents === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: s.subagents }));
			}
			parts.push(...facetLines(s, t, now));
			if (settings.showCompletedInBadge && s.done > 0) parts.push(`${s.done} ${t("status.completed")}`);
			return parts.join(" · ");
		}
		/**
		* 每个外部状态来源的明细行，**带它自己的图标**（#24）。
		*
		* 徽标侧画的是 provider 交出的、已含色档的元素（`rows/GroupBadge.tsx` 的 `facetGlyph`），
		* 明细侧此前只画一个统一的 `StateDot`，于是同一条状态、同一次悬停里，徽标是红色沙漏、
		* 明细是黄点——同一行的两个视图各说一套。宿主 `StateDot` 只有 warning / ongoing / done
		* 三档、没有 error 档，所以色档**只能**由来源自己的图标表达，这也是本函数存在的理由。
		*
		* provider 没交图标时退回通用点（与徽标侧同一套兜底），陌生来源仍然可见。
		*
		* @returns 明细行；`glyph` 为 `undefined` 表示该行用 `StateDot` 渲染。
		*/
		function facetDetailLines(s, t, now) {
			const translate = asFacetTranslate(t);
			const lines = [];
			for (const entry of s.facets.values()) {
				const raw = entry.facet.label?.(entry.fold, {
					now,
					t: translate
				});
				const text = raw === void 0 || raw === "" ? `${entry.fold.count} ${t("status.needsAttention")}` : raw;
				lines.push({
					state: "warning",
					text,
					glyph: facetGlyph(entry, t, now)
				});
			}
			return lines;
		}
		/**
		* Build the status detail lines for the workspace hover card.
		*
		* Extracted so `WorkspaceHoverContent` in `Rows.tsx` only needs to map the returned
		* array — the fork-specific status→line logic lives here.
		*
		* 按设置过滤：关掉的来源不出现在明细行里；`showHoverDetails=false` 时整段返回空。
		* 明细行的顺序与徽标**完全一致**（外部来源排在会话状态之后、已完成之前）：两处顺序
		* 不一样会让人怀疑它们是两套事实。
		*/
		function hoverStatusLines(status, t, settings, now = Date.now()) {
			const lines = [];
			if (status === void 0 || !settings.showHoverDetails) return lines;
			if (settings.showPendingInBadge) {
				if (status.approval > 0) lines.push({
					state: "warning",
					text: `${status.approval} ${t("status.waitingApproval")}`
				});
				if (status.planReview > 0) lines.push({
					state: "warning",
					text: `${status.planReview} ${t("status.planReview")}`
				});
				if (status.question > 0) lines.push({
					state: "warning",
					text: `${status.question} ${t("status.waitingAnswer")}`
				});
			}
			if (settings.showRunningInBadge) {
				if (status.running > 0) lines.push({
					state: "ongoing",
					text: `${status.running} ${t("status.running")}`
				});
				if (status.subagents > 0) lines.push({
					state: "ongoing",
					text: t(status.subagents === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: status.subagents })
				});
			}
			lines.push(...facetDetailLines(status, t, now));
			if (settings.showCompletedInBadge && status.done > 0) lines.push({
				state: "done",
				text: `${status.done} ${t("status.completed")}`
			});
			return lines;
		}
		/**
		* 某一条外部来源的元素该带哪只 class（#22）。
		*
		* 脉冲判据仍由各 facet 自己声明（`FacetFold.pulse`），但**作用对象必须下沉到声明它的那个
		* 元素**。此前 `groupBadgeIsUrgent()` 只返回一个整徽标的布尔值、class 加在容器上，于是同组
		* 里任何一家声明 `pulse: true` 都会让别家本该静止的图标跟着呼吸：`pulse: false` 是否生效，
		* 取决于同组里恰好有没有别人开了闪。判断交出去了，作用对象没交出去——这是修过一次的回归
		* （见下）。
		*
		* 保留这条历史的原因写在所有者那边：dsh-gitea-dispatch 把 `overdue` 画成**静止**（其
		* `lib/waiting-glyph.js`：「超时后停动画：静止即不再期待」），且它只代表 CI 窗口到期、
		* 不代表评审失败。同一条等待在行内静止、在父级闪动，就是同一事实的两种说法。
		*/
		function facetPulseClass(entry, urgentClass) {
			return entry.fold.pulse ? urgentClass : void 0;
		}
		/**
		* 一个来源的图标。
		*
		* 归 provider 画（`facet.renderIcon`）：「这个状态长什么样」是它的知识。没实现时本插件
		* 按色档退回一个通用点（见 `rows/GroupBadge.tsx`），保证陌生来源仍然可见、只是朴素。
		*/
		function facetGlyph(entry, t, now) {
			return entry.facet.renderIcon?.(entry.fold, {
				now,
				t: asFacetTranslate(t)
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/rows/Rows.module.css.mjs
		const css$1 = "._1Jb0BW_projectRow,._1Jb0BW_sessionRow{border-radius:var(--dsw-radius-md);padding:0 8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);align-items:center;gap:6px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px));display:flex}._1Jb0BW_projectRow:hover,._1Jb0BW_sessionRow:hover,._1Jb0BW_sessionRow._1Jb0BW_selected{background:var(--dsw-alias-interactive-bg-hover)}._1Jb0BW_searchResultRow{box-sizing:border-box;border-radius:var(--dsw-radius-lg);cursor:pointer;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;flex-direction:column;align-items:stretch;padding:4px 8px;display:flex}._1Jb0BW_searchResultRow:hover,._1Jb0BW_searchResultRow._1Jb0BW_selected{background:var(--dsw-alias-interactive-bg-hover)}._1Jb0BW_searchResultHeading{align-items:center;min-width:0;display:flex}._1Jb0BW_searchResultTitle{text-overflow:ellipsis;white-space:nowrap;flex:0 auto;min-width:0;margin-left:4px;font-size:14px;line-height:20px;overflow:hidden}._1Jb0BW_searchResultMeta{align-items:center;gap:6px;min-width:0;margin-left:20px;display:flex}._1Jb0BW_searchResultWorkspace,._1Jb0BW_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}._1Jb0BW_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}._1Jb0BW_searchResultWorkspace:only-child{max-width:100%}._1Jb0BW_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}._1Jb0BW_projectRow{box-sizing:border-box;align-items:center;height:34px}._1Jb0BW_projectRow ._1Jb0BW_rowActions{height:20px}._1Jb0BW_sessionRow{gap:0;height:32px}._1Jb0BW_sessionRow ._1Jb0BW_title{margin:0 6px 0 4px}._1Jb0BW_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}._1Jb0BW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}._1Jb0BW_folderActive{color:var(--dsw-alias-state-business-primary)}._1Jb0BW_projectRow ._1Jb0BW_chevron{display:none}._1Jb0BW_projectRow:hover ._1Jb0BW_chevron{display:inline-flex}._1Jb0BW_projectRow:hover ._1Jb0BW_folder{display:none}._1Jb0BW_arrow{transition:transform .15s var(--ds-ease-in-out)}._1Jb0BW_arrowOpen{transform:rotate(90deg)}._1Jb0BW_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}._1Jb0BW_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;overflow:hidden}._1Jb0BW_renameInput{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;outline:none;padding:0 2px;font-size:14px;line-height:20px}._1Jb0BW_sessionRow ._1Jb0BW_title{flex:1}._1Jb0BW_sessionRow ._1Jb0BW_title[data-scrolled]{mask-image:linear-gradient(90deg,#0000,#000 12px)}._1Jb0BW_sessionRow ._1Jb0BW_title[data-clipped]{mask-image:linear-gradient(270deg,#0000,#000 12px)}._1Jb0BW_sessionRow ._1Jb0BW_title[data-scrolled][data-clipped]{mask-image:linear-gradient(90deg,#0000,#000 12px calc(100% - 12px),#0000)}._1Jb0BW_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}._1Jb0BW_time{color:var(--dsw-alias-label-tertiary);flex:none;font-size:10px;line-height:16px}._1Jb0BW_pinIndicator{width:16px;height:20px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:center;margin-left:6px;display:inline-flex}._1Jb0BW_sessionRow._1Jb0BW_archived ._1Jb0BW_title,._1Jb0BW_searchResultRow._1Jb0BW_archived ._1Jb0BW_searchResultTitle,._1Jb0BW_searchResultRow._1Jb0BW_archived ._1Jb0BW_searchResultWorkspace,._1Jb0BW_searchResultRow._1Jb0BW_archived ._1Jb0BW_searchResultSnippet{color:var(--dsw-alias-label-caption)}._1Jb0BW_dot{flex:none}._1Jb0BW_rowActions{flex:none;align-items:center;gap:10px;display:none}._1Jb0BW_projectRow:hover ._1Jb0BW_rowActions,._1Jb0BW_sessionRow:hover ._1Jb0BW_rowActions,._1Jb0BW_searchResultRow:hover ._1Jb0BW_rowActions,._1Jb0BW_projectRow._1Jb0BW_menuOpen ._1Jb0BW_rowActions,._1Jb0BW_sessionRow._1Jb0BW_menuOpen ._1Jb0BW_rowActions{display:inline-flex}._1Jb0BW_searchResultHeading ._1Jb0BW_rowActions{margin-left:auto}._1Jb0BW_sessionRow:hover ._1Jb0BW_time,._1Jb0BW_sessionRow._1Jb0BW_menuOpen ._1Jb0BW_time,._1Jb0BW_sessionRow:hover ._1Jb0BW_pinIndicator,._1Jb0BW_sessionRow._1Jb0BW_menuOpen ._1Jb0BW_pinIndicator{display:none}@media (hover:hover){._1Jb0BW_sessionRow:hover ._1Jb0BW_title,._1Jb0BW_sessionRow._1Jb0BW_menuOpen ._1Jb0BW_title{text-overflow:clip}}._1Jb0BW_projectRow._1Jb0BW_menuOpen,._1Jb0BW_sessionRow._1Jb0BW_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}._1Jb0BW_sessionRow._1Jb0BW_dropBefore,._1Jb0BW_sessionRow._1Jb0BW_dropAfter{position:relative}._1Jb0BW_sessionRow._1Jb0BW_dropBefore:before,._1Jb0BW_sessionRow._1Jb0BW_dropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}._1Jb0BW_sessionRow._1Jb0BW_dropBefore:before{top:-7px}._1Jb0BW_sessionRow._1Jb0BW_dropAfter:after{bottom:-7px}._1Jb0BW_hoverContent{flex-direction:column;gap:8px;display:flex}._1Jb0BW_hoverTitle{color:var(--dsw-alias-label-primary);overflow-wrap:break-word;font-size:14px;line-height:20px}._1Jb0BW_hoverPath{color:var(--dsw-alias-label-secondary);word-break:break-all;font-size:12px;line-height:16px}._1Jb0BW_hoverTime{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px}._1Jb0BW_hoverStatus{color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}._1Jb0BW_groupBadge{flex:none;align-items:center;gap:3px;margin-inline-start:4px;display:inline-flex}._1Jb0BW_groupBadgeCount{color:var(--dsw-alias-label-tertiary);border:1px solid;border-radius:6px;padding:0 3px;font-size:9px;line-height:12px}@keyframes _1Jb0BW_groupBadgePulse{0%,to{opacity:1}50%{opacity:.6}}._1Jb0BW_groupBadgeUrgent{animation:2s ease-in-out infinite _1Jb0BW_groupBadgePulse}._1Jb0BW_hoverArchived svg{flex-shrink:0;margin:0 -4px}._1Jb0BW_iconButton{border-radius:var(--dsw-radius-xs);cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}._1Jb0BW_iconButton:hover{color:var(--dsw-alias-label-primary)}._1Jb0BW_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){._1Jb0BW_arrow{transition:none;animation:none}}";
		const tagId$1 = "dsh-group-status/Rows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-group-status";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var Rows_module_css_default = {
			"archived": "_1Jb0BW_archived",
			"arrow": "_1Jb0BW_arrow",
			"arrowOpen": "_1Jb0BW_arrowOpen",
			"chevron": "_1Jb0BW_chevron",
			"dot": "_1Jb0BW_dot",
			"dropAfter": "_1Jb0BW_dropAfter",
			"dropBefore": "_1Jb0BW_dropBefore",
			"folder": "_1Jb0BW_folder",
			"folderActive": "_1Jb0BW_folderActive",
			"groupBadge": "_1Jb0BW_groupBadge",
			"groupBadgeCount": "_1Jb0BW_groupBadgeCount",
			"groupBadgePulse": "_1Jb0BW_groupBadgePulse",
			"groupBadgeUrgent": "_1Jb0BW_groupBadgeUrgent",
			"hoverArchived": "_1Jb0BW_hoverArchived",
			"hoverContent": "_1Jb0BW_hoverContent",
			"hoverPath": "_1Jb0BW_hoverPath",
			"hoverStatus": "_1Jb0BW_hoverStatus",
			"hoverTime": "_1Jb0BW_hoverTime",
			"hoverTitle": "_1Jb0BW_hoverTitle",
			"iconButton": "_1Jb0BW_iconButton",
			"menuOpen": "_1Jb0BW_menuOpen",
			"meta": "_1Jb0BW_meta",
			"pinIndicator": "_1Jb0BW_pinIndicator",
			"projectRow": "_1Jb0BW_projectRow",
			"projectText": "_1Jb0BW_projectText",
			"renameInput": "_1Jb0BW_renameInput",
			"rowActions": "_1Jb0BW_rowActions",
			"searchResultHeading": "_1Jb0BW_searchResultHeading",
			"searchResultMeta": "_1Jb0BW_searchResultMeta",
			"searchResultRow": "_1Jb0BW_searchResultRow",
			"searchResultSnippet": "_1Jb0BW_searchResultSnippet",
			"searchResultTitle": "_1Jb0BW_searchResultTitle",
			"searchResultWorkspace": "_1Jb0BW_searchResultWorkspace",
			"selected": "_1Jb0BW_selected",
			"sessionRow": "_1Jb0BW_sessionRow",
			"slot": "_1Jb0BW_slot",
			"time": "_1Jb0BW_time",
			"title": "_1Jb0BW_title",
			"visuallyHidden": "_1Jb0BW_visuallyHidden"
		};
		//#endregion
		//#region src/client/rows/GroupBadge.tsx
		/**
		* Aggregated live-status badge for a folded folder row. Dots reuse StateDot so
		* colors match session rows (warning = pending, ongoing = running, done = completed).
		* Renders nothing while expanded or when nothing is pending/active/completed or any
		* status source reports a contribution.
		*
		* Count matches the dots: host-side sessions plus every registered facet's own count.
		*
		* `settings` 只过滤**本插件自己的**三档会话状态：关掉的档位不画点、不计数、不进
		* aria-label、不参与「是否显示徽标」的判断。会话行自身的状态点不受影响：那是行级状态，
		* 不是分组提示。**外部来源在这里没有开关可关** —— 它们要么注册了（一定显示），要么没
		* 注册（根本不在登记面上）。要关某个来源，去那个插件自己的设置卡片：显隐是来源的决定。
		*
		* `now` 缺省取渲染时刻（与 `WorkspaceBrowser` 为相对时间读的时钟同一姿态）：文案里的
		* 剩余时长以此计算，只在提供方 store 通知时随渲染更新。
		*/
		function groupLiveBadge(group, t, settings, now = Date.now()) {
			const s = group.liveStatus;
			if (group.expanded || s === void 0) return null;
			const pending = settings.showPendingInBadge ? s.approval + s.planReview + s.question : 0;
			const active = settings.showRunningInBadge ? s.running + s.subagents : 0;
			const completed = settings.showCompletedInBadge ? s.done : 0;
			const facetTotal = facetCountTotal(s);
			if (pending === 0 && active === 0 && completed === 0 && facetTotal === 0) return null;
			const label = groupLiveLabel(s, t, settings, now);
			const dots = [];
			if (pending > 0) dots.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: BADGE_FIELD_DOT_STATE.showPendingInBadge }, "warn"));
			if (active > 0) dots.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: BADGE_FIELD_DOT_STATE.showRunningInBadge }, "run"));
			const urgentClass = Rows_module_css_default.groupBadgeUrgent ?? "";
			for (const entry of s.facets.values()) {
				const glyph = facetGlyph(entry, t, now);
				const pulseClass = facetPulseClass(entry, urgentClass) || void 0;
				dots.push(glyph === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: entry.fold.tone === "info" ? "ongoing" : "warning" }, entry.facet.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: pulseClass,
					children: glyph
				}, entry.facet.id));
			}
			if (completed > 0) dots.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: BADGE_FIELD_DOT_STATE.showCompletedInBadge }, "done"));
			const count = pending + active + completed + facetTotal;
			const countLabel = count > 99 ? "99+" : count >= settings.countThreshold ? String(count) : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: Rows_module_css_default.groupBadge,
				role: "img",
				"aria-label": label,
				title: label,
				children: [dots, countLabel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: Rows_module_css_default.groupBadgeCount,
					children: countLabel
				})]
			});
		}
		//#endregion
		//#region src/client/rows/Rows.tsx
		/**
		* Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
		* all data and callbacks arrive via props. Hover swaps (folder->chevron,
		* time->ellipsis, action buttons) are CSS-only, and a session row's clipped
		* title marquees programmatically while the row is hovered. Workspace row
		* menus are visual-only except Rename/Delete. A Session row's "..." menu and
		* its hover buttons are the `sidebar.workspaces.session.menu.item` and
		* `sidebar.workspaces.session.row.action` lists, rendered through the
		* browser's `renderSlot` with the menu's open state as the occurrence's hook
		* context; this package's own actions are entries like any plugin's. The
		* session and workspace hover cards are suppressed while a menu is open.
		*/
		/** Row display title: blank rows show the localized New Session label. */
		function displayTitle(node, t) {
			return node.blank ? t("session.new") : node.title || t("session.untitled");
		}
		const MIN_TITLE_REVEAL_PX = 8;
		const TITLE_MARQUEE_PX_PER_MS = .03;
		/**
		* Place the title's scroll position and publish the stylesheet's fade-mask
		* hooks: `data-scrolled` while the title has left its start (left fade) and
		* `data-clipped` while text remains beyond the right edge (right fade).
		* @param title - the row's clipping title element.
		* @param left - scroll offset in CSS pixels.
		* @param range - the title's maximum scroll offset in CSS pixels.
		*/
		function placeTitle(title, left, range) {
			if (typeof title.scrollTo === "function") title.scrollTo({
				left,
				behavior: "instant"
			});
			else title.scrollLeft = left;
			if (left > 0) title.dataset.scrolled = "";
			else delete title.dataset.scrolled;
			if (left < range) title.dataset.clipped = "";
			else delete title.dataset.clipped;
		}
		/**
		* Return the title to its resting state: scrolled to the start with both fade
		* masks off, so the resting ellipsis renders at full strength.
		* @param title - the row's clipping title element.
		*/
		function restTitle(title) {
			if (typeof title.scrollTo === "function") title.scrollTo({
				left: 0,
				behavior: "instant"
			});
			else title.scrollLeft = 0;
			delete title.dataset.scrolled;
			delete title.dataset.clipped;
		}
		/**
		* Marquee a title wider than its one-line cell while its row is hovered: the
		* title clips its own text, so entering crawls it at a constant speed until the
		* far edge (a fork's incremented title, for example) is in view, then rests
		* there under the pointer. Overflow of at most {@link MIN_TITLE_REVEAL_PX}
		* stays put — a barely-clipped title moving a few pixels reads as jitter, not a
		* reveal. Leaving returns the title to the start in one step, because the
		* resting ellipsis and the narrowed cell would otherwise meet the text while it
		* travelled back. Reduced motion jumps to the far edge instead of crawling.
		* @param title - ref to the row's clipping title element.
		* @returns stable pointer enter/leave handlers for the row.
		*/
		function useTitleMarquee(title) {
			const frame = (0, react.useRef)(0);
			(0, react.useEffect)(() => () => {
				cancelAnimationFrame(frame.current);
			}, []);
			return (0, react.useMemo)(() => ({
				enter: () => {
					/* v8 ignore next -- defensive: the title span renders unconditionally. */
					if (title.current === null) return;
					const element = title.current;
					const range = element.scrollWidth - element.clientWidth;
					if (range <= MIN_TITLE_REVEAL_PX) return;
					if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
						placeTitle(element, range, range);
						return;
					}
					cancelAnimationFrame(frame.current);
					let previous;
					let position = 0;
					const step = (now) => {
						position += previous === void 0 ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
						previous = now;
						placeTitle(element, Math.min(position, range), range);
						if (position < range) frame.current = requestAnimationFrame(step);
					};
					frame.current = requestAnimationFrame(step);
				},
				leave: () => {
					cancelAnimationFrame(frame.current);
					/* v8 ignore next -- defensive: the title span renders unconditionally. */
					if (title.current === null) return;
					restTitle(title.current);
				}
			}), [title]);
		}
		/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
		function timeLabel(updatedAt, now, t) {
			const { unit, n } = (0, _deepseek_ai_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
			return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
		}
		/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
		function hoverTimeLabel(updatedAt, now, t) {
			const { unit, n } = (0, _deepseek_ai_dsh_client_ui_primitives.relativeTime)(updatedAt, now);
			return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
		}
		/**
		* Absolute creation time through the dictionary's date template (the message
		* clock pattern): `toLocaleString` would follow the browser language, not the
		* app locale, and produce mixed-language text after a switch.
		*/
		function createdLabel(createdAt, t) {
			const d = new Date(createdAt);
			const pad2 = (v) => String(v).padStart(2, "0");
			return t("hover.created", { time: `${t("date.ymd", {
				y: d.getFullYear(),
				m: d.getMonth() + 1,
				d: d.getDate()
			})} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
		}
		/** Hover-card body: workspace title, display directory path, absolute creation time. */
		function WorkspaceHoverContent({ label, cwd, createdAt, status, settings, now, t }) {
			const lines = hoverStatusLines(status, t, settings, now);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverPath,
						children: cwd
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: createdLabel(createdAt, t)
					}),
					lines.map((line) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Rows_module_css_default.hoverStatus,
						children: [line.glyph ?? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: line.state }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: line.text })]
					}, line.text))
				]
			});
		}
		/** Pointer-position half of a row (insert line above or below). */
		function rowHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/**
		* Project (workspace) header row: folder + title;
		* hover reveals the chevron and create button, and dwelling on a real
		* Workspace shows its hover card (the ungrouped bucket has none).
		* `containsCurrent` arrives on the node (derivation fact, no renderer scan).
		* @param props.group - derived group node.
		* @param props.containsCurrentDescendant - highlight an ancestor even when its subtree is collapsed.
		* @param props.onToggle - expand/collapse the group.
		* @param props.onCreate - start a frontend Session inside this Workspace.
		* @param props.drag - optional workspace-row drag wiring.
		* @param props.home - host account home for POSIX hover-path abbreviation.
		* @param props.t - the browser root's locale seat.
		* @returns the row element.
		*/
		function ProjectRowItem({ group, containsCurrentDescendant = false, onToggle, onCreate, actions, drag, home, newShortcut, settings, now, t }) {
			const row = group;
			const label = row.workspaceId === void 0 ? t("group.ungrouped") : row.label;
			const active = containsCurrentDescendant || group.expanded && group.containsCurrent;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const workspaceMenuItems = [{
				id: "rename",
				label: t("rename"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {})
			}, {
				id: "delete",
				label: t("delete.workspace"),
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, {}),
				danger: true
			}];
			const ownRow = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(Rows_module_css_default.projectRow, menuOpen && Rows_module_css_default.menuOpen),
				"data-row-key": `workspace:${group.key}`,
				role: "treeitem",
				"aria-expanded": row.expanded,
				onClick: onToggle,
				draggable: drag !== void 0,
				onDragStart: drag === void 0 ? void 0 : (e) => {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", row.key);
					drag.start();
				},
				onDragEnd: drag?.end,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.folder, active && Rows_module_css_default.folderActive),
						children: row.expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.chevron),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFillRegular, { className: clsx(Rows_module_css_default.arrow, row.expanded && Rows_module_css_default.arrowOpen) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.projectText,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.title,
							children: label
						})
					}),
					groupLiveBadge(group, t, settings, now),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: Rows_module_css_default.rowActions,
						children: [actions !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: workspaceMenuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								/* v8 ignore next -- Menu can emit only the rename and delete rows supplied above. */
								if (id !== "rename" && id !== "delete") return;
								if (id === "rename") actions.rename();
								else actions.delete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Rows_module_css_default.iconButton,
								"aria-label": t("actions.workspace.aria", { name: label }),
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("actions.newSession"),
							shortcutKeys: newShortcut?.keys,
							side: "bottom",
							align: "end",
							delayMs: 500,
							portal: true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Rows_module_css_default.iconButton,
								"aria-keyshortcuts": newShortcut?.aria,
								"aria-label": t("actions.newSession.aria", { name: label }),
								onClick: (e) => {
									e.stopPropagation();
									onCreate();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutlineRegular, {})
							})
						})]
					})
				]
			});
			if (row.createdAt === void 0) return ownRow;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: ownRow,
				content: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceHoverContent, {
					label: row.label,
					cwd: row.cwd === void 0 ? void 0 : abbreviateHomePath(row.cwd, home),
					createdAt: row.createdAt,
					status: row.expanded ? void 0 : row.liveStatus,
					settings,
					now: now ?? Date.now(),
					t
				}),
				openDelayMs: 800,
				grouped: true,
				disabled: menuOpen,
				copyText: row.cwd,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
		function assertNever(value) {
			throw new Error(`unknown pending interaction: ${String(value)}`);
		}
		/**
		* Session status presentation; pending interaction is primary and live activity
		* outranks completion reminders.
		*/
		function sessionStatuses(node, t) {
			const subagents = node.runningSubagentCount === 0 ? void 0 : {
				state: "ongoing",
				label: t(node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: node.runningSubagentCount })
			};
			let pending;
			switch (node.pendingInteraction) {
				case "approval":
					pending = {
						state: "warning",
						label: t("status.waitingApproval"),
						trailingLabel: t("status.compact.approval")
					};
					break;
				case "plan-review":
					pending = {
						state: "warning",
						label: t("status.planReview"),
						trailingLabel: t("status.compact.planReview")
					};
					break;
				case "question":
					pending = {
						state: "warning",
						label: t("status.waitingAnswer"),
						trailingLabel: t("status.compact.answer")
					};
					break;
				case void 0: break;
				/* v8 ignore next -- closed PendingInteractionStatus union */
				default: return assertNever(node.pendingInteraction);
			}
			if (pending !== void 0) return subagents === void 0 ? [pending] : [pending, subagents];
			if (node.running) {
				const primary = {
					state: "ongoing",
					label: t("status.running")
				};
				return subagents === void 0 ? [primary] : [primary, subagents];
			}
			if (subagents !== void 0) return [subagents];
			if (node.completed) return [{
				state: "done",
				label: t("status.completed")
			}];
			return [{
				state: "idle",
				label: t("status.idle")
			}];
		}
		/** Primary status dot plus every status's screen-reader label, shared by the search and session rows. */
		function SessionStatusDots({ statuses }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statuses[0].state }), statuses.map((status) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Rows_module_css_default.visuallyHidden,
				children: status.label
			}, status.label))] });
		}
		/** Non-interactive pinned-row marker; the enclosing row remains the only action. */
		function PinnedIndicator({ t }) {
			const label = t("row.pinned");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Rows_module_css_default.pinIndicator,
				role: "img",
				"aria-label": label,
				title: label,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 })
			});
		}
		/**
		* Hover-card body: full title, relative time, the Session's own scheduled-task
		* section, and every relevant live status. The task section sits above the
		* status lines so they stay the card's trailing status line.
		*/
		function SessionHoverContent({ node, now, renderSlot, t }) {
			const statuses = sessionStatuses(node, t).filter((status) => !(node.archived && (status.state === "done" || status.state === "idle")));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: displayTitle(node, t)
					}),
					!node.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: hoverTimeLabel(node.updatedAt, now, t)
					}),
					renderSlot("sidebar.session.row.hover", { sessionId: node.id }),
					statuses.map((status) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Rows_module_css_default.hoverStatus,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: status.state }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: status.label })]
					}, status.label)),
					node.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: clsx(Rows_module_css_default.hoverStatus, Rows_module_css_default.hoverArchived),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("row.archived") })]
					})
				]
			});
		}
		/**
		* One flat search result: title, Workspace context, and optional content
		* excerpt. Search navigation opens the session only; it does not address an
		* event inside the conversation. Archived rows carry a hover unarchive
		* button, because search is where the filter surfaces them for recovery.
		* @param props.result - merged local/content search row.
		* @param props.currentId - selected session id.
		* @param props.onOpen - open the selected session.
		* @param props.onUnarchive - unarchive an archived result row.
		* @param props.t - Workspace-browser translation seat.
		* @returns the result row.
		*/
		function SearchResultItem({ result, currentId, onOpen, onUnarchive, t }) {
			const selected = result.id === currentId;
			const statuses = sessionStatuses(result, t);
			const primaryStatus = statuses[0];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(Rows_module_css_default.searchResultRow, selected && Rows_module_css_default.selected, result.archived && Rows_module_css_default.archived),
				role: "treeitem",
				"aria-selected": selected,
				"aria-description": result.archived ? t("toast.archivedNotOpenable") : void 0,
				onClick: () => {
					onOpen(result.id);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultHeading,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.slot,
							children: !result.archived && primaryStatus.state !== "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.searchResultTitle,
							children: result.title || t("session.untitled")
						}),
						result.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.rowActions,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("actions.unarchive"),
								side: "bottom",
								align: "end",
								delayMs: 500,
								portal: true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Rows_module_css_default.iconButton,
									"aria-label": t("menu.unarchiveSession"),
									onClick: (e) => {
										e.stopPropagation();
										onUnarchive(result.id);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 })
								})
							})
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultMeta,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultWorkspace,
						children: result.workspace || t("group.ungrouped")
					}), result.snippet !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultSnippet,
						children: result.snippet
					})]
				})]
			});
		}
		/**
		* One top-level 32px session row: leading 16px cell (status dot, or the
		* leading seat while the row's primary state is idle), title, relative time or
		* compact pending label, and the row actions menu. A row that owns a state dot
		* keeps that cell and renders no seat, so an ambient automation mark never
		* appears beside the row's own state dot. An archived row keeps the cell blank:
		* neither marker renders there, and its live status stays on the hover card.
		* @param props.node - derived session node.
		* @param props.currentId - selected session id (row highlight).
		* @param props.now - epoch ms for relative-time formatting.
		* @param props.onOpen - open a session by id.
		* @param props.onRenameRequest - open the rename dialog from a title double-click (id + current title).
		* @param props.renderSlot - child-seat renderer for the row's action lists
		* (`sidebar.workspaces.session.menu.item` / `sidebar.workspaces.session.row.action`),
		* its leading decoration, and its hover-card section.
		* @param props.onReveal - scroll this row into view after search navigation, then acknowledge it.
		* @param props.drag - optional row-drag target wiring; blank rows cannot start a drag.
		* @param props.t - the browser root's locale seat.
		* @returns the session row.
		*/
		function SessionNodeItem({ node, currentId, now, onOpen, onRenameRequest, renderSlot, onReveal, drag, t }) {
			const row = node;
			const title = displayTitle(node, t);
			const selected = node.id === currentId;
			const statuses = sessionStatuses(node, t);
			const primaryStatus = statuses[0];
			const showStatus = primaryStatus.state !== "idle";
			const draggable = drag !== void 0 && !row.blank && !row.archived;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const menuOpenState = (0, react.useMemo)(() => [menuOpen, setMenuOpen], [menuOpen]);
			const rowRef = (0, react.useRef)(null);
			const titleRef = (0, react.useRef)(null);
			const marquee = useTitleMarquee(titleRef);
			(0, react.useEffect)(() => {
				if (onReveal === void 0) return;
				rowRef.current?.scrollIntoView({ block: "nearest" });
				onReveal();
			}, [onReveal]);
			const ownRow = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rowRef,
				"data-row-key": `session:${node.id}`,
				className: clsx(Rows_module_css_default.sessionRow, selected && Rows_module_css_default.selected, menuOpen && Rows_module_css_default.menuOpen, row.archived && Rows_module_css_default.archived, drag?.marker === "before" && Rows_module_css_default.dropBefore, drag?.marker === "after" && Rows_module_css_default.dropAfter),
				role: "treeitem",
				"aria-selected": selected,
				"aria-description": row.archived ? t("toast.archivedNotOpenable") : void 0,
				onClick: () => {
					onOpen(node.id);
				},
				onPointerEnter: marquee.enter,
				onPointerLeave: marquee.leave,
				draggable,
				onDragStart: !draggable ? void 0 : (e) => {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", node.id);
					drag.start();
				},
				onDragEnd: !draggable ? void 0 : drag.end,
				onDragOver: drag === void 0 ? void 0 : (e) => {
					if (!drag.active) return;
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					drag.hover(rowHalf(e));
				},
				onDrop: drag === void 0 ? void 0 : (e) => {
					if (!drag.active) return;
					e.preventDefault();
					drag.drop(rowHalf(e));
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.slot,
						children: !row.archived && !row.blank && (showStatus ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses }) : renderSlot("sidebar.session.row.leading", { sessionId: node.id }))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						ref: titleRef,
						className: Rows_module_css_default.title,
						onDoubleClick: row.blank ? void 0 : (e) => {
							e.stopPropagation();
							onRenameRequest(node.id, row.title);
						},
						children: title
					}),
					!row.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.time,
						"aria-hidden": primaryStatus.trailingLabel === void 0 ? void 0 : true,
						children: primaryStatus.trailingLabel ?? timeLabel(row.updatedAt, now, t)
					}),
					row.pinned && !row.archived && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PinnedIndicator, { t }),
					!row.blank && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: Rows_module_css_default.rowActions,
						onClick: (e) => {
							e.stopPropagation();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Rows_module_css_default.iconButton,
								"aria-label": t("actions.session.aria", { name: title }),
								onClick: () => {
									setMenuOpen((v) => !v);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineRegular, {})
							}),
							children: renderSlot("sidebar.workspaces.session.menu.item", {
								sessionId: node.id,
								displayTitle: row.title
							}, { hookContext: menuOpenState })
						}), renderSlot("sidebar.workspaces.session.row.action", {
							sessionId: node.id,
							displayTitle: row.title
						})]
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: ownRow,
				content: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionHoverContent, {
					node,
					now,
					renderSlot,
					t
				}),
				openDelayMs: 800,
				grouped: true,
				disabled: menuOpen || drag?.active === true,
				copyText: row.blank || row.title === "" ? void 0 : row.title,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/rows/AnimatedRows.module.css.mjs
		const css = "._8TnAsq_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}";
		const tagId = "dsh-group-status/AnimatedRows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-group-status";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AnimatedRows_module_css_default = { "exits": "_8TnAsq_exits" };
		//#endregion
		//#region src/client/rows/AnimatedRows.tsx
		/** React-commit-driven movement and entry/exit fades for the sidebar's keyed rows. */
		const ROW_FADE_MS = 100;
		const ROW_GLIDE_MS = 200;
		function sameRows(previous, next) {
			return previous.rowKeys.length === next.rowKeys.length && previous.rowKeys.every((key, index) => key === next.rowKeys[index]);
		}
		function intersects(row, viewport) {
			return row.bottom > viewport.top && row.top < viewport.bottom && row.right > viewport.left && row.left < viewport.right;
		}
		/**
		* Animates keyed sidebar rows only when their rendered membership or order changes.
		* Motion starts after the first pointer or keyboard input inside the mounted list.
		* The parent supplies a positioned container for the inert exit overlay.
		*/
		var AnimatedRows = class extends react.Component {
			armed = false;
			list = (0, react.createRef)();
			overlay = (0, react.createRef)();
			movements = /* @__PURE__ */ new Map();
			exits = /* @__PURE__ */ new Map();
			getSnapshotBeforeUpdate(previous) {
				const list = this.list.current;
				if (!this.armed || sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey || !previous.ready || !this.props.ready || list === null || typeof list.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
				const viewport = list.getBoundingClientRect();
				const positions = this.readPositions();
				const nextKeys = new Set(this.props.rowKeys);
				const removed = /* @__PURE__ */ new Map();
				for (const [key, row] of positions) {
					if (nextKeys.has(key) || !intersects(row.rect, viewport)) continue;
					const clone = row.element.cloneNode(true);
					clone.removeAttribute("data-row-key");
					clone.inert = true;
					clone.style.setProperty("--dsh-workspace-indent", getComputedStyle(row.element).getPropertyValue("--dsh-workspace-indent"));
					removed.set(key, {
						...row,
						element: clone
					});
				}
				return {
					positions,
					removed
				};
			}
			componentDidUpdate(previous, _state, snapshot) {
				if (snapshot === null) {
					if (!sameRows(previous, this.props) || previous.resetKey !== this.props.resetKey || previous.ready !== this.props.ready) this.clear();
					return;
				}
				this.cancelMovements();
				const list = this.list.current;
				const overlay = this.overlay.current;
				const viewport = list.getBoundingClientRect();
				const origin = overlay.getBoundingClientRect();
				const positions = this.readPositions();
				for (const [key, row] of positions) {
					this.removeExit(key);
					const previousRow = snapshot.positions.get(key);
					if (!intersects(row.rect, viewport) && (previousRow === void 0 || !intersects(previousRow.rect, viewport))) continue;
					if (previousRow === void 0) {
						this.move(row.element, [{ opacity: 0 }, { opacity: 1 }], ROW_FADE_MS);
						continue;
					}
					const dx = previousRow.rect.left - row.rect.left;
					const dy = previousRow.rect.top - row.rect.top;
					if (dx === 0 && dy === 0 && previousRow.opacity === 1) continue;
					this.move(row.element, [{
						transform: `translate(${String(dx)}px, ${String(dy)}px)`,
						opacity: previousRow.opacity
					}, {
						transform: "translate(0, 0)",
						opacity: 1
					}], ROW_GLIDE_MS);
				}
				for (const [key, row] of snapshot.removed) {
					const { element } = row;
					this.removeExit(key);
					Object.assign(element.style, {
						position: "absolute",
						margin: "0",
						transform: "none",
						boxSizing: "border-box",
						left: `${String(row.rect.left - origin.left)}px`,
						top: `${String(row.rect.top - origin.top)}px`,
						width: `${String(row.rect.width)}px`,
						height: `${String(row.rect.height)}px`
					});
					overlay.append(element);
					const animation = element.animate([{ opacity: row.opacity }, { opacity: 0 }], {
						duration: ROW_FADE_MS,
						easing: "ease-out",
						fill: "forwards"
					});
					this.exits.set(key, {
						element,
						animation
					});
					animation.onfinish = () => {
						this.removeExit(key);
					};
				}
			}
			componentWillUnmount() {
				this.clear();
			}
			readPositions() {
				const rows = this.list.current.querySelectorAll("[data-row-key]");
				return new Map(Array.from(rows, (element) => [element.dataset.rowKey, {
					element,
					rect: element.getBoundingClientRect(),
					opacity: this.movements.has(element) ? Number(getComputedStyle(element).opacity) : 1
				}]));
			}
			move(element, keyframes, duration) {
				const animation = element.animate(keyframes, {
					duration,
					easing: "ease-out"
				});
				this.movements.set(element, animation);
				animation.onfinish = () => {
					this.movements.delete(element);
					animation.cancel();
				};
			}
			cancelMovements() {
				for (const animation of this.movements.values()) {
					animation.onfinish = null;
					animation.cancel();
				}
				this.movements.clear();
			}
			removeExit(key) {
				const exit = this.exits.get(key);
				if (exit === void 0) return;
				exit.animation.onfinish = null;
				exit.animation.cancel();
				exit.element.remove();
				this.exits.delete(key);
			}
			clear() {
				this.cancelMovements();
				for (const key of this.exits.keys()) this.removeExit(key);
			}
			render() {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: this.list,
					className: this.props.className,
					role: "tree",
					"aria-label": this.props.label,
					onPointerDownCapture: () => {
						this.armed = true;
					},
					onKeyDownCapture: () => {
						this.armed = true;
					},
					children: this.props.children
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: this.overlay,
					className: AnimatedRows_module_css_default.exits,
					"aria-hidden": "true"
				})] });
			}
		};
		//#endregion
		//#region src/client/rows/EmptySessions.tsx
		/** The list-empty placeholder shared by the tree, flat, and search list bodies. */
		/** The list-empty placeholder — a glyph over the text; the archived-only view names its filter and offers the way back. */
		function EmptySessions({ rowState, onLeaveArchivedOnly, t }) {
			const archivedOnly = rowState.archivedFilter === "only";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: WorkspaceBrowser_module_css_default.emptyState,
				"data-row-key": "empty",
				children: [
					archivedOnly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 24 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQueueOutlineRegular, { size: 24 }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: archivedOnly ? t("empty.noneArchived") : t("empty.none") }),
					archivedOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: WorkspaceBrowser_module_css_default.emptyAction,
						onClick: onLeaveArchivedOnly,
						children: t("empty.viewOthers")
					})
				]
			});
		}
		//#endregion
		//#region src/client/rows/SessionTree.tsx
		/**
		* The scrolling session tree: Workspace groups, aggregated live-status badges,
		* watermarks, and row drag ordering.
		*
		* Split out of `WorkspaceBrowser.tsx` so the shell keeps only the header, search
		* box, and dialogs; this file owns the tree body and its local row limits, and
		* unmounting it drops both the sessions subscription and those limits.
		*/
		const facetsStore = facetStore();
		/** The scrolling session tree; unmounting drops the sessions subscription and local row limits. */
		function SessionTree({ list, useSessionStatus, startSession, open, workspaces, ungroupedSessionIds, rowState, onLeaveArchivedOnly, workspaceReady, animationResetKey, usePanelInfo, onRenameRequest, onDeleteRequest, onSessionRenameRequest, renderSlot, insertWorkspaceBefore, nestWorkspaces, groupExpansion, setGroupExpanded, setSessionOrder, home, t, revealSessionId, onSessionRevealed, shortcuts, useBadgeSettings }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const badgeSettings = useBadgeSettings((settings) => settings);
			const statuses = useSessionStatus((s) => s);
			const facets = useRegisteredFacets(facetsStore);
			const mainViewId = (0, react.useMemo)(() => mainViewSessionId(list), [list]);
			const current = panelActive ? void 0 : mainViewId;
			const revealGroup = revealSessionId === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, revealSessionId);
			const [storedWatermarks, setStoredWatermarks] = (0, react.useState)({});
			const [watermarkMotionKey, setWatermarkMotionKey] = (0, react.useState)(0);
			const [drag, setDrag] = (0, react.useState)(null);
			const sessionDropCommitted = (0, react.useRef)(false);
			const [workspaceDrag, setWorkspaceDrag] = (0, react.useState)(null);
			const workspaceDropCommitted = (0, react.useRef)(false);
			const nativeDragActive = drag !== null || workspaceDrag !== null;
			useNativeDragAcceptance(nativeDragActive);
			const currentGroup = current === void 0 || !workspaceReady ? void 0 : owningGroupKey(workspaces, current);
			(0, react.useEffect)(() => {
				if (current === void 0 || currentGroup === void 0 || Object.hasOwn(groupExpansion, currentGroup)) return;
				setGroupExpanded(currentGroup, true);
			}, [
				current,
				currentGroup,
				setGroupExpanded,
				groupExpansion
			]);
			const parents = (0, react.useMemo)(() => {
				if (!nestWorkspaces) return /* @__PURE__ */ new Map();
				const keysByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace.workspaceId]));
				const paths = [...keysByPath.keys()];
				return new Map(workspaces.map((workspace) => {
					const path = owningParentFolder(workspace.path, paths);
					return [workspace.workspaceId, path === void 0 ? void 0 : keysByPath.get(path)];
				}));
			}, [nestWorkspaces, workspaces]);
			const currentAncestors = (0, react.useMemo)(() => {
				const keys = /* @__PURE__ */ new Set();
				for (let key = currentGroup === void 0 ? void 0 : parents.get(currentGroup); key !== void 0; key = parents.get(key)) keys.add(key);
				return keys;
			}, [currentGroup, parents]);
			const expandedGroups = (0, react.useMemo)(() => {
				const ancestorKeys = new Set(parents.values());
				return [...workspaces.map((workspace) => workspace.workspaceId), ""].filter((key) => groupExpansion[key] ?? ancestorKeys.has(key));
			}, [
				groupExpansion,
				parents,
				workspaces
			]);
			const groups = (0, react.useMemo)(() => deriveGroups(list, workspaces, rowState, statuses, {
				expandedGroups,
				ungroupedOrder: ungroupedSessionIds
			}), [
				list,
				workspaces,
				rowState,
				statuses,
				expandedGroups,
				ungroupedSessionIds
			]);
			(0, react.useEffect)(() => {
				for (let key = revealGroup; key !== void 0; key = parents.get(key)) if (groupExpansion[key] === false || key === revealGroup && groupExpansion[key] !== true) setGroupExpanded(key, true);
			}, [
				groupExpansion,
				parents,
				revealGroup,
				setGroupExpanded
			]);
			const baselines = new Map(groups.map((group) => [group.key, Math.max(5, requiredWatermark(group.expanded ? group.sessions : [], current, group.key === revealGroup ? revealSessionId : void 0))]));
			const foldedKeys = new Set(groups.filter((group) => !group.expanded).map((group) => group.key));
			const underFoldedAncestor = (key) => {
				for (let owner = parents.get(key); owner !== void 0; owner = parents.get(owner)) if (foldedKeys.has(owner)) return true;
				return false;
			};
			const requiredWatermarks = new Map([...baselines].filter(([key]) => !underFoldedAncestor(key)));
			const sessionWatermarks = raiseWatermarks(storedWatermarks, requiredWatermarks);
			if (sessionWatermarks !== storedWatermarks) setStoredWatermarks((marks) => raiseWatermarks(marks, requiredWatermarks));
			const dropWatermarks = (drop) => {
				if (!Object.keys(storedWatermarks).some(drop)) return;
				setStoredWatermarks((marks) => Object.fromEntries(Object.entries(marks).filter(([key]) => !drop(key))));
				setWatermarkMotionKey((key) => key + 1);
			};
			const withinGroup = (key, root) => {
				for (let owner = key; owner !== void 0; owner = parents.get(owner)) if (owner === root) return true;
				return false;
			};
			const now = Date.now();
			const commitSessionDrag = (activeDrag, over) => {
				if (sessionDropCommitted.current) return;
				sessionDropCommitted.current = true;
				setDrag(null);
				const group = groups.find((candidate) => candidate.key === activeDrag.accountKey);
				if (group === void 0) return;
				if (over.id === activeDrag.sessionId) return;
				const accountSessionIds = activeDrag.accountKey === "" ? ungroupedSessionIds : workspaces.find((workspace) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
				if (accountSessionIds === void 0) return;
				const renderedSessions = watermarkRows(group.sessions, sessionWatermarks[group.key] ?? 5).rows;
				const nextOrder = sessionDragOrder(accountSessionIds, renderedSessions, activeDrag, over);
				if (nextOrder !== void 0) setSessionOrder(activeDrag.accountKey, nextOrder);
			};
			const commitWorkspaceDrag = (activeDrag, over) => {
				if (workspaceDropCommitted.current) return;
				workspaceDropCommitted.current = true;
				setWorkspaceDrag(null);
				const owner = parents.get(activeDrag.workspaceId);
				const siblings = workspaces.filter((workspace) => parents.get(workspace.workspaceId) === owner);
				const rowIndex = siblings.findIndex((workspace) => workspace.workspaceId === over.id);
				if (rowIndex === -1) return;
				const anchor = over.half === "before" ? over.id : siblings[rowIndex + 1]?.workspaceId;
				if (anchor === activeDrag.workspaceId) return;
				const sourceIndex = siblings.findIndex((workspace) => workspace.workspaceId === activeDrag.workspaceId);
				const anchorIndex = anchor === void 0 ? siblings.length : siblings.findIndex((workspace) => workspace.workspaceId === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
					console.warn("workspace reorder rejected:", reason);
				});
			};
			const childrenByParentForAggregation = (0, react.useMemo)(() => {
				const rendered = new Set(groups.map((group) => group.key));
				const children = /* @__PURE__ */ new Map();
				for (const group of groups) {
					let parent = parents.get(group.key);
					while (parent !== void 0 && !rendered.has(parent)) parent = parents.get(parent);
					const siblings = children.get(parent);
					if (siblings === void 0) children.set(parent, [group]);
					else siblings.push(group);
				}
				return children;
			}, [groups, parents]);
			const directStatusByGroup = (0, react.useMemo)(() => directStatusesForGroups(groups, facets, now), [groups, facets]);
			const groupsWithAggregatedStatus = (0, react.useMemo)(() => withAggregatedStatus(groups, directStatusByGroup, childrenByParentForAggregation), [
				groups,
				directStatusByGroup,
				childrenByParentForAggregation
			]);
			const childrenByParent = (0, react.useMemo)(() => {
				const rendered = new Set(groupsWithAggregatedStatus.map((group) => group.key));
				const children = /* @__PURE__ */ new Map();
				for (const group of groupsWithAggregatedStatus) {
					let parent = parents.get(group.key);
					while (parent !== void 0 && !rendered.has(parent)) parent = parents.get(parent);
					const siblings = children.get(parent);
					if (siblings === void 0) children.set(parent, [group]);
					else siblings.push(group);
				}
				return children;
			}, [groupsWithAggregatedStatus, parents]);
			const rootGroups = childrenByParent.get(void 0) ?? [];
			const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== void 0 && workspaceDrag?.over?.id === rootGroups[0].workspaceId && workspaceDrag.over.half === "before";
			const rowKeys = groupsWithAggregatedStatus.length === 0 ? ["empty"] : [];
			const renderGroup = (group, depth) => {
				const workspaceId = group.workspaceId;
				const children = childrenByParent.get(group.key) ?? [];
				const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
				const watermark = sessionWatermarks[group.key] ?? 5;
				const collapsed = watermarkRows(group.sessions, baselines.get(group.key) ?? 5);
				const visible = watermarkRows(group.sessions, watermark);
				const sessionsExpanded = visible.hiddenCount === 0;
				rowKeys.push(`workspace:${group.key}`);
				const childRows = group.expanded ? children.map((child) => renderGroup(child, depth + 1)) : [];
				const sessions = visible.rows;
				for (const node of sessions) rowKeys.push(`session:${node.id}`);
				if (collapsed.hiddenCount > 0) rowKeys.push(`overflow:${group.key}`);
				const workspaceMarker = workspaceId !== void 0 && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
				const workspaceDragProps = workspaceId === void 0 ? void 0 : {
					start: () => {
						workspaceDropCommitted.current = false;
						setWorkspaceDrag({
							workspaceId,
							over: null
						});
					},
					end: () => {
						if (workspaceDrag?.over !== null && workspaceDrag?.over !== void 0) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
						else setWorkspaceDrag(null);
						workspaceDropCommitted.current = false;
					}
				};
				const hoverWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
					setWorkspaceDrag((active) => active === null ? active : {
						...active,
						over: {
							id: workspaceId,
							half
						}
					});
				};
				const dropWorkspace = workspaceId === void 0 || !compatibleDrag ? void 0 : (half) => {
					commitWorkspaceDrag(workspaceDrag, {
						id: workspaceId,
						half
					});
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: { "--dsh-workspace-indent": `${depth * 12}px` },
					className: clsx(WorkspaceBrowser_module_css_default.groupSection, workspaceMarker === "before" && WorkspaceBrowser_module_css_default.workspaceDropBefore, workspaceMarker === "after" && WorkspaceBrowser_module_css_default.workspaceDropAfter),
					onDragOver: workspaceDrag === null ? void 0 : (e) => {
						e.preventDefault();
						if (hoverWorkspace === void 0 && parents.get(group.key) !== void 0) return;
						e.stopPropagation();
						if (hoverWorkspace === void 0) {
							e.dataTransfer.dropEffect = "none";
							if (workspaceDrag.over !== null) setWorkspaceDrag({
								...workspaceDrag,
								over: null
							});
						} else {
							e.dataTransfer.dropEffect = "move";
							hoverWorkspace(workspaceGroupHalf(e));
						}
					},
					onDrop: workspaceDrag === null ? void 0 : (e) => {
						e.preventDefault();
						if (dropWorkspace === void 0 && parents.get(group.key) !== void 0) return;
						e.stopPropagation();
						if (dropWorkspace === void 0) {
							workspaceDropCommitted.current = true;
							setWorkspaceDrag(null);
						} else dropWorkspace(workspaceGroupHalf(e));
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectRowItem, {
							newShortcut: shortcuts.find((row) => row.id === "session.new"),
							group,
							containsCurrentDescendant: currentAncestors.has(group.key),
							home,
							settings: badgeSettings,
							now,
							t,
							onToggle: () => {
								if (group.expanded) dropWatermarks((key) => withinGroup(key, group.key));
								setGroupExpanded(group.key, !group.expanded);
							},
							onCreate: () => {
								if (group.workspaceId !== void 0) {
									setGroupExpanded(group.key, true);
									startSession(group.workspaceId);
								}
							},
							drag: workspaceDragProps,
							actions: group.workspaceId === void 0 ? void 0 : {
								rename: () => {
									/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
									if (group.workspaceId !== void 0) onRenameRequest(group.workspaceId, group.label);
								},
								delete: () => {
									/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
									if (group.workspaceId !== void 0) onDeleteRequest(group.workspaceId, group.label);
								}
							}
						}),
						childRows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							children: childRows
						}),
						group.expanded && sessions.map((node) => {
							const sameGroupDrag = drag !== null && drag.accountKey === group.key;
							const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
							const normalizeHalf = (half) => node.blank ? "after" : half;
							const dragProps = {
								start: () => {
									sessionDropCommitted.current = false;
									setDrag({
										accountKey: group.key,
										sessionId: node.id,
										pinned: node.pinned,
										over: null
									});
								},
								active: compatibleTarget,
								marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									/* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
									setDrag((d) => d === null ? d : {
										...d,
										over: {
											id: node.id,
											half: normalizeHalf(half)
										}
									});
								},
								drop: (half) => {
									/* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
									if (drag === null) return;
									commitSessionDrag(drag, {
										id: node.id,
										half: normalizeHalf(half)
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitSessionDrag(drag, drag.over);
									else setDrag(null);
									sessionDropCommitted.current = false;
								}
							};
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionNodeItem, {
								node,
								currentId: current,
								now,
								onOpen: open,
								onRenameRequest: onSessionRenameRequest,
								renderSlot,
								onReveal: node.id === revealSessionId && group.key === revealGroup ? () => {
									onSessionRevealed(node.id);
								} : void 0,
								drag: dragProps,
								t
							}, node.id);
						}),
						group.expanded && collapsed.hiddenCount > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: WorkspaceBrowser_module_css_default.sessionOverflowButton,
							"data-row-key": `overflow:${group.key}`,
							"aria-expanded": sessionsExpanded,
							onClick: () => {
								if (sessionsExpanded) {
									dropWatermarks((key) => key === group.key);
									return;
								}
								setStoredWatermarks((marks) => ({
									...marks,
									[group.key]: visible.hiddenCount <= 5 ? Infinity : watermark + 5
								}));
								setWatermarkMotionKey((key) => key + 1);
							},
							children: sessionsExpanded ? t("sessions.collapse") : t("sessions.expand", { n: visible.hiddenCount })
						})
					]
				}, group.key);
			};
			const groupRows = rootGroups.map((group) => renderGroup(group, 0));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.HoverCardGroup, {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [
					workspaceDropAtListStart && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: WorkspaceBrowser_module_css_default.listTopDropIndicator,
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AnimatedRows, {
						className: clsx(WorkspaceBrowser_module_css_default.list, workspaceDropAtListStart && WorkspaceBrowser_module_css_default.listTopDropActive),
						label: t("section.sessions"),
						rowKeys,
						ready: list.phase === "ready" && workspaceReady && !nativeDragActive,
						resetKey: JSON.stringify([animationResetKey, watermarkMotionKey]),
						children: [groupsWithAggregatedStatus.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptySessions, {
							rowState,
							onLeaveArchivedOnly,
							t
						}), groupRows]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })
				]
			});
		}
		//#endregion
		//#region src/client/rows/ListView.tsx
		/** The two wide-only list bodies: the flat single-list view and the search results view. */
		/** The flat "In one list" body: every session is one draggable top-level row. */
		function FlatList({ list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, open, onSessionRenameRequest, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, t }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const statuses = useSessionStatus((s) => s);
			const rows = (0, react.useMemo)(() => deriveFlat(list, sessionIds, rowState, statuses), [
				list,
				sessionIds,
				rowState,
				statuses
			]);
			const [drag, setDrag] = (0, react.useState)(null);
			const dropCommitted = (0, react.useRef)(false);
			useNativeDragAcceptance(drag !== null);
			const mainViewId = (0, react.useMemo)(() => mainViewSessionId(list), [list]);
			const currentId = panelActive ? void 0 : mainViewId;
			const commitDrag = (activeDrag, over) => {
				if (dropCommitted.current) return;
				dropCommitted.current = true;
				setDrag(null);
				const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
				if (nextOrder !== void 0) setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
			};
			const now = Date.now();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.HoverCardGroup, {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(AnimatedRows, {
					className: clsx(WorkspaceBrowser_module_css_default.list, WorkspaceBrowser_module_css_default.flatList),
					label: t("section.sessions"),
					rowKeys: rows.length === 0 ? ["empty"] : rows.map((row) => `session:${row.id}`),
					ready: list.phase === "ready" && workspaceReady && drag === null,
					resetKey: animationResetKey,
					children: [rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EmptySessions, {
						rowState,
						onLeaveArchivedOnly,
						t
					}), rows.map((node) => {
						const active = drag !== null && drag.pinned === node.pinned;
						const normalizeHalf = (half) => node.blank ? "after" : half;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionNodeItem, {
							node,
							currentId,
							now,
							onOpen: open,
							onRenameRequest: onSessionRenameRequest,
							renderSlot,
							onReveal: node.id === revealSessionId ? () => {
								onSessionRevealed(node.id);
							} : void 0,
							drag: {
								start: () => {
									dropCommitted.current = false;
									setDrag({
										accountKey: FLAT_SESSION_ORDER_KEY,
										sessionId: node.id,
										pinned: node.pinned,
										over: null
									});
								},
								active,
								marker: active && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									setDrag((current) => current === null ? current : {
										...current,
										over: {
											id: node.id,
											half: normalizeHalf(half)
										}
									});
								},
								drop: (half) => {
									if (drag !== null) commitDrag(drag, {
										id: node.id,
										half: normalizeHalf(half)
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitDrag(drag, drag.over);
									else setDrag(null);
									dropCommitted.current = false;
								}
							},
							t
						}, node.id);
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/** Flat search body: local metadata matches plus the current Host result page. */
		function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t }) {
			const panelActive = usePanelInfo((info) => info.activePanelId !== null);
			const list = useSessions((s) => s);
			const statuses = useSessionStatus((s) => s);
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const results = (0, react.useMemo)(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [
				list,
				workspaces,
				query,
				archivedSessionIds,
				archivedFilter,
				statuses,
				currentRemote,
				resultLimit
			]);
			const pending = currentRemote.status === "loading";
			const mainViewId = (0, react.useMemo)(() => mainViewSessionId(list), [list]);
			const currentId = panelActive ? void 0 : mainViewId;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: WorkspaceBrowser_module_css_default.list,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchTree,
							role: "tree",
							"aria-label": t("search.results.aria"),
							"aria-busy": pending,
							children: results.items.map((result) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchResultItem, {
								result,
								currentId,
								onOpen: open,
								onUnarchive,
								t
							}, result.id))
						}),
						pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "status",
							"aria-label": t("search.pending"),
							children: (results.items.length === 0 ? [0, 1] : [0]).map((i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: WorkspaceBrowser_module_css_default.skeletonRow,
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.skeletonDot }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: WorkspaceBrowser_module_css_default.skeletonBars,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.skeletonBar }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: clsx(WorkspaceBrowser_module_css_default.skeletonBar, WorkspaceBrowser_module_css_default.skeletonBarWide) })]
								})]
							}, i))
						}),
						!pending && results.items.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							role: "status",
							children: t("search.noMatches")
						}),
						results.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							role: "status",
							children: t("search.hasMore", { n: resultLimit })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		//#endregion
		//#region src/client/rows/WorkspaceBrowser.tsx
		/**
		* The workspace/session browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + view options + add
		* workspace), search, the grouped tree or flat list, and the workspace
		* dialogs. Wide state renders the full browser; rail state renders the two
		* region icons (search / add workspace) as 36px controls on the shell's shared
		* rail entry path, each requesting expansion through the owner share. Adding
		* is the header button's one action, so it raises the directory flow with no
		* menu in between; the flow and its error dialog live in WorkspacePicker
		* (same package — direct composition, no slot between them). A Session row's
		* "..." menu and hover buttons are the `sidebar.workspaces.session.menu.item`
		* and `sidebar.workspaces.session.row.action` lists rendered through this
		* entry's `renderSlot`; the actions in them, this package's own included,
		* are slot entries with their own behavior, so this component threads no
		* action callbacks and hosts no action surface.
		*/
		function WorkspaceBrowser({ wide, usePanelInfo, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession, open, requestSessionRename, notifyArchivedNotOpenable, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, unarchiveSession, createWorkspace, searchSessions, searchResultLimit, useDirectoryFlow, useHostInfo, useShortcuts, useWorkspaceShortcuts, useBadgeSettings, requestSearch, requestAddWorkspace, closeAddWorkspace, setDirectoryBusy, renderSlot, t }) {
			const home = useHostInfo((info) => info.home);
			const shortcuts = useShortcuts((rows) => rows);
			const searchShortcut = shortcuts.find((row) => row.id === "session.search");
			const addShortcut = shortcuts.find((row) => row.id === "workspace.add");
			const shortcutState = useWorkspaceShortcuts((state) => state);
			const list = useSessions((state) => state);
			const storedWorkspaces = useWorkspaces((state) => state.items);
			const defaultWorkspaceName = t("workspace.defaultName");
			const workspaces = (0, react.useMemo)(() => storedWorkspaces.map((workspace) => ({
				...workspace,
				title: workspaceDisplayTitle(workspace.title, defaultWorkspaceName)
			})), [storedWorkspaces, defaultWorkspaceName]);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const workspaceStreamState = useWorkspaces((state) => state.state);
			const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
			const pinnedSessionIds = useWorkspaces((state) => state.pinnedSessionIds);
			const directoryFlowAvailable = useDirectoryFlow((occupied) => occupied);
			const groupBy = useStore((s) => s.groupBy);
			const orderBy = useStore((s) => s.orderBy);
			const archivedFilter = useStore((s) => s.archivedFilter ?? "default");
			const groupExpansion = useStore((s) => s.groupExpansion);
			const sessionOrderByAccount = useStore((s) => s.sessionOrderByAccount);
			const guardedOpen = (sessionId) => {
				if (archivedSessionIds.includes(sessionId)) {
					notifyArchivedNotOpenable();
					return;
				}
				open(sessionId);
			};
			const leaveArchivedOnly = () => {
				actions.setArchivedFilter("default");
			};
			const workspaceReady = workspacePhase === "ready" && workspaceStreamState !== "loading";
			const mainSessionId = (0, react.useMemo)(() => mainViewSessionId(list), [list]);
			const currentBlank = mainSessionId !== void 0 && list.byId[mainSessionId]?.blank === true ? mainSessionId : void 0;
			const ungroupedMemberIds = (0, react.useMemo)(() => {
				const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
				return list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id));
			}, [list, workspaces]);
			const orderState = (0, react.useMemo)(() => ({
				pinnedSessionIds,
				archivedSessionIds
			}), [archivedSessionIds, pinnedSessionIds]);
			const rowState = (0, react.useMemo)(() => ({
				...orderState,
				archivedFilter
			}), [orderState, archivedFilter]);
			const flatMemberIds = (0, react.useMemo)(() => sessionMemberIds(list), [list]);
			const orderedWorkspaces = (0, react.useMemo)(() => workspaces.map((workspace) => {
				const memberIds = workspace.sessionIds;
				const baseOrder = orderBy === "updated" ? orderByRecency(memberIds, list.byId) : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
				return {
					...workspace,
					sessionIds: pinCurrentBlank(baseOrder, currentBlank !== void 0 && memberIds.includes(currentBlank) ? currentBlank : void 0)
				};
			}), [
				currentBlank,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount,
				workspaces
			]);
			const orderedUngroupedSessionIds = (0, react.useMemo)(() => {
				return pinCurrentBlank(orderBy === "updated" ? orderByRecency(ungroupedMemberIds, list.byId) : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[""], list.byId, orderState), currentBlank !== void 0 && ungroupedMemberIds.includes(currentBlank) ? currentBlank : void 0);
			}, [
				currentBlank,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount,
				ungroupedMemberIds
			]);
			const orderedFlatSessionIds = (0, react.useMemo)(() => {
				return pinCurrentBlank(orderBy === "updated" ? orderByRecency(flatMemberIds, list.byId) : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState), currentBlank !== void 0 && flatMemberIds.includes(currentBlank) ? currentBlank : void 0);
			}, [
				currentBlank,
				flatMemberIds,
				list.byId,
				orderBy,
				orderState,
				sessionOrderByAccount
			]);
			const activeSessionOrders = (0, react.useMemo)(() => Object.fromEntries([
				...orderedWorkspaces.map((workspace) => [workspace.workspaceId, workspace.sessionIds]),
				["", orderedUngroupedSessionIds],
				[FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds]
			]), [
				orderedFlatSessionIds,
				orderedUngroupedSessionIds,
				orderedWorkspaces
			]);
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainAccountKeys([
					"",
					FLAT_SESSION_ORDER_KEY,
					...workspaces.map((workspace) => workspace.workspaceId)
				]);
			}, [
				actions.retainAccountKeys,
				workspacePhase,
				workspaces
			]);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready" || workspaceReady || orderBy !== "manual" || currentBlank === void 0) return;
				const changed = {};
				for (const [key, ids] of Object.entries(activeSessionOrders)) {
					if (key !== "__flat_session_order__" && workspacePhase !== "ready") continue;
					const saved = sessionOrderByAccount[key] ?? [];
					if (ids[0] !== currentBlank || saved[0] === currentBlank) continue;
					changed[key] = [currentBlank, ...saved.filter((id) => id !== currentBlank)];
				}
				if (Object.keys(changed).length > 0) actions.syncSessionOrders(changed);
			}, [
				actions.syncSessionOrders,
				activeSessionOrders,
				currentBlank,
				list.phase,
				orderBy,
				sessionOrderByAccount,
				workspacePhase,
				workspaceReady
			]);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready" || !workspaceReady || orderBy !== "manual" || currentBlank === void 0) return;
				if (Object.entries(activeSessionOrders).some(([key, ids]) => ids[0] === currentBlank && sessionOrderByAccount[key]?.[0] !== currentBlank)) actions.syncSessionOrders(activeSessionOrders);
			}, [
				actions.syncSessionOrders,
				activeSessionOrders,
				currentBlank,
				list.phase,
				orderBy,
				sessionOrderByAccount,
				workspaceReady
			]);
			const saveSessionOrder = (accountKey, order) => {
				actions.setSessionOrder(accountKey, order, activeSessionOrders);
			};
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const [revealSessionId, setRevealSessionId] = (0, react.useState)(void 0);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchRoot = (0, react.useRef)(null);
			const searchInput = (0, react.useRef)(null);
			const wsPickerOpen = shortcutState.addRequested;
			const wsPlusRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			const openSearchResult = (sessionId) => {
				if (archivedSessionIds.includes(sessionId)) {
					notifyArchivedNotOpenable();
					return;
				}
				setRevealSessionId(sessionId);
				setQuery("");
				setSearchExpanded(false);
				open(sessionId);
			};
			const acknowledgeSessionReveal = (sessionId) => {
				setRevealSessionId((current) => current === sessionId ? void 0 : current);
			};
			(0, react.useEffect)(() => {
				if (normalizedQuery !== "") setRevealSessionId(void 0);
			}, [normalizedQuery]);
			const [searchOnExpand, setSearchOnExpand] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (wide && searchOnExpand) {
					const timer = window.setTimeout(() => {
						searchInput.current?.focus({ preventScroll: true });
						setSearchOnExpand(false);
					}, 300);
					return () => {
						window.clearTimeout(timer);
					};
				}
			}, [wide, searchOnExpand]);
			(0, react.useEffect)(() => {
				if (shortcutState.searchRequest === 0) return;
				closeAddWorkspace();
				setSearchExpanded(true);
				if (!wide) {
					setSearchOnExpand(true);
					expandSidebar();
				} else searchInput.current?.focus({ preventScroll: true });
			}, [shortcutState.searchRequest]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded || searchOnExpand) return;
				searchInput.current?.focus({ preventScroll: true });
			}, [
				wide,
				searchExpanded,
				searchOnExpand
			]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded || searchOnExpand) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded,
				searchOnExpand
			]);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, 250);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && workspaces.some((w) => w.workspaceId !== renameTarget.workspaceId && w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.storedTitle || renameDuplicate;
			const closeRename = () => {
				if (renaming) return;
				setRenameTarget(null);
				setRenameError(null);
			};
			const confirmRename = () => {
				if (renameBlocked) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionUnarchive = (sessionId) => {
				unarchiveSession(sessionId).catch((reason) => {
					console.warn("session unarchive rejected:", reason);
				});
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteCommittedId, setDeleteCommittedId] = (0, react.useState)(null);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (deleteCommittedId === null || workspaces.some((workspace) => workspace.workspaceId === deleteCommittedId)) return;
				setDeleting(false);
				setDeleteCommittedId(null);
				setDeleteTarget(null);
			}, [deleteCommittedId, workspaces]);
			const closeDelete = () => {
				if (deleting) return;
				setDeleteTarget(null);
				setDeleteError(null);
			};
			const confirmDelete = () => {
				/* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteCommittedId(null);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleteCommittedId(deleteTarget.workspaceId);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.root, !wide && WorkspaceBrowser_module_css_default.rail),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspaceBrowser_module_css_default.sectionHeader,
						children: [
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: clsx(WorkspaceBrowser_module_css_default.sectionLabel, WorkspaceBrowser_module_css_default.wide, searchExpanded && WorkspaceBrowser_module_css_default.sectionLabelHidden),
								children: groupBy === "flat" ? t("section.sessions") : t("section.workspaces")
							}),
							wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.searchSlot, searchExpanded && WorkspaceBrowser_module_css_default.searchSlotExpanded),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									ref: searchRoot,
									className: clsx(WorkspaceBrowser_module_css_default.search, searchExpanded && WorkspaceBrowser_module_css_default.searchExpanded),
									onClick: () => {
										closeAddWorkspace();
										setSearchExpanded(true);
										searchInput.current?.focus();
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("search"),
											shortcutKeys: searchShortcut?.keys,
											side: "bottom",
											delayMs: 500,
											disabled: searchExpanded,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: WorkspaceBrowser_module_css_default.searchButton,
												"aria-label": t("search.sessions.aria"),
												"aria-keyshortcuts": searchShortcut?.aria,
												"aria-expanded": searchExpanded,
												onClick: () => {
													requestSearch();
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 })
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											ref: searchInput,
											className: WorkspaceBrowser_module_css_default.searchInput,
											type: "text",
											placeholder: t("search.placeholder"),
											maxLength: 500,
											value: query,
											tabIndex: searchExpanded ? 0 : -1,
											onChange: (e) => {
												setQuery(sanitizeSearchQuery(e.target.value));
											},
											onKeyDown: (e) => {
												if (e.key !== "Escape") return;
												setQuery("");
												setSearchExpanded(false);
											}
										}),
										searchExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: WorkspaceBrowser_module_css_default.clearButton,
											"aria-label": t("search.clear"),
											onClick: (e) => {
												e.stopPropagation();
												setQuery("");
												setSearchExpanded(false);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, {})
										})
									]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.headerActions, wide && searchExpanded && WorkspaceBrowser_module_css_default.headerActionsHidden),
								children: [wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewOptionsMenu, {
									groupBy,
									orderBy,
									archivedFilter,
									onGroupPick: actions.setGroupBy,
									onOrderPick: (mode) => {
										actions.setOrderBy(mode, activeSessionOrders);
									},
									onArchivedFilterPick: actions.setArchivedFilter,
									t
								}), directoryFlowAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("workspace.add"),
									shortcutKeys: addShortcut?.keys,
									side: "bottom",
									delayMs: 500,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										ref: wsPlusRef,
										type: "button",
										className: WorkspaceBrowser_module_css_default.iconButton,
										"aria-label": t("workspace.add"),
										"aria-keyshortcuts": addShortcut?.aria,
										onClick: () => {
											requestAddWorkspace();
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconProjectAddOutlineRegular, { size: wide ? 16 : 18 })
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
								t,
								open: wsPickerOpen,
								anchorRef: wsPlusRef,
								useWorkspaces,
								createWorkspace,
								useDirectoryFlow,
								renderDirectoryFlow: (owner) => renderSlot("sidebar.workspaces.directoryFlow", owner),
								addOnly: true,
								onBusyChange: setDirectoryBusy,
								side: "right",
								onPick: (workspaceId) => {
									closeAddWorkspace();
									startSession(workspaceId, { clearPreviousDraft: false });
								},
								onClose: () => {
									closeAddWorkspace();
								}
							})
						]
					}),
					!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.search,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							shortcutKeys: searchShortcut?.keys,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: WorkspaceBrowser_module_css_default.searchButton,
								"aria-label": t("search.sessions.aria"),
								"aria-keyshortcuts": searchShortcut?.aria,
								onClick: () => {
									requestSearch();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 18 })
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.listArea,
						children: wide && (normalizedQuery !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchResults, {
							usePanelInfo,
							useSessions,
							useSessionStatus,
							open: openSearchResult,
							onUnarchive: onSessionUnarchive,
							workspaces,
							archivedSessionIds,
							archivedFilter,
							query: normalizedQuery,
							remote: remoteSearch,
							resultLimit: searchResultLimit,
							t
						}) : groupBy === "flat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FlatList, {
							usePanelInfo,
							list,
							sessionIds: orderedFlatSessionIds,
							rowState,
							onLeaveArchivedOnly: leaveArchivedOnly,
							workspaceReady,
							animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`,
							useSessionStatus,
							open: guardedOpen,
							onSessionRenameRequest: requestSessionRename,
							renderSlot,
							setSessionOrder: saveSessionOrder,
							revealSessionId,
							onSessionRevealed: acknowledgeSessionReveal,
							t
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionTree, {
							usePanelInfo,
							useBadgeSettings,
							list,
							shortcuts,
							useSessionStatus,
							onSessionRenameRequest: requestSessionRename,
							renderSlot,
							workspaces: orderedWorkspaces,
							ungroupedSessionIds: orderedUngroupedSessionIds,
							workspaceReady,
							nestWorkspaces: groupBy === "workspace-tree",
							animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`,
							groupExpansion,
							setGroupExpanded: actions.setGroupExpanded,
							setSessionOrder: saveSessionOrder,
							rowState,
							onLeaveArchivedOnly: leaveArchivedOnly,
							startSession,
							open: guardedOpen,
							insertWorkspaceBefore,
							revealSessionId,
							onSessionRevealed: acknowledgeSessionReveal,
							home,
							t,
							onRenameRequest: (workspaceId, displayTitle) => {
								setRenameTarget({
									workspaceId,
									storedTitle: storedWorkspaces.find((w) => w.workspaceId === workspaceId)?.title ?? displayTitle
								});
								setRenameDraft(displayTitle);
								setRenameError(null);
							},
							onDeleteRequest: (workspaceId, title) => {
								setDeleteTarget({
									workspaceId,
									title
								});
								setDeleteError(null);
							}
						}))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: closeRename,
						closeLabel: t("close"),
						title: t("rename.workspace.title"),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: renaming,
							onClick: closeRename,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("rename")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: WorkspaceBrowser_module_css_default.renameInput,
								value: renameDraft,
								"aria-label": t("field.workspaceName"),
								"data-modal-autofocus": true,
								disabled: renaming,
								onFocus: (e) => {
									e.target.select();
								},
								onChange: (e) => {
									setRenameDraft(e.target.value);
									setRenameError(null);
								},
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								},
								onKeyDown: (e) => {
									if (e.key === "Enter" && !composingRef.current) {
										e.preventDefault();
										confirmRename();
									}
								}
							}),
							renameDuplicate && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: t("conflict.named", { name: renameTrimmed })
							}),
							renameError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: renameError
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: closeDelete,
						closeLabel: t("close"),
						title: t("delete.workspace"),
						...deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) },
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: WorkspaceBrowser_module_css_default.deleteAction,
							disabled: deleting,
							onClick: confirmDelete,
							children: t("delete.workspace")
						})] }),
						children: [deleting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.deleteStatus,
							role: "status",
							children: t("delete.pending")
						}), deleteError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: deleteError
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/session-actions/ArchiveSession.tsx
		/**
		* The archive action: a `sidebar.workspaces.session.menu.item` row and a
		* `sidebar.workspaces.session.row.action` button over one injected behavior,
		* plus the `shell.overlay` dialog that confirms stopping a Session's running
		* work before archiving it. The same entries restore an archived row; the
		* notice a successful archive raises and the diagnostics for Host rejections
		* live in the injected callbacks, not here.
		*/
		/**
		* Menu row (order 400): archive, or restore an archived row.
		* @param props - owner share, the archive share, and the menu open state.
		* @returns the row.
		*/
		function ArchiveSessionMenuItem({ sessionId, useArchived, useMenuOpenState, useShortcuts, archiveSession, unarchiveSession, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			const shortcut = useShortcuts((rows) => rows.find((row) => row.id === "session.archive"));
			const archived = useArchived((set) => set.has(sessionId));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				shortcut: archived ? void 0 : shortcut,
				icon: archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }),
				onSelect: () => {
					setMenuOpen(false);
					(archived ? unarchiveSession : archiveSession)(sessionId);
				},
				children: t(archived ? "menu.unarchiveSession" : "menu.archiveSession")
			});
		}
		/**
		* Hover button (order 100): archive, or restore an archived row.
		* @param props - owner share and the archive share.
		* @returns the button.
		*/
		function ArchiveSessionRowButton({ sessionId, useArchived, archiveSession, unarchiveSession, t }) {
			const archived = useArchived((set) => set.has(sessionId));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t(archived ? "actions.unarchive" : "actions.archive"),
				side: "bottom",
				align: "end",
				delayMs: 500,
				portal: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: Rows_module_css_default.iconButton,
					"aria-label": t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
					onClick: () => {
						(archived ? unarchiveSession : archiveSession)(sessionId);
					},
					children: archived ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 })
				})
			});
		}
		/**
		* The `shell.overlay` entry: nothing while no confirmation is pending,
		* otherwise one dialog per request (keyed by the Session). Confirming asks
		* the Host to stop the listed work and archive; cancelling leaves the
		* Session running and visible.
		* @param props - the request hook, its settlement, the stop-and-archive hop, and the locale seat.
		* @returns the open dialog, or null.
		*/
		function SessionArchiveConfirmDialog({ useArchiveRequest, settleSessionArchive, stopAndArchiveSession, t }) {
			const request = useArchiveRequest((pending) => pending);
			if (request === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArchiveConfirmForm, {
				request,
				stopAndArchiveSession,
				onSettle: settleSessionArchive,
				t
			}, request.sessionId);
		}
		/** One request's dialog: in-flight and error state die with it. */
		function ArchiveConfirmForm({ request, stopAndArchiveSession, onSettle, t }) {
			const [archiving, setArchiving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const close = () => {
				if (archiving) return;
				onSettle();
			};
			const confirm = () => {
				setArchiving(true);
				setError(null);
				stopAndArchiveSession(request.sessionId).then(() => {
					setArchiving(false);
					onSettle();
				}).catch((reason) => {
					setArchiving(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("close"),
				title: t("archive.confirm.title"),
				description: t("archive.confirm.desc", { title: request.displayTitle }),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: archiving,
					onClick: close,
					children: t("cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					className: WorkspaceBrowser_module_css_default.deleteAction,
					disabled: archiving,
					onClick: confirm,
					children: t("archive.confirm.action")
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: WorkspaceBrowser_module_css_default.archiveActivity,
						"aria-label": t("archive.confirm.activity"),
						children: request.activity.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: activityLine(entry, t) }, `${entry.kind}-${String(index)}`))
					}),
					archiving && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.deleteStatus,
						role: "status",
						children: t("archive.confirm.pending")
					}),
					error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.renameError,
						role: "alert",
						children: error
					})
				]
			});
		}
		/**
		* One family's line: its count and the items' labels (ids when a family
		* carries no label). A family this dictionary does not know — a provider
		* merged into the kind map — falls through to the generic line.
		*/
		function activityLine(entry, t) {
			const items = entry.items ?? [];
			const n = items.length;
			const names = items.map((item) => item.label ?? item.id).join(t("archive.confirm.listSeparator"));
			const plural = n === 1 ? "one" : "other";
			switch (entry.kind) {
				case "turn": return t("archive.confirm.turn");
				case "subagent": return t(`archive.confirm.subagents.${plural}`, {
					n,
					names
				});
				case "job": return t(`archive.confirm.jobs.${plural}`, {
					n,
					names
				});
				case "schedule": return t(`archive.confirm.schedules.${plural}`, {
					n,
					names
				});
				default: return t(`archive.confirm.other.${plural}`, {
					kind: entry.kind,
					n
				});
			}
		}
		//#endregion
		//#region src/client/session-actions/derived.ts
		/**
		* "还没投影过"的标记。
		*
		* 不能用 `undefined` 兼任：投影**合法地**可能返回 `undefined`（"当前没有待处理的
		* 请求"就是一次正常的空结果），把它当成"未计算"会让每次读都重跑一次 `project`。
		* 投影若新建 `Set` / 数组，消费者每次读都拿到新引用，选择器于是永远不收敛——这正是
		* 本函数要避免的那件事。Symbol 不与任何投影结果相等，且只在本模块内存在。
		*/
		const NOT_PROJECTED = Symbol("derive.notProjected");
		/**
		* Project one observable into another, recomputing only when the source
		* snapshot changes identity, so consumers that select from the projection
		* (a Set lookup per row) never rebuild it per read.
		* @param source - the observable to project.
		* @param project - pure projection of one source snapshot.
		* @returns the projected observable, subscribing through the source.
		*/
		function derive(source, project) {
			let seen;
			let value = NOT_PROJECTED;
			return {
				getSnapshot: () => {
					const snapshot = source.getSnapshot();
					if (value === NOT_PROJECTED || snapshot !== seen) {
						seen = snapshot;
						value = project(snapshot);
					}
					return value;
				},
				subscribe: (listener) => source.subscribe(listener)
			};
		}
		//#endregion
		//#region src/client/session-actions/ForkSession.tsx
		/** The fork action: one `sidebar.workspaces.session.menu.item` row. */
		/**
		* Menu row (order 300): fork at the Session's last completed turn; the child
		* arrives through the Host list beside its source. Absent when the access
		* snapshot excludes `session/fork` for this Session.
		* @param props - owner share, menu open state, access Hook, and the fork share.
		* @returns the row, or nothing when the caller may not fork this Session.
		*/
		function ForkSessionMenuItem({ sessionId, useMenuOpenState, useShortcuts, useSessionAccess, forkSession, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			const shortcut = useShortcuts((rows) => rows.find((row) => row.id === "session.fork"));
			if (!useSessionAccess(sessionId, "session/fork")) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				shortcut,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					forkSession(sessionId);
				},
				children: t("menu.fork")
			});
		}
		//#endregion
		//#region src/client/session-actions/PinSession.tsx
		/**
		* The pin action: a `sidebar.workspaces.session.menu.item` row and a
		* `sidebar.workspaces.session.row.action` button over one injected behavior.
		* Pin and archive are mutually exclusive on the Host, so the action reads both
		* sets and does not offer itself on an archived row; what a pin does beyond
		* the Host call (fronting the Session in its saved orders, the failure
		* notice) lives in the injected callbacks, not here.
		*/
		/** The row's pin and archive membership, one Set lookup each. */
		function usePinState({ sessionId, usePinned, useArchived }) {
			return {
				pinned: usePinned((pinned) => pinned.has(sessionId)),
				archived: useArchived((archived) => archived.has(sessionId))
			};
		}
		/**
		* Menu row (order 100): pin or unpin by the row's current state; absent on archived rows.
		* @param props - owner share, the pin share, and the menu open state.
		* @returns the row, or null for an archived Session.
		*/
		function PinSessionMenuItem(props) {
			const { sessionId, useMenuOpenState, pinSession, unpinSession, t } = props;
			const [, setMenuOpen] = useMenuOpenState();
			const { pinned, archived } = usePinState(props);
			if (archived) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				icon: pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					(pinned ? unpinSession : pinSession)(sessionId);
				},
				children: t(pinned ? "menu.unpinSession" : "menu.pinSession")
			});
		}
		/**
		* Hover button (order 200, rightmost: it lands where the rest-state pin marker sits); absent on archived rows.
		* @param props - owner share and the pin share.
		* @returns the button, or null for an archived Session.
		*/
		function PinSessionRowButton(props) {
			const { sessionId, pinSession, unpinSession, t } = props;
			const { pinned, archived } = usePinState(props);
			if (archived) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t(pinned ? "actions.unpin" : "actions.pin"),
				side: "bottom",
				align: "end",
				delayMs: 500,
				portal: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: Rows_module_css_default.iconButton,
					"aria-label": t(pinned ? "menu.unpinSession" : "menu.pinSession"),
					onClick: () => {
						(pinned ? unpinSession : pinSession)(sessionId);
					},
					children: pinned ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 14 })
				})
			});
		}
		//#endregion
		//#region src/client/session-actions/RenameSession.tsx
		/**
		* The rename action: a `sidebar.workspaces.session.menu.item` row that raises
		* the rename request, and the `shell.overlay` dialog entry that answers it.
		* The dialog lives outside the row menu because the row unmounts with the
		* menu; the browser raises the same request from a title double-click.
		*/
		/**
		* Menu row (order 200): ask for the rename dialog, seeded with the row's current title.
		* @param props - owner share, menu open state, and the rename share.
		* @returns the row.
		*/
		function RenameSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useShortcuts, requestSessionRename, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			const shortcut = useShortcuts((rows) => rows.find((row) => row.id === "session.rename"));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				shortcut,
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					requestSessionRename(sessionId, displayTitle);
				},
				children: t("rename")
			});
		}
		/**
		* The `shell.overlay` entry: nothing while no rename is requested, otherwise
		* one dialog per request (keyed by the Session, so a new request starts a
		* fresh draft). Sessions have no client-side name-conflict rule (the host
		* normalizes), and unlike Workspace rename an unchanged title is NOT
		* blocked. An unnamed Session starts with an empty draft and requires a name.
		* @param props - the request hook, its settlement, the rename hop, and the locale seat.
		* @returns the open dialog, or null.
		*/
		function SessionRenameDialog({ useRenameRequest, settleSessionRename, renameSession, t }) {
			const request = useRenameRequest((pending) => pending);
			if (request === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RenameForm, {
				request,
				renameSession,
				onSettle: settleSessionRename,
				t
			}, request.sessionId);
		}
		/** One request's dialog: the draft seeds from the request on mount; in-flight and error state die with it. */
		function RenameForm({ request, renameSession, onSettle, t }) {
			const [draft, setDraft] = (0, react.useState)(request.currentTitle);
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const composingRef = (0, react.useRef)(false);
			const trimmed = draft.trim();
			const blocked = renaming || trimmed === "";
			const close = () => {
				if (renaming) return;
				onSettle();
			};
			const confirm = () => {
				if (blocked) return;
				setRenaming(true);
				setError(null);
				renameSession(request.sessionId, trimmed).then(() => {
					setRenaming(false);
					onSettle();
				}).catch((reason) => {
					setRenaming(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("close"),
				title: t("rename.session.title"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: renaming,
					onClick: close,
					children: t("cancel")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					disabled: blocked,
					onClick: confirm,
					children: t("rename")
				})] }),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					className: WorkspaceBrowser_module_css_default.renameInput,
					value: draft,
					"aria-label": t("field.sessionName"),
					"data-modal-autofocus": true,
					disabled: renaming,
					onFocus: (e) => {
						e.target.select();
					},
					onChange: (e) => {
						setDraft(e.target.value);
						setError(null);
					},
					onCompositionStart: () => {
						composingRef.current = true;
					},
					onCompositionEnd: () => {
						composingRef.current = false;
					},
					onKeyDown: (e) => {
						if (e.key === "Enter" && !composingRef.current) {
							e.preventDefault();
							confirm();
						}
					}
				}), error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: WorkspaceBrowser_module_css_default.renameError,
					role: "alert",
					children: error
				})]
			});
		}
		//#endregion
		//#region src/client/session-actions/SessionId.tsx
		/** The copy Session ID action: one `sidebar.workspaces.session.menu.item` row. */
		/**
		* Copy the complete ID after dismissing the row menu.
		* @param props - row identity, menu dismissal, clipboard action, and locale.
		* @returns the final built-in menu item.
		*/
		function SessionIdMenuItem({ sessionId, useMenuOpenState, copySessionId, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					copySessionId(sessionId);
				},
				children: t("menu.sessionId")
			});
		}
		//#endregion
		//#region src/client/session-actions/RowActionToast.tsx
		/**
		* Dispatch the current notice without interpreting its business payload.
		* @param props - Current notice, dismissal, and the declared keyed renderer.
		* @returns the selected notice presentation, or nothing.
		*/
		function RowActionToast({ useToast, dismissToast, renderSlot }) {
			const notice = useToast((current) => current);
			if (notice === null) return null;
			return renderSlot("workspace.toast", {
				...notice,
				dismissToast
			}, { entryKey: notice.kind });
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* `workspace` namespace dictionaries: the browsing region (section header,
		* search, tree rows, dialogs) and the pick/add flow. Runtime failure
		* messages (wire error strings) pass through untranslated by policy.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"defaultWorkspace.failed": "无法创建默认工作区，请通过“选择工作区”选择文件夹",
			"draft.workspaceRequired": "请先选择工作区",
			"draft.initializationFailed": "暂时无法填入草稿，请稍后重试",
			"group.ungrouped": "未分组",
			"session.new": "新会话",
			"session.untitled": "未命名",
			"shortcut.noSession": "请先选择一个会话",
			"shortcut.noPicker": "目录选择器不可用",
			"shortcut.directoryBusy": "正在选择或添加工作区",
			"shortcut.noCompletedTurn": "当前会话没有已结束的轮次",
			"shortcut.forkFailed": "无法分叉会话，请重试",
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			"viewOptions.label": "视图选项",
			"groupBy.label": "分组方式",
			"groupBy.workspace": "按工作区",
			"groupBy.workspaceTree": "按工作区树",
			"groupBy.flat": "单列表",
			"orderBy.label": "排序方式",
			"orderBy.manual": "手动排序",
			"orderBy.updated": "最近更新",
			"filterBy.label": "筛选会话",
			"viewOptions.hideArchived": "隐藏已归档",
			"viewOptions.showArchived": "全部对话（显示已归档）",
			"viewOptions.onlyArchived": "仅显示已归档",
			"sessions.expand": "展开其余 {n} 个会话",
			"sessions.collapse": "收起",
			"empty.none": "暂无会话",
			"empty.noneArchived": "暂无已归档会话",
			"empty.viewOthers": "查看其他会话",
			"empty.noMatches": "无匹配结果",
			"workspace.add": "添加工作区",
			"search.sessions.aria": "搜索会话",
			"search.placeholder": "搜索会话名称",
			"search.clear": "清除搜索",
			"search.results.aria": "搜索结果",
			"search.pending": "正在搜索会话历史…",
			"search.noMatches": "无匹配会话",
			"search.hasMore": "仅显示前 {n} 条结果，请缩小搜索范围。",
			"menu.addWorkspace": "添加工作区…",
			"picker.loading": "正在加载工作区…",
			"conflict.named": "已存在名为“{name}”的工作区。",
			"folderError.title": "无法打开文件夹",
			"folderError.retry": "重新选择",
			"rename": "重命名",
			"rename.workspace.title": "重命名工作区",
			"rename.session.title": "重命名会话",
			"field.workspaceName": "工作区名称",
			"field.sessionName": "会话名称",
			"delete.workspace": "删除工作区",
			"delete.desc": "将把“{name}”从工作区列表中移除。文件夹与会话记录会保留，其会话将显示在“未分组”下。",
			"delete.pending": "正在删除工作区…",
			"menu.fork": "分叉会话",
			"menu.archiveSession": "归档会话",
			"menu.unarchiveSession": "取消归档",
			"menu.pinSession": "置顶会话",
			"menu.unpinSession": "取消置顶",
			"menu.sessionId": "复制 Session ID",
			"toast.sessionIdCopied": "Session ID 已复制",
			"toast.sessionIdCopyFailed": "复制失败，请重试",
			"row.archived": "已归档",
			"row.pinned": "已置顶",
			"toast.archivedNotOpenable": "已归档对话暂时无法查看，请取消归档后查看",
			"toast.archived": "会话已归档，可",
			"toast.stoppedAndArchived": "已停止并归档，可",
			"archive.confirm.title": "停止并归档此会话？",
			"archive.confirm.desc": "“{title}”仍有正在进行的工作。归档会先停止这些工作；之后可在侧栏筛选“全部对话（显示已归档）”中恢复会话，被停止的工作不会自动继续。",
			"archive.confirm.activity": "将被停止的工作",
			"archive.confirm.turn": "进行中的回合",
			"archive.confirm.subagents.one": "{n} 个运行中的子智能体：{names}",
			"archive.confirm.subagents.other": "{n} 个运行中的子智能体：{names}",
			"archive.confirm.jobs.one": "{n} 个后台任务：{names}",
			"archive.confirm.jobs.other": "{n} 个后台任务：{names}",
			"archive.confirm.schedules.one": "{n} 条定时提醒：{names}",
			"archive.confirm.schedules.other": "{n} 条定时提醒：{names}",
			"archive.confirm.other.one": "{n} 项其他工作（{kind}）",
			"archive.confirm.other.other": "{n} 项其他工作（{kind}）",
			"archive.confirm.listSeparator": "、",
			"archive.confirm.action": "停止并归档",
			"archive.confirm.pending": "正在停止并归档…",
			"toast.archivedUndo": "撤销",
			"toast.archivedOr": "或",
			"toast.archivedFilter": "筛选已归档会话",
			"toast.pinFailed": "置顶失败，请稍后重试",
			"toast.unpinFailed": "取消置顶失败，请稍后重试",
			"toast.createFailed": "新建会话失败：{message}",
			"toast.forkRequiresOpen": "请先打开原会话完成迁移，再创建分支",
			"toast.openForkSource": "打开原会话",
			"sessions.count.one": "{n} 个会话",
			"sessions.count.other": "{n} 个会话",
			"actions.workspace.aria": "工作区“{name}”的操作",
			"actions.session.aria": "会话“{name}”的操作",
			"actions.archive": "归档会话",
			"actions.unarchive": "取消归档",
			"actions.pin": "置顶会话",
			"actions.unpin": "取消置顶",
			"actions.newSession": "新会话",
			"actions.newSession.aria": "在“{name}”中新建会话",
			"status.running": "进行中",
			"status.subagentsRunning.one": "{n} 个子智能体运行中",
			"status.subagentsRunning.other": "{n} 个子智能体运行中",
			"status.idle": "空闲",
			"status.waitingApproval": "等待审批",
			"status.planReview": "计划待审",
			"status.waitingAnswer": "等待回答",
			"status.compact.approval": "待审批",
			"status.compact.planReview": "计划待审",
			"status.compact.answer": "待回答",
			"status.needsAttention": "需要关注",
			"status.completed": "已完成",
			"hover.created": "创建于 {time}",
			"hover.copied": "已复制",
			"date.ymd": "{y}年{m}月{d}日",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前",
			"settings.badge.section": "折叠徽标",
			"settings.badge.showRunning": "显示「进行中」转圈",
			"settings.badge.showRunningHint": "关闭后，进行中的会话（含子智能体）不再画转圈，也不再计入折叠徽标的数字与悬停明细。",
			"settings.badge.showPending": "显示「待审批」黄点",
			"settings.badge.showPendingHint": "关闭后，等待审批 / 计划评审 / 等待回答的会话不再画黄点，也不再计入折叠徽标的数字与悬停明细。",
			"settings.badge.showCompleted": "显示「已完成」绿点",
			"settings.badge.showCompletedHint": "关闭后，「已完成」的会话不再画绿点，也不再计入折叠徽标的数字与悬停明细。会话行自身的绿点不受影响。",
			"settings.hover.section": "悬停明细",
			"settings.hover.showDetails": "显示状态明细行",
			"settings.hover.showDetailsHint": "关闭后，悬停卡只显示工作区标题、路径和创建时间——不再显示聚合状态明细行。",
			"settings.count.section": "数字显示",
			"settings.count.threshold": "数字显示阈值",
			"settings.count.thresholdHint": "数量 >= 此值时才在徽标上显示数字。默认 2（即 count=1 时省略，因为状态点已表达\"有东西\"）。设为 1 则始终显示。",
			"settings.count.decrease": "减少",
			"settings.count.increase": "增加",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.saveFailed": "本部署没有接受这些值，已保留供你修改。",
			"settings.readOnly": "本部署的设置为只读。",
			"settings.unavailable": "该插件当前未加载，暂时无法配置。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"defaultWorkspace.failed": "Unable to create default workspace. Use Choose workspace to select a folder.",
			"draft.workspaceRequired": "Choose a workspace first.",
			"draft.initializationFailed": "Could not fill the draft. Please try again shortly.",
			"group.ungrouped": "Ungrouped",
			"session.new": "New Session",
			"session.untitled": "Untitled",
			"shortcut.noSession": "Select a session first",
			"shortcut.noPicker": "Directory picker unavailable",
			"shortcut.directoryBusy": "Selecting or adding a workspace",
			"shortcut.noCompletedTurn": "This session has no completed turn",
			"shortcut.forkFailed": "Could not fork the session. Try again.",
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			"viewOptions.label": "View options",
			"groupBy.label": "Group by",
			"groupBy.workspace": "WorkSpace",
			"groupBy.workspaceTree": "Workspace Tree",
			"groupBy.flat": "In one list",
			"orderBy.label": "Order by",
			"orderBy.manual": "Manual",
			"orderBy.updated": "Last updated",
			"filterBy.label": "Filter sessions",
			"viewOptions.hideArchived": "Hide archived",
			"viewOptions.showArchived": "All conversations (show archived)",
			"viewOptions.onlyArchived": "Archived only",
			"sessions.expand": "Show {n} more sessions",
			"sessions.collapse": "Show less",
			"empty.none": "No sessions yet",
			"empty.noneArchived": "No archived sessions yet",
			"empty.viewOthers": "View other sessions",
			"empty.noMatches": "No matches",
			"workspace.add": "Add workspace",
			"search.sessions.aria": "Search sessions",
			"search.placeholder": "Search session names",
			"search.clear": "Clear search",
			"search.results.aria": "Search results",
			"search.pending": "Searching session history…",
			"search.noMatches": "No matching sessions",
			"search.hasMore": "Showing the first {n} results. Narrow your search.",
			"menu.addWorkspace": "Add workspace…",
			"picker.loading": "Loading workspaces…",
			"conflict.named": "A workspace named “{name}” already exists.",
			"folderError.title": "Couldn’t open folder",
			"folderError.retry": "Choose again",
			"rename": "Rename",
			"rename.workspace.title": "Rename workspace",
			"rename.session.title": "Rename session",
			"field.workspaceName": "Workspace name",
			"field.sessionName": "Session name",
			"delete.workspace": "Delete workspace",
			"delete.desc": "This removes “{name}” from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped.",
			"delete.pending": "Deleting workspace…",
			"menu.fork": "Fork session",
			"menu.archiveSession": "Archive session",
			"menu.unarchiveSession": "Unarchive session",
			"menu.pinSession": "Pin session",
			"menu.unpinSession": "Unpin session",
			"menu.sessionId": "Copy Session ID",
			"toast.sessionIdCopied": "Session ID copied",
			"toast.sessionIdCopyFailed": "Copy failed. Try again.",
			"row.archived": "Archived",
			"row.pinned": "Pinned",
			"toast.archivedNotOpenable": "Archived sessions cannot be opened. Unarchive it to view.",
			"toast.archived": "Session archived. You can ",
			"toast.stoppedAndArchived": "Session stopped and archived. You can ",
			"archive.confirm.title": "Stop and archive this session?",
			"archive.confirm.desc": "“{title}” still has work in progress. Archiving stops it first; you can restore the session later from the “All conversations (show archived)” filter in the sidebar, and the stopped work will not resume on its own.",
			"archive.confirm.activity": "Work that will be stopped",
			"archive.confirm.turn": "The turn in progress",
			"archive.confirm.subagents.one": "{n} running subagent: {names}",
			"archive.confirm.subagents.other": "{n} running subagents: {names}",
			"archive.confirm.jobs.one": "{n} background job: {names}",
			"archive.confirm.jobs.other": "{n} background jobs: {names}",
			"archive.confirm.schedules.one": "{n} scheduled reminder: {names}",
			"archive.confirm.schedules.other": "{n} scheduled reminders: {names}",
			"archive.confirm.other.one": "{n} other item of work ({kind})",
			"archive.confirm.other.other": "{n} other items of work ({kind})",
			"archive.confirm.listSeparator": ", ",
			"archive.confirm.action": "Stop and archive",
			"archive.confirm.pending": "Stopping and archiving…",
			"toast.archivedUndo": "undo",
			"toast.archivedOr": " or ",
			"toast.archivedFilter": "filter archived sessions",
			"toast.pinFailed": "Pin failed. Try again later.",
			"toast.unpinFailed": "Unpin failed. Try again later.",
			"toast.createFailed": "New session failed: {message}",
			"toast.forkRequiresOpen": "Open the original session to complete migration before creating a branch.",
			"toast.openForkSource": "Open original session",
			"sessions.count.one": "{n} session",
			"sessions.count.other": "{n} sessions",
			"actions.workspace.aria": "Workspace actions for {name}",
			"actions.session.aria": "Session actions for {name}",
			"actions.archive": "Archive",
			"actions.unarchive": "Unarchive",
			"actions.pin": "Pin",
			"actions.unpin": "Unpin",
			"actions.newSession": "New session",
			"actions.newSession.aria": "New session in {name}",
			"status.running": "Running",
			"status.subagentsRunning.one": "{n} subagent running",
			"status.subagentsRunning.other": "{n} subagents running",
			"status.idle": "Idle",
			"status.waitingApproval": "Waiting for approval",
			"status.planReview": "Plan awaiting review",
			"status.waitingAnswer": "Waiting for answer",
			"status.compact.approval": "Approval",
			"status.compact.planReview": "Plan review",
			"status.compact.answer": "Answer",
			"status.needsAttention": "Needs attention",
			"status.completed": "Completed",
			"hover.created": "Created {time}",
			"hover.copied": "Copied",
			"date.ymd": "{y}-{m}-{d}",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago",
			"settings.badge.section": "Collapsed badge",
			"settings.badge.showRunning": "Show the running dot",
			"settings.badge.showRunningHint": "When off, running Sessions (and subagents) stop drawing the spinning dot and drop out of the collapsed badge count and its hover details.",
			"settings.badge.showPending": "Show the pending dot",
			"settings.badge.showPendingHint": "When off, Sessions waiting for approval / plan review / answer stop drawing the yellow dot and drop out of the collapsed badge count and its hover details.",
			"settings.badge.showCompleted": "Show the completed dot",
			"settings.badge.showCompletedHint": "When off, completed Sessions stop drawing the dot and drop out of the collapsed badge count and its hover details. The Session row's own dot is unaffected.",
			"settings.hover.section": "Hover details",
			"settings.hover.showDetails": "Show status detail lines",
			"settings.hover.showDetailsHint": "When off, the hover card shows only the workspace title, path, and creation time — no aggregated status lines.",
			"settings.count.section": "Count display",
			"settings.count.threshold": "Count display threshold",
			"settings.count.thresholdHint": "The count is shown on the badge only when the total is >= this value. Default 2 (omits the count when it equals 1 — the dots already convey \"something is happening\"). Set to 1 to always show.",
			"settings.count.decrease": "Decrease",
			"settings.count.increase": "Increase",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.saveFailed": "The deployment did not accept these values; they were left for you to correct.",
			"settings.readOnly": "This deployment stores settings read-only.",
			"settings.unavailable": "This plugin is not loaded, so it cannot be configured right now."
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspace";
		/** 插件详情页配置表单的槽位名（按包名寻址；契约见 `plugin-manager-slot.d.ts`）。 */
		const CONFIG_CARD_SLOT = "plugins.bundle.config";
		/**
		* 插件管理器分发 `plugins.bundle.config` 用的键 = **包名**（不是条目 id）。
		* 本包的补丁把行 id 也写成同名，但两者是不同概念，别改成 ENTRY_ID 的引用。
		*/
		const CONFIG_CARD_KEY = "dsh-group-status";
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"remote",
			"remote.directoryPicker",
			"layout",
			"shortcuts",
			"remoteAccess"
		];
		/**
		* Register the browser and picker once their slot declarations are on the
		* ledger. Inject factories return plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			const viewHandle = createWorkspaceViewStore();
			const viewInstance = viewHandle.create();
			const viewStore = {
				...viewHandle,
				create: () => viewInstance
			};
			const rowToast = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			let toastSeq = 0;
			const notify = (toast) => {
				rowToast.set({
					...toast,
					seq: ++toastSeq
				});
			};
			const uiWorkspace = new UiWorkspaceService(ctx, ctx.remote.directoryPicker, workspaces, sessions, viewInstance.actions, notify);
			const denyWorkspaceAccess = {
				getSnapshot: () => false,
				subscribe: () => () => {}
			};
			ctx.slots.provideRoot({
				hooks: { workspaces: workspaces.list },
				keyedHooks: { workspaceAccess: (workspaceId, action) => action === void 0 ? denyWorkspaceAccess : ctx.remoteAccess.source("workspace", workspaceId, action) }
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-workspace: dictionaries");
			ctx.effect(() => () => disposeFacetStore(), "ui-workspace: status facets");
			const shortcutControls = createWorkspaceShortcutControls();
			const badgeSettings = createBadgeSettingsSource();
			ctx.slots.provideRoot({ hooks: { badgeSettings } });
			ctx.inject(["configForms"], (configCtx) => {
				const forms = configCtx.get("configForms");
				if (forms === void 0 || typeof forms.get !== "function") return;
				const scope = forms.get(ENTRY_ID);
				if (scope === void 0) return;
				badgeSettings.publish(scope.getSnapshot());
				configCtx.effect(() => scope.subscribe(() => {
					badgeSettings.publish(scope.getSnapshot());
				}), "dsh-group-status: badge settings");
				const whileServed = forms.whileServed?.bind(forms);
				if (whileServed === void 0) return;
				configCtx.effect(() => whileServed([ENTRY_ID], () => ctx.slots.inject(CONFIG_CARD_SLOT, () => ctx.slots.register({
					name: CONFIG_CARD_SLOT,
					key: CONFIG_CARD_KEY,
					locale: NS,
					inject: () => ({ scope })
				}, BadgeSettingsCard))), "dsh-group-status: plugins-page card");
			});
			const searchSessions = async (query, signal) => {
				const result = await sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const flowSource = (hole) => ({
				getSnapshot: () => ctx.slots.entries(hole).length > 0,
				subscribe: (listener) => ctx.slots.subscribe(hole, listener)
			});
			const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
			const hostInfo = {
				getSnapshot: () => ctx.remote.$host,
				subscribe: (listener) => ctx.on("connection/reset", listener)
			};
			const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
			const openSession = (sessionId) => {
				uiWorkspace.openSession(sessionId);
			};
			const pinnedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.pinnedSessionIds));
			const archivedSet = derive(workspaces.list, (snapshot) => new Set(snapshot.archivedSessionIds));
			const renameRequest = derive(shortcutControls.state, (state) => state.renameTarget);
			const archiveRequest = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			const requestSessionRename = shortcutControls.rename;
			const unarchiveSession = (sessionId) => {
				uiWorkspace.unarchiveSession(sessionId).catch((reason) => {
					console.warn("session unarchive rejected:", reason);
				});
			};
			const renameSession = async (sessionId, title) => {
				const result = await sessions.using(sessionId, { source: "workspaceOperation" }, (reference) => reference.binding.session.rename(title));
				if (!result.ok) throw new Error(result.error.message);
			};
			const pinInjected = () => ({
				hooks: {
					pinned: pinnedSet,
					archived: archivedSet
				},
				pinSession: (sessionId) => {
					uiWorkspace.pinSession(sessionId).catch(() => {
						notify({ kind: "pinFailed" });
					});
				},
				unpinSession: (sessionId) => {
					uiWorkspace.unpinSession(sessionId).catch(() => {
						notify({ kind: "unpinFailed" });
					});
				}
			});
			const archiveInjected = () => ({
				hooks: { archived: archivedSet },
				archiveSession: (sessionId) => {
					uiWorkspace.archiveSession(sessionId).then(() => {
						notify({
							kind: "archived",
							sessionId
						});
					}).catch((reason) => {
						const activity = activeSessionRefusal(reason);
						if (activity === void 0) {
							console.warn("session archive rejected:", reason);
							return;
						}
						const displayTitle = sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId;
						archiveRequest.set({
							sessionId,
							displayTitle,
							activity
						});
					});
				},
				unarchiveSession
			});
			installWorkspaceShortcuts(ctx, uiWorkspace, shortcutControls, archiveInjected().archiveSession, (reason) => {
				notify({
					kind: "shortcutForkFailed",
					reason
				});
			});
			const archiveConfirmInjected = () => ({
				hooks: { archiveRequest },
				settleSessionArchive: () => {
					archiveRequest.set(null);
				},
				stopAndArchiveSession: async (sessionId) => {
					await uiWorkspace.archiveSession(sessionId, { stopActivity: true });
					notify({
						kind: "stoppedAndArchived",
						sessionId
					});
				}
			});
			const forkInjected = () => ({ forkSession: (sessionId) => {
				uiWorkspace.forkSession(sessionId, (childId) => {
					ctx.get("productAnalytics")?.track("branch_session_click", {
						session_id: childId,
						parent_session_id: sessionId,
						click_position: "sidebar"
					});
				}, { allowMigration: false }).catch((reason) => {
					if ((reason instanceof Error && reason.name === "SessionForkError" ? reason : void 0)?.rpcError?.code === "session/migration-required") notify({
						kind: "forkRequiresOpen",
						sessionId
					});
				});
			} });
			const renameInjected = () => ({ requestSessionRename });
			const renameDialogInjected = () => ({
				hooks: { renameRequest },
				settleSessionRename: shortcutControls.closeRename,
				renameSession
			});
			const sessionIdInjected = () => ({ copySessionId: async (id) => {
				notify({ kind: await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(id) ? "sessionIdCopied" : "sessionIdCopyFailed" });
			} });
			registerToasts(ctx, viewStore, {
				undoArchive: unarchiveSession,
				showArchived: () => {
					viewInstance.actions.setArchivedFilter("show");
				},
				openForkSource: (id) => {
					if (workspaces.list.getSnapshot().archivedSessionIds.includes(id)) {
						notify({ kind: "archivedNotOpenable" });
						return;
					}
					openSession(id);
				}
			});
			const rowToastInjected = () => ({
				hooks: { toast: rowToast },
				dismissToast: () => {
					rowToast.set(null);
				}
			});
			const browserInjected = () => ({
				startSession: (workspaceId, options) => {
					uiWorkspace.startSession(workspaceId, options);
				},
				open: openSession,
				searchSessions,
				searchResultLimit: sessions.searchResultLimit,
				requestSessionRename,
				notifyArchivedNotOpenable: () => {
					notify({ kind: "archivedNotOpenable" });
				},
				renameWorkspace: async (workspaceId, title) => {
					await workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				unarchiveSession: async (sessionId) => {
					await uiWorkspace.unarchiveSession(sessionId);
				},
				createWorkspace: (input) => workspaces.create(input),
				requestSearch: shortcutControls.search,
				requestAddWorkspace: shortcutControls.add,
				closeAddWorkspace: shortcutControls.closeAdd,
				setDirectoryBusy: shortcutControls.directoryBusy,
				hooks: {
					directoryFlow: browserFlowSource,
					hostInfo,
					workspaceShortcuts: shortcutControls.state,
					shortcuts: ctx.shortcuts.catalog
				}
			});
			const pickerInjected = () => ({
				createWorkspace: (input) => workspaces.create(input),
				hooks: { directoryFlow: pickerFlowSource }
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				children: {
					"sidebar.workspaces.directoryFlow": {
						kind: "single",
						scope: "root"
					},
					"sidebar.workspaces.session.menu.item": {
						kind: "list",
						scope: "root",
						inject: { hooks: {
							menuOpenState: menuOpenStateFactory,
							shortcuts: ctx.shortcuts.catalog
						} }
					},
					"sidebar.workspaces.session.row.action": {
						kind: "list",
						scope: "root"
					},
					"sidebar.session.row.leading": {
						kind: "list",
						scope: "root"
					},
					"sidebar.session.row.hover": {
						kind: "list",
						scope: "root"
					}
				},
				store: viewStore,
				inject: browserInjected,
				locale: NS
			}, WorkspaceBrowser));
			ctx.slots.inject("sidebar.workspaces.session.menu.item", function* () {
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "pin",
					order: 100,
					locale: NS,
					inject: pinInjected
				}, PinSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "rename",
					order: 200,
					locale: NS,
					inject: renameInjected
				}, RenameSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "fork",
					order: 300,
					locale: NS,
					inject: forkInjected
				}, ForkSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "archive",
					order: 400,
					locale: NS,
					inject: archiveInjected
				}, ArchiveSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "session-id",
					order: 450,
					locale: NS,
					inject: sessionIdInjected
				}, SessionIdMenuItem);
			});
			ctx.slots.inject("sidebar.workspaces.session.row.action", function* () {
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.row.action",
					id: "archive",
					order: 100,
					locale: NS,
					inject: archiveInjected
				}, ArchiveSessionRowButton);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.row.action",
					id: "pin",
					order: 200,
					locale: NS,
					inject: pinInjected
				}, PinSessionRowButton);
			});
			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.session-rename",
					locale: NS,
					inject: renameDialogInjected
				}, SessionRenameDialog);
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.session-archive",
					locale: NS,
					inject: archiveConfirmInjected
				}, SessionArchiveConfirmDialog);
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.row-toast",
					inject: rowToastInjected,
					children: { "workspace.toast": {
						kind: "keyed",
						scope: "root"
					} }
				}, RowActionToast);
			});
			ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({
				name: "conversation.hero.workspace",
				children: { "conversation.hero.workspace.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: pickerInjected,
				locale: NS
			}, WorkspacePicker));
		}
		/**
		* The activity a Host `workspace/session-active` refusal reported, or nothing
		* for any other failure. The class identity check goes by name: client plugin
		* bundles do not share error-class identity.
		*/
		function activeSessionRefusal(reason) {
			if (!(reason instanceof Error) || reason.name !== "WorkspaceArchiveError") return void 0;
			const { rpcError } = reason;
			return rpcError.code === "workspace/session-active" ? rpcError.details.activity : void 0;
		}
		//#endregion
		exports.FACET_TONE_RANK = FACET_TONE_RANK;
		exports.GROUP_STATUS_FACET_PROTOCOL_VERSION = GROUP_STATUS_FACET_PROTOCOL_VERSION;
		exports.apply = apply;
		exports.groupStatusFacetRegistry = registry;
		exports.inject = inject;
		exports.registerGroupStatusFacet = registerGroupStatusFacet;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map