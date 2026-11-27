#!/usr/bin/env node
// CONNECT AI HQ · 한 줄로 켜기
//   npx github:wonseokjung/connect-ai-autonomous-company                 본사를 켜고 브라우저를 연다 (데이터: ~/.connect-ai-hq)
//   npx github:wonseokjung/connect-ai-autonomous-company connect         내 바이브코딩 툴(9종)에 MCP와 직원 수첩(스킬)을 한 번에 연결한다
//   npx github:wonseokjung/connect-ai-autonomous-company connect --yes   묻지 않고 감지된 모든 바이브코딩 툴에 즉시 일괄 연결 (--dry-run 미리보기)
//   npx github:wonseokjung/connect-ai-autonomous-company disconnect      연결했던 aihq MCP 항목과 스킬만 안전하게 제거 (.bak 백업)
//   npx github:wonseokjung/connect-ai-autonomous-company mcp             MCP 서버 (AI 도구 설정에서 부르는 명령)
//   npx github:wonseokjung/connect-ai-autonomous-company task ...        AI 직원용 보고 명령 (hq 와 같음)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { banner } from '../lib/banner.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME_DIR = path.join(os.homedir(), '.connect-ai-hq');
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'start';

function flag(name) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const hasFlag = (...names) => names.some((n) => argv.includes(n));

const HELP = `CONNECT AI HQ v2 · 인공지능 시대, 당신의 삶과 AI 일을 함께 최적화하는 본사

  npx github:wonseokjung/connect-ai-autonomous-company                 본사를 켜고 브라우저를 엽니다
      --port <번호>                 기본 8790
      --no-open                     브라우저를 열지 않음
      --example                     데이터가 없을 때 예시 회사로 시작 (AIHQ_SEED=example 과 같음)
  npx github:wonseokjung/connect-ai-autonomous-company connect         내 바이브코딩 툴(Claude Code·Codex·Antigravity·Cursor 등 9종) 자동 감지 후 일괄 연결
      --yes, -y                     확인 없이 감지된 모든 툴에 즉시 일괄 연결 (기존 설정 .bak 자동 백업)
      --dry-run                     파일을 수정하지 않고 무엇이 연결될지 미리보기
  npx github:wonseokjung/connect-ai-autonomous-company disconnect      연결한 aihq MCP·스킬만 깔끔히 제거 (--yes / --dry-run 지원)
  npx github:wonseokjung/connect-ai-autonomous-company mcp             MCP 서버 (HQ_EMPLOYEE=<직원 아이디>)
  npx github:wonseokjung/connect-ai-autonomous-company <hq 명령>        AI 직원용 보고 명령. 예: task list --mine codex

데이터 폴더: ${HOME_DIR} (AIHQ_DATA_DIR 로 바꿀 수 있음)
`;

function openBrowser(url) {
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(bin, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch { /* 브라우저를 못 열면 주소만 보여 준다 */ }
}

async function isHq(base) {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(1500) });
    return { up: true, hq: /<title>CONNECT AI HQ/.test(await res.text()) };
  } catch {
    return { up: false, hq: false };
  }
}

async function start() {
  const port = Number(flag('port') || process.env.AIHQ_PORT || 8790);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('포트 번호가 맞지 않아요.'); process.exit(1); }
  const url = `http://127.0.0.1:${port}`;
  const open = flag('no-open') === undefined && process.env.AIHQ_NO_OPEN !== '1';
  const now = await isHq(url);
  if (now.hq) {
    console.log(`이미 켜져 있어요: ${url}`);
    if (open) openBrowser(url);
    return;
  }
  if (now.up) { console.error(`${port}번 포트를 다른 프로그램이 쓰고 있어요. --port 8791 처럼 다른 번호로 켜 주세요.`); process.exit(1); }

  process.env.AIHQ_PORT = String(port);
  if (flag('example') === true) process.env.AIHQ_SEED = 'example';
  process.env.AIHQ_DATA_DIR = process.env.AIHQ_DATA_DIR || path.join(HOME_DIR, 'data');
  process.env.AIHQ_WORKSPACES = process.env.AIHQ_WORKSPACES || path.join(HOME_DIR, 'workspaces');
  fs.mkdirSync(process.env.AIHQ_DATA_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(process.env.AIHQ_WORKSPACES, { recursive: true });

  console.log('\nCONNECT AI HQ v2 · 인공지능 시대, 당신의 삶과 AI 일을 함께 최적화하는 본사');
  console.log(`데이터: ${process.env.AIHQ_DATA_DIR} (이 컴퓨터 안에만 저장)`);
  await import(pathToFileURL(path.join(ROOT, 'server.mjs')).href);
  for (let i = 0; i < 40; i++) {
    if ((await isHq(url)).hq) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`바이브코딩 툴 한 번에 연결: npx github:wonseokjung/connect-ai-autonomous-company connect --yes · 끄기: Ctrl+C\n`);
  if (open) openBrowser(url);
}

async function fetchEmployees() {
  const base = (process.env.AIHQ_URL || `http://127.0.0.1:${flag('port') || process.env.AIHQ_PORT || 8790}`).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/agent/employees`, { headers: { 'X-HQ-Agent': '1', 'User-Agent': 'aihq-cli/1' }, signal: AbortSignal.timeout(1500) });
    if (res.ok) return await res.json();
  } catch { /* 본사가 꺼져 있으면 기본 직원 아이디로 */ }
  return [];
}

function fmtInstallResult(r, t) {
  const parts = [];
  if (r.mcp === 'already') parts.push('MCP 이미 연결됨');
  else if (r.mcp === 'installed-cli') parts.push('MCP 연결 완료(CLI)');
  else if (r.mcp === 'installed-json') parts.push(`MCP 안전 병합 완료${r.backupPath ? ' (.bak 백업)' : ''}`);
  else if (r.mcp === 'dry-run-cli') parts.push(`MCP 예정(CLI): ${t.mcp.line}`);
  else if (r.mcp === 'dry-run-json') parts.push(`MCP 예정(JSON 안전 병합): ${t.mcp.file}`);
  else if (r.mcp === 'failed') parts.push(`MCP 실패(${r.error || '오류'})`);

  if (r.skill === 'already') parts.push('스킬 이미 있음');
  else if (r.skill === 'installed') parts.push('스킬 설치 완료');
  else if (r.skill === 'dry-run') parts.push(`스킬 예정: ${t.skill.to}`);
  return parts.join(' · ') || '변경 없음';
}

// 내 컴퓨터에 설치된 바이브코딩 툴(9종)에 MCP와 직원 수첩(스킬)을 안전하게 일괄/선택 연결한다.
async function connect() {
  const { connectTargets, installTarget, installSharedSkill } = await import('../lib/connect.mjs');
  const autoYes = hasFlag('--yes', '-y', '--all');
  const dryRun = hasFlag('--dry-run');
  const employees = await fetchEmployees();
  const targets = connectTargets({ employees }).filter((t) => t.found);

  console.log(`\nCONNECT AI HQ · 바이브코딩 툴 자동 연결${dryRun ? ' (미리보기 --dry-run)' : ''}`);
  if (!targets.length) {
    console.log('이 컴퓨터에서 연결할 바이브코딩 툴(Claude Code·Codex·Antigravity·Cursor·Gemini CLI·OpenCode·Windsurf·Claude Desktop·LM Studio)을 찾지 못했어요.');
    console.log('웹에서 쓰는 AI(ChatGPT·Claude·Dots·Muse 등)는 본사 화면에서 지시문 복사로 바로 쓸 수 있어요.\n');
    return;
  }

  let todoCount = 0;
  for (const t of targets) {
    const done = t.mcp.configured && (!t.skill || t.skill.installed);
    if (!done) todoCount++;
    const mark = done ? '✓ 이미 연결됨' : '○ 연결 예정';
    console.log(`  ${mark}  ${t.name} (직원 아이디: ${t.employee}${t.skill ? ' · MCP + 스킬' : ' · MCP'})`);
  }

  if (!todoCount && !dryRun) {
    const shared = installSharedSkill({ dryRun: false });
    console.log(`\n감지된 ${targets.length}개 툴이 이미 모두 연결되어 있어요.${shared.status === 'installed' ? ' (공용 스킬 ~/.agents/skills 도 함께 채워 두었어요)' : ''}\n`);
    return;
  }

  const tty = process.stdin.isTTY && process.stdout.isTTY;
  let mode = dryRun ? 'all' : autoYes ? 'all' : null;
  let rl = null;
  if (!mode) {
    if (!tty) {
      console.log('\n대화형 터미널이 아니라서 미리보기만 출력합니다. 한 번에 연결하려면 --yes 를 붙여 실행하세요:');
      console.log('  npx github:wonseokjung/connect-ai-autonomous-company connect --yes\n');
      for (const t of targets) {
        const r = installTarget(t, { dryRun: true });
        console.log(`· ${t.name}: ${fmtInstallResult(r, t)}`);
      }
      return;
    }
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = (await rl.question(`\n감지된 ${targets.length}개 툴(미연결 ${todoCount}개)에 한 번에 연결할까요? (기존 설정은 .bak 백업)\n  [Y] 한 번에 전부 연결 (기본)  /  [s] 도구마다 선택  /  [n] 취소 : `)).trim().toLowerCase();
    if (ans === 'n' || ans === 'no' || ans === '아니요') {
      rl.close();
      console.log('취소했어요. 아무 파일도 바꾸지 않았습니다.\n');
      return;
    }
    mode = ans === 's' ? 'select' : 'all';
  }

  try {
    let okCount = 0;
    for (const t of targets) {
      if (mode === 'select' && rl) {
        const done = t.mcp.configured && (!t.skill || t.skill.installed);
        if (done) { console.log(`\n· ${t.name}: 이미 연결됨 ✓`); continue; }
        const ok = /^(|y|yes|예|네|응)$/i.test((await rl.question(`\n· ${t.name} 연결할까요? [Y/n] `)).trim());
        if (!ok) { console.log('  건너뜀'); continue; }
      }
      const r = installTarget(t, { dryRun });
      if (r.mcp !== 'failed') okCount++;
      console.log(`· ${t.name}: ${fmtInstallResult(r, t)}`);
      if (r.mcp === 'failed' && t.mcp.snippet) {
        console.log(`  → ${t.mcp.file} 의 JSON 형식을 확인한 뒤 아래를 직접 합쳐 주세요:\n${t.mcp.snippet.replace(/^/gm, '    ')}`);
      } else if (r.mcp === 'failed' && t.mcp.line) {
        console.log(`  → 직접 실행 명령: ${t.mcp.line}`);
      }
    }
    const shared = installSharedSkill({ dryRun });
    if (shared.status === 'installed') console.log(`· 공용 스킬: ${shared.to} 설치 완료`);
    else if (shared.status === 'dry-run') console.log(`· 공용 스킬 예정: ${shared.to}`);
    console.log(dryRun
      ? '\n[미리보기 완료] 실제 연결하려면 --dry-run 을 빼고 다시 실행하세요.\n'
      : okCount === 0
        ? `\n연결에 실패한 툴이 있어요 (0/${targets.length}개). 위 안내를 확인한 뒤 다시 시도해 주세요.\n`
        : `\n완료! (${okCount}/${targets.length}개 툴 연결됨) 이제 각 바이브코딩 툴을 열면 "출근해 / 내 할 일 확인해" 로 본사와 바로 일할 수 있어요.\n`);
  } finally {
    rl?.close();
  }
}

async function disconnect() {
  const { connectTargets, uninstallTarget, uninstallSharedSkill } = await import('../lib/connect.mjs');
  const autoYes = hasFlag('--yes', '-y', '--all');
  const dryRun = hasFlag('--dry-run');
  const employees = await fetchEmployees();
  const targets = connectTargets({ employees }).filter((t) => t.mcp.configured || t.skill?.installed);

  console.log(`\nCONNECT AI HQ · 바이브코딩 툴 연결 해제${dryRun ? ' (미리보기 --dry-run)' : ''}`);
  if (!targets.length) {
    const sh = uninstallSharedSkill({ dryRun });
    console.log(sh.status === 'removed' ? `공용 스킬(${sh.to})을 제거했어요.\n` : '연결되어 있는 aihq 설정이 없어요.\n');
    return;
  }
  for (const t of targets) console.log(`  · ${t.name} (${t.mcp.configured ? 'MCP' : ''}${t.mcp.configured && t.skill?.installed ? ' + ' : ''}${t.skill?.installed ? '스킬' : ''})`);

  if (!dryRun && !autoYes) {
    if (!(process.stdin.isTTY && process.stdout.isTTY)) {
      console.log('\n제거하려면 --yes 옵션을 붙여 실행해 주세요.\n');
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = (await rl.question('\n위 툴에서 aihq 항목만 제거할까요? (다른 MCP 설정은 그대로 유지됩니다) [y/N] ')).trim();
    rl.close();
    if (!/^(y|yes|예|네|응)$/i.test(ans)) { console.log('취소했어요.\n'); return; }
  }

  for (const t of targets) {
    const r = uninstallTarget(t, { dryRun });
    console.log(`· ${t.name}: MCP=${r.mcp}${t.skill ? ` · 스킬=${r.skill}` : ''}${r.backupPath ? ' (.bak 백업)' : ''}`);
  }
  const sh = uninstallSharedSkill({ dryRun });
  if (sh.status === 'removed' || sh.status === 'dry-run') console.log(`· 공용 스킬: ${sh.status} (${sh.to})`);
  console.log(dryRun ? '\n[미리보기 완료]\n' : '\n깔끔하게 연결 해제했어요.\n');
}

async function main() {
  // the gold banner only where a person reads the screen (never on mcp: stdout there is the protocol)
  if (cmd === 'help' || cmd === '--help' || flag('help') === true || flag('h') === true) { console.log(banner()); console.log(HELP); return; }
  if (cmd === 'start') { console.log(banner()); return start(); }
  if (cmd === 'connect') { console.log(banner()); return connect(); }
  if (cmd === 'disconnect') return disconnect();
  if (cmd === 'mcp') { await import(pathToFileURL(path.join(ROOT, 'mcp', 'server.mjs')).href); return; }
  // 나머지는 AI 직원용 보고 명령 (hq) 으로 넘긴다
  let rest = cmd === 'hq' ? argv.slice(1) : argv;
  const pi = rest.indexOf('--port');
  if (pi >= 0) {
    if (!process.env.AIHQ_URL && /^\d{1,5}$/.test(rest[pi + 1] || '')) process.env.AIHQ_URL = `http://127.0.0.1:${rest[pi + 1]}`;
    rest = [...rest.slice(0, pi), ...rest.slice(pi + 2)];
  }
  process.argv = [process.argv[0], path.join(ROOT, 'bin', 'hq.mjs'), ...rest];
  await import(pathToFileURL(path.join(ROOT, 'bin', 'hq.mjs')).href);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
