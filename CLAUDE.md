## 测试

```bash
npx vitest run test/ts/comet-scripts.test.ts   # Comet Node 脚本测试
npx vitest run                                   # 全量测试
```

## Comet Node 脚本规范

<<<<<<< HEAD
脚本源码位于 `src/scripts/`（TypeScript），经 `build.js` 编译输出到 `assets/skills/comet/scripts/`（JavaScript），必须跨平台兼容（macOS / Linux / Windows）：

- 使用 TypeScript 实现（`src/scripts/*.ts`），构建时编译为 `.js`
=======
脚本位于 `assets/skills/comet/scripts/`，必须跨平台兼容（macOS / Linux / Windows）：

- 使用 Node.js 实现，不新增 `.sh` wrapper
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
- 脚本间调用使用 `node <script>.js` 或共享 `runNode`
- 用户配置的 `build_command` / `verify_command` 允许交给平台 shell 执行
- 新增脚本必须加入 `beforeEach` 的拷贝列表和 manifest.json

## 脚本依赖关系

```
<<<<<<< HEAD
comet-lib.ts ← comet-state.ts, comet-guard.ts, comet-handoff.ts, comet-archive.ts, comet-yaml-validate.ts, comet-env.ts
comet-state.ts ← comet-guard.ts, comet-handoff.ts, comet-archive.ts
comet-yaml-validate.ts ← comet-guard.ts (preflight 阶段)
comet-handoff.ts ← comet-state.ts (写入 handoff_context/handoff_hash)
=======
comet-lib.js ← comet-state.js, comet-guard.js, comet-handoff.js, comet-archive.js, comet-yaml-validate.js, comet-env.js
comet-state.js ← comet-guard.js, comet-handoff.js, comet-archive.js
comet-yaml-validate.js ← comet-guard.js (preflight 阶段)
comet-handoff.js ← comet-state.js (写入 handoff_context/handoff_hash)
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
```

新增共享工具函数时优先放入 `comet-lib.js`，避免各脚本行为分叉。

## .comet.yaml 状态机

每个 change 的状态文件，字段变更需要同步三处：
1. `comet-state.js` — 可写字段白名单 + enum 验证
2. `comet-yaml-validate.js` — schema 校验 + KNOWN_KEYS
3. `test/ts/comet-scripts.test.ts` — 测试中的 yaml 字符串

## 双语言 Skill

skill 优化时先写中文版本（`assets/skills-zh/`），用户确认后再修改英文版本（`assets/skills/`）。

## Changelog 规范

文件：`CHANGELOG.md`，新版本条目置顶。

```
## What's Changed [x.y.z] - YYYY-MM-DD

### Added / Changed / Fixed / Tests / Removed / Security

- **功能名**: 描述做了什么以及为什么
```

要点：
- 版本号与 `package.json` 的 `version` 字段一致
- 每条以 `- **粗体关键词**: ` 开头，后接具体变更内容
- 按类型分组：Added → Changed → Fixed → Tests → Removed → Security
- 描述侧重 **行为变更**（what + why），不是实现细节
- `### Tests` 条目汇总新增测试覆盖的场景，不逐条列出测试用例
