import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');

const bodyStart = source.indexOf('\n## ');
if (bodyStart === -1) {
	console.error('错误：AGENTS.md 未找到 ## 段落');
	process.exit(1);
}
const body = `${source.slice(bodyStart + 1).trimEnd()}\n`;

const commitBody = `${extractMarkedRegion('sync:commit-message')}\n`;

const NOTE = `<!-- 此文件由 scripts/sync-ai-rules.mjs 自动生成自 AGENTS.md，请勿直接编辑。
     如需修改，请编辑 AGENTS.md 后运行 \`bun sync-ai-rules\`。 -->`;

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
	if (existsSync(path)) {
		chmodSync(path, 0o644);
	}
	writeFileSync(path, content, 'utf8');
	chmodSync(path, 0o444);
}

function extractMarkedRegion(name) {
	const startMarker = `<!-- ${name}:start -->`;
	const endMarker = `<!-- ${name}:end -->`;
	const start = source.indexOf(startMarker);
	const end = source.indexOf(endMarker, start + startMarker.length);
	if (start === -1 || end === -1) {
		console.error('错误：AGENTS.md 中未找到完整的 marker 对：');
		console.error(`  ${startMarker}`);
		console.error(`  ${endMarker}`);
		const found = [...source.matchAll(/<!--\s*sync:[^\s>]+\s*-->/g)].map(
			(m) => m[0],
		);
		if (found.length === 0) {
			console.error('AGENTS.md 中目前不存在任何 sync marker。');
		} else {
			console.error('AGENTS.md 中目前的 sync marker：');
			for (const m of found) console.error(`  - ${m}`);
		}
		console.error(
			'若已重命名 marker，请同步更新 scripts/sync-ai-rules.mjs 中对应的字面量。',
		);
		process.exit(1);
	}
	return source.slice(start + startMarker.length, end).trim();
}
