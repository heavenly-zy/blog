# AGENTS.md 同步：单一信源 + 生成产物

> 本文档记录 `AGENTS.md` → `.github/copilot-*.md` / `.cursor/rules/main.mdc` 的同步机制改造方案。
>
> 思路：**单一信源 + 生成产物**。本方案适配的当前项目工具链：`bun` + `lefthook`。

## 背景

### 改造前的状态

- `AGENTS.md` 是项目 AI 助手指令的"唯一权威来源"。
- `scripts/sync-ai-rules.mjs` 从 `AGENTS.md` 派生三份副本，供不同 AI 工具消费：
	- `.github/copilot-instructions.md`（GitHub Copilot Chat / 代码生成）
	- `.github/copilot-commit-message-instructions.md`（Copilot "生成提交消息" 按钮）
	- `.cursor/rules/main.mdc`（Cursor）
- 但这三份副本**也被提交到 git**，`lefthook` 在 `pre-commit` 时还会主动 `git add` 它们一起进入暂存区。

### 问题

- 副本顶部虽有 banner 注释 `<!-- 此文件由 ... 自动生成 -->`，但仍可被直接编辑。下一次 sync 才会覆盖，期间漂移已经发生，甚至已经被 commit。
- 副本既是"生成产物"又是"被跟踪文件"，身份模糊：回看 git 历史无法分辨某次变更是从 `AGENTS.md` 同步来的，还是绕过 `AGENTS.md` 直接改副本的。
- 这套机制依赖"开发者自觉只改 `AGENTS.md`"，但缺乏强制约束。

## 目标

从根源消除漂移：**`AGENTS.md` 是唯一可编辑的信源，三份副本是构建产物，不进 git、自动生成、写入后只读**。

## 为什么不像 CLAUDE.md 一样用引用？

`CLAUDE.md` 全文只有一行：

```text
@AGENTS.md
```

这是 Claude Code 私有的导入语法——客户端加载 `CLAUDE.md` 时会把 `AGENTS.md` 全文展开到上下文里，所以 Claude Code 不需要副本。

但 GitHub Copilot 与 Cursor 都没有对应的引用机制：

- **Copilot** 固定读 `.github/copilot-instructions.md` 与 `.github/copilot-commit-message-instructions.md`，把整个文件当成纯文本提示词喂给模型，**没有** import / include 语法。
- **Cursor** 固定读 `.cursor/rules/*.mdc`（Markdown + YAML frontmatter），同样不支持指向外部文件的引用。

而且这三份副本并不是"`AGENTS.md` 的原样拷贝"——`scripts/sync-ai-rules.mjs` 会针对每个工具做不同的包装：

| 副本 | 加工方式 |
| --- | --- |
| `.github/copilot-instructions.md` | banner + `# Copilot Instructions` 标题 + AGENTS.md 全文 |
| `.github/copilot-commit-message-instructions.md` | banner + 标题 + **仅截取 `## 提交消息规则` 一节** |
| `.cursor/rules/main.mdc` | YAML frontmatter（`description` / `alwaysApply`）+ banner + AGENTS.md 全文 |

所以即使未来某个工具支持外部引用，"裁剪 / 包装"这个环节依然省不掉。

## 为什么不用 symlink？

另一个看起来直觉的方案是：用 symlink 让 `.github/copilot-instructions.md` 等直接指向 `AGENTS.md`。但这条路同样走不通：

1. **路径与文件名是工具规定死的**——`copilot-instructions.md` ≠ `AGENTS.md` ≠ `main.mdc`，symlink 解决不了"必须叫这个名字"这个约束本身（只是把"复制"换成"建链"，文件依然得存在）。
2. **内容也不能等同于 `AGENTS.md`**——前一节那张加工表里，commit-message 副本只截取 `## 提交消息规则` 一节，`main.mdc` 还要在头部包一层 YAML frontmatter。symlink 按字节透传，做不了裁剪 / 包装。
3. **跨平台不可靠**——Windows 默认不还原 git 中的 symlink（git mode `120000`），checkout 出来是一行字面量路径文本而非真正的软链接：

	```bash
	$ cat .github/copilot-instructions.md
	../AGENTS.md          # 不是软链，而是文本
	```

	要让 symlink 在 Windows 上正常工作，每个开发者都得单独配 `git config --global core.symlinks true`、开启 Windows 开发者模式、再重新 checkout；CI 还要单独处理。任何一步漏配都会踩坑，新人门槛高。

**结论**：这三份副本必须是真实存在的文件，内容也不等于 `AGENTS.md` 原文，所以"复制 + 加工 + 自动同步"是必然选择，再用前述五层防御保证它们不被误改、不进 git。

## 方案

### 防御层级（自外而内）

| 层 | 机制 | 防御目标 |
| --- | --- | --- |
| 1 | `.gitignore` 排除副本 | 副本不进 git，从根上避免漂移被 commit |
| 2 | `postinstall` + `pre-commit` 自动 sync | 开发者无需记命令；AGENTS.md 改动后副本立即刷新 |
| 3 | `chmod 0o444`（写入后只读） | 编辑器层面 readonly 提示，劝退手改 |
| 4 | lefthook guard job | 兜底拦截 `git add -f` 强加生成物 |
| 5 | banner 注释 | 副本顶部明示来源与修改方式 |

### 改动清单

| 文件 | 操作 |
| --- | --- |
| [scripts/sync-ai-rules.mjs](../scripts/sync-ai-rules.mjs) | 增强 banner；`write()` 写入前解除只读、写入后 `chmod 0o444` |
| [.gitignore](../.gitignore) | 追加三个生成副本 + `.claude/settings.local.json` |
| `.github/copilot-instructions.md` | `git rm --cached`（工作区文件保留） |
| `.github/copilot-commit-message-instructions.md` | 同上 |
| `.cursor/rules/main.mdc` | 同上 |
| [package.json](../package.json) | 新增 `postinstall: node scripts/sync-ai-rules.mjs` |
| [lefthook.yml](../lefthook.yml) | sync job 去掉 `git add`；新增 `guard-generated-rules` job |
| [AGENTS.md](../AGENTS.md) | 顶部说明改写为"自动同步"语义 |

### 关键代码

#### `scripts/sync-ai-rules.mjs` 的 `write()` 函数

```js
function write(rel, content) {
	const path = resolve(root, rel);
	mkdirSync(dirname(path), { recursive: true });
	if (existsSync(path)) {
		chmodSync(path, 0o644); // 解除只读，避免重写失败
	}
	writeFileSync(path, content, 'utf8');
	chmodSync(path, 0o444); // 写完设为只读
}
```

`mkdirSync(..., { recursive: true })` 同时保证 `.cursor/rules/` 与 `.github/` 即使不存在（如 fresh clone）也能自动创建——无需 `.keep` 占位。

#### banner 文案

```html
<!-- 此文件由 scripts/sync-ai-rules.mjs 自动生成自 AGENTS.md，请勿直接编辑。
     如需修改，请编辑 AGENTS.md 后运行 `bun sync-ai-rules`。 -->
```

#### `lefthook.yml`

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: sync-ai-rules
      glob: "AGENTS.md"
      run: bun sync-ai-rules
    - name: guard-generated-rules
      glob: "{.github/copilot-instructions.md,.github/copilot-commit-message-instructions.md,.cursor/rules/main.mdc}"
      run: |
        printf '✗ 检测到自动生成的 AGENTS.md 副本被加入提交：\n%s\n请编辑 AGENTS.md，commit 时会自动同步；如需手动刷新本地副本，运行 `bun sync-ai-rules`。\n' "{staged_files}"
        exit 1
    - name: biome
      glob: "*.{js,ts,jsx,tsx,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
```

利用 lefthook 自带的 `glob` 过滤：当且仅当三个生成产物之一被 staged 时，guard job 触发并直接 `exit 1`，无需手写 `grep` 过滤。

## 关键决策与取舍

### 为什么 `chmod 0o444` 而不只是 banner？

- banner 是被动提示，无法阻止编辑器写入。
- `chmod 0o444` 让 VSCode / Cursor / JetBrains 等编辑器在打开文件时直接显示 **Readonly** 标记，劝退力强得多。
- 代价：脚本重写副本时需要先 `chmod 0o644` 解除只读，否则 `writeFileSync` 会失败。已在 `write()` 内置处理。
- 跨平台：Node `chmodSync(0o444)` 在 Windows 下会设置只读位（git-bash 下 `ls -l` 显示 `-r--r--r--`，资源管理器右键属性勾上"只读"）。

### 为什么 `pre-commit` 保留 `sync`，不是只靠 `postinstall`？

| 方案 | 优 | 劣 |
| --- | --- | --- |
| 仅 `postinstall` 同步 | 最干净，commit 流程不动副本 | AGENTS.md 改动后到下次 install 之前，本地副本是过期的 |
| **保留 `pre-commit` sync**（采纳） | AGENTS.md 改动 → 下次 commit 立即刷新；所见即所得 | pre-commit 多跑一个脚本（仅在 AGENTS.md 改动时） |

副本已 `.gitignore`，sync 后不会被 add 进 commit；保留这一步纯粹是为了开发者本地体验。

### 为什么用 `postinstall` 而不是 `prepare`？

- `prepare` 已被 `lefthook install` 占用，是 hook 安装的标准用法。
- `postinstall` 是 bun / npm 约定的"依赖装完后"钩子，语义上正好匹配"装完依赖顺手把生成物补齐"。
- 二者职责清晰分离，不需要把它们用 `&&` 串到一起。

### 为什么不加 `.cursor/.keep` / `.github/.keep`？

- 同步脚本的 `mkdirSync({ recursive: true })` 保证目录会被自动创建。
- `postinstall` 钩子保证 fresh clone 后第一次 `bun install` 立即触发同步，目录与文件一起出现。
- `.gitignore` 是**文件级精准忽略**（具体到 `.github/copilot-instructions.md` 等），目录本身仍可承载未来的真实内容（如 GitHub Actions workflows、Cursor 其他规则文件），不需要占位文件。

## 验证

按以下步骤可以端到端验证整套机制：

1. **手动同步**：
	```bash
	bun sync-ai-rules
	```
	预期：三份副本生成，权限为 `-r--r--r--`（git-bash 下 `ls -l` 验证）。

2. **副本不再被跟踪**：
	```bash
	git ls-files .github/ .cursor/
	git status --short
	```
	预期：`git ls-files` 不再列出三个生成副本；`git status` 中它们既不在 staged 也不在 untracked。

3. **install 触发同步**：
	```bash
	rm .github/copilot-instructions.md   # 删掉一份副本
	bun install
	ls -l .github/copilot-instructions.md   # 应被重新生成且只读
	```

4. **AGENTS.md 改动 → pre-commit 自动刷新副本**：在 `AGENTS.md` 加一行无关注释，`git add AGENTS.md && git commit -m "test"`。预期：commit 成功，本地副本已被 sync 刷新。

5. **guard job 拦截强加**：
	```bash
	git add -f .github/copilot-instructions.md
	git commit -m "should fail"
	```
	预期：被 `guard-generated-rules` 阻止，错误信息提示编辑 `AGENTS.md`。

6. **只读保护**：在 VSCode / Cursor 中打开任意一份生成副本，预期编辑器顶部显示 **Readonly**。

## 后续可拓展

- 若未来引入 `.trae/rules`，可把复制逻辑合并进同一个 `sync-ai-rules.mjs`，让它一并产出 `.trae/rules/*.md`。
- 若 `AGENTS.md` 进一步拆分（例如按 section 输出到不同工具），扩展点在 `sync-ai-rules.mjs` 中按 `## 段落标题` 提取的现有逻辑。
