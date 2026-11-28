import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractRecurringSchedule, extractKoreanTime } from '../lib/util.mjs';
import { detectGate } from '../lib/gates.mjs';
import { normalizeEmployeeSkill, matchEmployeeSkills } from '../lib/tools.mjs';
import { exportBlueprint } from '../lib/blueprint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUB = path.join(ROOT, 'qa', 'stub-agent.mjs');

async function startServer(extraEnv = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aihq-kb-test-'));
  const port = 19500 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      AIHQ_PORT: String(port),
      AIHQ_DATA_DIR: path.join(dir, 'data'),
      AIHQ_WORKSPACES: path.join(dir, 'ws'),
      AIHQ_SEED: 'example',
      AIHQ_NO_OPEN: '1',
      AIHQ_DISPATCH: '0',
      AIHQ_AUTO_ENABLE: '1',
      AIHQ_NO_NOTIFY: '1',
      AIHQ_NO_CAFFEINATE: '1',
      AIHQ_NO_BROWSER_PROBE: '1',
      AIHQ_TEST_RAM_PCT: '40',
      AIHQ_LLM_MODEL: '',
      AIHQ_CLAUDE_BIN: STUB,
      AIHQ_CODEX_BIN: STUB,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const origin = `http://127.0.0.1:${port}`;
  const dataDir = path.join(dir, 'data');
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${origin}/api/state`);
      if (r.ok) {
        const secret = (await fs.readFile(path.join(dataDir, '.human-session'), 'utf8')).trim();
        const cookie = `hq_human=${secret}`;
        return {
          origin,
          cookie,
          async ui(method, p, body) {
            const res = await fetch(`${origin}${p}`, {
              method,
              headers: { 'Content-Type': 'application/json', 'X-HQ-UI': '1', 'Sec-Fetch-Site': 'same-origin', Origin: origin, Cookie: cookie },
              body: body === undefined ? undefined : JSON.stringify(body),
            });
            return { status: res.status, body: await res.json().catch(() => null) };
          },
          async agent(method, p, body) {
            const res = await fetch(`${origin}${p}`, {
              method,
              headers: { 'Content-Type': 'application/json', 'User-Agent': 'aihq-cli/1', 'X-HQ-Agent': '1' },
              body: body === undefined ? undefined : JSON.stringify(body),
            });
            return { status: res.status, body: await res.json().catch(() => null) };
          },
          async close() {
            child.kill('SIGTERM');
            await new Promise((res) => child.once('exit', res));
            await fs.rm(dir, { recursive: true, force: true });
          },
        };
      }
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 80));
  }
  child.kill('SIGKILL');
  throw new Error('테스트 서버 기동 시간 초과');
}

test('반복 명령 자연어 파싱 + 주요/세부 스킬 매칭 단위 검증', () => {
  const iv = extractRecurringSchedule('5분마다 이메일 체크해줘');
  assert.equal(iv?.intervalMin, 5);
  const hourly = extractRecurringSchedule('매시간 AI 막힘 점검');
  assert.equal(hourly?.intervalMin, 60);
  const daily = extractRecurringSchedule('매일 오전 8시 30분 유튜브 브리핑');
  assert.equal(daily?.time, '08:30');
  assert.deepEqual(daily?.days, [0, 1, 2, 3, 4, 5, 6]);
  const weekly = extractRecurringSchedule('매주 월요일 9시에 주간 보고');
  assert.deepEqual(weekly?.days, [1]);
  assert.equal(weekly?.time, '09:00');
  const twoHr = extractRecurringSchedule('2시간마다 물 마시기 알람');
  assert.equal(twoHr?.intervalMin, 120);
  const morn = extractRecurringSchedule('아침마다 AI 뉴스 3줄 브리핑해줘');
  assert.equal(morn?.time, '08:30');
  const mwf = extractRecurringSchedule('매주 월, 수, 금 오전 9시 쇼츠 훅 아이디어 3개');
  assert.deepEqual(mwf?.days, [1, 3, 5]);
  assert.equal(mwf?.time, '09:00');
  // 초안·사전 벤치마크·금지 안내 문구는 안전 통과, 실제 게시/발송은 반드시 차단
  assert.equal(detectGate('매일 아침 8시 유튜브 업로드 전 벤치마크 분석해줘'), null);
  assert.equal(detectGate('새 유튜브 영상 인스타 스레드 X 크로스포스팅 초안 써줘'), null);
  assert.equal(detectGate('답장 초안만 저장하고 실제 발송이나 삭제는 절대 하지 마'), null);
  assert.equal(detectGate('매일 밤 9시 인스타에 바로 게시해줘'), '게시');
  assert.equal(detectGate('매일 오전 10시 고객에게 이메일 바로 보내줘'), '발송');
  assert.equal(extractRecurringSchedule('지금 유튜브 쇼츠 훅 3개 써줘'), null);
  // 화면비("9:16", "16:9", "1:1")는 예약 시각("09:16")으로 오인하면 안 됨
  assert.equal(extractKoreanTime('이 영상에 모션그래픽 넣어줘 9:16 숏츠 편집'), null);
  assert.equal(extractKoreanTime('16:9 가로 영상과 1:1 정사각형 크롭'), null);
  assert.equal(extractKoreanTime('오전 9:16에 회의 알림'), '09:16');

  const sk = normalizeEmployeeSkill({
    name: 'Connect AI Motion',
    command: 'npx connect-ai-video-motion',
    primary: true,
    subSkills: '인물 피해 모션그래픽 배치, 9:16 숏폼 크롭',
  });
  assert.equal(sk.primary, true);
  assert.equal(sk.subSkills.length, 2);
  const hits = matchEmployeeSkills('이 영상 9:16 숏폼 크롭으로 정리해줘', { skills: [sk] });
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].matchedSubSkills, ['9:16 숏폼 크롭']);
});

test('주요/세부 스킬 · AI 도구 자가 등록 · 내 지식 베이스(프롬프트 자동 주입/보안) · 선제적 멤버십 최적화 · 1줄 반복 오토메이션 · Ego Lite 프로브 통합 검증', async () => {
  const srv = await startServer({ AIHQ_TEST_USAGE_JSON: JSON.stringify({ claude: 100, codex: 5 }) });
  try {
    // 1) 주요 스킬 + 세부 스킬 장착 (UI) & AI 자가 등록 (Agent)
    const addSk = await srv.ui('POST', '/api/ui/employees/codex/skills', {
      presetKey: 'connect-ai-video-motion',
      primary: true,
      subSkills: ['인물 피해 모션그래픽 배치', '9:16 숏폼 크롭'],
    });
    assert.equal(addSk.status, 200);
    assert.equal(addSk.body.skill.primary, true);
    assert.equal(addSk.body.skill.subSkills.length, 2);

    const selfReg = await srv.agent('POST', '/api/agent/skills/register', {
      from: 'codex',
      name: 'yt-dlp',
      command: 'yt-dlp',
      subSkills: ['유튜브 자막 추출'],
    });
    assert.equal(selfReg.status, 200);
    assert.equal(selfReg.body.skill.addedBy, 'ai');
    assert.equal(selfReg.body.skill.subSkills[0].name, '유튜브 자막 추출');

    // 위험한 URL 차단 검증
    const badUrl = await srv.agent('POST', '/api/agent/skills/register', {
      from: 'codex',
      name: 'bad',
      repo: 'javascript:alert(1)',
    });
    assert.equal(badUrl.status, 400);

    // 2) 3계층 지식 베이스 (나의 지식[owner] · 공용 지식[shared] · AI 직원별[agent] 격리 + 권한 경계)
    const kb = await srv.ui('POST', '/api/ui/knowledge', {
      title: 'CONNECT AI LAB 브랜드 톤',
      category: '브랜드',
      layer: 'owner',
      tags: '유튜브, 강의, 톤',
      content: '군더더기 없이 직관적이고 실전 중심의 한국어로 답한다. 시그니처 컬러는 매트 블랙과 샴페인 골드.',
    });
    assert.equal(kb.status, 200);
    assert.equal(kb.body.category, '브랜드');
    assert.equal(kb.body.layer, 'owner');

    const agentKbList = await srv.agent('GET', '/api/agent/knowledge?emp=codex&q=매트');
    assert.equal(agentKbList.status, 200);
    assert.equal(agentKbList.body.length, 1);
    assert.equal(agentKbList.body[0].layer, 'owner');

    const overwriteBlocked = await srv.agent('POST', '/api/agent/knowledge', {
      from: 'codex',
      title: 'CONNECT AI LAB 브랜드 톤',
      content: 'AI가 마음대로 덮어쓰기 시도',
    });
    assert.equal(overwriteBlocked.status, 403, '대표가 작성한 지식은 AI가 덮어쓸 수 없어야 함');

    const ownerWriteBlocked = await srv.agent('POST', '/api/agent/knowledge', {
      from: 'codex',
      title: '대표 노하우 사칭 시도',
      layer: 'owner',
      content: 'AI가 나의 지식 계층에 직접 쓰기 시도',
    });
    assert.equal(ownerWriteBlocked.status, 403, 'AI 직원은 나의 지식(owner) 계층에 직접 작성할 수 없어야 함');

    const aiMemo = await srv.agent('POST', '/api/agent/knowledge', {
      from: 'codex',
      title: '쇼츠 자막 안전영역 메모',
      layer: 'shared',
      content: '상단 1/3 및 하단 240px 안전영역 준수',
      tags: '쇼츠, 자막, 강의',
    });
    assert.equal(aiMemo.status, 200);
    assert.equal(aiMemo.body.item.category, 'AI 학습 메모');
    assert.equal(aiMemo.body.item.layer, 'shared');
    assert.equal(aiMemo.body.item.updatedBy, 'codex');

    const claudeSecret = await srv.agent('POST', '/api/agent/knowledge', {
      from: 'claude',
      title: 'Claude 전용 강의 분석 체크리스트',
      layer: 'agent',
      content: 'CLAUDE_PRIVATE_ONLY_TOKEN_999',
      tags: '강의, 분석',
    });
    assert.equal(claudeSecret.status, 200);
    assert.equal(claudeSecret.body.item.layer, 'agent');
    assert.equal(claudeSecret.body.item.scope, 'claude');

    // 계층별 필터 + 타 AI 전용 지식 격리 검증
    const codexAll = await srv.agent('GET', '/api/agent/knowledge?emp=codex');
    assert.equal(codexAll.body.some((x) => x.title === 'Claude 전용 강의 분석 체크리스트'), false, 'Codex는 Claude 전용 지식을 열람할 수 없어야 함');
    const codexShared = await srv.agent('GET', '/api/agent/knowledge?emp=codex&layer=shared');
    assert.ok(codexShared.body.every((x) => x.layer === 'shared') && codexShared.body.length >= 1);
    const claudeOwn = await srv.agent('GET', '/api/agent/knowledge?emp=claude&layer=agent');
    assert.equal(claudeOwn.body.length, 1);
    assert.equal(claudeOwn.body[0].scope, 'claude');

    // 3) 선제적 멤버십 최적화 라우팅: 메인 AI를 claude(한도 100%)로 지정해도 일반 작업은 여유 있는 codex(5%)로 선제 우회!
    await srv.ui('PATCH', '/api/ui/settings', { mainAi: 'claude' });
    const del = await srv.ui('POST', '/api/ui/coordinator/delegate', {
      title: '12월 강의 소개 문구 2줄만 써줘',
    });
    assert.equal(del.status, 200);
    assert.equal(del.body.assignee, 'codex', 'Claude 100% 한도일 때 여유 있는 Codex(5%)로 선제 우회해야 함');
    assert.match(del.body.reason, /멤버십 최적화/);

    // 4) 최종 프롬프트 미리보기에 나의 지식(대표) + 공용 지식(AI 협업) 라벨 주입, 타 AI(Claude) 전용 지식은 비노출 확인
    const prev = await srv.ui('GET', `/api/ui/tasks/${del.body.id}/prompt-preview`);
    assert.equal(prev.status, 200);
    assert.match(prev.body.prompt, /★ \[주요\] connect-ai-video-motion/);
    assert.match(prev.body.prompt, /9:16 숏폼 크롭/);
    assert.match(prev.body.prompt, /나의 지식\(대표 노하우\).*CONNECT AI LAB 브랜드 톤/);
    assert.match(prev.body.prompt, /공용 지식\(AI 협업\).*쇼츠 자막 안전영역 메모/);
    assert.doesNotMatch(prev.body.prompt, /CLAUDE_PRIVATE_ONLY_TOKEN_999/, '다른 AI 직원(Claude)의 전용 지식은 Codex 프롬프트에 섞이면 안 됨');
    assert.match(prev.body.prompt, /npx connect-ai-video-motion install-skill/);

    // 4-b) CONNECT AI 직원 14종 일괄 등록 + 공개 전(준비 중) 스킬 자동 배분 제외 + doctor 점검 검증
    const packRes = await srv.ui('POST', '/api/ui/skills/connect-ai-pack', {});
    assert.equal(packRes.status, 200);
    assert.equal(packRes.body.total, 14);
    const writerInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-writer');
    const xrInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-xr');
    const motionInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-motion');
    const videoInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-video-motion');
    const devInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-developer');
    const acctInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-accountant');
    const locInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-localizer');
    const blenderInfo = packRes.body.assigned.find((a) => a.key === 'connect-ai-blender');
    assert.equal(writerInfo?.published, true, 'connect-ai-writer는 공개 직원이어야 함');
    assert.equal(xrInfo?.published, true, 'connect-ai-xr는 공개 직원이어야 함');
    assert.equal(motionInfo?.published, true, 'connect-ai-motion은 GitHub 공개 완료');
    assert.equal(videoInfo?.published, true);
    assert.equal(devInfo?.published, true, 'connect-ai-developer는 공개 직원이어야 함');
    assert.equal(acctInfo?.published, true, 'connect-ai-accountant는 공개 직원이어야 함');
    assert.equal(locInfo?.published, true, 'connect-ai-localizer는 공개 직원이어야 함');
    assert.equal(blenderInfo?.published, false, 'connect-ai-blender는 아직 공개 전(준비 중)이어야 함');
    assert.equal(blenderInfo?.doctorStatus, 'upcoming');

    // 공개 안 된 connect-ai-blender 스킬은 matchEmployeeSkills에서 완전히 제외되어야 함
    const stPack = await srv.ui('GET', '/api/state');
    const blenderOwner = stPack.body.data.employees.find((e) => e.id === blenderInfo.empId);
    const unpubHits = matchEmployeeSkills('connect-ai-blender 블렌더 자동화 3d 렌더 파이프라인', blenderOwner);
    assert.equal(unpubHits.some((s) => s.preset === 'connect-ai-blender'), false, '공개 전 스킬은 자동 배분 매칭에서 제외되어야 함');

    // 공개 전 스킬 doctor 호출 시 upcoming 유지
    const upSkill = blenderOwner.skills.find((s) => s.preset === 'connect-ai-blender');
    const upDoc = await srv.ui('POST', `/api/ui/employees/${blenderOwner.id}/skills/${upSkill.id}/doctor`, {});
    assert.equal(upDoc.status, 200);
    assert.equal(upDoc.body.doctor.status, 'upcoming');

    // 동료 직원의 공개 스킬이 멤버십 한도 우회 시 대체 AI 프롬프트에도 자동 공유되는지 검증
    const bypassSkillTask = await srv.ui('POST', '/api/ui/coordinator/delegate', {
      title: '이 사업 해부해 줘 https://example.com',
    });
    assert.equal(bypassSkillTask.status, 200);
    assert.equal(bypassSkillTask.body.time, null);
    const bypassPrev = await srv.ui('GET', `/api/ui/tasks/${bypassSkillTask.body.id}/prompt-preview`);
    assert.equal(bypassPrev.status, 200);
    assert.match(bypassPrev.body.prompt, /reversebusiness/);

    // machineHealth에 잔여량·움직임 필드가 포함되는지 검증
    const macIds = Object.keys(stPack.body.machineHealth || {});
    assert.ok(macIds.length >= 1);
    assert.equal(Array.isArray(stPack.body.machineHealth[macIds[0]].activeJobs), true);
    assert.equal(typeof stPack.body.machineHealth[macIds[0]].moving, 'boolean');

    // 5) 청사진 내보내기에 주요·세부 스킬은 포함되고 비공개 내 지식은 제외되는지 확인
    const stNow = await srv.ui('GET', '/api/state');
    const bp = exportBlueprint(stNow.body.data);
    assert.equal(bp.knowledge, undefined, '비공개 내 지식은 청사진에 포함되지 않아야 함');
    const codexBp = bp.employeeSkills.find((x) => x.empName.includes('Codex'));
    assert.ok(codexBp?.skills?.some((s) => s.primary && s.subSkills?.length >= 2));

    // 6) #home 1줄 반복 명령 → 오토메이션 자동 등록 검증
    const recurRes = await srv.ui('POST', '/api/ui/coordinator/delegate', {
      title: '매일 오전 8시 30분 유튜브 트렌드 브리핑',
    });
    assert.equal(recurRes.status, 200);
    assert.equal(recurRes.body.isRecurring, true);
    assert.equal(recurRes.body.createdRoutine.time, '08:30');
    assert.equal(recurRes.body.createdRoutine.assignee, 'codex');

    // 7) 도구·인터넷 필수 작업("내 깃허브 전체 체크")은 순수 로컬 LLM(ollama)에 배정하지 않고 CLI 에이전트에 배정
    const ghTask = await srv.ui('POST', '/api/ui/coordinator/delegate', {
      title: '내 깃허브 전체 체크',
    });
    assert.equal(ghTask.status, 200);
    assert.notEqual(ghTask.body.assignee, 'ollama', '깃허브·도구 필요 작업은 인터넷/셸이 없는 로컬 LLM으로 가면 안 됨');
    assert.equal(ghTask.body.assignee, 'codex');

    // 8) Ego Lite 실시간 프로브 API 응답 구조 검증
    const probeRes = await srv.ui('GET', '/api/ui/browsers/probe');
    assert.equal(probeRes.status, 200);
    assert.equal(typeof probeRes.body.ego.installed, 'boolean');
    assert.equal(typeof probeRes.body.ego.connected, 'boolean');

    // 9) 오토메이션 · 할 일에 명시적으로 꽂은 지정 스킬(skills) + 지정 지식(knowledgeIds) 100% 프롬프트 주입 및 전파 검증
    const secretRuleKb = await srv.ui('POST', '/api/ui/knowledge', {
      title: '다국어 응답 기준서',
      category: '참고 자료',
      content: '스페인어·영어·일본어 등 작성자 언어 그대로 2문장 이내 친근하게 답하고 과장 금지. 마무리에 CONNECT AI LAB 서명 생략.',
      tags: ['다국어'],
      scope: 'all',
    });
    assert.equal(secretRuleKb.status, 200);
    const kbId = secretRuleKb.body.id;

    // 제목에 '다국어' 단어가 전혀 없어도 knowledgeIds로 명시 연결하면 반드시 최우선 주입되어야 함
    const pinnedRt = await srv.ui('POST', '/api/ui/routines', {
      title: '인스타그램 최신 컨텐츠 댓글 작성',
      intervalMin: 60,
      days: [0, 1, 2, 3, 4, 5, 6],
      assignee: 'auto',
      skills: ['connect-ai-marketer', 'connect-ai-video-motion'],
      knowledgeIds: [kbId],
      instruction: '최신 게시물 댓글에 자연스럽게 답글 초안을 준비하세요.',
    });
    assert.equal(pinnedRt.status, 200);
    assert.deepEqual(pinnedRt.body.skills, ['connect-ai-marketer', 'connect-ai-video-motion']);
    assert.deepEqual(pinnedRt.body.knowledgeIds, [kbId]);

    const rtPrev = await srv.ui('GET', `/api/ui/routines/${pinnedRt.body.id}/prompt-preview`);
    assert.equal(rtPrev.status, 200);
    assert.match(rtPrev.body.prompt, /대표가 지정한 필수 스킬/);
    assert.match(rtPrev.body.prompt, /connect-ai-marketer/);
    assert.match(rtPrev.body.prompt, /connect-ai-video-motion/);
    assert.match(rtPrev.body.prompt, /★ \[필수 · 나의 지식\(대표 노하우\) · 참고 자료\] 다국어 응답 기준서/);
    assert.match(rtPrev.body.prompt, /스페인어·영어·일본어/);
    assert.ok(rtPrev.body.linked.skills.some((s) => s.key === 'connect-ai-marketer'));
    assert.ok(rtPrev.body.linked.knowledge.some((k) => k.id === kbId && k.pinned === true));

    // 루틴에서 오늘 자동 생성된 할 일(task)도 skills·knowledgeIds를 그대로 상속받아야 함
    const stAfterRt = await srv.ui('GET', '/api/state');
    const spawned = stAfterRt.body.data.tasks.find((t) => t.routineId === pinnedRt.body.id);
    assert.ok(spawned, '오토메이션에서 오늘 할 일이 생성되어야 함');
    assert.deepEqual(spawned.skills, ['connect-ai-marketer', 'connect-ai-video-motion']);
    assert.deepEqual(spawned.knowledgeIds, [kbId]);
    const taskPrev = await srv.ui('GET', `/api/ui/tasks/${spawned.id}/prompt-preview`);
    assert.equal(taskPrev.status, 200);
    assert.match(taskPrev.body.prompt, /★ \[필수 · 나의 지식\(대표 노하우\) · 참고 자료\] 다국어 응답 기준서/);
    assert.match(taskPrev.body.prompt, /connect-ai-marketer/);

    // 루틴에서 지정 스킬 수정 시 오늘 할 일에도 동기화, 지식 삭제 시 참조 정리
    const patchedRt = await srv.ui('PATCH', `/api/ui/routines/${pinnedRt.body.id}`, {
      skills: ['connect-ai-marketer'],
    });
    assert.equal(patchedRt.status, 200);
    assert.deepEqual(patchedRt.body.skills, ['connect-ai-marketer']);
    const delKb = await srv.ui('DELETE', `/api/ui/knowledge/${kbId}`);
    assert.equal(delKb.status, 200);
    const stAfterDel = await srv.ui('GET', '/api/state');
    const rtAfterDel = stAfterDel.body.data.routines.find((r) => r.id === pinnedRt.body.id);
    const tAfterDel = stAfterDel.body.data.tasks.find((t) => t.id === spawned.id);
    assert.deepEqual(rtAfterDel.knowledgeIds, []);
    assert.deepEqual(tAfterDel.knowledgeIds, []);
    assert.deepEqual(tAfterDel.skills, ['connect-ai-marketer']);

    // 10) 오토메이션 '게시·업로드 승인 없이 바로 실행(autoApprove)' 검증 + 결제·삭제 안전선 유지 검증
    const autoPubRt = await srv.ui('POST', '/api/ui/routines', {
      title: '5분마다 유튜브 커뮤니티 댓글에 세종대왕 말투로 댓글 달아 게시',
      intervalMin: 5,
      days: [0, 1, 2, 3, 4, 5, 6],
      assignee: 'codex',
      autoApprove: true,
    });
    assert.equal(autoPubRt.status, 200);
    assert.equal(autoPubRt.body.autoApprove, true);
    assert.equal(autoPubRt.body.gate, null, 'autoApprove=true이면 게시 게이트가 자동 해제되어야 함');
    const autoPubPrev = await srv.ui('GET', `/api/ui/routines/${autoPubRt.body.id}/prompt-preview`);
    assert.equal(autoPubPrev.status, 200);
    assert.equal(autoPubPrev.body.linked.autoApprove, true);
    assert.match(autoPubPrev.body.prompt, /대표 사전 승인/);

    // 결제·삭제는 autoApprove=true여도 절대 자동 통과되지 않아야 함
    const payRt = await srv.ui('POST', '/api/ui/routines', {
      title: '매달 클라우드 요금 결제',
      time: '09:00',
      days: [1],
      assignee: 'codex',
      autoApprove: true,
    });
    assert.equal(payRt.status, 200);
    assert.equal(payRt.body.gate, '결제', '결제 게이트는 autoApprove=true여도 절대 해제되면 안 됨');

    // 결재서에서 "승인 + 앞으로 바로 실행(autoApproveRoutine)" 누르면 루틴까지 자동 해제
    const gatedRt = await srv.ui('POST', '/api/ui/routines', {
      title: '유튜브 댓글 게시 자동 답글 테스트',
      intervalMin: 30,
      days: [0, 1, 2, 3, 4, 5, 6],
      assignee: 'codex',
      autoApprove: false,
    });
    assert.equal(gatedRt.status, 200);
    assert.equal(gatedRt.body.gate, '게시');
    const stGated = await srv.ui('GET', '/api/state');
    const gatedTask = stGated.body.data.tasks.find((t) => t.routineId === gatedRt.body.id);
    assert.ok(gatedTask);
    const appRes = await srv.ui('POST', `/api/ui/tasks/${gatedTask.id}/approve-gate`, { autoApproveRoutine: true });
    assert.equal(appRes.status, 200);
    const stAfterApp = await srv.ui('GET', '/api/state');
    const rtAfterApp = stAfterApp.body.data.routines.find((r) => r.id === gatedRt.body.id);
    assert.equal(rtAfterApp.autoApprove, true);
    assert.equal(rtAfterApp.gate, null);

    // 11) AI 직원별 전용 참고 지식(e.knowledgeIds) 지정 → 할 일/루틴에 별도 지식 연결이 없어도 프롬프트에 최우선 주입 + 삭제 시 정리
    const empKbRes = await srv.ui('POST', '/api/ui/knowledge', {
      title: '코덱스 전용 배포 체크리스트',
      category: '참고 자료',
      content: '모든 코드 변경 후 node --check 와 npm test 를 반드시 통과시킨 뒤 보고한다.',
      tags: ['체크'],
      scope: 'all',
    });
    assert.equal(empKbRes.status, 200);
    const empKbId = empKbRes.body.id;

    const patchEmpKb = await srv.ui('PATCH', '/api/ui/employees/codex', { knowledgeIds: [empKbId] });
    assert.equal(patchEmpKb.status, 200);
    assert.deepEqual(patchEmpKb.body.knowledgeIds, [empKbId]);

    const plainTask = await srv.ui('POST', '/api/ui/tasks', {
      title: '오늘 회의 안건 3줄로 정리',
      assignee: 'codex',
      date: '2099-12-31',
    });
    assert.equal(plainTask.status, 200);
    const empPrev = await srv.ui('GET', `/api/ui/tasks/${plainTask.body.id}/prompt-preview`);
    assert.equal(empPrev.status, 200);
    assert.match(empPrev.body.prompt, /★ \[필수 · .*참고 자료\] 코덱스 전용 배포 체크리스트/);
    assert.match(empPrev.body.prompt, /npm test/);

    const delEmpKb = await srv.ui('DELETE', `/api/ui/knowledge/${empKbId}`);
    assert.equal(delEmpKb.status, 200);
    const stAfterEmpKbDel = await srv.ui('GET', '/api/state');
    const codexAfterDel = stAfterEmpKbDel.body.data.employees.find((e) => e.id === 'codex');
    assert.equal((codexAfterDel.knowledgeIds || []).includes(empKbId), false, '지식 삭제 시 직원의 knowledgeIds에서도 정리되어야 함');

    // 12) 맥북 ↔ 맥 스튜디오 자원 배분(workTags) + 1클릭 자동 최적화 + 작업 성격별 컴퓨터 자동 배차
    const stBeforeOpt = await srv.ui('GET', '/api/state');
    const existingStudio = stBeforeOpt.body.data.resources.find((r) => r.kind === '기계' && !r.isThisMac && /(스튜디오|studio)/i.test(r.name));
    let studioId = existingStudio?.id;
    if (!studioId) {
      const studioRes = await srv.ui('POST', '/api/ui/resources', {
        name: '맥 스튜디오 (Mac Studio)',
        kind: '기계',
        status: '사용 가능',
      });
      assert.equal(studioRes.status, 200);
      studioId = studioRes.body.id;
    }

    const optRes = await srv.ui('POST', '/api/ui/resources/optimize-machines', {});
    assert.equal(optRes.status, 200);
    assert.equal(optRes.body.studio.id, studioId);
    assert.ok(optRes.body.studio.workTags.includes('video'));
    assert.ok(optRes.body.studio.workTags.includes('3d'));
    assert.ok(optRes.body.thisMac.workTags.includes('daily'));
    assert.equal(optRes.body.thisMac.fallbackTo, studioId);
    assert.equal(optRes.body.studio.fallbackTo, optRes.body.thisMac.id);

    const videoSuggest = await srv.ui('POST', '/api/ui/assign/suggest', { title: '쇼츠 9:16 영상 편집 모션그래픽 렌더' });
    assert.equal(videoSuggest.status, 200);
    assert.equal(videoSuggest.body.resource, studioId, '영상·모션 작업은 workTags=video 인 맥 스튜디오로 배정되어야 함');

    const snsSuggest = await srv.ui('POST', '/api/ui/assign/suggest', { title: '인스타그램 댓글 확인하고 답글 초안 쓰기' });
    assert.equal(snsSuggest.status, 200);
    assert.equal(snsSuggest.body.resource, optRes.body.thisMac.id, '일상·SNS 작업은 workTags=daily 인 이 맥으로 배정되어야 함');
  } finally {
    await srv.close();
  }
});
