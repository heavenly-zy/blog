import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');

const bodyStart = source.indexOf('\n## ');
if (bodyStart === -1) {
	console.error('错误：AGENTS.md 未找到 ## 段落');
	process.exit(1);
}
const body = source.slice(bodyStart + 1).trimEnd() + '\n';

const sections = body.split(/\n(?=## )/);
const commit = sections.find((s) => s.startsWith('## 提交消息规则'));
if (!commit) {
	console.error('错误：AGENTS.md 未找到 "## 提交消息规则" 一节');
	process.exit(1);
}
const commitBody = commit.replace(/^## 提交消息规则\n/, '').trimEnd() + '\n';

const NOTE =
	'<!-- 此文件由 scripts/sync-ai-rules.mjs 自动生成自 AGENTS.md，请勿直接编辑。 -->';

write(
	'.github/copilot-instructions.md',
	`${NOTE}\n\n# Copilot Instructions\n\n${body}`,
);
write(
	'.github/copilot-commit-message-instructions.md',
	`${NOTE}\n\n# 提交消息生成规则\n\n${commitBody}`,
);
write(
	'.cursor/rules/main.mdc',
	`---\ndescription: 项目通用规则\nalwaysApply: true\n---\n\n${NOTE}\n\n${body}`,
);

console.log('AI 规则副本已同步：');
console.log('  - .github/copilot-instructions.md');
console.log('  - .github/copilot-commit-message-instructions.md');
console.log('  - .cursor/rules/main.mdc');

function write(rel, content) {
	const path = resolve(root, rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, 'utf8');
}
