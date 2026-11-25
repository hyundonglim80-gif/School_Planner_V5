#!/usr/bin/env node
// SessionStart 훅(.claude/settings.json): 새 세션 시작·/clear 때 프로젝트 폴더에 HANDOFF.md가 있으면 그 내용을 새 세션 맥락에 넣는다.
// 작업 규칙 4번(docs/WORK-RULES.md - 11-25 사용자). node만 있으면 리눅스(클라우드)·윈도우(PC) 어디서나 돈다.
// 파일이 없거나 읽다 실패하면 아무것도 내보내지 않고 끝난다(세션은 그대로 시작).
// HANDOFF.md는 저장소에 올리지 않는다(.gitignore) - 메모 🤖 요청 자동 실행이 남의 인계를 이어 하지 않게, 그 실행에서는 아예 돌지 않는다.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 훅이 맥락에 넣는 글은 1만 자 안팎에서 잘린다 - 넘으면 앞부분만 넣고 나머지는 파일을 직접 읽게 한다.
const LIMIT = 9000;

if (process.env.GITHUB_ACTIONS === 'true') process.exit(0);

let input = {};
try {
  if (!process.stdin.isTTY) input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  input = {};
}

const dir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = join(dir, 'HANDOFF.md');

try {
  if (!existsSync(file) || !statSync(file).isFile()) process.exit(0);
  let text = readFileSync(file, 'utf8').replace(/^﻿/, '').trim();
  if (!text) process.exit(0);

  const cut = text.length > LIMIT;
  if (cut) text = text.slice(0, LIMIT);

  const lines = [
    `## 이어 받은 작업 - ${file}`,
    '',
    '이전 세션이 남긴 HANDOFF.md 내용이다. 작업 규칙 4번(docs/WORK-RULES.md)대로 한다: 세 줄로 요약해 보여 주고, 모델 추천이 필요하면 추천한 뒤, "다음 할 일"부터 바로 이어 간다. 적힌 작업이 모두 끝나면 이 파일을 지운다.',
  ];
  if (cut) lines.push(`(글이 길어 앞 ${LIMIT}자만 넣었다 - 나머지는 이 파일을 직접 읽는다.)`);
  lines.push('', '---', '', text);

  process.stdout.write(
    JSON.stringify({
      systemMessage: 'HANDOFF.md를 불러왔습니다. "계속"이라고 입력하면 이어서 진행합니다.',
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') },
    }),
  );
} catch {
  process.exit(0);
}
