import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ensureHealth, normalizeHealthPayload, ingestHealthEntry, evaluateHealth } from '../lib/health.mjs';
import { BROWSER_CATALOG, PHONE_MODES, pickBrowser, pickPhone, phonePromptBlock } from '../lib/tools.mjs';
import { AI_CATALOG } from '../lib/catalog.mjs';
import { seedData } from '../lib/seed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('대표 헬스 파싱 (단축어 플랫 JSON + Apple Health Auto Export 중첩 JSON + 수면 분→시간)', () => {
  const n1 = normalizeHealthPayload({ steps: 8420, sleep: 450, restingHr: 61, exerciseMin: 40, energy: 5, source: 'iphone-shortcut' }, '2026-11-21');
  assert.equal(n1.steps, 8420);
  assert.equal(n1.sleepHours, 7.5);
  assert.equal(n1.restingHr, 61);
  assert.equal(n1.exerciseMin, 40);
  assert.equal(n1.energy, 5);
  assert.equal(n1.source, 'iphone-shortcut');

  const n2 = normalizeHealthPayload({
    data: {
      metrics: [
        { name: 'step_count', data: [{ qty: 3200 }, { qty: 2800 }] },
        { name: 'resting_heart_rate', data: [{ qty: 64 }] },
        { name: 'apple_exercise_time', data: [{ qty: 25 }] },
        { name: 'sleep_analysis', data: [{ totalSleep: 7.2 }] },
      ],
    },
  }, '2026-11-21');
  assert.equal(n2.steps, 6000);
  assert.equal(n2.restingHr, 64);
  assert.equal(n2.exerciseMin, 25);
  assert.equal(n2.sleepHours, 7.2);
  assert.equal(n2.source, 'health-auto-export');
});

test('대표 컨디션 점수 평가 (최상 · 수면 부족 위임 권고 · 7일 추이)', () => {
  const d = {};
  ensureHealth(d);
  // 컨디션 최상
  ingestHealthEntry(d, { date: '2026-11-21', steps: 9200, sleepHours: 7.8, restingHr: 60, exerciseMin: 40, energy: 5 }, '2026-11-21');
  const best = evaluateHealth(d.health, '2026-11-21', 15);
  assert.equal(best.level, 'best');
  assert.equal(best.delegateRecommended, false);
  assert.ok(best.score >= 80);
  assert.equal(best.trend7.length, 7);
  assert.equal(best.trend7[6].label, '오늘');

  // 수면 부족(4.5시간) + 고심박 → 컨디션 주의/휴식 + AI 위임 권고
  const d2 = {};
  ensureHealth(d2);
  ingestHealthEntry(d2, { date: '2026-11-21', steps: 900, sleepHours: 4.5, restingHr: 88, exerciseMin: 0, energy: 2 }, '2026-11-21');
  const low = evaluateHealth(d2.health, '2026-11-21', 16);
  assert.ok(['caution', 'rest'].includes(low.level));
  assert.equal(low.delegateRecommended, true);
  assert.match(low.advice, /AI|회복/);
});

test('브라우저·스마트폰·AI 직원 카탈로그 확장 및 아이폰 미러링 지시서 안전선', () => {
  const brKeys = new Set(BROWSER_CATALOG.map((b) => b.key));
  for (const k of ['eldo', 'ego-lite', 'aside', 'chrome', 'dia', 'comet', 'arc', 'safari']) assert.ok(brKeys.has(k));

  const aiKeys = new Set(AI_CATALOG.map((a) => a.key));
  for (const k of ['dots', 'geminicli', 'antigravity', 'manus', 'muse', 'pickle']) assert.ok(aiKeys.has(k));

  assert.equal(PHONE_MODES.length, 3);

  const d = seedData();
  d.resources.push(
    { id: 'br-eldo', kind: '브라우저', name: 'ELDO', preset: 'eldo', status: '사용 가능', isDefault: false },
    { id: 'br-aside', kind: '브라우저', name: 'Aside', preset: 'aside', status: '사용 가능', isDefault: true },
    { id: 'br-dia', kind: '브라우저', name: 'Dia', preset: 'dia', status: '사용 가능', isDefault: false },
    { id: 'ph-1', kind: '스마트폰', name: 'Jay iPhone', phoneMode: 'iphone-mirror', hostMachine: 'mbp', status: '사용 가능' },
  );
  assert.equal(pickBrowser('ELDO에서 홈택스 영수증 확인해 줘', d.resources)?.id, 'br-eldo');
  assert.equal(pickBrowser('Dia에서 경쟁사 가격 확인해 줘', d.resources)?.id, 'br-dia');
  assert.equal(pickBrowser('이메일 확인해 줘', d.resources)?.id, 'br-aside');

  const ph = pickPhone('아이폰 인스타 앱에서 릴스 커버 확인해 줘', d.resources);
  assert.equal(ph?.id, 'ph-1');
  const block = phonePromptBlock(ph, d.resources, { orca: true });
  assert.match(block, /맥북 프로.*iPhone Mirroring/);
  assert.match(block, /orca computer/);
  assert.match(block, /잠금 해제.*결제.*송금/);
});

async function startTestServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aihq-ha-'));
  const port = 19910 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], {
    env: {
      ...process.env,
      AIHQ_PORT: String(port),
      AIHQ_DATA_DIR: dir,
      AIHQ_WORKSPACES: path.join(dir, 'ws'),
      AIHQ_SEED: 'example',
      AIHQ_NO_OPEN: '1',
      AIHQ_DISPATCH: '0',
      AIHQ_LLM_MODEL: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${origin}/api/state`); if (r.ok) break; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 80));
  }
  const secret = fs.readFileSync(path.join(dir, '.human-session'), 'utf8').trim();
  const ui = async (method, url, body) => {
    const r = await fetch(`${origin}${url}`, {
      method,
      headers: {
        Origin: origin,
        'X-HQ-UI': '1',
        Cookie: `hq_human=${secret}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const stop = async () => {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { origin, ui, stop };
}

test('서버 통합: 헬스 Webhook 토큰 인증 · 프라이버시 차단(청사진/리포트) · 스마트폰 미러링 프롬프트 자동 주입', async () => {
  const srv = await startTestServer();
  try {
    const st0 = await (await fetch(`${srv.origin}/api/state`)).json();
    const token = st0.health?.token;
    assert.ok(token && token.length >= 16, '로컬 헬스 토큰이 발급되어야 함');
    assert.equal(st0.data.health, undefined, 'data 객체에는 raw health가 중복 노출되지 않아야 함');

    // 1) 토큰 없이 외부(non-UI) 요청은 거부
    const bad = await fetch(`${srv.origin}/api/health/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIHQ-Health-Token': 'wrong-token' },
      body: JSON.stringify({ steps: 5000 }),
    });
    assert.ok([401, 403].includes(bad.status));

    // 2) 올바른 토큰으로 아이폰 단축어 형식 전송 → 즉시 반영
    const okIngest = await fetch(`${srv.origin}/api/health/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIHQ-Health-Token': token },
      body: JSON.stringify({ steps: 8800, sleepHours: 7.6, restingHr: 61, exerciseMin: 35, energy: 5, source: 'iphone-shortcut' }),
    });
    assert.equal(okIngest.status, 200);
    const okJson = await okIngest.json();
    assert.equal(okJson.ok, true);
    assert.equal(okJson.health.level, 'best');

    // 3) 프라이버시 경계: 청사진 내보내기와 일일 리포트에 건강 데이터·토큰이 절대 유출되지 않음
    const bp = await srv.ui('GET', '/api/ui/blueprint/export');
    assert.equal(bp.status, 200);
    const bpStr = JSON.stringify(bp.body);
    assert.ok(!bpStr.includes(token), '청사진에 헬스 토큰이 들어가면 안 됨');
    assert.ok(!bpStr.includes('8800'), '청사진에 걸음 수가 들어가면 안 됨');
    const rep = await srv.ui('GET', '/api/ui/report/daily');
    assert.equal(rep.status, 200);
    assert.ok(!JSON.stringify(rep.body).includes(token), '리포트에 헬스 토큰이 들어가면 안 됨');

    // 4) 컴퓨터 유즈 스위치 + 스마트폰(아이폰 미러링) 등록 + 브라우저 직접 추가
    const patchMac = await srv.ui('PATCH', '/api/ui/resources/mbp', { computerUse: true });
    assert.equal(patchMac.status, 200);
    assert.equal(patchMac.body.computerUse, true);

    const addPhone = await srv.ui('POST', '/api/ui/resources', {
      kind: '스마트폰', name: 'Jay iPhone', phoneMode: 'iphone-mirror', hostMachine: 'mbp',
    });
    assert.equal(addPhone.status, 200);
    assert.equal(addPhone.body.phoneMode, 'iphone-mirror');

    const addBr = await srv.ui('POST', '/api/ui/resources', {
      kind: '브라우저', name: 'Aside', preset: 'aside', isDefault: true,
    });
    assert.equal(addBr.status, 200);

    // 5) 아이폰 앱 관련 할 일 생성 → 프롬프트 미리보기에 iPhone Mirroring + 고정 안전선 자동 주입
    const addTask = await srv.ui('POST', '/api/ui/tasks', {
      title: '아이폰 인스타 앱에서 릴스 커버 확인해 줘',
      assignee: 'codex',
    });
    assert.equal(addTask.status, 200);
    const prev = await srv.ui('GET', `/api/ui/tasks/${addTask.body.id}/prompt-preview`);
    assert.equal(prev.status, 200);
    assert.equal(prev.body.linked.phone?.name, 'Jay iPhone');
    assert.match(prev.body.prompt, /iPhone Mirroring/);
    assert.match(prev.body.prompt, /잠금 해제.*결제.*송금/);
  } finally {
    await srv.stop();
  }
});
