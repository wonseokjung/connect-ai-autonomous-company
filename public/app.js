// AI 회사 본사 · 화면
// 네 칸: 오늘 할 일, 자동 루틴, AI 직원, AI 사무실.
// 모든 데이터는 textContent 로만 넣는다 (AI가 쓴 글은 데이터일 뿐, 절대 실행하지 않음).
'use strict';

// 브랜드 테마 & 가독성 초기화 (기본: 편안한 고대비 라이트 + 블랙·골드 포인트, 다크/큰글씨 토글 지원)
try {
  const savedTheme = localStorage.getItem('aihq-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  if (localStorage.getItem('aihq-text-lg') === '1') document.documentElement.dataset.textLg = '1';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = savedTheme === 'obsidian' ? '#070605' : '#FAF9F6';
} catch {}

const C = window.Charts;
let S = null;
const ui = {
  route: 'home', param: '', open: null, picking: null, rtPicking: null, editingEmp: null, openAccount: null, resTab: 'machines',
  taskPick: 'auto', rtPick: 'auto', rtSched: 'time', homeFilter: 'all', doneOpen: false, insertOpen: {}, empDraftEngine: {},
  autoTab: 'list', autoQuery: '', autoFilter: 'all', autoRunsFilter: 'all',
  kbCat: 'all', kbLayer: 'all', kbEmp: 'all', kbQuery: '', ragLayer: 'all',
  editingTask: null, cliMonitor: false,
  swarmTeam: 'all', swarmSelected: 'all',
  archiveRange: 'today', archiveDay: '', archiveMore: false,
  hanokStage: (() => { try { return localStorage.getItem('aihq_hanok_stage') !== '0'; } catch { return true; } })(),
  drag: false, office: null, tools: null, briefOpen: false, models: null, listening: false, lastThread: null, handout: {}, ob: null, lan: null,
  composing: false, pendingRender: false, lastSig: '',
};

function isEmpCooling(e) {
  if (!e || !e.cooldownUntil) return false;
  const ts = Date.parse(e.cooldownUntil);
  return Number.isFinite(ts) && ts > Date.now();
}
function empCooldownMin(e) {
  if (!isEmpCooling(e)) return 0;
  return Math.max(1, Math.ceil((Date.parse(e.cooldownUntil) - Date.now()) / 60000));
}
function healthLabel(level) {
  return level === 'overload' ? '과부하' : level === 'busy' ? '혼잡' : level === 'down' ? '꺼짐' : '여유';
}

document.addEventListener('compositionstart', () => { ui.composing = true; });
document.addEventListener('compositionend', () => { ui.composing = false; });
document.addEventListener('focusout', () => {
  if (!ui.pendingRender) return;
  setTimeout(() => {
    if (ui.pendingRender && !isEditingPageInput()) { ui.pendingRender = false; render(); }
  }, 80);
});

function isEditingPageInput() {
  if (ui.composing) return true;
  const el = document.activeElement;
  if (!el || !el.closest('#page')) return false;
  if (el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    if (el.type === 'checkbox' || el.type === 'radio') return false;
    // 빈 입력칸(Enter 전송 직후 커서만 남은 상태)은 실시간 완료·알람 화면 갱신을 막지 않는다
    if (!String(el.value || '').trim()) return false;
    return true;
  }
  return false;
}

// 같은 요청을 두 번 보내지 않는다 (엔터 두 번, 빠른 두 번 클릭)
const inflight = new Set();
async function once(key, fn) {
  if (inflight.has(key)) return null;
  inflight.add(key);
  try { return await fn(); } finally { inflight.delete(key); }
}
// 입력칸 값을 먼저 비우고 보낸다. 실패하면 되돌린다.
async function submitInput(input, key, send) {
  const v = input.value;
  if (!v.trim()) { input.focus(); return null; }
  return once(key, async () => {
    input.value = '';
    const r = await send(v);
    if (!r) { const el = document.querySelector(`[data-k="${input.dataset.k}"]`) || input; if (!el.value) el.value = v; }
    return r;
  });
}

async function copyText(textValue) {
  try { await navigator.clipboard.writeText(textValue); return true; } catch { /* http 폰 등 */ }
  const ta = h('textarea', { style: 'position:fixed;top:-1000px;opacity:0' }, textValue);
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
const batchim = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0; };
// 한국어 조사: 받침이 있으면 앞의 것 (영어 이름은 끝 글자 소리로 짐작)
function josa(w, withB, without) {
  const s = String(w || '').trim();
  const last = s.slice(-1);
  const has = /[가-힣]/.test(last) ? batchim(s) : /(ng|[klmn])$/i.test(s);
  return `${s}${has ? withB : without}`;
}
const gateK = (g) => `${g}${batchim(g) ? '이' : '가'}`;
const gateO = (g) => `${g}${batchim(g) ? '을' : '를'}`;

// ───────── 작은 도우미 ─────────

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = Boolean(v);
      else if (k === 'style') el.style.cssText = v; // CSP: style 속성 대신 CSSOM
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const k of kids.flat(3)) {
    if (k === null || k === undefined || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

function setDlg(dlg, ...kids) {
  dlg.replaceChildren(...kids.flat(3).filter((k) => k !== null && k !== undefined && k !== false));
}

function closeDlg() {
  const dlg = document.getElementById('dlg');
  if (!dlg) return;
  dlg.className = '';
  if (dlg.open) dlg.close();
}

function githubShortLabel(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const m = /^https?:\/\/github\.com\/([^/\s]+\/[^/\s]+)(?:\/tree\/[^/]+\/(.+))?/i.exec(s);
  if (m) return m[2] ? `${m[1]}/${m[2].split('/').slice(-1)[0]}` : m[1];
  return s.replace(/^https?:\/\//i, '').slice(0, 36);
}

function parseClientRepoHint(raw) {
  const s = String(raw || '').trim();
  if (!s) return { name: '', command: '' };
  const ghUrl = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(\/.*)?$/i.exec(s);
  if (ghUrl) {
    const subParts = (ghUrl[3] || '').replace(/\/+$/, '').split('/').filter(Boolean);
    const subLeaf = subParts.length >= 3 && (subParts[0] === 'tree' || subParts[0] === 'blob')
      ? subParts[subParts.length - 1].replace(/\.(md|mjs|js|ts|py)$/i, '')
      : '';
    return {
      name: subLeaf && subLeaf.toLowerCase() !== 'skill' ? subLeaf : ghUrl[2],
      command: `npx github:${ghUrl[1]}/${ghUrl[2]}`,
    };
  }
  const ghShort = /^(?:npx\s+(?:-y\s+)?)?github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i.exec(s);
  if (ghShort) return { name: ghShort[2], command: s.startsWith('npx') ? s : `npx ${s}` };
  const pair = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s);
  if (pair && !s.startsWith('@')) return { name: pair[2], command: `npx github:${pair[1]}/${pair[2]}` };
  const npx = /^npx\s+(?:-y\s+)?(@?[A-Za-z0-9_./@-]+)/i.exec(s);
  if (npx) return { name: npx[1].split('/').pop().replace(/@[^@]+$/, ''), command: s };
  return { name: '', command: '' };
}

function skillPillsEl(empObj, { onDark = false, max = 6 } = {}) {
  const skills = [...(Array.isArray(empObj?.skills) ? empObj.skills : [])]
    .sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  if (!skills.length) {
    return onDark
      ? h('div', { class: 'swarm-brain-bar' },
        h('button', { type: 'button', class: 'swarm-brain-pill', onclick: () => openEmployeeSkillsModal(empObj.id) }, '+ 주요 스킬 · GitHub 연결 (예: Connect AI Motion)'))
      : h('button', { type: 'button', class: 'input-me', onclick: () => openEmployeeSkillsModal(empObj.id) }, '+ 주요 스킬 · GitHub 연결');
  }
  const shown = skills.slice(0, max);
  const more = skills.length - shown.length;
  return h('div', { class: `skill-pills${onDark ? ' on-dark' : ''}` },
    shown.map((sk) => {
      const subCnt = (sk.subSkills || []).length;
      const isUpcoming = sk.published === false || sk.doctorStatus === 'upcoming';
      const isReady = !isUpcoming && sk.doctorStatus === 'ready';
      const tip = [
        sk.primary ? '★ 주요 스킬' : '',
        sk.roleLabel || '',
        isUpcoming ? '준비 중 (공개 전 · 자동 배분 제외)' : isReady ? '● 사용 가능 (doctor Ready)' : '점검 전',
        sk.installCmd ? `설치: ${sk.installCmd}` : '',
        sk.doctorCmd ? `점검: ${sk.doctorCmd}` : '',
        sk.inputSpec || sk.outputSpec ? `입출력: ${sk.inputSpec || '—'} → ${sk.outputSpec || '—'}` : '',
        sk.computeHint ? `컴퓨터: ${sk.computeHint}` : '',
        subCnt ? `세부 스킬:\n${sk.subSkills.map((s, i) => `${i + 1}) ${s.name}${s.note ? `: ${s.note}` : ''}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      const vis = skillVisualInfo(sk);
      const koName = (vis.titleKo || sk.roleLabel || sk.name).split('·')[0].trim();
      return h('button', {
        type: 'button',
        class: `skill-pill${sk.primary && !isUpcoming ? ' is-primary' : ''}${isUpcoming ? ' is-upcoming' : ''}${onDark ? ' on-dark' : ''}`,
        title: `${sk.name}\n${tip}`,
        onclick: () => openEmployeeSkillsModal(empObj.id, { tab: 'equipped', openId: sk.id }),
      },
      h('span', { class: 'skill-pill-ic', 'aria-hidden': 'true' }, skillPixelIconSvg(vis.icon, 14)),
      h('span', { class: 'skill-pill-name' }, koName || sk.name),
      isUpcoming
        ? h('span', { class: 'skill-sub-cnt upcoming' }, '준비 중')
        : isReady
          ? h('span', { class: 'skill-sub-cnt ready' }, subCnt ? `사용 가능 · ${subCnt}` : '사용 가능')
          : (subCnt ? h('span', { class: 'skill-sub-cnt' }, `세부 ${subCnt}`) : null));
    }),
    more > 0 ? h('button', { type: 'button', class: `skill-pill-add${onDark ? ' on-dark' : ''}`, onclick: () => openEmployeeSkillsModal(empObj.id, { tab: 'equipped' }) }, `+${more}`) : null,
    h('button', { type: 'button', class: `skill-pill-add${onDark ? ' on-dark' : ''}`, onclick: () => openEmployeeSkillsModal(empObj.id, { tab: 'arsenal' }) }, '+ 스킬'));
}

function kbLayerOf(k) {
  if (k?.layer === 'owner' || k?.layer === 'shared' || k?.layer === 'agent') return k.layer;
  if (k?.scope && k.scope !== 'all') return 'agent';
  if ((k?.updatedBy && k.updatedBy !== 'jay') || k?.category === 'AI 학습 메모') return 'shared';
  return 'owner';
}

function ragLayerOf(r) {
  if (r?.layer === 'owner' || r?.layer === 'shared' || r?.layer === 'agent') return r.layer;
  return r?.scope && r.scope !== 'all' ? 'agent' : 'shared';
}

function kbLayerPill(item, isRag = false) {
  const layer = isRag ? ragLayerOf(item) : kbLayerOf(item);
  if (layer === 'owner') return h('span', { class: 'kb-layer-pill is-owner' }, isRag ? '나의 RAG' : '나의 지식');
  if (layer === 'agent') return h('span', { class: 'kb-layer-pill is-agent' }, `${shortName(item.scope)} 전용${isRag ? ' RAG' : ''}`);
  return h('span', { class: 'kb-layer-pill is-shared' }, isRag ? '공용 RAG' : '공용 지식');
}

function empKnowledgeDocs(empObj) {
  const allKb = Array.isArray(S.data?.knowledge) ? S.data.knowledge : [];
  const pinnedIds = Array.isArray(empObj?.knowledgeIds) ? empObj.knowledgeIds : [];
  const pinned = pinnedIds.map((id) => allKb.find((k) => k.id === id)).filter(Boolean);
  const scoped = allKb.filter((k) => kbLayerOf(k) === 'agent' && k.scope === empObj?.id && !pinnedIds.includes(k.id));
  const allRag = Array.isArray(S.data?.ragSources) ? S.data.ragSources : [];
  const pinnedRagIds = Array.isArray(empObj?.ragIds) ? empObj.ragIds : [];
  const pinnedRags = pinnedRagIds.map((id) => allRag.find((r) => r.id === id && r.enabled !== false)).filter(Boolean);
  const scopedRags = allRag.filter((r) => r.enabled !== false && ragLayerOf(r) === 'agent' && r.scope === empObj?.id && !pinnedRagIds.includes(r.id));
  const rags = [...pinnedRags, ...scopedRags];
  return { pinned, scoped, all: [...pinned, ...scoped], pinnedRags, scopedRags, rags, total: pinned.length + scoped.length + rags.length };
}

function empKbPillsEl(empObj, { max = 4 } = {}) {
  const { pinned, scoped, all, rags } = empKnowledgeDocs(empObj);
  if (!all.length && !rags.length) {
    return h('button', {
      type: 'button', class: 'input-me',
      onclick: () => openEmployeeKnowledgeModal(empObj.id),
    }, '+ 참고 지식 · RAG 연결');
  }
  const shownRags = rags.slice(0, 2);
  const shownKb = all.slice(0, Math.max(1, max - shownRags.length));
  const more = (rags.length - shownRags.length) + (all.length - shownKb.length);
  return h('div', { class: 'emp-kb-pills' },
    shownRags.map((rg) => h('button', {
      type: 'button',
      class: 'emp-rag-pill',
      title: `RAG [${ragTypeLabel(rg.type)}]: ${rg.name}${rg.folderPath ? ` (${rg.folderPath})` : rg.endpoint ? ` (${rg.endpoint})` : ''}`,
      onclick: () => openEmployeeKnowledgeModal(empObj.id),
    },
    h('span', { class: 'emp-rag-badge' }, 'RAG'),
    h('span', { class: 'emp-kb-nm' }, rg.name))),
    shownKb.map((kb) => {
      const isScoped = scoped.some((x) => x.id === kb.id) && !pinned.some((x) => x.id === kb.id);
      return h('button', {
        type: 'button',
        class: `emp-kb-pill${isScoped ? ' is-scoped' : ''}`,
        title: `[${kb.category}] ${kb.title}\n${String(kb.content || '').slice(0, 140)}`,
        onclick: () => openEmployeeKnowledgeModal(empObj.id),
      },
      h('span', { class: 'emp-kb-ic', 'aria-hidden': 'true' }, '📚'),
      h('span', { class: 'emp-kb-nm' }, kb.title),
      isScoped ? h('span', { class: 'emp-kb-sub' }, '전용') : null);
    }),
    more > 0 ? h('button', { type: 'button', class: 'skill-pill-add', onclick: () => openEmployeeKnowledgeModal(empObj.id) }, `+${more}`) : null,
    h('button', { type: 'button', class: 'skill-pill-add', onclick: () => openEmployeeKnowledgeModal(empObj.id) }, '+ 지식 · RAG'));
}

function openEmployeeKnowledgeModal(empOrId) {
  const empId = typeof empOrId === 'string' ? empOrId : empOrId?.id;
  const e = emp(empId);
  if (!e) return;
  const dlg = document.getElementById('dlg');
  dlg.className = 'auto-dlg';

  const selectedIds = new Set(Array.isArray(e.knowledgeIds) ? e.knowledgeIds : []);
  const selectedRagIds = new Set(Array.isArray(e.ragIds) ? e.ragIds : []);
  let query = '';
  let addOpen = (S.data?.knowledge || []).length === 0 && (S.data?.ragSources || []).length === 0;

  const ragListWrap = h('div', { class: 'kb-pick-list rag-pick-compact' });
  const listWrap = h('div', { class: 'kb-pick-list' });
  const countEl = h('span', { class: 'small muted' });
  const newDrawer = h('div', { class: 'kb-inline-add' });

  const renderList = () => {
    const allKb = (Array.isArray(S.data?.knowledge) ? S.data.knowledge : [])
      .filter((k) => kbLayerOf(k) !== 'agent' || k.scope === e.id);
    const allRag = (Array.isArray(S.data?.ragSources) ? S.data.ragSources : [])
      .filter((r) => r.enabled !== false && (ragLayerOf(r) !== 'agent' || r.scope === e.id));
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allKb.filter((k) => `${k.title} ${k.category} ${(k.tags || []).join(' ')} ${k.content}`.toLowerCase().includes(q))
      : allKb;
    countEl.textContent = `지식 ${selectedIds.size}건 · RAG ${selectedRagIds.size}건 연결`;

    if (allRag.length) {
      ragListWrap.replaceChildren(
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin-bottom:2px' },
          h('span', { class: 'small', style: 'font-weight:700;color:var(--ink)' }, '연결된 내 RAG (우선 검색)'),
          h('button', { type: 'button', class: 'btn link', onclick: () => { closeDlg(); openRagModal(null, 'folder', { layer: 'agent', scope: e.id }); } }, `+ ${shortName(e.id)} 전용 RAG →`)),
        ...allRag.map((rg) => {
          const on = selectedRagIds.has(rg.id);
          const sub = rg.type === 'folder'
            ? `${rg.folderPath}${rg.stats?.chunks ? ` · 청크 ${rg.stats.chunks}개` : ''}`
            : rg.type === 'http' ? rg.endpoint
              : rg.type === 'mcp' ? `MCP ${rg.mcpServer}${rg.mcpTool ? `/${rg.mcpTool}` : ''}`
                : rg.webUrl;
          return h('button', {
            type: 'button',
            class: `kb-pick-item rag-pick-item${on ? ' is-on' : ''}`,
            'aria-pressed': on ? 'true' : 'false',
            onclick: () => {
              if (selectedRagIds.has(rg.id)) selectedRagIds.delete(rg.id);
              else selectedRagIds.add(rg.id);
              renderList();
            },
          },
          h('div', { class: 'kb-pick-top' },
            h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
              h('span', { class: 'rag-type-pill' }, ragTypeLabel(rg.type)),
              kbLayerPill(rg, true),
              h('b', { class: 'kb-pick-title' }, rg.name)),
            h('span', { class: `kb-pick-chk${on ? ' is-on' : ''}` }, on ? '✓' : '+')));
        }));
    } else {
      ragListWrap.replaceChildren(
        h('div', { class: 'rag-empty-inline' },
          h('span', { class: 'small', style: 'font-weight:600' }, '내 RAG'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { closeDlg(); openRagModal(null, 'folder', { layer: 'agent', scope: e.id }); } }, '+ 연결')));
    }

    if (!filtered.length) {
      listWrap.replaceChildren(h('div', { class: 'small muted', style: 'padding:10px 4px' }, '등록된 지식 없음'));
      return;
    }
    const groups = [
      { key: 'agent', title: `${shortName(e.id)} 전용`, items: filtered.filter((k) => kbLayerOf(k) === 'agent') },
      { key: 'owner', title: '나의 지식 · 대표', items: filtered.filter((k) => kbLayerOf(k) === 'owner') },
      { key: 'shared', title: '공용 지식 · AI 협업', items: filtered.filter((k) => kbLayerOf(k) === 'shared') },
    ].filter((g) => g.items.length);

    listWrap.replaceChildren(...groups.flatMap((g) => [
      h('div', { class: 'kb-group-h' }, g.title, h('span', { class: 'small muted' }, `${g.items.length}`)),
      ...g.items.map((kb) => {
        const on = selectedIds.has(kb.id);
        return h('button', {
          type: 'button',
          class: `kb-pick-item${on ? ' is-on' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          title: String(kb.content || '').slice(0, 140),
          onclick: () => {
            if (selectedIds.has(kb.id)) selectedIds.delete(kb.id);
            else selectedIds.add(kb.id);
            renderList();
          },
        },
        h('div', { class: 'kb-pick-top' },
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            kbLayerPill(kb),
            h('b', { class: 'kb-pick-title' }, kb.title)),
          h('span', { class: `kb-pick-chk${on ? ' is-on' : ''}` }, on ? '✓' : '+')));
      }),
    ]));
  };

  const cats = S.options?.knowledgeCategories || ['브랜드', '비즈니스', '업무 규칙', '참고 자료', 'AI 학습 메모'];
  const newTitle = h('input', { class: 'in sm', placeholder: '새 지식 제목 (예: 유튜브 숏폼 대본 공식, 코딩 스타일 가이드)', 'aria-label': '새 지식 제목' });
  const newCat = h('select', { class: 'in sm', style: 'width:auto;min-width:120px', 'aria-label': '카테고리' }, cats.map((c) => h('option', { value: c }, c)));
  let newLayer = 'agent';
  const newLayerPicker = h('div', { class: 'picker' });
  const renderNewLayerPicker = () => {
    const opts = [
      ['agent', `${shortName(e.id)} 전용`],
      ['shared', '공용 (AI 협업)'],
      ['owner', '나의 지식 (대표)'],
    ];
    newLayerPicker.replaceChildren(...opts.map(([k, lbl]) => h('button', {
      type: 'button', class: `chip sm${newLayer === k ? ' on' : ''}`,
      onclick: () => { newLayer = k; renderNewLayerPicker(); },
    }, lbl)));
  };
  renderNewLayerPicker();
  const newContent = h('textarea', { class: 'in sm', rows: 3, placeholder: '이 AI 직원이 일할 때 꼭 알아야 할 규칙, 말투, URL, 참고 노하우를 적어 주세요.', 'aria-label': '새 지식 내용' });

  const renderNewDrawer = () => {
    newDrawer.classList.toggle('hidden', !addOpen);
  };

  const createAndAttach = () => once(`emp-kb-new-${e.id}`, async () => {
    const t = newTitle.value.trim();
    const c = newContent.value.trim();
    if (!t) { newTitle.focus(); toast('지식 제목을 입력해 주세요'); return; }
    if (!c) { newContent.focus(); toast('지식 내용을 입력해 주세요'); return; }
    const created = await api('POST', '/api/ui/knowledge', {
      title: t,
      category: newCat.value,
      layer: newLayer,
      scope: newLayer === 'agent' ? e.id : 'all',
      content: c,
    });
    if (created && created.id) {
      if (!Array.isArray(S.data.knowledge)) S.data.knowledge = [];
      if (!S.data.knowledge.some((k) => k.id === created.id)) S.data.knowledge.unshift(created);
      selectedIds.add(created.id);
      newTitle.value = '';
      newContent.value = '';
      newLayer = 'agent';
      renderNewLayerPicker();
      addOpen = false;
      renderNewDrawer();
      renderList();
      toast(`"${t}" 지식을 저장하고 연결했어요`);
    }
  });

  newDrawer.replaceChildren(
    h('div', { class: 'kb-inline-h' }, '새 지식 바로 만들고 연결'),
    h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' },
      h('div', { style: 'flex:1;min-width:190px' }, newTitle),
      newCat),
    newContent,
    h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;margin-top:6px;gap:8px' },
      newLayerPicker,
      h('button', { type: 'button', class: 'btn sm dark', onclick: createAndAttach }, '+ 저장하고 연결')));
  renderNewDrawer();

  const searchIn = h('input', {
    class: 'in sm', type: 'search', placeholder: '내 지식 검색 (제목 · 태그 · 내용)...', 'aria-label': '지식 검색',
    oninput: (ev) => { query = ev.target.value; renderList(); },
  });

  const save = () => once(`emp-kb-save-${e.id}`, async () => {
    const resSave = await act('PATCH', `/api/ui/employees/${e.id}`, {
      knowledgeIds: [...selectedIds],
      ragIds: [...selectedRagIds],
    }, `${shortName(e.id)} 지식 ${selectedIds.size}건 · RAG ${selectedRagIds.size}건을 저장했어요`);
    if (resSave) { closeDlg(); render(); }
  });

  renderList();

  const addToggleBtn = h('button', {
    type: 'button', class: 'btn sm gold',
    onclick: () => {
      addOpen = !addOpen;
      renderNewDrawer();
      addToggleBtn.textContent = addOpen ? '새 지식 닫기' : '+ 새 지식 바로 추가';
      if (addOpen) setTimeout(() => newTitle.focus(), 20);
    },
  }, addOpen ? '새 지식 닫기' : '+ 새 지식 바로 추가');

  setDlg(dlg,
    h('div', { class: 'auto-m-top' },
      h('div', { class: 'auto-m-head' },
        h('h3', { class: 'auto-m-title-h' }, `${shortName(e.id)} · 지식 · RAG`)),
      h('button', { type: 'button', class: 'auto-m-x', 'aria-label': '닫기', onclick: closeDlg }, '×')),
    h('div', { class: 'auto-m-body' },
      ragListWrap,
      h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:4px' },
        h('div', { style: 'flex:1;min-width:180px' }, searchIn),
        addToggleBtn),
      newDrawer,
      listWrap),
    h('div', { class: 'auto-m-foot' },
      countEl,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '취소'),
        h('button', { type: 'button', class: 'btn dark', onclick: save }, '저장'))));
  dlg.showModal();
}

// ───── 조선 비급서 · RPG 스킬 도감 (시각적 16비트 픽셀 아이콘 · 카테고리 · 검색 · 장착 슬롯) ─────
const SKILL_CATEGORIES = [
  { key: 'all',       label: '전체' },
  { key: 'connect',   label: '✦ CONNECT AI' },
  { key: 'video',     label: '영상·모션' },
  { key: 'marketing', label: '마케팅·SNS' },
  { key: 'research',  label: '사업·리서치' },
  { key: 'build',     label: '3D·웹·자동화' },
];

const SKILL_ICON_GRIDS = {
  video:    ['................','..OOOOOOOOOOOO..','.OLLLLLLLLLLLLO.','.OOKKOOKKOOKKOO.','.OLLLLLLLLLLLLO.','.OOOOOOOOOOOOOO.','.OOMMMMMMMMMMOO.','.OOMMMYYMMMMMOO.','.OOMMMYYYMMMMOO.','.OOMMMYYYYMMMOO.','.OOMMMYYYMMMMOO.','.OOMMMYYMMMMMOO.','.OOMMMMMMMMMMOO.','..OOOOOOOOOOOO..','................','................'],
  motion:   ['.......OO.......','......OYYO......','......OYYO......','.....OYYYYO.....','..OO.OYHHYO.OO..','.OYYOOYHHYOOYYO.','OYYYYYYHHYYYYYYO','.OYYOOYHHYOOYYO.','..OO.OYHHYO.OO..','.....OYYYYO.....','......OYYO......','......OYYO......','.......OO.......','...OO......OO...','..OYYO....OYYO..','...OO......OO...'],
  marketer: ['..........OO....','.........OYYO...','........OYYYO...','.......OYYYYO.O.','..OOOOOYYYYYO.YO','.OLLLLYYYYYYO..O','.OLLLLYYYYYYO.YO','.OLLLLYYYYYYO..O','..OOOOOYYYYYO.YO','....OLLOYYYYO.O.','....OLLO.OYYO...','....OLLO..OO....','....OLLO........','.....OO.........','................','................'],
  research: ['....OOOOOO......','..OOLLLLLLOO....','.OLLHHLLLLLLO...','.OLHLLLLLLLLO...','.OLLLLLLLLLLO...','.OLLLLLLLLLLO...','..OOLLLLLLOO....','....OOOOOOYO....','.........OYYO...','..........OYYO..','...........OYYO.','............OYYO','.............OO.','................','................','................'],
  slides:   ['................','.OOOOOOOOOOOOOO.','.OLLLLLLLLLLLLO.','.OLYYLLLLLLLLLO.','.OLYYLLMMMMMLLO.','.OLLLLLLLLLLLLO.','.OLMMMMMLLYYLLO.','.OLMMMMMLLYYLLO.','.OLLLLLLLLLLLLO.','.OOOOOOOOOOOOOO.','.......OO.......','......OYYO......','....OOYYYYOO....','....OOOOOOOO....','................','................'],
  three:    ['......OOOO......','....OOYYYYOO....','..OOYYYYYYYYOO..','.OYYYYHHHHYYYYO.','.OYYOOYYYYOOYYO.','.OMMOOYYYYOODDO.','.OMMMMOYYODDDDO.','.OMMMMMOODDDDDO.','.OMMMMMOODDDDDO.','.OMMMMMOODDDDDO.','.OMMMMMOODDDDDO.','..OOMMMOODDOO...','....OOMOODO.....','......OOOO......','................','................'],
  blender:  ['.....OOOOOO.....','...OOYYYYYYOO...','..OYYHHHHHHYYO..','.OYYHMMMMMMHYYO.','.OYMMOOOOOOMMYO.','.OYMOLLLLLLOMYO.','.OYMOLHHHHLOMYO.','.OYMOLHHHHLOMYO.','.OYMOLLLLLLOMYO.','.OYMMOOOOOOMMYO.','..OYYMMMMMMYYO..','...OOYYYYYYOO...','.....OOOOOO.....','................','................','................'],
  audio:    ['.......OO.......','......OYYO......','......OYYO......','...OO.OYYO.OO...','..OLLO.YY.OLLO..','..OLLOYYYYOLLO..','..OLLOYYYYOLLO..','.O.LLOYYYYOLL.O.','.O.LLOYYYYOLL.O.','..OLLOYYYYOLLO..','..OLLO.YY.OLLO..','...OO.OYYO.OO...','......OYYO......','......OYYO......','.......OO.......','................'],
  auto:     ['......OOOO......','.....OYYYYO.....','..OO.OYYYYO.OO..','.OYYOOYOOYOOYYO.','.OYYYYOMMOYYYYO.','..OOYOMHHMOYOO..','...OOMHHHHMOO...','...OOMHHHHMOO...','..OOYOMHHMOYOO..','.OYYYYOMMOYYYYO.','.OYYOOYOOYOOYYO.','..OO.OYYYYO.OO..','.....OYYYYO.....','......OOOO......','................','................'],
  scroll:   ['...OOOOOOOOOO...','..OYYYYYYYYYYO..','.OYYLLLLLLLLYYO.','.OYLLMMMMMMLLYO.','.OYLLLLLLLLLLYO.','.OYLLMMMMMMLLYO.','.OYLLLLLLLLLLYO.','.OYLLMMMMLLLLY0.'.replace('0','O'),'.OYLLLLLLLLLLYO.','.OYLLMMMMMMLLYO.','.OYYLLLLLLLLYYO.','..OYYYYYYYYYYO..','...OOOOOOOOOO...','................','................'],
};

const SKILL_ICON_PALETTES = {
  video:    { O: '#181410', L: '#f8fafc', K: '#18181b', M: '#1e293b', Y: '#d4a359', H: '#fff7d6' },
  motion:   { O: '#261a08', Y: '#f5b93b', H: '#fffbeb', L: '#fde68a', M: '#d97706' },
  marketer: { O: '#2b1212', Y: '#fb7185', L: '#ffe4e6', M: '#f43f5e', H: '#fff1f2' },
  research: { O: '#0f1f38', L: '#93c5fd', H: '#eff6ff', Y: '#d4a359', M: '#3b82f6' },
  slides:   { O: '#1f1636', L: '#ede9fe', M: '#a78bfa', Y: '#d4a359', H: '#ffffff' },
  three:    { O: '#0c261d', Y: '#34d399', H: '#d1fae5', M: '#10b981', D: '#047857', L: '#6ee7b7' },
  blender:  { O: '#2d1607', Y: '#fb923c', H: '#ffedd5', M: '#ea580c', L: '#fdba74' },
  audio:    { O: '#0c2426', Y: '#2dd4bf', L: '#99f6e4', H: '#f0fdfa', M: '#14b8a6' },
  auto:     { O: '#161b26', Y: '#d4a359', M: '#64748b', H: '#f8fafc', L: '#cbd5e1' },
  scroll:   { O: '#261b0c', Y: '#d4a359', L: '#fef3c7', M: '#92400e', H: '#fffbeb' },
};

function skillPixelIconSvg(kind = 'scroll', size = 28) {
  const NS = 'http://www.w3.org/2000/svg';
  const grid = SKILL_ICON_GRIDS[kind] || SKILL_ICON_GRIDS.scroll;
  const pal = SKILL_ICON_PALETTES[kind] || SKILL_ICON_PALETTES.scroll;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ars-px-svg');
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!ch || ch === '.') continue;
      const fill = pal[ch];
      if (!fill) continue;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', fill);
      svg.appendChild(r);
    }
  }
  return svg;
}

const SKILL_VISUAL_MAP = {
  'connect-ai-video-motion': { cat: 'video',     icon: 'video',    titleKo: '영상 편집',            flow: '내 영상(mp4) → 9:16 숏츠' },
  'connect-ai-motion':       { cat: 'video',     icon: 'motion',   titleKo: '모션그래픽',           flow: '글 몇 줄 → 모션그래픽 영상' },
  'connect-ai-marketer':     { cat: 'marketing', icon: 'marketer', titleKo: '마케팅 · SNS',         flow: 'SNS · 유튜브 → 답글 · 벤치마크' },
  reversebusiness:           { cat: 'research',  icon: 'research', titleKo: '사업 구조 분석',       flow: 'URL 1개 → 6칸 수익모델 해부' },
  'connect-ai-slides-web':   { cat: 'build',     icon: 'slides',   titleKo: '웹 슬라이드',          flow: '발표 개요 → 인터랙티브 슬라이드' },
  'connect-ai-three':        { cat: 'build',     icon: 'three',    titleKo: '3D 웹 (Three.js)',     flow: '콘셉트 → 3D 웹 쇼케이스' },
  'connect-ai-blender':      { cat: 'build',     icon: 'blender',  titleKo: '3D 블렌더',            flow: '장면 지시서 → 3D 턴테이블 렌더' },
  remotion:                  { cat: 'video',     icon: 'motion',   titleKo: 'Remotion 영상',        flow: 'React 코드 → 쇼츠 · 인트로' },
  hyperframes:               { cat: 'video',     icon: 'motion',   titleKo: 'Hyperframes 모션',     flow: 'HTML → 미니멀 자막 카드' },
  ffmpeg:                    { cat: 'video',     icon: 'video',    titleKo: 'FFmpeg 편집',          flow: '원본 영상 → 무음 컷 · 인코딩' },
  blender:                   { cat: 'build',     icon: 'blender',  titleKo: 'Blender 3D',           flow: '3D 모델 → 조명 · 카메라 렌더' },
  'yt-dlp':                  { cat: 'marketing', icon: 'marketer', titleKo: 'yt-dlp 자막 · 영상',   flow: '유튜브 링크 → 자막 · 벤치마크' },
  whisper:                   { cat: 'video',     icon: 'audio',    titleKo: 'Whisper 자막',         flow: '음성 · 영상 → 한국어 SRT' },
  'orca-computer':           { cat: 'build',     icon: 'auto',     titleKo: 'Orca 화면 제어',       flow: '화면 트리 → 앱 · 미러링 제어' },
  playwright:                { cat: 'build',     icon: 'auto',     titleKo: 'Playwright 자동화',    flow: '웹 앱 → E2E 테스트 · 캡처' },
  firecrawl:                 { cat: 'research',  icon: 'research', titleKo: 'Firecrawl 웹 수집',    flow: '웹사이트 → AI 마크다운' },
  'reverse-engineer-anything': { cat: 'research', icon: 'research', titleKo: 'REA 구조 분석',       flow: '앱 · 번들 → API · 구조 해부' },
};

function skillVisualInfo(item = {}) {
  const key = String(item.key || item.preset || item.name || '').toLowerCase();
  const hit = SKILL_VISUAL_MAP[key];
  if (hit) {
    return {
      ...hit,
      flow: (item.inputSpec && item.outputSpec) ? `${item.inputSpec} → ${item.outputSpec}` : hit.flow,
    };
  }
  const hay = `${item.name || ''} ${item.roleLabel || ''} ${item.hint || ''} ${item.when || ''} ${item.note || ''}`.toLowerCase();
  let cat = 'build';
  let icon = 'scroll';
  if (/영상|모션|숏츠|컷|편집|video|motion|remotion|ffmpeg/.test(hay)) { cat = 'video'; icon = 'video'; }
  else if (/음성|자막|whisper|오디오|녹취/.test(hay)) { cat = 'video'; icon = 'audio'; }
  else if (/마케팅|홍보|sns|인스타|유튜브|댓글|트위터|스레드|marketer/.test(hay)) { cat = 'marketing'; icon = 'marketer'; }
  else if (/해부|리서치|조사|분석|크롤링|수집|reverse|firecrawl|rea/.test(hay)) { cat = 'research'; icon = 'research'; }
  else if (/슬라이드|발표|slides/.test(hay)) { cat = 'build'; icon = 'slides'; }
  else if (/blender|블렌더/.test(hay)) { cat = 'build'; icon = 'blender'; }
  else if (/three|3d/.test(hay)) { cat = 'build'; icon = 'three'; }
  else if (/자동화|브라우저|playwright|orca|컴퓨터/.test(hay)) { cat = 'build'; icon = 'auto'; }
  return {
    cat,
    icon,
    titleKo: item.roleLabel ? `${item.roleLabel}` : (item.name || '커스텀 스킬'),
    flow: (item.inputSpec && item.outputSpec) ? `${item.inputSpec} → ${item.outputSpec}` : '',
  };
}

function allSelectableSkills() {
  const catalog = Array.isArray(S.options?.ossCatalog) ? S.options.ossCatalog : [];
  const out = [];
  const seen = new Set();
  const pushItem = (raw) => {
    const key = String(raw.key || raw.preset || raw.name || '').trim();
    if (!key) return;
    const low = key.toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    const v = skillVisualInfo(raw);
    out.push({
      key,
      name: raw.name || key,
      shortTitle: v.titleKo.split('·')[0].trim(),
      titleKo: v.titleKo,
      icon: v.icon,
      cat: v.cat,
      flow: v.flow || '',
      connectAiPack: Boolean(raw.connectAiPack),
      published: raw.published !== false,
      when: raw.when || '',
      note: raw.note || raw.hint || '',
    });
  };
  for (const c of catalog) pushItem(c);
  for (const e of (S.data?.employees || [])) {
    for (const sk of (e.skills || [])) {
      if (sk.published === false || sk.doctorStatus === 'upcoming') continue;
      pushItem({ ...sk, key: sk.preset || sk.name });
    }
  }
  return out.sort((a, b) => {
    const ra = a.published ? 1 : 0;
    const rb = b.published ? 1 : 0;
    if (ra !== rb) return rb - ra;
    const ca = a.connectAiPack ? 1 : 0;
    const cb = b.connectAiPack ? 1 : 0;
    if (ca !== cb) return cb - ca;
    return 0;
  });
}

function skillChipMeta(key) {
  const low = String(key || '').toLowerCase();
  const hit = allSelectableSkills().find((s) => s.key.toLowerCase() === low || s.name.toLowerCase() === low);
  if (hit) return hit;
  const v = skillVisualInfo({ name: key });
  return { key, name: key, shortTitle: v.titleKo.split('·')[0].trim(), titleKo: v.titleKo, icon: v.icon };
}

function suggestSkillsForText(txt) {
  const s = String(txt || '').toLowerCase();
  if (!s.trim()) return [];
  const hits = [];
  const add = (k) => { if (!hits.includes(k)) hits.push(k); };
  if (/인스타|instagram|댓글|답글|스레드|threads|유튜브|youtube|트위터|x\.com|마케팅|홍보|업로드|크로스포스팅|벤치마크|sns|포스팅/.test(s)) add('connect-ai-marketer');
  if (/영상|쇼츠|shorts|릴스|reels|모션|편집|자막|비디오|mp4|컷편집|촬영/.test(s)) { add('connect-ai-video-motion'); add('connect-ai-motion'); }
  if (/자막|음성|녹취|whisper|srt/.test(s)) add('whisper');
  if (/인코딩|무음|ffmpeg|컷|압축/.test(s)) add('ffmpeg');
  if (/사업|해부|경쟁사|수익화|비즈니스|reverse|rebiz/.test(s)) add('reversebusiness');
  if (/슬라이드|발표|강의|ppt|덱/.test(s)) add('connect-ai-slides-web');
  if (/3d|블렌더|blender/.test(s)) add('connect-ai-blender');
  if (/three\.?js|인터랙티브|웹\s*3d/.test(s)) add('connect-ai-three');
  if (/브라우저|웹\s*테스트|playwright|자동화\s*테스트/.test(s)) add('playwright');
  if (/맥\s*조작|아이폰|미러링|orca|데스크톱/.test(s)) add('orca-computer');
  if (/크롤링|웹\s*수집|스크래핑|firecrawl/.test(s)) add('firecrawl');
  return hits;
}

function suggestAccountForText(txt) {
  const s = String(txt || '').toLowerCase();
  const accs = (S.data?.resources || []).filter((r) => r.kind === '계정' && r.status !== '꺼짐');
  if (!s.trim() || !accs.length) return null;
  const rules = [
    ['instagram', /인스타|instagram|릴스|dm/],
    ['youtube', /유튜브|youtube|쇼츠|커뮤니티/],
    ['threads', /스레드|threads/],
    ['x', /\bx\b|트위터|twitter|x\.com/],
    ['gmail', /지메일|gmail|이메일|메일|영수증/],
  ];
  for (const [plat, re] of rules) {
    if (!re.test(s)) continue;
    const hit = accs.find((a) => String(a.platform || '').toLowerCase() === plat || String(a.name || '').toLowerCase().includes(plat) || re.test(String(a.name || '').toLowerCase()));
    if (hit) return hit.id;
  }
  return null;
}

function blueprintPillsRow(item) {
  const skillKeys = Array.isArray(item.skills) ? item.skills : [];
  const kbIds = Array.isArray(item.knowledgeIds) ? item.knowledgeIds : [];
  const ragIds = Array.isArray(item.ragIds) ? item.ragIds : [];
  const acc = item.account ? res(item.account) : null;
  const mac = item.resource ? res(item.resource) : null;
  const showMac = Boolean(mac && mac.kind === '기계' && !mac.isThisMac);
  const kbs = kbIds.map((id) => (S.data?.knowledge || []).find((k) => k.id === id)).filter(Boolean);
  const rags = ragIds.map((id) => (S.data?.ragSources || []).find((r) => r.id === id)).filter(Boolean);
  if (!skillKeys.length && !kbs.length && !rags.length && !acc && !item.autoApprove && !showMac) return null;
  return h('div', { class: 'auto-bp-pills' },
    item.autoApprove ? h('span', { class: 'bp-pill bp-auto', title: '게시·댓글·업로드는 대표 확인 없이 바로 실행합니다 (결제·삭제는 보호)' }, '⚡ 바로 실행') : null,
    ...skillKeys.map((k) => {
      const m = skillChipMeta(k);
      return h('span', { class: 'bp-pill bp-skill', title: `지정 스킬: ${m.titleKo} (${m.name})` },
        skillPixelIconSvg(m.icon, 13),
        h('span', null, m.shortTitle));
    }),
    ...rags.map((rg) => h('span', { class: 'bp-pill bp-rag', title: `연결 RAG [${ragTypeLabel(rg.type)}]: ${rg.name}` },
      h('span', { class: 'bp-rag-tag' }, 'RAG'),
      h('span', null, rg.name))),
    ...kbs.map((kb) => h('span', { class: 'bp-pill bp-kb', title: `지정 지식 [${kb.category}]: ${kb.title}` },
      h('span', { class: 'bp-pill-ic' }, '📚'),
      h('span', null, kb.title))),
    acc ? h('span', { class: 'bp-pill bp-acc', title: `연결 계정: ${acc.name}` },
      h('span', { class: 'bp-pill-ic' }, '🌐'),
      h('span', null, acc.name.split(' · ')[0])) : null,
    showMac ? h('span', { class: 'bp-pill bp-mac', title: `지정 컴퓨터: ${mac.name}` },
      h('span', { class: 'bp-pill-ic' }, '💻'),
      h('span', null, mac.name)) : null);
}

function buildSkillArsenal({ catalog = [], isSelected, onToggle, compact = false, defaultCat = 'all' }) {
  let activeCat = defaultCat;
  let query = '';
  let onlyReady = false;

  const root = h('div', { class: `ars-root${compact ? ' is-compact' : ''}` });
  const loadoutBar = h('div', { class: 'ars-loadout' });
  const tabsBar = h('div', { class: 'ars-tabs', role: 'tablist' });
  const searchIn = h('input', {
    class: 'in sm ars-search',
    placeholder: '스킬 검색',
    'aria-label': '스킬 검색',
  });
  const readyBtn = h('button', { type: 'button', class: 'ars-ready-btn' }, '사용 가능만');
  const gridWrap = h('div', { class: 'ars-grid' });

  const matchCat = (c, catKey) => {
    if (catKey === 'all') return true;
    if (catKey === 'connect') return Boolean(c.connectAiPack);
    return skillVisualInfo(c).cat === catKey;
  };

  const renderArsenal = () => {
    const selectedItems = catalog.filter((c) => isSelected(c));
    loadoutBar.classList.toggle('hidden', !selectedItems.length);
    if (selectedItems.length) {
      loadoutBar.replaceChildren(
        h('span', { class: 'ars-loadout-lbl' }, `선택 (${selectedItems.length})`),
        h('div', { class: 'ars-loadout-chips' }, selectedItems.map((c) => {
          const v = skillVisualInfo(c);
          return h('button', {
            type: 'button', class: 'ars-slot-chip', title: `${c.name} 해제`,
            onclick: () => onToggle(c, renderArsenal),
          }, skillPixelIconSvg(v.icon, 14), h('span', null, v.titleKo.split('·')[0].trim()), h('i', { class: 'ars-slot-x' }, '×'));
        })));
    } else {
      loadoutBar.replaceChildren();
    }

    tabsBar.replaceChildren(...SKILL_CATEGORIES.map((cat) => {
      const cnt = catalog.filter((c) => matchCat(c, cat.key) && (!onlyReady || c.published !== false)).length;
      return h('button', {
        type: 'button',
        class: `ars-tab${activeCat === cat.key ? ' on' : ''}`,
        onclick: () => { activeCat = cat.key; renderArsenal(); },
      }, cat.label, h('span', { class: 'ars-tab-cnt' }, String(cnt)));
    }));

    readyBtn.className = `ars-ready-btn${onlyReady ? ' on' : ''}`;
    readyBtn.textContent = onlyReady ? '● 사용 가능만' : '사용 가능만';

    const q = query.trim().toLowerCase();
    const visible = catalog.filter((c) => {
      if (!matchCat(c, activeCat)) return false;
      if (onlyReady && c.published === false) return false;
      if (!q) return true;
      const v = skillVisualInfo(c);
      const subText = (c.subSkills || []).map((s) => (typeof s === 'string' ? s : `${s.name} ${s.note || ''}`)).join(' ');
      const hay = `${c.name} ${c.roleLabel || ''} ${v.titleKo} ${v.flow} ${c.hint || ''} ${c.when || ''} ${subText}`.toLowerCase();
      return hay.includes(q);
    });

    if (!visible.length) {
      gridWrap.replaceChildren(h('div', { class: 'ars-empty' }, '결과 없음'));
      return;
    }

    gridWrap.replaceChildren(...visible.map((c) => {
      const on = isSelected(c);
      const upcoming = c.published === false;
      const v = skillVisualInfo(c);
      return h('button', {
        type: 'button',
        class: `ars-card is-tile${on ? ' on' : ''}${upcoming ? ' is-upcoming' : ''}${c.connectAiPack ? ' is-official' : ''}`,
        title: [c.name, c.hint].filter(Boolean).join(' · '),
        onclick: () => onToggle(c, renderArsenal),
      },
      h('div', { class: 'ars-card-top' },
        h('div', { class: `ars-ic-box sm ic-${v.icon}` }, skillPixelIconSvg(v.icon, 20)),
        h('div', { class: 'ars-titles' },
          h('div', { class: 'ars-title-ko' }, v.titleKo)),
        h('span', { class: `ars-state${on ? ' on' : ''}${upcoming ? ' locked' : ''}` },
          on ? '✓ 추가됨' : (upcoming ? '준비 중' : '+ 추가'))));
    }));
  };

  searchIn.addEventListener('input', (ev) => { query = ev.target.value; renderArsenal(); });
  readyBtn.addEventListener('click', () => { onlyReady = !onlyReady; renderArsenal(); });

  root.replaceChildren(
    loadoutBar,
    h('div', { class: 'ars-controls' },
      tabsBar,
      h('div', { class: 'ars-search-row' }, searchIn, readyBtn)),
    gridWrap);
  renderArsenal();
  return { el: root, refresh: renderArsenal };
}

function openEmployeeSkillsModal(empOrId, opts = {}) {
  const empId = typeof empOrId === 'string' ? empOrId : empOrId?.id;
  if (!empId) return;
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide arsenal-dlg';
  let editingSkillId = null;
  const initEmp = emp(empId);
  let activeTab = opts.tab || ((initEmp?.skills || []).length ? 'equipped' : 'arsenal');
  const openIds = new Set(opts.openId ? [opts.openId] : []);
  let equippedQuery = '';

  const repoIn = h('input', { class: 'in', placeholder: '예: npx connect-ai-video-motion 또는 https://github.com/wonseokjung/connect-ai-marketer', 'aria-label': 'GitHub 주소 또는 실행 명령' });
  const nameIn = h('input', { class: 'in', placeholder: '예: connect-ai-video-motion', 'aria-label': '주요 스킬 이름' });
  const roleIn = h('input', { class: 'in', placeholder: '예: 영상 편집 직원 · 2강', 'aria-label': '담당·강의 라벨' });
  const installIn = h('input', { class: 'in mono', placeholder: 'npx connect-ai-video-motion install-skill', 'aria-label': '설치 명령 (최초 1회)' });
  const doctorIn = h('input', { class: 'in mono', placeholder: 'npx connect-ai-video-motion doctor', 'aria-label': '점검 명령 (doctor)' });
  const cmdIn = h('input', { class: 'in mono', placeholder: '예: npx connect-ai-video-motion', 'aria-label': '실행 명령' });
  const computeIn = h('input', { class: 'in', placeholder: '예: 렌더는 Office 1(맥 스튜디오), 가벼운 건 HQ', 'aria-label': '실행할 컴퓨터' });
  const inputSpecIn = h('input', { class: 'in', placeholder: '예: 내 얼굴 나오는 영상(mp4/mov)', 'aria-label': '넣는 것' });
  const outputSpecIn = h('input', { class: 'in', placeholder: '예: 편집된 영상 + 9:16', 'aria-label': '나오는 것' });
  const subIn = h('textarea', { class: 'in skill-sub-ta', rows: 3, placeholder: '한 줄에 하나씩 "이름: 설명" 형식\n예) 몸 인식 모션그래픽: 얼굴, 몸, 손을 피해서 빈자리에 제품 이름, 로고\n컷 편집: 말을 글로 바꿔서 필요 없는 부분 자르기', 'aria-label': '세부 스킬 목록' });
  const whenIn = h('input', { class: 'in', placeholder: '예: "이 영상에 모션그래픽 넣어줘", "컷 편집해줘", "숏츠로 만들어 줘"', 'aria-label': '이렇게 말하면 이 스킬' });
  const publishNoteIn = h('input', { class: 'in', placeholder: '예: npm 0.3.0 · GitHub 공개 또는 아직 npm 공개 전', 'aria-label': '공개 메모' });
  const noteIn = h('input', { class: 'in', placeholder: '예: 한 줄 설명 (선택)', 'aria-label': '스킬 메모' });
  const primaryChk = h('input', { type: 'checkbox', checked: true });
  const publishedChk = h('input', { type: 'checkbox', checked: true });
  let nameTouched = false;
  let cmdTouched = false;
  nameIn.addEventListener('input', () => { nameTouched = Boolean(nameIn.value.trim()); });
  cmdIn.addEventListener('input', () => { cmdTouched = Boolean(cmdIn.value.trim()); });
  repoIn.addEventListener('input', () => {
    const hint = parseClientRepoHint(repoIn.value);
    if (!nameTouched && hint.name) nameIn.value = hint.name;
    if (!cmdTouched && hint.command) cmdIn.value = hint.command;
  });

  const resetForm = () => {
    editingSkillId = null;
    for (const el of [repoIn, nameIn, roleIn, installIn, doctorIn, cmdIn, computeIn, inputSpecIn, outputSpecIn, subIn, whenIn, publishNoteIn, noteIn]) el.value = '';
    primaryChk.checked = true;
    publishedChk.checked = true;
    nameTouched = false;
    cmdTouched = false;
    submitBtn.textContent = '+ 스킬 추가';
    cancelEditBtn.classList.add('hidden');
  };

  const tabBar = h('div', { class: 'sk-modal-tabs', role: 'tablist' });
  const equippedSearchIn = h('input', { class: 'in sm', placeholder: '스킬 검색', 'aria-label': '스킬 검색' });
  const listWrap = h('div');
  const presetWrap = h('div');
  const formWrap = h('div', { class: 'skill-form' });
  const headCount = h('span', { class: 'tag' });
  const cancelEditBtn = h('button', { type: 'button', class: 'btn sm hidden', onclick: () => { resetForm(); activeTab = 'equipped'; syncTabs(); } }, '편집 취소');

  const syncTabs = () => {
    const e = emp(empId);
    const skCnt = (e?.skills || []).length;
    const catCnt = (S.options?.ossCatalog || []).length;
    tabBar.replaceChildren(
      ...[
        ['equipped', `사용 중 (${skCnt})`],
        ['arsenal', `전체 스킬 (${catCnt})`],
        ['custom', editingSkillId ? '편집' : '+ 직접 추가'],
      ].map(([tk, tl]) => h('button', {
        type: 'button',
        class: `sk-modal-tab${activeTab === tk ? ' on' : ''}`,
        onclick: () => { activeTab = tk; syncTabs(); },
      }, tl)));
    listWrap.classList.toggle('hidden', activeTab !== 'equipped');
    presetWrap.classList.toggle('hidden', activeTab !== 'arsenal');
    formWrap.classList.toggle('hidden', activeTab !== 'custom');
  };

  equippedSearchIn.addEventListener('input', (ev) => { equippedQuery = ev.target.value; renderBody(); });

  const submitSkill = () => once('emp-skill-save', async () => {
    const rawRepo = repoIn.value.trim();
    const rawName = nameIn.value.trim();
    if (!rawRepo && !rawName) { repoIn.focus(); toast('스킬 이름이나 명령/GitHub 주소를 입력해 주세요'); return; }
    const payload = {
      name: rawName,
      roleLabel: roleIn.value.trim(),
      command: cmdIn.value.trim(),
      installCmd: installIn.value.trim(),
      doctorCmd: doctorIn.value.trim(),
      inputSpec: inputSpecIn.value.trim(),
      outputSpec: outputSpecIn.value.trim(),
      computeHint: computeIn.value.trim(),
      published: publishedChk.checked,
      publishNote: publishNoteIn.value.trim(),
      primary: primaryChk.checked,
      subSkills: subIn.value.trim(),
      when: whenIn.value.trim(),
      note: noteIn.value.trim(),
    };
    if (editingSkillId) {
      const r = await act('PATCH', `/api/ui/employees/${empId}/skills/${editingSkillId}`, { ...payload, repo: rawRepo }, '스킬을 수정했어요');
      if (r) { resetForm(); activeTab = 'equipped'; renderBody(); }
      return;
    }
    const isRepoLike = /^(https?:\/\/|github:|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$)/i.test(rawRepo);
    const r = await act('POST', `/api/ui/employees/${empId}/skills`, {
      ...payload,
      sourceInput: rawRepo,
      repo: isRepoLike ? rawRepo : '',
    }, '스킬을 장착했어요');
    if (r) { resetForm(); activeTab = 'equipped'; renderBody(); }
  });

  const submitBtn = h('button', { type: 'button', class: 'btn gold', onclick: submitSkill }, '+ 스킬 추가');
  repoIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) submitSkill(); });
  whenIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) submitSkill(); });

  const renderBody = () => {
    const e = emp(empId);
    if (!e) { closeDlg(); render(); return; }
    const skills = [...(Array.isArray(e.skills) ? e.skills : [])]
      .sort((a, b) => Number(a.published !== false) - Number(b.published !== false) ? (a.published !== false ? -1 : 1) : Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
    const readyCnt = skills.filter((s) => s.published !== false && s.doctorStatus === 'ready').length;
    const upCnt = skills.filter((s) => s.published === false || s.doctorStatus === 'upcoming').length;
    headCount.textContent = `${skills.length}개`;

    if (!skills.length) {
      listWrap.replaceChildren(h('div', { class: 'skill-empty' },
        h('button', { type: 'button', class: 'btn sm dark', onclick: () => { activeTab = 'arsenal'; syncTabs(); } }, '+ 스킬 추가')));
    } else {
      const eq = equippedQuery.trim().toLowerCase();
      const filteredSkills = eq
        ? skills.filter((sk) => {
          const subsTxt = (sk.subSkills || []).map((s) => `${s.name} ${s.note || ''}`).join(' ');
          return `${sk.name} ${sk.roleLabel || ''} ${sk.when || ''} ${sk.note || ''} ${subsTxt}`.toLowerCase().includes(eq);
        })
        : skills;
      const listKids = [];
      if (skills.length >= 4) listKids.push(h('div', { class: 'sk-eq-search' }, equippedSearchIn));
      listKids.push(h('div', { class: 'skill-list' }, filteredSkills.map((sk) => {
        const subs = Array.isArray(sk.subSkills) ? sk.subSkills : [];
        const isUpcoming = sk.published === false || sk.doctorStatus === 'upcoming';
        const isReady = !isUpcoming && sk.doctorStatus === 'ready';
        const isMissing = !isUpcoming && sk.doctorStatus === 'missing';
        const expanded = openIds.has(sk.id);

        const addSubName = h('input', { class: 'in sm skill-sub-name-in', placeholder: '새 세부 스킬 이름', 'aria-label': `${sk.name} 세부 스킬 이름` });
        const addSubNote = h('input', { class: 'in sm skill-sub-note-in', placeholder: '설명 (어떻게 쓰는지)', 'aria-label': `${sk.name} 세부 스킬 설명` });
        const pushSub = async () => {
          const nm = addSubName.value.trim();
          const nt = addSubNote.value.trim();
          if (!nm) { addSubName.focus(); return; }
          const nextSubs = [...subs.map((x) => ({ name: x.name, when: x.when, command: x.command, note: x.note })), { name: nm, note: nt }];
          const r = await act('PATCH', `/api/ui/employees/${empId}/skills/${sk.id}`, { subSkills: nextSubs }, `세부 스킬 "${nm}"을 추가했어요`);
          if (r) renderBody();
        };
        addSubName.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); pushSub(); } });
        addSubNote.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); pushSub(); } });

        const statusBadge = isUpcoming
          ? h('span', { class: 'ops-pill sm is-off', title: '공개 전 스킬은 자동 배분에서 제외됩니다' }, '준비 중 · 자동 배분 제외')
          : isReady
            ? h('span', { class: 'ops-pill sm is-ok', title: sk.doctorOutput || 'doctor Ready 확인됨' }, '● 사용 가능')
            : isMissing
              ? h('span', { class: 'ops-pill sm is-warn', title: sk.doctorOutput || '최초 1회 설치가 필요합니다' }, '설치 필요')
              : h('span', { class: 'ops-pill sm' }, '점검 전');

        const specRows = [
          sk.installCmd ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '설치 (1회)'), h('code', { class: 'skill-cmd' }, sk.installCmd)) : null,
          sk.doctorCmd ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '점검 (doctor)'), h('code', { class: 'skill-cmd' }, sk.doctorCmd), sk.doctorOutput ? h('span', { class: `sk-doc-out${isReady ? ' ok' : ''}` }, sk.doctorOutput) : null) : null,
          (sk.inputSpec || sk.outputSpec) ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '넣는 것 → 나오는 것'), h('span', { class: 'sk-spec-v' }, `${sk.inputSpec || '—'}  →  ${sk.outputSpec || '—'}`)) : null,
          sk.when ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '이렇게 말하면'), h('span', { class: 'sk-spec-v' }, sk.when)) : null,
          sk.computeHint ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '실행 컴퓨터'), h('span', { class: 'sk-spec-v' }, sk.computeHint)) : null,
          sk.publishNote ? h('div', { class: 'sk-spec-row' }, h('span', { class: 'sk-spec-k' }, '공개 상태'), h('span', { class: 'sk-spec-v' }, sk.publishNote)) : null,
        ].filter(Boolean);

        const vis = skillVisualInfo(sk);
        const toggleExpand = () => {
          if (openIds.has(sk.id)) openIds.delete(sk.id);
          else openIds.add(sk.id);
          renderBody();
        };
        return h('div', { class: `skill-row${sk.primary && !isUpcoming ? ' is-primary' : ''}${isUpcoming ? ' is-upcoming' : ''}${expanded ? '' : ' is-collapsed'}` },
          h('div', { class: 'skill-row-main' },
            h('div', { class: 'skill-row-top is-clickable', onclick: toggleExpand, title: sk.name },
              h('span', { class: `ars-ic-box sm ic-${vis.icon}` }, skillPixelIconSvg(vis.icon, 18)),
              h('b', null, sk.roleLabel || vis.titleKo || sk.name),
              statusBadge),
            expanded && specRows.length ? h('div', { class: 'sk-spec-box' }, specRows) : null,
            expanded
              ? h('div', { class: 'sk-subs-box' },
                h('div', { class: 'sk-subs-h' }, `세부 스킬 (${subs.length}개 · 추가·제거 가능)`),
                subs.length
                  ? h('div', { class: 'sk-sub-list' }, subs.map((sub, idx) => h('div', { class: 'sk-sub-item' },
                    h('span', { class: 'sk-sub-num' }, `${idx + 1})`),
                    h('div', { class: 'sk-sub-text' },
                      h('b', null, sub.name),
                      sub.note ? h('span', { class: 'sk-sub-desc' }, `: ${sub.note}`) : null),
                    h('button', {
                      type: 'button', class: 'skill-sub-x', 'aria-label': `${sub.name} 제거`,
                      onclick: () => once(`del-sub-${sk.id}-${sub.id}`, async () => {
                        const nextSubs = subs.filter((x) => x.id !== sub.id && x.name !== sub.name);
                        const r = await act('PATCH', `/api/ui/employees/${empId}/skills/${sk.id}`, { subSkills: nextSubs }, `세부 스킬 "${sub.name}"을 뺐어요`);
                        if (r) renderBody();
                      }),
                    }, '×'))))
                  : null,
                h('div', { class: 'skill-sub-add-row' }, addSubName, addSubNote, h('button', { type: 'button', class: 'btn sm', onclick: pushSub }, '+ 추가')))
              : null),
          h('div', { class: 'skill-row-acts' },
            h('button', { type: 'button', class: 'btn sm', onclick: toggleExpand }, expanded ? '접기 ▴' : '상세 ▾'),
            !isUpcoming
              ? h('button', {
                type: 'button', class: `btn sm${isReady ? '' : ' dark'}`,
                title: 'doctor 명령으로 사용 가능 여부를 지금 점검합니다',
                onclick: () => once(`doc-sk-${sk.id}`, async () => {
                  const r = await act('POST', `/api/ui/employees/${empId}/skills/${sk.id}/doctor`, {});
                  if (r?.doctor) {
                    toast(r.doctor.ready ? `● ${sk.name} 사용 가능 (${r.doctor.output})` : `${sk.name} 점검: ${r.doctor.output}`, { kind: r.doctor.ready ? 'connect' : 'handoff' });
                    renderBody();
                  }
                }),
              }, isReady ? '재점검' : '점검 (doctor)')
              : null,
            h('button', {
              type: 'button', class: `btn sm${isUpcoming ? '' : ' gold'}`,
              title: isUpcoming ? '공개 완료로 활성화 (자동 배분에 포함)' : '준비 중으로 전환 (자동 배분에서 제외)',
              onclick: () => once(`pub-sk-${sk.id}`, async () => {
                const r = await act('PATCH', `/api/ui/employees/${empId}/skills/${sk.id}`, { published: isUpcoming }, isUpcoming ? `${sk.name} 스킬을 공개(활성)로 전환했어요` : `${sk.name} 스킬을 준비 중(자동 배분 제외)으로 바꿨어요`);
                if (r) renderBody();
              }),
            }, isUpcoming ? '공개 전환' : '공개 중'),
            h('button', {
              type: 'button', class: 'btn sm',
              onclick: () => {
                editingSkillId = sk.id;
                repoIn.value = sk.repo || '';
                nameIn.value = sk.name || '';
                roleIn.value = sk.roleLabel || '';
                cmdIn.value = sk.command || '';
                installIn.value = sk.installCmd || '';
                doctorIn.value = sk.doctorCmd || '';
                inputSpecIn.value = sk.inputSpec || '';
                outputSpecIn.value = sk.outputSpec || '';
                computeIn.value = sk.computeHint || '';
                publishNoteIn.value = sk.publishNote || '';
                subIn.value = subs.map((x) => (x.note ? `${x.name}: ${x.note}` : x.name)).join('\n');
                whenIn.value = sk.when || '';
                noteIn.value = sk.note || '';
                primaryChk.checked = Boolean(sk.primary);
                publishedChk.checked = sk.published !== false;
                nameTouched = Boolean(sk.name);
                cmdTouched = Boolean(sk.command);
                submitBtn.textContent = '스킬 수정 저장';
                cancelEditBtn.classList.remove('hidden');
                activeTab = 'custom';
                syncTabs();
                nameIn.focus();
              },
            }, '편집'),
            h('button', {
              type: 'button', class: 'btn sm',
              onclick: () => once(`del-sk-${sk.id}`, async () => {
                const r = await act('DELETE', `/api/ui/employees/${empId}/skills/${sk.id}`, undefined, `${sk.name} 스킬을 뺐어요`);
                if (r) { if (editingSkillId === sk.id) resetForm(); renderBody(); }
              }),
            }, '제거')));
      })));
      listWrap.replaceChildren(...listKids);
    }

    const equippedKeys = new Set(skills.map((s) => (s.preset || '').toLowerCase()).filter(Boolean));
    const equippedRepos = new Set(skills.map((s) => (s.repo || '').toLowerCase()).filter(Boolean));
    const equippedNames = new Set(skills.map((s) => (s.name || '').toLowerCase()).filter(Boolean));
    const catalog = [...(S.options?.ossCatalog || [])].sort((a, b) => {
      const ap = a.published !== false ? 1 : 0;
      const bp = b.published !== false ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const ac = a.connectAiPack ? 1 : 0;
      const bc = b.connectAiPack ? 1 : 0;
      if (ac !== bc) return bc - ac;
      const am = a.team === (e.team || 'ops') ? 1 : 0;
      const bm = b.team === (e.team || 'ops') ? 1 : 0;
      return bm - am;
    });
    const officeOss = (S.data.resources || []).filter((r) => r.kind === '오픈소스' && r.status !== '꺼짐'
      && !catalog.some((c) => c.key === r.preset || c.name.toLowerCase() === String(r.name || '').toLowerCase()));

    const findEquipped = (c) => skills.find((s) =>
      (s.preset && s.preset.toLowerCase() === c.key.toLowerCase())
      || (c.repo && s.repo && s.repo.toLowerCase() === c.repo.toLowerCase())
      || (s.name && s.name.toLowerCase() === c.name.toLowerCase()));

    const arsenal = buildSkillArsenal({
      catalog,
      isSelected: (c) => Boolean(findEquipped(c)),
      onToggle: (c) => once(`preset-sk-${c.key}`, async () => {
        const existing = findEquipped(c);
        if (existing) {
          const r = await act('DELETE', `/api/ui/employees/${empId}/skills/${existing.id}`, undefined, `${shortName(empId)}에서 ${c.name} 스킬을 뺐어요`);
          if (r) { if (editingSkillId === existing.id) resetForm(); renderBody(); }
          return;
        }
        const r = await act('POST', `/api/ui/employees/${empId}/skills`, { presetKey: c.key, primary: true }, `${shortName(empId)}에게 ${c.name} 스킬${c.published === false ? ' (준비 중)' : ''}을 장착했어요`);
        if (r) renderBody();
      }),
    });
    const presetKids = [arsenal.el];
    if (officeOss.length) {
      presetKids.push(h('div', { class: 'skill-sec-sub' },
        h('div', { class: 'skill-sec-h' }, '내 사무실에 등록된 오픈소스 연결'),
        h('div', { class: 'picker' }, officeOss.map((r) => {
          const on = (r.repo && equippedRepos.has(r.repo.toLowerCase())) || equippedNames.has(String(r.name || '').toLowerCase());
          return h('button', {
            type: 'button',
            class: `chip sm${on ? ' on' : ''}`,
            onclick: () => once(`res-sk-${r.id}`, async () => {
              const out = await act('POST', `/api/ui/employees/${empId}/skills`, { resourceId: r.id }, `${r.name} 스킬을 연결했어요`);
              if (out) renderBody();
            }),
          }, `${on ? '✓ ' : '+ '}${r.name}`);
        }))));
    }
    presetWrap.replaceChildren(...presetKids);
    syncTabs();
  };

  formWrap.replaceChildren(
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, '스킬 이름', nameIn),
      h('label', { class: 'field' }, 'GitHub / 명령', repoIn)),
    h('details', { class: 'clean-fold sm', style: 'margin-top:8px' },
      h('summary', null, '상세 옵션'),
      h('div', { class: 'grid2 coord-dlg-gap' },
        h('label', { class: 'field' }, '표시 이름', roleIn),
        h('label', { class: 'field' }, '실행 명령', cmdIn)),
      h('div', { class: 'grid2 coord-dlg-gap' },
        h('label', { class: 'field' }, '설치 명령', installIn),
        h('label', { class: 'field' }, '점검 명령', doctorIn)),
      h('div', { class: 'grid2 coord-dlg-gap' },
        h('label', { class: 'field' }, '입력', inputSpecIn),
        h('label', { class: 'field' }, '출력', outputSpecIn)),
      h('label', { class: 'field coord-dlg-gap' }, '트리거 키워드', whenIn),
      h('label', { class: 'field coord-dlg-gap' }, '세부 스킬', subIn),
      h('div', { class: 'grid2 coord-dlg-gap' },
        h('label', { class: 'field' }, '실행 컴퓨터', computeIn),
        h('label', { class: 'field' }, '상태 메모', publishNoteIn))),
    h('div', { class: 'skill-form-foot' },
      h('div', { class: 'row' },
        h('label', { class: 'skill-pri-chk' }, primaryChk, '주요'),
        h('label', { class: 'skill-pri-chk' }, publishedChk, '공개')),
      h('div', { class: 'skill-form-acts' }, cancelEditBtn, submitBtn)));

  const e0 = emp(empId);
  const tInfo = e0 ? empTeamInfo(e0) : null;
  renderBody();
  const finish = () => { closeDlg(); render(); };

  setDlg(dlg,
    h('div', { class: 'row codex-top' },
      h('h3', { class: 'coord-dlg-h' }, `${shortName(empId)} · 스킬`,
        tInfo ? h('span', { class: `team-pill tm-${tInfo.key}` }, h('i'), tInfo.short) : null),
      h('button', { type: 'button', class: 'auto-m-x', 'aria-label': '닫기', onclick: finish }, '×')),
    tabBar,
    listWrap,
    presetWrap,
    formWrap,
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn dark', onclick: finish }, '완료')));
  dlg.showModal();
  dlg.scrollTop = 0;
}

function koSubject(word) {
  const s = String(word || '').trim();
  if (!s) return '';
  const ch = s.charCodeAt(s.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) return `${s}${(ch - 0xac00) % 28 === 0 ? '가' : '이'}`;
  return `${s}가`;
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
function money(n, cur) { return cur === 'KRW' ? won(n) : `${cur} ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
function bigMoney(n) { return [Math.round(n).toLocaleString('ko-KR'), h('small', null, '원')]; }
function dateK(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}
function periodK(p) { return /^\d{4}-\d{2}$/.test(p) ? `${Number(p.slice(5))}월 전체` : dateK(p); }
function stamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const same = S && S.today === `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return same ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function emp(id) { return S.data.employees.find((e) => e.id === id); }
function res(id) { return S.data.resources.find((r) => r.id === id); }
function nameOf(id) {
  if (id === 'jay') return `${S.data.owner.name} 대표`;
  if (id === 'system') return '본사';
  const e = emp(id);
  if (!e) return '담당 미정';
  return e.avatarName && e.avatarName !== e.name ? `${e.avatarName} (${e.name})` : e.name;
}
function shortName(id) {
  if (id === 'jay') return '나';
  const e = emp(id);
  if (!e) return '미정';
  if (e.avatarName) return e.avatarName;
  return e.name.replace(/ 멤버십.*$/, '').replace(/^내가 학습시킨 /, '');
}
function kindBadge(kind, imported, pasted) {
  if (imported) return h('span', { class: 'kind ghost' }, '가져옴');
  if (pasted) return h('span', { class: 'kind ghost' }, '붙여 넣음');
  if (kind === 'human') return h('span', { class: 'kind' }, '사람');
  if (kind === 'ai') return h('span', { class: 'kind ai' }, 'AI');
  return h('span', { class: 'kind sys' }, '본사');
}
function evidenceLink(file) {
  return file ? h('a', { class: 'evi', href: `/evidence/${encodeURIComponent(file)}`, target: '_blank', rel: 'noopener' }, '근거 보기') : null;
}
const SND = () => window.HQSound;
let liveCardSeq = 0;

function pushLiveCard({ kind = 'info', kicker = '', title = '', body = '', empId = null, taskId = null, actionLabel = '', onAction = null, sound = null, seal = false, duration = 4600 } = {}) {
  const dock = document.getElementById('live-dock');
  if (!dock) return;
  if (sound !== false) SND()?.play(sound || (kind === 'info' ? 'tick' : kind));
  const id = `lc-${++liveCardSeq}`;
  const kickerText = kicker || ({
    connect: 'CONNECT AI · 연결',
    done: 'CONNECT AI · 완료',
    handoff: 'CONNECT AI · 자동 인계',
    approve: 'CONNECT AI · 결재 印',
    alert: 'CONNECT AI · 확인 필요',
    info: 'CONNECT AI',
  }[kind] || 'CONNECT AI');
  const nowStr = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  const eObj = empId && S ? emp(empId) : null;
  const iconEl = eObj
    ? avatarEl(eObj, { size: 34, stateOverride: kind === 'connect' ? 'working' : 'idle' })
    : seal
      ? h('span', { class: 'live-seal', 'aria-hidden': 'true' }, '印')
      : h('span', { class: 'live-brand-dot', 'aria-hidden': 'true' }, h('i'), h('i'));

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    card.classList.add('hiding');
    setTimeout(() => card.remove(), 220);
  };
  const card = h('div', { class: `live-card k-${kind}`, 'data-id': id, role: 'status' },
    h('div', { class: 'live-card-in' },
      iconEl,
      h('div', { class: 'live-card-body' },
        h('div', { class: 'live-card-meta' }, h('span', { class: 'live-kicker' }, kickerText), h('span', { class: 'live-ts' }, nowStr)),
        h('div', { class: 'live-card-title' }, title),
        body ? h('div', { class: 'live-card-sub clamp2' }, body) : null,
        taskId
          ? h('button', { type: 'button', class: 'btn link live-card-act', onclick: () => { dismiss(); openTaskById(taskId); } }, actionLabel || '열기 →')
          : onAction
            ? h('button', { type: 'button', class: 'btn link live-card-act', onclick: () => { dismiss(); onAction(); } }, actionLabel || '열기 →')
            : null),
      h('button', { type: 'button', class: 'live-x', 'aria-label': '알림 닫기', onclick: dismiss }, '×')),
    h('div', { class: 'live-prog' }, h('i')));

  card.addEventListener('mouseenter', () => { clearTimeout(timer); card.classList.add('paused'); });
  card.addEventListener('mouseleave', () => { card.classList.remove('paused'); timer = setTimeout(dismiss, 1800); });
  dock.prepend(card);
  while (dock.children.length > 4) dock.lastElementChild?.remove();
  requestAnimationFrame(() => card.classList.add('shown'));
  timer = setTimeout(dismiss, duration);
}

function toast(msg, opts = {}) {
  const txt = String(msg || '').trim();
  if (!txt) return;
  let kind = opts.kind || 'info';
  if (!opts.kind) {
    if (/승인|확인했어요/.test(txt)) kind = 'approve';
    else if (/완료|결과를 남겼/.test(txt)) kind = 'done';
    else if (/인계|우회|전환/.test(txt)) kind = 'handoff';
    else if (/시작했|켰어요|연결|맡겼/.test(txt)) kind = 'connect';
    else if (/실패|오류|필요해|중단|차단/.test(txt)) kind = 'alert';
  }
  pushLiveCard({
    kind,
    title: txt,
    body: opts.body || '',
    empId: opts.empId || null,
    taskId: opts.taskId || null,
    actionLabel: opts.actionLabel || '',
    sound: opts.sound !== undefined ? opts.sound : (kind === 'info' ? 'tick' : kind),
    seal: kind === 'approve',
    duration: opts.duration || (kind === 'alert' ? 5400 : 3800),
  });
}

function renderLiveWorker() {
  const box = document.getElementById('live-worker');
  if (!box || !S) return;
  const list = S.working || [];
  if (!list.length) { box.replaceChildren(); box.classList.remove('show'); return; }
  const w = list[0];
  const eObj = emp(w.emp);
  const tObj = w.taskId ? S.data.tasks.find((x) => x.id === w.taskId) : null;
  const more = list.length > 1 ? ` 외 ${list.length - 1}명` : '';
  const pill = h('div', {
    class: 'live-worker-pill', role: 'button', tabindex: '0',
    onclick: () => { if (w.taskId) openTaskById(w.taskId); else location.hash = '#dashboard'; },
    onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (w.taskId) openTaskById(w.taskId); else location.hash = '#dashboard'; } },
  },
  eObj ? avatarEl(eObj, { size: 32, stateOverride: 'working' }) : h('span', { class: 'live-brand-dot' }, h('i'), h('i')),
  h('div', { class: 'live-worker-txt' },
    h('div', { class: 'live-worker-h' }, h('span', { class: 'live-pulse' }), h('b', null, `${shortName(w.emp)} 일하는 중${more}`)),
    h('div', { class: 'small muted clamp' }, w.statusLine || tObj?.title || w.label || '작업 실행 중')),
  w.taskId
    ? h('button', {
      type: 'button', class: 'btn sm stop-run-btn',
      title: `${shortName(w.emp)} 작업 즉시 중단`,
      onclick: (ev) => { ev.stopPropagation(); stopRunningTask(w.taskId, w.emp); },
    }, '■ 중단')
    : null,
  h('span', { class: 'tag' }, '열기'));
  box.replaceChildren(pill);
  box.classList.add('show');
}

function stopRunningTask(taskId, empId) {
  return once(`stop-${taskId}`, async () => {
    await act('POST', `/api/ui/tasks/${taskId}/stop`, {}, `⏹️ ${shortName(empId)} 작업을 즉시 중단했어요`);
  });
}

const recentStartCards = new Map();
function markStartCardShown(taskId) {
  if (!taskId) return;
  const now = Date.now();
  recentStartCards.set(taskId, now);
  for (const [k, ts] of recentStartCards) if (now - ts > 10000) recentStartCards.delete(k);
}
function wasStartCardRecent(taskId) {
  const ts = taskId ? recentStartCards.get(taskId) : 0;
  return Boolean(ts && Date.now() - ts < 8000);
}

function detectLiveEvents(prev, next) {
  if (!prev || !next?.data) return;
  const prevWork = new Set((prev.working || []).map((w) => `${w.emp}:${w.taskId}`));
  for (const w of next.working || []) {
    if (!prevWork.has(`${w.emp}:${w.taskId}`)) {
      if (wasStartCardRecent(w.taskId)) continue;
      const t = next.data.tasks.find((x) => x.id === w.taskId);
      markStartCardShown(w.taskId);
      pushLiveCard({
        kind: 'connect',
        title: `${shortName(w.emp)} 작업 연결 · 시작`,
        body: t ? t.title : (w.label || '작업 시작'),
        empId: w.emp,
        taskId: w.taskId || null,
        actionLabel: '진행 보기 →',
        duration: 4200,
      });
    }
  }
  const prevTasks = new Map((prev.data?.tasks || []).map((t) => [t.id, t]));
  for (const t of next.data.tasks || []) {
    const old = prevTasks.get(t.id);
    if (!old) continue;
    const oldTrailLen = (old.failoverTrail || []).length;
    const newTrail = t.failoverTrail || [];
    if (newTrail.length > oldTrailLen) {
      const last = newTrail[newTrail.length - 1];
      pushLiveCard({
        kind: 'handoff',
        title: `자동 인계: ${last.fromName} → ${last.toName}`,
        body: `${t.title} (${last.reason})`,
        empId: last.to,
        taskId: t.id,
        actionLabel: '진행 보기 →',
        duration: 5400,
      });
    }
    if (!old.alarmFiredAt && t.alarmFiredAt) {
      pushLiveCard({
        kind: 'approve',
        kicker: 'CONNECT AI · 알람',
        title: `⏰ ${t.title}`,
        body: t.time ? `${fmtKoTime(t.time)} 예약 알람이 울렸습니다` : '예약 알람이 울렸습니다',
        taskId: t.id,
        actionLabel: '확인 →',
        sound: 'done',
        duration: 12000,
      });
    }
    if (old.status !== '완료' && t.status === '완료' && (t.completedBy || t.assignee) !== 'jay' && !t.alarmFiredAt) {
      const byId = t.completedBy || t.assignee;
      pushLiveCard({
        kind: 'done',
        title: `${shortName(byId)} 작업 완료 · 결과물 도착`,
        body: t.resultSummary || t.title,
        empId: byId,
        taskId: t.id,
        actionLabel: '결과 보기 →',
        duration: 6000,
      });
    }
  }
  const prevApprs = new Set((prev.data?.approvals || []).map((a) => a.id));
  for (const a of next.data.approvals || []) {
    if (!prevApprs.has(a.id) && a.status === '대기') {
      pushLiveCard({
        kind: 'alert',
        title: `대표 결재 요청 (${a.kind})`,
        body: `${shortName(a.from)}: ${a.what}`,
        empId: a.from,
        taskId: a.taskId || null,
        actionLabel: '결재하기 →',
        seal: true,
        duration: 6500,
      });
    }
  }
}
const CLI_ENGINES = ['claude', 'codex', 'gemini', 'agy', 'opencode'];
const ENGINE_LABEL = { web: '복사해서 맡기기', none: '스스로 보고 (MCP, CLI)', local: '로컬 모델', claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', agy: 'Antigravity (agy)', opencode: 'OpenCode' };
const RUN_LABEL = { off: '꺼짐', manual: '누를 때만', auto: '자동 실행' };
// 이 앱이 직접 일을 시킬 수 있는가 (로컬 모델, 또는 이 맥에 설치된 Claude Code, Codex, Gemini CLI, Antigravity, OpenCode)
function canRun(e) {
  if (!e || e.runMode === 'off') return false;
  if (e.engine === 'local') return Boolean(e.model);
  if (CLI_ENGINES.includes(e.engine)) return Boolean(S.runners[e.engine]);
  return false;
}
function accessChannelsOf(e) {
  const out = [];
  const d = S?.data;
  if (!d || !e) return out;
  const cuMac = d.resources.find((r) => r.kind === '기계' && r.status !== '꺼짐' && r.computerUse !== false);
  const defBr = d.resources.find((r) => r.kind === '브라우저' && r.status !== '꺼짐' && r.isDefault)
    || d.resources.find((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  const phones = d.resources.filter((r) => r.kind === '스마트폰' && r.status !== '꺼짐');
  const isLocalExec = [...CLI_ENGINES, 'local'].includes(e.engine) || (e.group !== 'home-cloud' && /데스크탑|컴퓨터|로컬/.test(e.runsOn || ''));
  const canCu = Boolean(cuMac && (CLI_ENGINES.includes(e.engine) || /컴퓨터\s*유즈|자동화/.test(e.role || '')));
  const isMobileOnly = e.catalog === 'pickle' || /스마트폰/.test(e.role || '');

  if (isLocalExec) out.push('로컬 컴퓨터');
  if (canCu) out.push('화면 조작(CU)');
  if (defBr && e.engine !== 'local' && !isMobileOnly) out.push(`브라우저 · ${defBr.name}`);
  if (e.group === 'home-cloud' || e.engine === 'web') out.push(isMobileOnly ? '스마트폰 · 클라우드' : '클라우드 웹');
  for (const ph of phones) {
    const mode = ph.phoneMode || 'iphone-mirror';
    if (mode === 'mobile-ai' && (ph.assignee === e.id || isMobileOnly)) {
      out.push(`스마트폰 · ${ph.name}`);
    } else if ((mode === 'iphone-mirror' || mode === 'android-adb') && (ph.assignee === e.id || canCu)) {
      out.push(mode === 'iphone-mirror' ? `아이폰 미러링` : '안드로이드');
    }
  }
  return [...new Set(out)].slice(0, 4);
}
const isWorking = (id) => S.working.some((w) => w.emp === id);
const features = () => S.data.settings.features || {};

async function api(method, url, body) {
  const r = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-HQ-UI': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch { /* 빈 응답 */ }
  if (r.status === 401) {
    toast('사람 세션이 없습니다. 화면을 새로고침합니다.');
    setTimeout(() => location.reload(), 1200);
    throw new Error('session');
  }
  if (!r.ok) { const msg = json?.error || `오류 ${r.status}`; toast(msg); throw new Error(msg); }
  return json;
}
async function act(method, url, body, okMsg) {
  try {
    const r = await api(method, url, body);
    // 자동 배분 직후 load()가 중복 "작업 연결 · 시작" 카드를 띄우지 않도록 먼저 기록
    if (url === '/api/ui/coordinator/delegate' && r?.autoStarted && r?.id) markStartCardShown(r.id);
    if (okMsg) toast(okMsg);
    await load();
    return r;
  } catch {
    return null;
  }
}

// ───────── 불러오기와 다시 그리기 ─────────

function stateSignature(st) {
  const mh = st.machineHealth || {};
  const mhSig = Object.values(mh).map((x) => `${x.id}:${x.level}:${x.ramPct ?? ''}`).join(',');
  const wSig = (st.working || []).map((w) => `${w.emp}:${w.taskId}:${w.statusLine || ''}`).join(',');
  const oSig = (st.offices || []).map((o) => `${o.id}:${o.state}:${o.log || ''}`).join(',');
  const uSig = Object.entries(st.employeeUsage || {}).map(([id, u]) => `${id}:${u.pct5h ?? ''}`).join(',');
  return `${st.rev || 0}|${wSig}|${(st.assigning || []).join(',')}|${oSig}|${mhSig}|${(st.ramHistory || []).length}|${st.health?.lastSyncAt || ''}|${st.health?.score ?? ''}|${uSig}|${st.runtime?.active ? 1 : 0}`;
}

async function load({ background = false } = {}) {
  const r = await fetch('/api/state', { credentials: 'same-origin' });
  const next = await r.json();
  const sig = stateSignature(next);
  const unchanged = background && S && sig === ui.lastSig;
  const prev = S;
  S = next;
  ui.lastSig = sig;
  if (prev && !unchanged) detectLiveEvents(prev, next);
  renderLiveWorker();
  if (unchanged) return;
  if (background && !S?.data?.settings?.onboarded) return;
  if (background && isEditingPageInput()) {
    ui.pendingRender = true;
    renderNav();
    return;
  }
  ui.pendingRender = false;
  render();
}

function snapshotInputs() {
  const snap = new Map();
  for (const el of document.querySelectorAll('[data-k]')) {
    snap.set(el.dataset.k, { value: el.value, checked: el.checked, open: el.open, scrollTop: el.scrollTop || 0, focused: document.activeElement === el, s: el.selectionStart, e: el.selectionEnd });
  }
  return snap;
}
function restoreInputs(snap) {
  for (const el of document.querySelectorAll('[data-k]')) {
    const v = snap.get(el.dataset.k);
    if (!v) continue;
    if (el.tagName === 'DETAILS') { el.open = v.open; continue; }
    if (el.type === 'checkbox') { el.checked = v.checked; continue; }
    if (el.dataset.fresh !== '1') el.value = v.value;
    if (el.tagName === 'TEXTAREA' && v.scrollTop) el.scrollTop = v.scrollTop;
    if (v.focused) { el.focus(); try { el.setSelectionRange(v.s, v.e); } catch { /* select */ } }
  }
}

function openTaskById(tid) {
  const t = S?.data?.tasks?.find((x) => x.id === tid);
  if (t && t.status === '완료') ui.doneOpen = true;
  ui.open = tid;
  ui.picking = null;
  if (ui.route !== 'home') { ui.route = 'home'; location.hash = `#home/${tid}`; }
  render();
  setTimeout(() => {
    const db = document.querySelector('.done-box');
    if (t && t.status === '완료' && db) db.open = true;
    document.querySelector(`li[data-id="${tid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 30);
}

async function openPromptPreview(kind, id, flushFn = null) {
  if (flushFn) await flushFn();
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  setDlg(dlg, h('h3', null, 'AI에게 전달되는 최종 지시서'), h('div', { class: 'small muted' }, '지시서를 정리하는 중…'));
  dlg.showModal();
  try {
    const p = await api('GET', `/api/ui/${kind}/${id}/prompt-preview`);
    const badges = [];
    if (p.empName) badges.push(h('span', { class: 'tag solid' }, p.empName));
    if (p.linked?.office) badges.push(h('span', { class: 'tag' }, p.linked.office));
    if (p.linked?.browser) badges.push(h('span', { class: 'tag' }, p.linked.account?.spaceName ? `${p.linked.browser} (${p.linked.account.spaceName})` : p.linked.browser));
    if (p.linked?.account) badges.push(h('span', { class: 'tag' }, p.linked.account.name.split(' · ')[0].split(' (')[0]));
    for (const sk of p.linked?.skills || []) {
      const m = skillChipMeta(sk.key || sk.name);
      badges.push(h('span', { class: 'tag bp-prev-sk' }, skillPixelIconSvg(m.icon, 13), `스킬: ${m.shortTitle}`));
    }
    for (const kb of p.linked?.knowledge || []) {
      badges.push(h('span', { class: `tag${kb.pinned ? ' bp-prev-kb' : ''}` }, `${kb.pinned ? '★ 지식: ' : '지식: '}${kb.title}`));
    }
    for (const dName of p.linked?.designs || []) badges.push(h('span', { class: 'tag' }, `디자인: ${dName}`));
    for (const tObj of p.linked?.tools || []) badges.push(h('span', { class: 'tag' }, tObj.name));
    if (p.linked?.memory?.count) badges.push(h('span', { class: 'tag bp-prev-kb' }, `자동 기억 ${p.linked.memory.count}`));
    if (p.linked?.compaction?.compacted) badges.push(h('span', { class: 'tag' }, `스레드 압축 (${p.linked.compaction.originalCount}→${p.linked.compaction.keptCount})`));
    if (p.linked?.estCost) badges.push(h('span', { class: 'tag' }, `예상 ${won(p.linked.estCost)}`));
    if (p.linked?.autoApprove) badges.push(h('span', { class: 'tag bp-prev-sk' }, '⚡ 게시·업로드 바로 실행'));
    if (p.linked?.gate) badges.push(h('span', { class: 'tag' }, `${p.linked.gate} ${p.linked.gateApproved ? '확인됨' : '확인 필요'}`));
    setDlg(dlg, 
      h('h3', null, 'AI에게 전달되는 최종 지시서'),
      badges.length ? h('div', { class: 'row', style: 'margin-bottom:12px' }, badges) : null,
      p.linked?.account?.blocked ? h('div', { class: 'warn', style: 'margin-bottom:12px' }, p.linked.account.message) : null,
      h('pre', { class: 'report-pre' }, p.prompt),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); } }, '닫기'),
        h('button', { class: 'btn dark', onclick: async () => { await copyText(p.prompt); toast('최종 지시서를 복사했어요'); } }, '지시서 복사')));
  } catch {
    dlg.className = '';
    dlg.close();
  }
}

async function openConnectModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const loadView = async () => {
    setDlg(dlg, h('h3', null, 'AI 도구 연결 (MCP · 스킬)'), h('div', { class: 'small muted' }, '이 컴퓨터의 AI 도구를 확인하는 중…'));
    if (!dlg.open) dlg.showModal();
    try {
      const c = await api('GET', '/api/onboard/connect');
      const list = (c.targets || []).filter((t) => t.found);
      const pending = list.filter((t) => !(t.mcp.configured && (!t.skill || t.skill.installed)));
      const oneLineCmd = c.terminal || 'npx github:wonseokjung/connect-ai-autonomous-company connect --yes';
      const rows = list.length ? list.map((t) => {
        const done = t.mcp.configured && (!t.skill || t.skill.installed);
        return h('div', { class: 'ob-conn' },
          h('div', { class: 'row' },
            h('div', null, h('b', null, t.name), h('div', { class: 'small muted' }, `직원 아이디 ${t.employee}${t.skill ? ' · MCP + 스킬' : ' · MCP'}`)),
            done ? h('span', { class: 'tag solid' }, '연결됨 ✓') : h('span', { class: 'tag' }, '연결 전')),
          !done ? h('details', { style: 'margin-top:6px' },
            h('summary', { class: 'small muted', style: 'cursor:pointer' }, '개별 수동 명령 보기'),
            h('div', { class: 'ob-cmds' },
              !t.mcp.configured ? (t.mcp.line ? copyBlock('MCP', t.mcp.line) : copyBlock(`MCP (${t.mcp.file})`, t.mcp.snippet)) : null,
              t.skill && !t.skill.installed ? copyBlock('스킬', t.skill.line) : null)) : null);
      }) : [h('div', { class: 'empty' }, '이 컴퓨터에서 바이브코딩 툴(Claude Code · Codex · Antigravity · Cursor · OpenCode · Gemini CLI · Windsurf · Claude Desktop · LM Studio)을 찾지 못했어요. 웹 AI는 지시문 복사로 바로 쓸 수 있어요.')];
      setDlg(dlg,
        h('h3', null, 'AI 도구 연결'),
        pending.length ? copyBlock(`터미널 1줄 연결 (${pending.length}개)`, oneLineCmd) : null,
        ...rows,
        h('div', { class: 'bar' },
          h('button', { class: 'btn', onclick: loadView }, '연결 다시 확인'),
          h('button', { class: 'btn dark', onclick: () => { dlg.className = ''; dlg.close(); } }, '닫기')));
    } catch {
      dlg.className = '';
      dlg.close();
    }
  };
  loadView();
}

function openSettingsModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const d = S.data;
  const ownerName = h('input', { class: 'in', value: d.owner.name || '', placeholder: '이름', 'aria-label': '이름' });
  const companyName = h('input', { class: 'in', value: d.settings.companyName || '', placeholder: '회사', 'aria-label': '회사' });
  const qFrom = h('input', { class: 'in', type: 'time', value: d.settings.quietHours?.from || '', 'aria-label': '방해 금지 시작' });
  const qTo = h('input', { class: 'in', type: 'time', value: d.settings.quietHours?.to || '', 'aria-label': '방해 금지 종료' });
  const f = d.settings.features || {};
  const fAppr = h('input', { type: 'checkbox', checked: Boolean(f.approvals) });
  const fMsg = h('input', { type: 'checkbox', checked: Boolean(f.messenger) });
  const fRev = h('input', { type: 'checkbox', checked: Boolean(f.revenue) });
  const fOpt = h('input', { type: 'checkbox', checked: d.settings.autoOptimize !== false });
  const fAutoMem = h('input', { type: 'checkbox', checked: d.settings.autoMemory !== false });
  const fAutoVer = h('input', { type: 'checkbox', checked: d.settings.autoVerify !== false });
  const fSleep = h('input', { type: 'checkbox', checked: d.settings.preventSleep !== false });
  const fAutoAdd = h('input', { type: 'checkbox', checked: d.settings.autoStartAdded !== false });
  const fNotify = h('input', { type: 'checkbox', checked: d.settings.desktopNotify !== false });
  const fSound = h('input', { type: 'checkbox', checked: SND()?.enabled() !== false, onchange: (ev) => { SND()?.setEnabled(ev.target.checked); if (ev.target.checked) SND()?.play('connect', { force: true }); } });
  const memCount = Object.keys(d.settings.assignMemory || {}).length;
  const swRow = (label, chk) => h('div', { class: 'set-row' },
    h('span', { class: 'set-lbl' }, label),
    h('label', { class: 'switch' }, chk, h('span', { class: 'tr' })));
  const save = () => once('save-set', async () => {
    SND()?.setEnabled(fSound.checked);
    const patch = {
      ownerName: ownerName.value.trim() || undefined,
      companyName: companyName.value.trim(),
      autoOptimize: fOpt.checked,
      autoMemory: fAutoMem.checked,
      autoVerify: fAutoVer.checked,
      preventSleep: fSleep.checked,
      autoStartAdded: fAutoAdd.checked,
      desktopNotify: fNotify.checked,
      features: { approvals: fAppr.checked, messenger: fMsg.checked, revenue: fRev.checked, channel: fRev.checked },
    };
    if (qFrom.value && qTo.value && qFrom.value !== qTo.value) patch.quietHours = { from: qFrom.value, to: qTo.value };
    else if (!qFrom.value && !qTo.value) patch.quietHours = null;
    dlg.className = '';
    dlg.close();
    await act('PATCH', '/api/ui/settings', patch, '저장했어요');
  });
  setDlg(dlg,
    h('h3', null, '설정'),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, '이름', ownerName),
      h('label', { class: 'field' }, '회사', companyName)),
    h('div', { class: 'grid2', style: 'margin-top:12px' },
      h('label', { class: 'field' }, '방해 금지 시작', qFrom),
      h('label', { class: 'field' }, '방해 금지 종료', qTo)),
    h('div', { class: 'set-rows' },
      swRow('자동 실행', fAutoAdd),
      swRow('알림', fNotify),
      swRow('효과음', fSound),
      swRow('자동 최적화', fOpt)),
    h('details', { class: 'clean-fold sm', style: 'margin-top:12px' },
      h('summary', null, '고급'),
      h('div', { class: 'set-adv' },
        swRow('자동 기억', fAutoMem),
        swRow('자동 검증', fAutoVer),
        swRow('잠자기 방지', fSleep),
        h('div', { class: 'set-row' },
          h('span', { class: 'set-lbl' }, '추가 메뉴'),
          h('div', { class: 'row', style: 'gap:10px' },
            h('label', { class: 'chk-l small' }, fAppr, '결재함'),
            h('label', { class: 'chk-l small' }, fMsg, '메신저'),
            h('label', { class: 'chk-l small' }, fRev, '매출'))),
        h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap;padding-top:8px' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => { dlg.className = ''; dlg.close(); location.hash = '#pocket'; } }, '폰 뷰'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { dlg.className = ''; dlg.close(); location.hash = '#dashboard'; } }, '대시보드'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { dlg.className = ''; dlg.close(); openConnectModal(); } }, '도구 연결'),
          h('button', { type: 'button', class: 'btn sm', onclick: async () => { if (confirm('처음 설정을 다시 열까요?')) { dlg.className = ''; dlg.close(); ui.ob = null; await act('PATCH', '/api/ui/settings', { onboarded: false }); } } }, '처음 설정'),
          memCount ? h('button', { type: 'button', class: 'btn sm', onclick: async () => { await act('PATCH', '/api/ui/settings', { resetAssignMemory: true }, '초기화했어요'); openSettingsModal(); } }, `학습 초기화 (${memCount})`) : null))),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: save }, '저장')));
  dlg.showModal();
}

function render() {
  if (!S || (ui.drag && document.querySelector('.dragging')) || document.getElementById('dlg').open) return;
  ui.drag = false;
  const snap = snapshotInputs();
  const th = document.querySelector('.thread');
  const nearBottom = th ? th.scrollHeight - th.scrollTop - th.clientHeight < 60 : true;
  document.body.classList.toggle('onboarding', !S.data.settings.onboarded);
  renderNav();
  const page = document.getElementById('page');
  page.replaceChildren(pageFor(ui.route)());
  restoreInputs(snap);
  const th2 = document.querySelector('.thread');
  if (th2 && (nearBottom || ui.lastThread !== ui.open)) th2.scrollTop = th2.scrollHeight;
  ui.lastThread = ui.open;
}

const NAV = [['home', '오늘'], ['daily', '오토메이션'], ['staff', 'AI 직원'], ['resources', '내 자원']];
function hiddenOn() { return (window.HIDDEN || []).filter((x) => features()[x.flag]); }

function pageFor(route) {
  if (!S.data.settings.onboarded) return pageStart;
  const base = { home: pageHome, dashboard: pageDashboard, pocket: pagePocket, daily: pageDaily, staff: pageStaff, resources: pageResources }[route];
  if (base) return base;
  const hid = hiddenOn().find((x) => x.id === route);
  return hid ? hid.fn : pageHome;
}

function fmtElapsedSec(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  if (n < 60) return `${n}초`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}분 ${pad(s)}초`;
}

function fmtUptimeShort(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  if (!n) return '';
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  if (d > 0) return `가동 ${d}일 ${h}시간`;
  const m = Math.floor((n % 3600) / 60);
  return h > 0 ? `가동 ${h}시간 ${m}분` : `가동 ${m}분`;
}

function isEmpLinkedQuick(e) {
  if (!e || e.runMode === 'off') return false;
  if (CLI_ENGINES.includes(e.engine)) return Boolean(S?.runners?.[e.engine]);
  if (e.engine === 'local') return Boolean(e.model);
  return false;
}

// 모든 화면(사이드바·LIVE CREW·대시보드)에서 공유하는 멤버십 잔여량/가동 상태 단일 계산기
function empQuotaInfo(e) {
  const u = S?.employeeUsage?.[e.id] || null;
  const linked = isEmpLinkedQuick(e);
  const job = (S?.working || []).find((w) => w.emp === e.id) || null;
  const working = Boolean(job);
  const cooling = isEmpCooling(e);
  const coolMin = cooling ? empCooldownMin(e) : 0;
  const unlimited = e.engine === 'local';
  const pctUsed = !unlimited && typeof u?.pct5h === 'number' ? Math.min(100, Math.max(0, Math.round(u.pct5h))) : null;
  const pctRemain = unlimited ? 100 : (pctUsed !== null ? Math.max(0, 100 - pctUsed) : null);
  const resetMin = u?.resetInMin || 0;
  const resetShort = resetMin ? (resetMin >= 60 ? `${Math.floor(resetMin / 60)}h` : `${resetMin}m`) : '';
  const resetLong = resetMin ? fmtResetMin(resetMin) : '';
  let level = 'ready';
  if (cooling || (pctRemain !== null && pctRemain <= 15)) level = 'hot';
  else if (pctRemain !== null && pctRemain <= 30) level = 'warn';
  else if (unlimited) level = 'unlimited';
  else if (pctRemain !== null) level = 'ok';
  else if (!linked) level = 'off';
  const remainShort = cooling
    ? `휴식 ${coolMin}m`
    : unlimited
      ? '무제한'
      : pctRemain !== null
        ? `${pctRemain}% 남음`
        : (linked ? '연결됨' : '미연결');
  const shortBrand = ({ claude: 'Claude', codex: 'Codex', gemini: 'Gemini', agy: 'Antigravity', opencode: 'OpenCode', local: 'Ollama' }[e.engine])
    || ENGINE_LABEL[e.engine]
    || shortName(e.id);
  const modelLabel = e.engine === 'local'
    ? String(e.model || '').replace(/^(ollama|lmstudio):/, '') || '로컬 모델'
    : (e.modelNow?.name && e.modelNow.name !== '확인 불가' ? e.modelNow.name : (e.model || ''));
  return {
    e, u, linked, working, job, cooling, coolMin, unlimited,
    pctUsed, pctRemain, resetMin, resetShort, resetLong, level, remainShort, shortBrand, modelLabel,
    runsToday: u?.runsToday || 0,
    source: u?.source || (linked ? '즉시 가동' : '미연결'),
  };
}

function renderNav() {
  const d = S.data;
  const open = d.tasks.filter((t) => t.date <= S.today && t.status !== '완료').length;
  const waiting = d.tasks.filter((t) => t.gate && !t.gateApprovedAt && t.status !== '완료' && t.assignee !== 'jay').length + d.approvals.filter((a) => a.status === '대기').length;
  const items = [...NAV, ...hiddenOn().map((x) => [x.id, x.label])];
  document.getElementById('nav').replaceChildren(...items.map(([id, label]) => {
    let c = null;
    if (id === 'home' && (open || waiting)) c = h('span', { class: `cnt${waiting ? ' hot' : ''}`, title: waiting ? `대표 확인 ${waiting}건` : '' }, waiting || open);
    return h('a', { href: `#${id}`, class: ui.route === id ? 'on' : '', 'aria-current': ui.route === id ? 'page' : null }, h('span', null, label), c);
  }));
  document.getElementById('brand-sub').textContent = d.settings.companyName || (d.owner.name ? `${d.owner.name} · 삶과 AI 일의 최적화` : '삶과 AI 일의 최적화');
  const mobSet = document.getElementById('mob-set');
  if (mobSet && !mobSet.dataset.bound) { mobSet.dataset.bound = '1'; mobSet.addEventListener('click', openSettingsModal); }
  const thisMacRes = d.resources.find((r) => r.kind === '기계' && r.isThisMac);
  const localH = thisMacRes ? S.machineHealth?.[thisMacRes.id] : null;
  const workingCnt = (S.working || []).length;
  const coolCnt = d.employees.filter(isEmpCooling).length;
  const queueCnt = d.tasks.filter((t) => t.queued && t.status !== '완료').length;
  const soundOn = SND()?.enabled() !== false;
  const quotaChips = [];
  const seenQuotaEng = new Set();
  for (const e of d.employees) {
    const q = empQuotaInfo(e);
    if (q.pctRemain === null && !q.unlimited) continue;
    const engKey = e.engine || e.id;
    if (seenQuotaEng.has(engKey)) continue;
    seenQuotaEng.add(engKey);
    quotaChips.push({
      label: q.shortBrand,
      remainText: q.unlimited ? '무제한' : `${q.pctRemain}% 남음`,
      resetShort: q.resetShort,
      hot: q.level === 'hot',
      warn: q.level === 'warn',
      unlimited: q.unlimited,
      title: q.unlimited
        ? `${e.name} · 무료 무제한 로컬 실행`
        : `${e.name} · 5시간 한도 ${q.pctRemain}% 남음 (사용 ${q.pctUsed}%)${q.resetLong ? ` · ${q.resetLong}` : ''}`,
    });
    if (quotaChips.length >= 3) break;
  }
  const quotaSummaryText = quotaChips.length
    ? quotaChips.map((q) => `${q.label} ${q.unlimited ? '∞' : q.remainText.replace(' 남음', '')}`).join(' · ')
    : (workingCnt ? `${workingCnt}명 일하는 중` : `AI 직원 ${d.employees.length}명`);
  const quotaRow = h('button', {
    type: 'button',
    class: `side-quota-mini${workingCnt ? ' is-live' : ''}`,
    title: '멤버십 잔여 · 대시보드 열기',
    onclick: () => { location.hash = '#dashboard'; },
  },
  h('i', { class: `side-pulse${workingCnt ? ' moving' : ''}` }),
  h('span', { class: 'sq-mini-txt' }, quotaSummaryText));
  const curTheme = document.documentElement.dataset.theme || 'light';
  const isObsidian = curTheme === 'obsidian';
  const isTextLg = document.documentElement.dataset.textLg === '1';
  const footNodes = [
    quotaRow,
    h('div', { class: 'row side-foot-acts' },
      h('button', { type: 'button', class: 'btn sm', onclick: openSettingsModal }, '설정'),
      h('button', {
        type: 'button', class: `btn sm${isTextLg ? ' on' : ''}`,
        title: isTextLg ? '보통 글씨 크기로 돌아가기' : '글씨 크게 보기 (시니어·고대비)',
        'aria-label': '글씨 크기 전환',
        onclick: () => {
          const nextLg = !isTextLg;
          if (nextLg) document.documentElement.dataset.textLg = '1';
          else delete document.documentElement.dataset.textLg;
          try { localStorage.setItem('aihq-text-lg', nextLg ? '1' : '0'); } catch {}
          renderNav();
        },
      }, isTextLg ? '보통' : '가+'),
      h('button', {
        type: 'button', class: `btn sm theme-btn${isObsidian ? ' on' : ''}`,
        title: isObsidian ? '밝은 화면으로 전환' : '어두운 블랙 & 골드 화면으로 전환',
        'aria-label': '브랜드 테마 전환',
        onclick: () => {
          const next = isObsidian ? 'light' : 'obsidian';
          document.documentElement.dataset.theme = next;
          try { localStorage.setItem('aihq-theme', next); } catch {}
          const meta = document.querySelector('meta[name="theme-color"]');
          if (meta) meta.content = next === 'obsidian' ? '#070605' : '#FAF9F6';
          renderNav();
        },
      }, isObsidian ? '밝게' : '어둡게'),
      h('button', {
        type: 'button', class: `btn sm sound-btn${soundOn ? ' on' : ''}`,
        title: soundOn ? '효과음 켜짐 (눌러서 끄기)' : '효과음 꺼짐 (눌러서 켜기)',
        'aria-label': soundOn ? '효과음 끄기' : '효과음 켜기',
        onclick: () => {
          const nextOn = !soundOn;
          SND()?.setEnabled(nextOn);
          if (nextOn) SND()?.play('connect', { force: true });
          renderNav();
        },
      }, soundOn ? '♪' : '♪✕')),
  ].filter(Boolean);
  document.getElementById('side-foot').replaceChildren(...footNodes);
}

function secHead(title, meta, ...actions) {
  return h('div', { class: 'sec-h' }, h('h2', null, title), h('div', { class: 'actions' }, meta ? h('span', { class: 'meta' }, meta) : null, ...actions));
}

// 한 번 눌러 담당 바꾸기 (끝에 직원 추가)
function assigneePicker(current, onPick) {
  const opts = [['jay', '나'], ...S.data.employees.map((e) => [e.id, shortName(e.id)])];
  return h('div', { class: 'picker', role: 'group', 'aria-label': '담당 고르기' }, opts.map(([id, label]) => h('button', {
    type: 'button', class: `chip${current === id ? ' on' : ''}`, 'aria-pressed': current === id ? 'true' : 'false',
    onclick: (ev) => { ev.stopPropagation(); onPick(id); },
  }, label)), h('button', { type: 'button', class: 'chip add', onclick: (ev) => { ev.stopPropagation(); openAddEmployee(); } }, '+ 직원 추가'));
}

const GRIP = () => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 10 14');
  for (const [x, y] of [[2, 2], [8, 2], [2, 7], [8, 7], [2, 12], [8, 12]]) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 1.3); c.setAttribute('fill', 'currentColor');
    svg.appendChild(c);
  }
  return svg;
};

// ───────── 할 일 줄 ─────────

function isInstalledCli(e) {
  return Boolean(e && CLI_ENGINES.includes(e.engine) && S.runners?.[e.engine]);
}
function runnableCandidates(excludeId = null) {
  const list = (S?.data?.employees || []).filter((x) => x.id !== excludeId && (canRun(x) || isInstalledCli(x)));
  return list.sort((a, b) => Number(canRun(b)) - Number(canRun(a)));
}
function latestResultOf(t) {
  const msgs = (S?.data?.messages || []).filter((m) => m.thread === `task:${t.id}` && (m.kind === 'result' || m.fromKind === 'ai'));
  const last = msgs.filter((m) => m.kind === 'result').slice(-1)[0] || msgs.slice(-1)[0];
  if (last) return { text: last.text || '', by: last.from, at: last.at, run: last.run || null };
  if (t.resultSummary) return { text: t.resultSummary, by: t.completedBy || t.assignee, at: t.completedAt || t.lastRunAt, run: null };
  return null;
}

function taskRow(t, { draggable = true, overdue = false } = {}) {
  const open = ui.open === t.id;
  const done = t.status === '완료';
  // 확인 버튼은 AI가 할 일에만 (내가 직접 하는 일은 내가 하는 것이 곧 확인)
  const gated = t.gate && !t.gateApprovedAt && !done && t.assignee !== 'jay';
  const pendAppr = S.data.approvals.some((a) => a.taskId === t.id && a.status === '대기');
  const e = emp(t.assignee);
  const workJob = S.working.find((w) => w.taskId === t.id) || (t.status === '진행' ? S.working.find((w) => w.emp === t.assignee) : null);
  const thinking = S.assigning.includes(`task:${t.id}`);
  const trail = t.failoverTrail || [];
  const li = h('li', { class: `task${done ? ' done' : ''}${open ? ' open' : ''}`, 'data-id': t.id });

  const chk = h('input', { type: 'checkbox', class: 'chk', checked: done, 'aria-label': `${t.title} 완료`,
    onchange: () => act('PATCH', `/api/ui/tasks/${t.id}`, { status: chk.checked ? '완료' : '대기' }, chk.checked ? '완료했어요 · 오늘 한 일로 옮겼어요' : '오늘 할 일로 되돌렸어요') });
  const who = h('button', {
    class: `who-chip${t.assignee === 'jay' ? '' : t.assignee ? ' ai' : ' none'}`, 'aria-label': '담당 바꾸기', 'aria-expanded': ui.picking === t.id ? 'true' : 'false',
    onclick: (ev) => { ev.stopPropagation(); ui.picking = ui.picking === t.id ? null : t.id; render(); },
  }, t.assignee ? shortName(t.assignee) : '담당 미정');
  const msgs = S.data.messages.filter((m) => m.thread === `task:${t.id}` && m.fromKind !== 'system').length;
  const stLen = (t.steps || []).length;
  const stDone = stLen ? t.steps.filter((s) => s.status === '완료').length : 0;
  const nowHm = `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  const isFutureScheduled = Boolean(!done && t.date === S.today && t.time && t.time > nowHm && e && e.runMode === 'auto');
  const quickRun = (!done && !gated && e && !t.officeRun && !workJob)
    ? (isFutureScheduled
      ? h('span', { class: 'tag', title: `${t.time}이 되면 ${shortName(e.id)}이(가) 자동으로 시작합니다` }, `예약 ${t.time}`)
      : canRun(e)
        ? h('button', {
          type: 'button', class: 'btn sm dark', title: `${shortName(e.id)} 지금 바로 실행`,
          onclick: (ev) => {
            ev.stopPropagation();
            once(`qrun-${t.id}`, async () => {
              const forceRun = Boolean(t.queued);
              const r = await act('POST', `/api/ui/tasks/${t.id}/run`, forceRun ? { force: true } : {});
              if (r?.queued) toast(`⏳ 대기열: ${r.reason || '여유 생기면 자동 시작해요'}`);
              else if (r) toast(`${shortName(r.empId || e.id)}이(가) 작업을 시작했어요`);
            });
          },
        }, t.queued ? '지금 바로 실행' : t.status === '막힘' ? '재시도' : '실행')
        : (e.engine === 'web' ? h('span', { class: 'tag dash', title: '웹 전용 AI — 눌러서 설치된 AI로 바로 실행하거나 지시문 복사' }, '웹 복사') : null))
    : null;
  const right = h('div', { class: 'right' },
    overdue && !done ? h('button', { class: 'btn sm', title: '오늘 할 일로 옮기기', onclick: (ev) => { ev.stopPropagation(); act('PATCH', `/api/ui/tasks/${t.id}`, { date: S.today }, '오늘로 옮겼어요'); } }, '오늘로') : null,
    pendAppr ? h('span', { class: 'tag solid', title: '대표 결재 대기 중' }, '결재 대기') : null,
    gated ? h('button', { class: 'btn sm stamp-trig-btn', onclick: (ev) => { ev.stopPropagation(); openStampApprovalModal(t); } }, `${t.gate} 결재 印`) : null,
    t.queued && !done ? h('span', { class: 'tag dash', title: t.queueReason || '여유 생기면 자동 시작' }, '대기열') : null,
    workJob || t.status === '진행' || t.status === '막힘'
      ? h('span', { class: `stat-pill ${workJob ? '진행' : t.status}` }, officeOf(t) && t.status === '진행' ? `${officeOf(t).name} 실행 중` : workJob ? '● 일하는 중' : t.status === '막힘' ? '막힘' : t.status)
      : null,
    workJob
      ? h('button', { type: 'button', class: 'btn sm stop-run-btn', title: '실행 중인 AI를 즉시 멈춥니다', onclick: (ev) => { ev.stopPropagation(); stopRunningTask(t.id, workJob.emp); } }, '■ 중단')
      : null,
    quickRun,
    who);
  const meta = [];
  if (workJob?.statusLine) meta.push(workJob.statusLine);
  else if (t.queued && t.queueReason && !done) meta.push(t.queueReason);
  else if (stLen) meta.push(`${stDone}/${stLen}단계`);
  else if (t.date !== S.today) meta.push(dateK(t.date));

  const toggleOpen = () => { ui.open = open ? null : t.id; ui.picking = null; render(); };
  const timeText = t.intervalMin
    ? (t.intervalMin >= 60 && t.intervalMin % 60 === 0 ? `${t.intervalMin / 60}시간` : `${t.intervalMin}분`)
    : (t.time || '·');
  li.appendChild(h('div', {
    class: 'line', tabindex: '0', role: 'button', 'aria-expanded': open ? 'true' : 'false',
    onclick: (ev) => { if (ev.target.closest('button,input,a')) return; toggleOpen(); },
    onkeydown: (ev) => { if (ev.target !== ev.currentTarget) return; if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleOpen(); } },
  },
  draggable ? h('button', { class: 'handle', 'aria-label': '끌어서 순서 바꾸기', title: '끌어서 순서 바꾸기' }, GRIP()) : h('span'),
  chk,
  h('span', { class: `time${t.time || t.intervalMin ? '' : ' none'}` }, timeText),
  h('div', { class: 'ttl' }, h('span', { class: 't' }, t.title), meta.length ? h('span', { class: 'note' }, meta.join(' · ')) : null),
  right));
  if (ui.picking === t.id) {
    li.appendChild(h('div', { class: 'pick-row' }, assigneePicker(t.assignee, (id) => { ui.picking = null; act('PATCH', `/api/ui/tasks/${t.id}`, { assignee: id }, `${shortName(id)}에게 맡겼어요`); })));
  }
  if (open) li.appendChild(taskDetail(t, e));
  return li;
}

function stepsEditor(kind, item) {
  const isTask = kind === 'tasks';
  const steps = item.steps || [];
  const mode = item.stepMode === 'parallel' ? 'parallel' : 'serial';
  const machines = S.data.resources.filter((r) => r.kind === '기계' && r.status !== '꺼짐');
  const browsers = S.data.resources.filter((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  const designs = S.data.resources.filter((r) => r.kind === '디자인' && r.status !== '꺼짐');
  const ossList = S.data.resources.filter((r) => r.kind === '오픈소스' && r.status !== '꺼짐');
  const doneCount = steps.filter((s) => s.status === '완료').length;
  const activeSet = new Set(
    mode === 'parallel'
      ? steps.filter((s) => s.status !== '완료').map((s) => s.id)
      : [steps.find((s) => s.status !== '완료')?.id].filter(Boolean),
  );
  const base = `/api/ui/${kind}/${item.id}`;
  const stepInput = h('input', { class: 'in sm', 'data-k': `wf-add-${kind}-${item.id}`, placeholder: '단계 추가 (예: 블렌더 3D 모델링 — AI·사무실·도구 자동 추천)', 'aria-label': '새 협업 단계' });
  const addStep = () => submitInput(stepInput, `wf-add-${kind}-${item.id}`, (v) => act('POST', `${base}/steps`, { title: v }, '단계를 추가했어요'));
  stepInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) addStep(); });
  const folderInput = h('input', { class: 'in sm', value: item.sharedFolder || '', 'data-k': `wf-dir-${kind}-${item.id}`, placeholder: '공유 폴더 (선택, 예: ~/iCloud/영상편집)', 'aria-label': '공유 폴더' });
  const saveFolder = () => act('PATCH', base, { sharedFolder: folderInput.value.trim() }, '공유 폴더를 저장했어요');
  folderInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) saveFolder(); });

  const moveStep = (idx, dir) => {
    const next = [...steps];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    act('PATCH', base, { steps: next }, '단계 순서를 바꿨어요');
  };

  const renderStep = (s, idx) => {
    const isAct = isTask && activeSet.has(s.id);
    const isDone = isTask && s.status === '완료';
    const patchStep = (patch, msg) => act('PATCH', `${base}/steps/${s.id}`, patch, msg);
    return h('li', { class: `wf-step${isDone ? ' done' : ''}${isAct ? ' active' : ''}`, 'data-step': s.id },
      h('div', { class: 'wf-top' },
        isTask ? h('input', { type: 'checkbox', class: 'chk', checked: isDone, 'aria-label': `${s.title} 완료`, onchange: (ev) => patchStep({ status: ev.target.checked ? '완료' : '대기' }, ev.target.checked ? `${idx + 1}단계 완료` : '대기로 되돌렸어요') }) : null,
        h('span', { class: `wf-num${isAct ? ' on' : ''}` }, String(idx + 1)),
        h('span', { class: 'wf-title' }, s.title),
        isAct ? h('span', { class: 'tag solid' }, mode === 'parallel' ? '동시 진행' : '지금 차례') : null,
        h('div', { class: 'wf-ord' },
          idx > 0 ? h('button', { type: 'button', class: 'btn link', 'aria-label': '위로', onclick: () => moveStep(idx, -1) }, '↑') : null,
          idx < steps.length - 1 ? h('button', { type: 'button', class: 'btn link', 'aria-label': '아래로', onclick: () => moveStep(idx, 1) }, '↓') : null,
          h('button', { type: 'button', class: 'x', 'aria-label': `${s.title} 지우기`, onclick: () => act('DELETE', `${base}/steps/${s.id}`, undefined, '단계를 지웠어요') }, '×'))),
      h('div', { class: 'wf-ctl' },
        h('select', { class: 'in sm', 'aria-label': `${s.title} 담당`, onchange: (ev) => patchStep({ assignee: ev.target.value || null }, '담당을 바꿨어요') },
          h('option', { value: '', selected: !s.assignee }, '담당 미정'),
          h('option', { value: 'jay', selected: s.assignee === 'jay' }, '나 (대표)'),
          S.data.employees.map((e) => h('option', { value: e.id, selected: s.assignee === e.id }, shortName(e.id)))),
        machines.length ? h('select', { class: 'in sm', 'aria-label': `${s.title} 사무실`, onchange: (ev) => patchStep({ resource: ev.target.value || null }, '사무실을 바꿨어요') },
          h('option', { value: '', selected: !s.resource }, '사무실 자동'),
          machines.map((m) => h('option', { value: m.id, selected: s.resource === m.id }, m.name))) : null,
        browsers.length ? h('select', { class: 'in sm', 'aria-label': `${s.title} 브라우저`, onchange: (ev) => patchStep({ browser: ev.target.value || null }, '브라우저를 바꿨어요') },
          h('option', { value: '', selected: !s.browser }, '브라우저 없음'),
          browsers.map((b) => h('option', { value: b.id, selected: s.browser === b.id }, b.name))) : null,
        designs.length ? h('select', { class: 'in sm', 'aria-label': `${s.title} 디자인`, onchange: (ev) => patchStep({ design: ev.target.value || null }, '디자인 스타일을 바꿨어요') },
          h('option', { value: '', selected: !s.design }, '디자인 기본'),
          designs.map((des) => h('option', { value: des.id, selected: s.design === des.id }, des.name))) : null),
      ossList.length ? h('div', { class: 'wf-tools' }, ossList.map((o) => {
        const has = (s.tools || []).includes(o.id);
        return h('button', {
          type: 'button', class: `chip sm${has ? ' on' : ''}`,
          onclick: () => {
            const next = has ? (s.tools || []).filter((x) => x !== o.id) : [...(s.tools || []), o.id];
            patchStep({ tools: next });
          },
        }, o.name);
      })) : null,
      s.note ? h('div', { class: 'small muted wf-note' }, s.note) : null,
      s.output ? h('div', { class: 'small wf-out' }, `결과: ${s.output}`) : null);
  };

  const sumText = steps.length
    ? `팀 분업 워크플로우 · ${isTask ? `${doneCount}/${steps.length} 완료` : `${steps.length}단계`} · ${mode === 'parallel' ? '동시에 함께' : '순서대로'}`
    : '팀으로 나눠 하기 (여러 AI · 사무실이 단계별 협업)';

  return h('details', { class: 'wf-box', 'data-k': `wf-${kind}-${item.id}`, open: steps.length > 0 ? true : undefined },
    h('summary', null, sumText),
    h('div', { class: 'wf-body' },
      h('div', { class: 'wf-bar' },
        h('div', { class: 'seg', role: 'group', 'aria-label': '협업 방식' },
          h('button', { type: 'button', class: mode === 'serial' ? 'on' : '', onclick: () => mode !== 'serial' && act('PATCH', base, { stepMode: 'serial' }, '순서대로(릴레이)로 바꿨어요') }, '순서대로'),
          h('button', { type: 'button', class: mode === 'parallel' ? 'on' : '', onclick: () => mode !== 'parallel' && act('PATCH', base, { stepMode: 'parallel' }, '동시에 함께(병렬)로 바꿨어요') }, '동시에 함께')),
        h('div', { class: 'wf-dir' }, folderInput, h('button', { type: 'button', class: 'btn sm', onclick: saveFolder }, '저장'))),
      !steps.length && (S.options.stepTemplates || []).length ? h('div', { class: 'wf-tpls' },
        h('span', { class: 'small muted' }, '예시로 채우기'),
        S.options.stepTemplates.map((tpl) => h('button', {
          type: 'button', class: 'chip',
          onclick: () => once(`tpl-${kind}-${item.id}-${tpl.key}`, () => act('POST', `${base}/steps/template`, { key: tpl.key }, `${tpl.label}을 채웠어요`)),
        }, tpl.label))) : null,
      steps.length ? h('ul', { class: 'wf-steps' }, steps.map(renderStep)) : null,
      h('div', { class: 'wf-add' }, stepInput, h('button', { type: 'button', class: 'btn sm dark', onclick: addStep }, '+ 추가'))));
}

// ───────── 프롬프트 중심 입력 도우미 (끼워넣기 + 자동 연결 1줄) ─────────

function insertAtCursor(ta, snippet) {
  const s = ta.selectionStart ?? ta.value.length;
  const e = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, s);
  const after = ta.value.slice(e);
  const padL = before && !/[\s(\[]$/.test(before) ? ' ' : '';
  const padR = after && !/^[\s,.)\]]/.test(after) ? ' ' : '';
  ta.value = `${before}${padL}${snippet}${padR}${after}`;
  const pos = s + padL.length + snippet.length;
  ta.focus();
  try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ }
}

function promptInsertDrawer(ta, key) {
  const active = S.data.resources.filter((r) => r.status !== '꺼짐');
  const items = [
    ...active.filter((r) => r.kind === '브라우저').slice(0, 2).map((r) => ({ label: r.name, text: `${r.name} 사용해서` })),
    ...active.filter((r) => r.kind === '오픈소스').slice(0, 6).map((r) => ({ label: r.name, text: `${r.name} 오픈소스로` })),
    ...active.filter((r) => r.kind === '디자인').slice(0, 4).map((r) => ({ label: r.name, text: `${r.name} 스타일로` })),
    ...active.filter((r) => r.kind === '계정')
      .sort((a, b) => (b.spaceName ? 1 : 0) - (a.spaceName ? 1 : 0))
      .slice(0, 6)
      .map((r) => {
        const clean = r.name.split(' · ')[0].split(' (')[0];
        return { label: clean, text: r.spaceName ? `${clean} (${r.spaceName} 스페이스)` : clean };
      }),
    ...active.filter((r) => r.kind === '기계' && !r.isThisMac).slice(0, 2).map((r) => ({ label: r.name, text: `${r.name}에서` })),
  ];
  if (!items.length) return { btn: null, panel: null };
  const panel = h('div', { class: 'p-insert', style: ui.insertOpen[key] ? '' : 'display:none' },
    h('div', { class: 'picker' }, items.map((it) => h('button', {
      type: 'button', class: 'chip sm', onclick: () => { insertAtCursor(ta, it.text); ta.dispatchEvent(new Event('input')); },
    }, `+ ${it.label}`))));
  const btn = h('button', {
    type: 'button', class: `chip sm${ui.insertOpen[key] ? ' on' : ''}`,
    onclick: () => {
      ui.insertOpen[key] = !ui.insertOpen[key];
      panel.style.display = ui.insertOpen[key] ? '' : 'none';
      btn.classList.toggle('on', ui.insertOpen[key]);
      btn.textContent = ui.insertOpen[key] ? '끼워넣기 접기 ▴' : '+ 도구 · 디자인 · 계정 끼워넣기 ▾';
    },
  }, ui.insertOpen[key] ? '끼워넣기 접기 ▴' : '+ 도구 · 디자인 · 계정 끼워넣기 ▾');
  return { btn, panel };
}

function linkedSummaryLine(item) {
  const parts = [];
  for (const sk of item.skills || []) {
    parts.push(`스킬: ${skillChipMeta(sk).shortTitle}`);
  }
  for (const kid of item.knowledgeIds || []) {
    const kb = (S.data?.knowledge || []).find((k) => k.id === kid);
    if (kb) parts.push(`지식: ${kb.title}`);
  }
  const acc = item.account ? res(item.account) : null;
  const br = (item.browser ? res(item.browser) : null) || (acc ? ((acc.browser ? res(acc.browser) : null) || defaultBrowser()) : null);
  if (br && br.kind === '브라우저') parts.push(acc?.spaceName ? `${br.name} (${acc.spaceName})` : br.name);
  for (const tid of item.tools || []) {
    const o = res(tid);
    if (o) parts.push(o.command && /^npx\b/i.test(o.command) ? `${o.name} (npx)` : o.name);
  }
  const des = item.design ? res(item.design) : null;
  if (des) parts.push(`디자인: ${des.name}`);
  if (acc) parts.push(`${acc.name.split(' · ')[0].split(' (')[0]} (${accountSummaryText(acc)})`);
  const cost = Number(item.estCost) > 0 ? Number(item.estCost) : 0;
  if (cost) parts.push(`예상 ${won(cost)}`);
  if (!parts.length) return null;
  return h('div', { class: 'p-linked small muted' }, h('b', null, '자동·지정 연결됨'), ' · ', parts.join(' · '));
}

function openEmpTerminal(empId, app = 'terminal') {
  if (!empId || empId === 'jay') return;
  return once(`open-term-${empId}-${app}`, async () => {
    const r = await act('POST', `/api/ui/employees/${empId}/open-terminal`, { app });
    if (r?.ok) toast(`${shortName(empId)} ${r.app} 열었어요`);
    else if (r?.workspace) toast(r.message || r.workspace);
  });
}

function renderCleanResult(rawText) {
  const lines = String(rawText || '').trim().split('\n');
  const formatInline = (line) => {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) parts.push(h('b', null, tok.slice(2, -2)));
      else parts.push(h('code', { class: 'res-code' }, tok.slice(1, -1)));
      last = m.index + tok.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts;
  };
  return h('div', { class: 'res-clean' }, lines.map((ln) => {
    const trimmed = ln.trim();
    if (!trimmed) return h('div', { class: 'res-gap' });
    if (/^[-•*]\s+/.test(trimmed)) {
      return h('div', { class: 'res-li' }, h('span', { class: 'res-dot' }, '·'), h('span', null, ...formatInline(trimmed.replace(/^[-•*]\s+/, ''))));
    }
    return h('div', { class: 'res-p' }, ...formatInline(trimmed));
  }));
}

function taskDetail(t, e) {
  const browsers = S.data.resources.filter((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  const ossList = S.data.resources.filter((r) => r.kind === '오픈소스' && r.status !== '꺼짐');
  const designList = S.data.resources.filter((r) => r.kind === '디자인' && r.status !== '꺼짐');
  const accList = S.data.resources.filter((r) => r.kind === '계정' && r.status !== '꺼짐');
  const editing = ui.editingTask === t.id;
  const f = {
    title: h('input', { class: 'in sm', value: t.title, 'data-k': `e-title-${t.id}`, 'aria-label': '제목' }),
    time: h('input', { class: 'in sm', type: 'time', value: t.time || '', 'data-k': `e-time-${t.id}`, 'aria-label': '시간' }),
    date: h('input', { class: 'in sm', type: 'date', value: t.date, 'data-k': `e-date-${t.id}`, 'aria-label': '날짜' }),
    note: h('textarea', {
      class: 'in prompt-box', rows: 3, 'data-k': `e-note-${t.id}`, 'aria-label': '지시 내용',
      placeholder: '지시 내용',
    }, t.note || ''),
    estCost: h('input', { class: 'in sm', inputmode: 'numeric', value: t.estCost ? String(t.estCost) : '', 'data-k': `e-cost-${t.id}`, placeholder: '예상 비용 (원)', 'aria-label': '예상 비용 (원)' }),
    resource: h('select', { class: 'in sm', 'data-k': `e-res-${t.id}`, 'aria-label': '리소스' }, h('option', { value: '' }, '컴퓨터 자동'),
      S.data.resources.filter((r) => !['브라우저', '오픈소스', '디자인'].includes(r.kind)).map((r) => h('option', { value: r.id, selected: t.resource === r.id }, `${r.name} · ${r.status}`))),
    gate: h('select', { class: 'in sm', 'data-k': `e-gate-${t.id}`, 'aria-label': '대표 확인' }, h('option', { value: '' }, '확인 없음'),
      S.options.gates.map((g) => h('option', { value: g, selected: t.gate === g }, `${g} 승인`))),
  };
  const dirtyEl = h('span', { class: 'p-dirty' }, '');
  const isDirty = () => f.title.value !== t.title || f.note.value !== (t.note || '') || f.time.value !== (t.time || '') || f.date.value !== t.date || (f.estCost.value.trim() !== (t.estCost ? String(t.estCost) : ''));
  const syncDirty = () => { dirtyEl.textContent = isDirty() ? '저장 안 됨 · ⌘↵' : ''; };
  for (const el of [f.title, f.note, f.time, f.date, f.estCost]) el.addEventListener('input', syncDirty);

  const save = async (silent = false) => {
    const r = await act('PATCH', `/api/ui/tasks/${t.id}`, {
      title: f.title.value, time: f.time.value, date: f.date.value, note: f.note.value,
      estCost: f.estCost.value.trim() === '' ? null : f.estCost.value.trim(),
      resource: f.resource.value || null,
      ...(f.gate.value !== (t.gate || '') ? { gate: f.gate.value || null } : {}),
    }, silent ? null : '저장했어요');
    return r;
  };
  const flushIfDirty = async () => { if (isDirty()) await save(true); };
  f.title.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) save(); });
  f.note.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); save(); } });

  const insDrawer = promptInsertDrawer(f.note, `t-${t.id}`);
  const allSkills = allSelectableSkills().filter((sk) => sk.published);
  const skillPicker = allSkills.length ? h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '지정 스킬'),
    h('div', { class: 'picker' }, allSkills.slice(0, 12).map((sk) => {
      const has = (t.skills || []).includes(sk.key);
      return h('button', {
        type: 'button', class: `chip sm bp-chip${has ? ' on' : ''}`,
        title: `${sk.titleKo}${sk.flow ? ` · ${sk.flow}` : ''}`,
        onclick: () => {
          const next = has ? (t.skills || []).filter((x) => x !== sk.key) : [...(t.skills || []), sk.key];
          act('PATCH', `/api/ui/tasks/${t.id}`, { skills: next }, has ? `${sk.shortTitle} 스킬 해제했어요` : `${sk.shortTitle} 스킬 지정했어요`);
        },
      }, skillPixelIconSvg(sk.icon, 13), sk.shortTitle);
    }))) : null;
  const kbList = Array.isArray(S.data.knowledge) ? S.data.knowledge : [];
  const knowledgePicker = h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '참고 지식'),
    h('div', { class: 'picker' },
      kbList.length ? kbList.map((kb) => {
        const has = (t.knowledgeIds || []).includes(kb.id);
        return h('button', {
          type: 'button', class: `chip sm bp-chip${has ? ' on' : ''}`,
          title: `[${kb.category}] ${kb.content.slice(0, 140)}`,
          onclick: () => {
            const next = has ? (t.knowledgeIds || []).filter((x) => x !== kb.id) : [...(t.knowledgeIds || []), kb.id];
            act('PATCH', `/api/ui/tasks/${t.id}`, { knowledgeIds: next }, has ? `${kb.title} 지식 해제했어요` : `${kb.title} 지식 연결했어요`);
          },
        }, `📚 ${kb.title}`);
      }) : h('span', { class: 'small muted' }, '내 지식 탭에서 브랜드 톤·규칙을 추가하면 여기서 바로 꽂을 수 있어요')));
  const accountPicker = accList.length ? h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '연결 계정'),
    h('div', { class: 'picker' },
      h('button', { type: 'button', class: `chip sm${!t.account ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { account: null }) }, '자동'),
      accList.map((a) => h('button', { type: 'button', class: `chip sm${t.account === a.id ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { account: a.id }, `${a.name} 연결했어요`) }, a.name)))) : null;
  const browserPicker = browsers.length ? h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '브라우저'),
    h('div', { class: 'picker' },
      h('button', { type: 'button', class: `chip sm${!t.browser ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { browser: null }) }, '자동'),
      browsers.map((b) => h('button', { type: 'button', class: `chip sm${t.browser === b.id ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { browser: b.id }, `${b.name}로 정했어요`) }, b.name)))) : null;
  const designPicker = designList.length ? h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '디자인'),
    h('div', { class: 'picker' },
      h('button', { type: 'button', class: `chip sm${!t.design ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { design: null }) }, '자동'),
      designList.map((dObj) => h('button', { type: 'button', class: `chip sm${t.design === dObj.id ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/tasks/${t.id}`, { design: dObj.id }, `${dObj.name} 스타일을 적용했어요`) }, dObj.name)))) : null;
  const ossPicker = ossList.length ? h('div', { class: 'd-tools' }, h('span', { class: 'small muted' }, '오픈소스'),
    h('div', { class: 'picker' }, ossList.map((o) => {
      const has = (t.tools || []).includes(o.id);
      return h('button', {
        type: 'button', class: `chip sm${has ? ' on' : ''}`,
        onclick: () => {
          const next = has ? (t.tools || []).filter((x) => x !== o.id) : [...(t.tools || []), o.id];
          act('PATCH', `/api/ui/tasks/${t.id}`, { tools: next });
        },
      }, o.name);
    }))) : null;
  const workJob = S.working.find((w) => w.taskId === t.id) || (t.status === '진행' ? S.working.find((w) => w.emp === t.assignee) : null);
  const latestRes = latestResultOf(t);
  const trail = t.failoverTrail || [];
  const locked = Boolean(t.gate && !t.gateApprovedAt);
  const canCliTerm = Boolean(e && !['web', 'none'].includes(e.engine));
  const quickRun = () => once(`qrun-${t.id}`, async () => {
    await flushIfDirty();
    const resRun = await act('POST', `/api/ui/tasks/${t.id}/run`, {});
    if (resRun?.queued) toast(`대기열: ${resRun.reason || '여유 시 자동 시작'}`);
    else if (resRun) toast(`${shortName(resRun.empId || e?.id || t.assignee)} 실행 시작`);
  });

  const topBar = h('div', { class: 'td-topbar' },
    h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
      e ? h('span', { class: 'td-who-pill' }, avatarEl(e, { size: 20 }), shortName(e.id))
        : h('span', { class: 'td-who-pill' }, '나'),
      h('select', { class: 'in sm td-status-sel', 'aria-label': '상태', onchange: (ev) => act('PATCH', `/api/ui/tasks/${t.id}`, { status: ev.target.value }) },
        S.options.statuses.map((s) => h('option', { value: s, selected: s === t.status }, s))),
      workJob
        ? h('button', { type: 'button', class: 'btn sm stop-run-btn', onclick: () => stopRunningTask(t.id, workJob.emp) }, '■ 중단')
        : (e && canRun(e) && !t.officeRun
          ? h('button', { type: 'button', class: 'btn sm dark', disabled: locked || isWorking(e.id), onclick: quickRun }, t.status === '완료' ? '↻ 다시 실행' : '▶ 실행')
          : null),
      canCliTerm
        ? h('button', { type: 'button', class: 'btn sm', title: '맥 터미널에서 작업 폴더 열기', onclick: () => openEmpTerminal(e.id, 'terminal') }, '터미널')
        : null),
    h('div', { class: 'row', style: 'gap:6px' },
      h('button', {
        type: 'button', class: `btn sm${editing ? ' dark' : ''}`,
        onclick: () => { ui.editingTask = editing ? null : t.id; render(); },
      }, editing ? '닫기' : '편집'),
      h('button', {
        type: 'button', class: 'x', 'aria-label': '삭제',
        onclick: () => { if (confirm(`삭제할까요?\n${t.title}`)) { ui.open = null; ui.editingTask = null; act('DELETE', `/api/ui/tasks/${t.id}`, undefined, '삭제했어요'); } },
      }, '×')));

  const stepsStrip = Array.isArray(t.steps) && t.steps.length >= 2
    ? h('div', { class: 'td-steps-strip' },
      h('span', { class: 'tag' }, t.stepMode === 'parallel' ? '동시 협업' : '릴레이 협업'),
      ...t.steps.map((st, idx) => h('span', { class: `td-step-pill is-${st.status === '완료' ? 'done' : st.status === '진행' ? 'live' : 'wait'}` },
        `${idx + 1}. ${shortName(st.assignee)}${st.status === '완료' ? ' ✓' : st.status === '진행' ? ' ●' : ''}`)))
    : null;

  const topStatusBox = workJob
    ? h('div', { class: 'res-card live live-stream-card' },
      h('div', { class: 'live-stream-top' },
        h('div', { class: 'row' },
          emp(workJob.emp) ? avatarEl(emp(workJob.emp), { size: 26, stateOverride: 'working', onDark: true }) : null,
          h('b', null, `${shortName(workJob.emp)}`),
          h('span', { class: 'ops-pill sm is-live' }, workJob.label || '실행 중')),
        h('div', { class: 'row' },
          h('span', { class: 'ops-lj-time', 'data-live-since': workJob.since || null, 'data-live-prefix': '● ' }, `● ${fmtElapsedSec(workJob.elapsedSec)}`))),
      h('div', { class: 'live-term', role: 'log', 'aria-live': 'polite' },
        h('div', { class: 'live-term-body' },
          (workJob.liveLines || []).length
            ? (workJob.liveLines || []).slice(-18).map((ln) => h('div', { class: 'live-term-line' },
              h('span', { class: 'lt-ts' }, ln.at || ''),
              h('span', { class: 'lt-txt' }, ln.text || '')))
            : h('div', { class: 'live-term-line muted' },
              h('span', { class: 'lt-ts' }, 'LIVE'),
              h('span', { class: 'lt-txt' }, workJob.statusLine || '실행 중…')),
          h('span', { class: 'live-term-cursor', 'aria-hidden': 'true' }, '▌'))))
    : latestRes
      ? h('div', { class: 'res-card' },
        h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:8px' },
          h('div', { class: 'row', style: 'gap:6px' },
            h('b', { style: 'font-size:13px' }, t.status === '완료' ? '결과' : '최근 결과'),
            h('span', { class: 'small muted' }, `${latestRes.by === 'jay' ? '나' : shortName(latestRes.by)}${latestRes.at ? ` · ${stamp(latestRes.at)}` : ''}`),
            t.lastVerification ? h('span', { class: `tag${t.lastVerification.repaired ? ' warn' : ''}`, title: (t.lastVerification.issues || []).join(' · ') || '검증 완료' }, t.lastVerification.repaired ? '자동 보완' : (t.lastVerification.passed ? '검증 통과' : '검증 확인')) : null,
            trail.length ? h('span', { class: 'tag' }, `${trail.map((x) => x.fromName).join(' → ')} → ${trail[trail.length - 1].toName}`) : null),
          h('button', { type: 'button', class: 'btn sm', onclick: async () => { await copyText(latestRes.text); toast('복사했어요'); } }, '복사')),
        renderCleanResult(latestRes.text))
      : null;

  const editPanel = editing ? h('div', { class: 'td-edit-box' },
    h('div', { class: 'd-grid' }, h('div', { class: 'span2' }, f.title), f.time, f.date),
    h('div', { class: 'p-wrap' },
      h('div', { class: 'p-toolbar' },
        h('div', { class: 'row' }, insDrawer.btn, dirtyEl),
        h('button', { type: 'button', class: 'btn link', onclick: () => openPromptPreview('tasks', t.id, flushIfDirty) }, '지시서 보기')),
      insDrawer.panel,
      f.note),
    h('div', { class: 'd-who' }, h('span', { class: 'small muted' }, '담당'), assigneePicker(t.assignee, (id) => act('PATCH', `/api/ui/tasks/${t.id}`, { assignee: id }, `${shortName(id)} 배정`))),
    h('div', { class: 'd-bar' },
      h('div', { class: 'row' },
        !t.routineId ? h('button', { class: 'btn sm', onclick: () => once(`tor-${t.id}`, async () => { await flushIfDirty(); await act('POST', `/api/ui/tasks/${t.id}/to-routine`, {}, '오토메이션 등록'); }) }, '오토메이션으로') : null),
      h('button', { class: 'btn sm dark', onclick: async () => { const r = await save(); if (r) { ui.editingTask = null; render(); } } }, '저장')),
    h('details', { class: 'adv-fold', 'data-k': `adv-${t.id}`, open: (t.steps || []).length > 0 ? true : undefined },
      h('summary', null, (t.steps || []).length ? `세부 설정 · 협업 ${(t.steps || []).length}단계` : '세부 설정 · 협업'),
      h('div', { class: 'adv-body' },
        h('div', { class: 'd-grid2' }, f.resource, f.gate),
        h('div', { class: 'd-grid2' }, f.estCost,
          h('label', { class: 'chk-l', style: 'align-self:center' },
            h('input', { type: 'checkbox', checked: Boolean(t.localOnly), onchange: (ev) => act('PATCH', `/api/ui/tasks/${t.id}`, { localOnly: ev.target.checked }) }),
            '로컬 전용')),
        skillPicker, knowledgePicker, accountPicker, browserPicker, designPicker, ossPicker,
        stepsEditor('tasks', t)))) : null;

  const needWorkBox = Boolean(e && !t.officeRun && (!canRun(e) || t.status === '막힘' || t.queued || locked));

  return h('div', { class: 'detail td-clean' },
    topBar,
    stepsStrip,
    topStatusBox,
    editPanel,
    officeBox(t, e),
    needWorkBox ? workBox(t, e, flushIfDirty) : null,
    threadView(t, Boolean(topStatusBox)));
}

// ───────── 사무실에서 실행 (배차) ─────────
const ACTIVE_REMOTE = ['sending', 'running', 'fetching'];
function officeOf(t) { return t.remote && ACTIVE_REMOTE.includes(t.remote.state) ? (S.offices || []).find((o) => o.id === t.remote.res) : null; }
function isOfficeRes(r) { return r && r.kind === '기계' && !r.isThisMac && r.sshAlias; }

// 리소스가 사무실 기계일 때만 보인다: 스위치 하나 + 일 종류 + 값 하나 + 상태 한 줄
function officeBox(t, e) {
  const r = res(t.resource);
  if (!isOfficeRes(r) || !e) return null;
  const o = (S.offices || []).find((x) => x.id === r.id);
  const active = t.remote && ACTIVE_REMOTE.includes(t.remote.state);
  const job = t.officeJob || { template: 'ai-text', params: {} };
  const allowed = o ? o.templates : ['ai-text'];
  const tplSel = h('select', { class: 'in sm', 'aria-label': '일 종류', disabled: active, 'data-k': `oj-t-${t.id}` },
    (S.officeTemplates || []).filter((x) => allowed.includes(x.key)).map((x) => h('option', { value: x.key, selected: job.template === x.key }, x.label)));
  const PARAM = { 'ffmpeg-test': ['seconds', '초 (1~10)'], 'remotion-render': ['composition', '컴포지션 이름'], 'blender-render': ['blend', 'render-node/…/파일.blend'] };
  const pk = PARAM[job.template];
  const param = pk ? h('input', { class: 'in sm', style: 'max-width:200px', 'data-k': `oj-p-${t.id}`, value: job.params?.[pk[0]] ?? '', placeholder: pk[1], 'aria-label': pk[1], disabled: active }) : null;
  const extra = job.template === 'remotion-render' ? h('input', { class: 'in sm', style: 'max-width:110px', 'data-k': `oj-f-${t.id}`, value: job.params?.frames || '', placeholder: '프레임 0-29', 'aria-label': '프레임', disabled: active })
    : job.template === 'blender-render' ? h('input', { class: 'in sm', style: 'max-width:90px', 'data-k': `oj-f-${t.id}`, value: job.params?.frame ?? '', placeholder: '프레임', 'aria-label': '프레임', disabled: active }) : null;
  const readJob = () => {
    const tpl = tplSel.value;
    const p = {};
    const k = PARAM[tpl];
    if (k && tpl === job.template && param) p[k[0]] = param.value.trim();
    if (tpl === 'remotion-render' && extra && tpl === job.template && extra.value.trim()) p.frames = extra.value.trim();
    if (tpl === 'blender-render' && extra && tpl === job.template && extra.value.trim()) p.frame = extra.value.trim();
    return { template: tpl, params: p };
  };
  tplSel.addEventListener('change', () => { if (tplSel.value !== job.template) act('PATCH', `/api/ui/tasks/${t.id}`, { officeJob: { template: tplSel.value, params: {} }, officeRun: false }); });
  const sw = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: Boolean(t.officeRun), disabled: active,
    onchange: (ev) => act('PATCH', `/api/ui/tasks/${t.id}`, ev.target.checked ? { officeJob: readJob(), officeRun: true } : { officeRun: false }, ev.target.checked ? `${o ? o.name : r.name}에서 실행을 켰어요` : '껐어요') }),
  h('span', { class: 'tr' }), h('b', null, `${o ? o.name : r.name}에서 실행`));
  let line = '';
  const rm = t.remote;
  if (active) line = `${o ? o.name : ''}에서 실행 중${o && o.log ? ` · ${o.log}` : ''}`;
  else if (rm && ['retry', 'blocked'].includes(rm.state)) line = rm.reason;
  else if (rm && rm.state === 'done') line = `끝남 · ${stamp(rm.endedAt)}`;
  else if (rm && rm.state === 'failed') line = `멈춤 · ${rm.reason || ''}`;
  else if (t.officeRun) line = t.gate && !t.gateApprovedAt ? `${gateK(t.gate)} 들어간 일이라 대표 확인 뒤에 보내요` : t.status === '대기' ? '곧 보내요' : '';
  return h('div', { class: 'work' },
    h('div', { class: 'row' }, sw, tplSel, param, extra),
    line ? h('div', { class: 'small muted' }, line) : null);
}

// AI에게 일 시키기. 앱이 직접 실행할 수 있으면 1클릭 실행, 설치된 CLI 가 꺼져 있거나 웹 전용 AI 면 1클릭 전환·바로 실행 제공
function workBox(t, e, flushIfDirty = null) {
  if (t.status === '완료' && !ui.handout[t.id]) return null;
  const locked = t.gate && !t.gateApprovedAt;
  const retryBtn = (t.status === '막힘' || t.queued) ? h('button', { class: 'btn sm', onclick: () => once(`retry-${t.id}`, () => act('POST', `/api/ui/tasks/${t.id}/retry`, {}, '대기 상태로 초기화했어요')) }, t.queued ? '대기열 해제' : '다시 시도') : null;
  const runNow = (payload = {}, msgFn = null) => once(`run-${t.id}-${payload.switchTo || 'cur'}`, async () => {
    if (flushIfDirty) await flushIfDirty();
    const resRun = await act('POST', `/api/ui/tasks/${t.id}/run`, payload);
    if (resRun?.queued) toast(`⏳ 대기열: ${resRun.reason || '여유 생기면 자동 시작해요'}`);
    else if (resRun?.rerouted) toast(`⚡ ${resRun.reason || `${resRun.office}로 우회했어요`}`);
    else if (resRun) toast(msgFn ? msgFn(resRun) : `${shortName(resRun.empId || e.id)}이(가) 작업을 시작했어요`);
  });

  const altRunners = runnableCandidates(e.id).slice(0, 3);
  if (canRun(e)) {
    const local = e.engine === 'local';
    return h('div', { class: 'work' },
      h('div', { class: 'small' }, local ? `${shortName(e.id)}: 이 컴퓨터 안에서 바로 답해요.` : `${shortName(e.id)}: 이 컴퓨터에서 직접 실행하고 결과물을 아래 「오늘 한 일」에 남깁니다 (실패 시 다른 AI에게 자동 인계).`),
      t.queued && t.queueReason ? h('div', { class: 'small muted' }, `⏳ 대기열: ${t.queueReason}`) : null,
      locked ? h('div', { class: 'small muted' }, `${gateK(t.gate)} 들어간 일이라 대표 확인 뒤에 시킬 수 있어요.`) : null,
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { class: 'btn dark', 'data-act': 'run', disabled: isWorking(e.id) || locked,
          onclick: () => runNow({}, (r) => (local ? `${josa(shortName(e.id), '이', '가')} 쓰는 중이에요` : `${shortName(r.empId || e.id)}이(가) 작업을 시작했어요`)) },
        isWorking(e.id) ? (local ? '쓰는 중 · 보통 10~50초' : '● 일하는 중') : local ? '지금 답 받기' : `${shortName(e.id)} 바로 실행`),
        t.status === '막힘' && altRunners.length
          ? altRunners.slice(0, 2).map((cand) => h('button', {
            type: 'button', class: 'btn sm', disabled: locked,
            onclick: () => runNow({ switchTo: cand.id, enableAuto: true }, () => `${shortName(cand.id)}에게 넘겨서 바로 실행했어요`),
          }, `${shortName(cand.id)}에게 넘겨 실행`))
          : null,
        retryBtn));
  }

  // 이 컴퓨터에 CLI 가 설치되어 있지만 실행 모드가 '꺼짐(off)' 인 경우: 1클릭 자동 실행 켜고 바로 실행!
  if (isInstalledCli(e) && e.runMode === 'off') {
    return h('div', { class: 'work' },
      h('div', { class: 'small' }, h('b', null, `${shortName(e.id)}은 이 컴퓨터에 설치되어 있어요`), ' · 실행 모드가 꺼져 있어 대기 중입니다. 아래 버튼 한 번으로 자동 실행을 켜고 바로 시작할 수 있어요.'),
      locked ? h('div', { class: 'small muted' }, `${gateK(t.gate)} 들어간 일이라 대표 확인 뒤에 시킬 수 있어요.`) : null,
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        h('button', { type: 'button', class: 'btn dark', disabled: locked, onclick: () => runNow({ enableAuto: true }, () => `${shortName(e.id)} 자동 실행을 켜고 바로 시작했어요`) }, '자동 실행 켜고 지금 바로 실행'),
        retryBtn));
  }

  const ho = ui.handout[t.id];
  const url = ho?.url || e.webUrl || '';
  const paste = h('textarea', { class: 'in', rows: 4, 'data-k': `paste-${t.id}`, placeholder: `${shortName(e.id)}에게 받은 답을 여기에 붙여 넣으세요`, 'aria-label': '받은 답' });
  const doneBox = h('input', { type: 'checkbox', checked: true, 'data-k': `paste-done-${t.id}`, 'aria-label': '끝난 일로 표시' });
  const getPrompt = () => once(`ho-${t.id}`, async () => {
    try {
      if (flushIfDirty) await flushIfDirty();
      const r = await api('POST', `/api/ui/tasks/${t.id}/handout`, {});
      ui.handout[t.id] = r;
      const ok = await copyText(r.prompt);
      toast(ok ? `복사했어요. ${shortName(e.id)}에 붙여 넣으세요` : '아래 지시문을 길게 눌러 복사해 주세요');
      await load();
    } catch { /* toast 는 api 가 띄움 */ }
  });
  const savePaste = () => submitInput(paste, `paste-${t.id}`, (v) => act('POST', `/api/ui/tasks/${t.id}/paste`, { text: v, done: doneBox.checked }, '결과를 남겼어요'));
  const directHandoff = altRunners.length
    ? h('div', { class: 'handoff-run-box' },
      h('div', { class: 'small' }, h('b', null, `${shortName(e.id)}은 웹 전용이라 앱에서 직접 실행 못해요`), ' · 이 컴퓨터에 설치된 AI에게 넘겨 바로 실행할 수 있어요:'),
      h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:6px' },
        altRunners.map((cand) => h('button', {
          type: 'button', class: 'btn sm dark', disabled: locked,
          onclick: () => runNow({ switchTo: cand.id, enableAuto: true }, () => `${shortName(cand.id)}에게 넘겨 바로 작업을 시작했어요`),
        }, `${shortName(cand.id)}로 바로 실행`))))
    : null;
  return h('div', { class: 'work' },
    directHandoff,
    h('div', { class: 'small' }, h('b', null, '복사해서 맡기기'), ` · ${josa(e.name, '은', '는')} 이 앱 안에서 직접 답하지 않아요. 지시문을 복사해 ${url ? '열어서' : `${shortName(e.id)}에`} 붙여 넣고, 받은 답을 아래에 넣어 주세요.`),
    locked ? h('div', { class: 'small muted' }, `${gateK(t.gate)} 들어간 일이라 대표 확인 뒤에 맡길 수 있어요.`) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn dark', 'data-act': 'copy', disabled: locked, onclick: getPrompt }, ho ? '지시문 다시 복사' : '1. 지시문 복사'),
      url ? h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer', 'data-act': 'open' }, `2. ${shortName(e.id)} 열기`) : null,
      retryBtn),
    ho ? h('details', { 'data-k': `ho-d-${t.id}` }, h('summary', null, '지시문 보기'), h('pre', { class: 'full' }, ho.prompt)) : null,
    paste,
    h('div', { class: 'row', style: 'justify-content:space-between' },
      h('label', { class: 'chk-l' }, doneBox, '끝난 일로 표시'),
      h('button', { class: 'btn dark', 'data-act': 'paste', onclick: savePaste }, `${url ? '3' : '2'}. 결과로 남기기`)));
}

// ───────── 할 일 스레드 ─────────

function msgView(m) {
  if (m.fromKind === 'system') return h('div', { class: 'm sys' }, `${m.text} · ${stamp(m.at)}`);
  const head = h('div', { class: 'by' }, h('b', null, m.from === 'jay' ? '나' : nameOf(m.from)), kindBadge(m.fromKind, m.imported, m.pasted), h('span', null, stamp(m.at)),
    m.kind === 'result' ? h('span', { class: 'tag' }, '결과') : null,
    m.kind === 'transcript' ? h('span', { class: 'tag' }, '작업 기록') : null,
    m.run ? h('span', null, [m.run.label, m.run.model ? `모델 ${m.run.model}` : ''].filter(Boolean).join(' · ')) : null);
  let body;
  if (m.kind === 'handoff' && m.handoff) {
    const hf = m.handoff;
    const kv = (k, v) => h('div', null, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v || '-'));
    body = h('div', { class: 'handoff' },
      h('div', { class: 'small', style: 'font-weight:600' }, hf.to ? `인수인계 → ${nameOf(hf.to)}` : '인수인계 · 다음 담당을 골라 주세요'),
      h('div', { class: 'hf-grid' }, kv('한 것', hf.done), kv('멈춘 곳', hf.stuck), kv('이유', hf.why), hf.model ? kv('모델', hf.model) : null,
        h('div', null, h('div', { class: 'k' }, '파일'), hf.files?.length ? h('ul', { class: 'files' }, hf.files.map((x) => h('li', null, x))) : h('div', { class: 'v' }, '-'))));
  } else if (m.kind === 'transcript') {
    body = h('div', null, h('div', { class: 'body clamp' }, m.summary || ''),
      h('details', { 'data-k': `tr-${m.id}` }, h('summary', null, `전체 보기${m.fileName ? ` · ${m.fileName}` : ''}`), h('pre', { class: 'full' }, m.text)));
  } else if (m.kind === 'approval') {
    const a = S.data.approvals.find((x) => x.id === m.approvalId);
    body = h('div', { class: 'handoff' }, h('div', { class: 'body' }, m.text),
      a && a.status === '대기'
        ? h('div', { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'btn sm', onclick: () => act('POST', `/api/ui/approvals/${a.id}/decide`, { decision: '반려' }, '반려했습니다') }, '반려'),
          h('button', { class: 'btn sm dark', onclick: () => { triggerRoyalStampFx(a.kind || '결재'); act('POST', `/api/ui/approvals/${a.id}/decide`, { decision: '승인' }, '승인했어요'); } }, '승인'))
        : h('div', { class: 'small muted', style: 'margin-top:6px' }, a ? `${a.status}${a.decidedAt ? ` · ${stamp(a.decidedAt)}` : ''}` : ''));
  } else {
    const long = m.text.length > 600;
    body = h('div', null, h('div', { class: `body${long ? ' clamp' : ''}` }, long ? m.text.slice(0, 600) : m.text),
      long ? h('details', { 'data-k': `long-${m.id}` }, h('summary', null, '전체 보기'), h('pre', { class: 'full' }, m.text)) : null,
      m.link ? h('a', { class: 'evi', href: m.link, target: '_blank', rel: 'noopener noreferrer' }, m.link) : null);
  }
  return h('div', { class: `m${m.from === 'jay' ? ' me' : ''}` }, head, body);
}

function threadView(t, hasTopResult = false) {
  const list = S.data.messages.filter((m) => m.thread === `task:${t.id}`);
  const msgCount = list.filter((m) => m.fromKind !== 'system').length;
  const typing = S.working.filter((w) => w.thread === `task:${t.id}`).map((w) => `${nameOf(w.emp)} 실행 중`);
  const inp = h('input', { class: 'in sm', 'data-k': `compose-${t.id}`, 'aria-label': '메모', placeholder: '메모 입력' });
  const sendMsg = async () => {
    const r = await submitInput(inp, `msg-${t.id}`, (v) => act('POST', `/api/ui/tasks/${t.id}/messages`, { text: v }));
    if (r) document.querySelector(`[data-k="compose-${t.id}"]`)?.focus();
  };
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); sendMsg(); } });

  const historyEl = list.length
    ? (hasTopResult || list.length > 3
      ? h('details', { class: 'clean-fold sm td-hist', 'data-k': `hist-${t.id}` },
        h('summary', null, `기록 (${msgCount || list.length})`),
        h('div', { class: 'thread', style: 'margin-top:8px' }, list.slice(-20).map(msgView)))
      : h('div', { class: 'thread' }, list.map(msgView)))
    : null;

  return h('div', { class: 'td-thread' },
    historyEl,
    typing.length ? h('div', { class: 'typing' }, typing.join(' · ')) : null,
    h('div', { class: 'row td-compose' },
      h('div', { style: 'flex:1' }, inp),
      h('button', { type: 'button', class: 'btn sm dark', onclick: sendMsg }, '보내기')));
}

function openImport(t) {
  const dlg = document.getElementById('dlg');
  const who = h('select', { class: 'in', 'aria-label': '누구의 대화' }, S.data.employees.map((e) => h('option', { value: e.id, selected: e.id === t.assignee }, e.name)));
  const body = h('textarea', { class: 'in', rows: 8, placeholder: '피클, Muse, ChatGPT 앱 등에서 나눈 대화를 붙여 넣으세요', 'aria-label': '대화 내용' });
  const link = h('input', { class: 'in', placeholder: '공유 링크 (선택, https)', 'aria-label': '공유 링크' });
  setDlg(dlg, 
    h('h3', null, '대화 가져오기'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 16px' }, `할 일 "${t.title}" 스레드에 그 직원의 메시지로 남고, 가져옴 표시가 붙습니다.`),
    h('label', { class: 'field' }, '누구와의 대화', who),
    h('label', { class: 'field', style: 'margin-top:12px' }, '대화 내용', body),
    h('label', { class: 'field', style: 'margin-top:12px' }, '공유 링크', link),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once(`imp-${t.id}`, async () => { dlg.close(); await act('POST', `/api/ui/tasks/${t.id}/import`, { emp: who.value, text: body.value, link: link.value }, '대화를 가져왔습니다'); }) }, '가져오기')));
  dlg.showModal();
  body.focus();
}

function taskList(list, opts = {}) {
  const ul = h('ul', { class: 'tasks' }, list.map((t) => taskRow(t, opts)));
  if (opts.draggable !== false) enableDrag(ul);
  return ul;
}

function enableDrag(ul) {
  ul.addEventListener('pointerdown', (e) => {
    const hd = e.target.closest('.handle');
    if (!hd) return;
    const li = hd.closest('li.task');
    e.preventDefault();
    // 줄을 옮기면 손잡이가 DOM 에서 잠깐 빠지므로, 포인터는 목록(ul)이 붙잡는다
    ul.setPointerCapture(e.pointerId);
    ui.drag = true;
    li.classList.add('dragging');
    const before = [...ul.children].map((x) => x.dataset.id).join();
    const move = (ev) => {
      const sibs = [...ul.querySelectorAll(':scope > li.task')].filter((x) => x !== li);
      let placed = false;
      for (const sb of sibs) {
        const r = sb.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { if (li.nextSibling !== sb) ul.insertBefore(li, sb); placed = true; break; }
      }
      if (!placed && ul.lastElementChild !== li) ul.appendChild(li);
    };
    const up = async () => {
      ul.removeEventListener('pointermove', move);
      li.classList.remove('dragging');
      ui.drag = false;
      const ids = [...ul.children].map((x) => x.dataset.id);
      if (ids.join() !== before) await act('POST', '/api/ui/tasks/reorder', { ids });
    };
    let ended = false;
    const end = () => { if (ended) return; ended = true; up(); };
    ul.addEventListener('pointermove', move);
    ul.addEventListener('pointerup', end, { once: true });
    ul.addEventListener('pointercancel', end, { once: true });
    ul.addEventListener('lostpointercapture', end, { once: true });
  });
}

// ───────── 음성 (보조) ─────────

let recog = null;
function toggleMic(input) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('이 브라우저는 음성 인식을 지원하지 않습니다'); return; }
  if (ui.listening && recog) { recog.stop(); return; }
  recog = new SR();
  recog.lang = 'ko-KR';
  recog.interimResults = true;
  recog.continuous = false;
  recog.onresult = (e) => {
    let s = '';
    for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
    const el = document.querySelector('[data-k="add-title"]') || input;
    el.value = s;
    el.dispatchEvent(new Event('input'));
  };
  recog.onend = () => { ui.listening = false; render(); };
  recog.onerror = (e) => toast(e.error === 'not-allowed' ? '마이크 권한이 필요합니다' : `음성 인식 오류: ${e.error}`);
  recog.start();
  ui.listening = true;
  render();
}

const MIC_SVG = () => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5');
  for (const d of ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5.5 11.5a6.5 6.5 0 0 0 13 0', 'M12 18v3']) {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('stroke-linecap', 'round'); svg.appendChild(p);
  }
  return svg;
};

// ───────── 내 할 일 (홈) ─────────

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return '늦은 밤입니다';
  if (hr < 12) return '좋은 아침입니다';
  if (hr < 18) return '좋은 오후입니다';
  return '좋은 저녁입니다';
}

// 담당 직접 선택(기본) + 컴퓨터 자동 최적화 실시간 미리보기 바
function createWhoBar(titleInput, pickKey) {
  const cur = () => ui[pickKey] || 'auto';
  const sugBox = h('div', { class: 'add-suggest', 'aria-live': 'polite' });
  let lastSug = null;
  let timer = null;
  let seq = 0;

  const btns = [];
  const addChip = (id, label, extraClass = '') => {
    const b = h('button', { type: 'button', class: `chip sm${extraClass}${cur() === id ? ' on' : ''}`, 'aria-pressed': cur() === id ? 'true' : 'false' }, label);
    btns.push([id, b]);
    return b;
  };
  const autoBtn = h('button', { type: 'button', class: `chip sm gold-auto${cur() === 'auto' ? ' on' : ''}`, 'aria-pressed': cur() === 'auto' ? 'true' : 'false' }, '✦ 자동 배분');
  const picker = h('div', { class: 'picker', role: 'group', 'aria-label': '담당 선택' },
    autoBtn,
    addChip('jay', '나'),
    S.data.employees.map((e) => addChip(e.id, isEmpCooling(e) ? `${shortName(e.id)} (휴식)` : shortName(e.id), isEmpCooling(e.id) ? ' cool' : '')));
  btns.push(['auto', autoBtn]);

  const updateView = () => {
    const pick = cur();
    for (const [id, b] of btns) {
      const on = pick === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    const q = titleInput.value.trim();
    if (!q && (pick === 'jay' || pick === 'auto')) {
      autoBtn.textContent = '✦ 자동 배분';
      sugBox.classList.remove('show');
      sugBox.replaceChildren();
      return;
    }
    if (!lastSug) {
      if (pick !== 'jay' && pick !== 'auto') {
        sugBox.replaceChildren(h('b', null, shortName(pick)), ' 직접 지정 · 메인 컴퓨터 기준으로 자동 최적화합니다');
        sugBox.classList.add('show');
      } else {
        sugBox.classList.remove('show');
        sugBox.replaceChildren();
      }
      return;
    }
    const sugWho = lastSug.assignee ? shortName(lastSug.assignee) : '미정';
    autoBtn.textContent = pick === 'auto' && q ? `✦ 자동 배분 → ${sugWho}` : '✦ 자동 배분';
    const extras = [];
    if (lastSug.browserName) extras.push(lastSug.spaceName ? `${lastSug.browserName} (${lastSug.spaceName})` : lastSug.browserName);
    if (lastSug.accountName) extras.push(lastSug.accountName.split(' · ')[0].split(' (')[0]);
    if (lastSug.designName) extras.push(`디자인: ${lastSug.designName}`);
    for (const tn of lastSug.toolNames || []) extras.push(tn);
    if (lastSug.gate) extras.push(`${lastSug.gate} 확인 필요`);

    const mh = lastSug.machineHealth;
    const compText = lastSug.machineQueued
      ? `컴퓨터 과부하(${mh?.ramPct ?? '?'}%) · 실행 시 대기열 보호`
      : lastSug.machineRerouted && lastSug.machineReason
        ? `⚡ ${lastSug.machineReason}`
        : lastSug.resourceName
          ? `컴퓨터 자동: ${lastSug.resourceName}${typeof mh?.ramPct === 'number' ? ` (RAM ${mh.ramPct}% · ${healthLabel(mh.level)})` : ''}`
          : '';

    sugBox.replaceChildren();
    if (pick === 'auto') {
      sugBox.append(
        '자동 추천 → ',
        h('b', null, sugWho),
        lastSug.reason ? ` · ${lastSug.reason}` : '',
        compText ? ` · ${compText}` : '',
        extras.length ? ` · 연결: ${extras.join(', ')}` : '');
      sugBox.classList.add('show');
    } else if (pick === 'jay') {
      if (extras.length) {
        sugBox.append(h('b', null, '나'), ' 직접 할 일 · 연결: ', extras.join(', '));
        sugBox.classList.add('show');
      } else {
        sugBox.classList.remove('show');
      }
    } else {
      const cool = lastSug.empCooldown;
      sugBox.append(
        h('b', null, shortName(pick)),
        cool
          ? ` 토큰 휴식 중(${cool.remainingMin}분 남음${cool.fallbackName ? ` · 실행 시 ${shortName(cool.fallbackId)}로 자동 전환` : ''})`
          : ' 직접 지정',
        compText ? ` · ${compText}` : '',
        extras.length ? ` · 연결: ${extras.join(', ')}` : '');
      sugBox.classList.add('show');
    }
  };

  const fetchSuggest = () => {
    const q = titleInput.value.trim();
    const pick = cur();
    if (!q && (pick === 'jay' || pick === 'auto')) { lastSug = null; updateView(); return; }
    const mySeq = ++seq;
    fetch('/api/ui/assign/suggest', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-HQ-UI': '1' },
      body: JSON.stringify({ title: q, assignee: pick }),
    }).then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (mySeq !== seq || !s) return;
      lastSug = s;
      updateView();
    }).catch(() => { /* 조용히 무시 */ });
  };

  for (const [id, b] of btns) {
    b.addEventListener('click', () => {
      ui[pickKey] = id;
      updateView();
      fetchSuggest();
      titleInput.focus();
    });
  }

  titleInput.addEventListener('input', () => {
    clearTimeout(timer);
    if (!titleInput.value.trim() && (cur() === 'jay' || cur() === 'auto')) { lastSug = null; updateView(); return; }
    timer = setTimeout(fetchSuggest, 160);
  });

  const wrap = h('div', null,
    h('div', { class: 'add-who' }, h('span', { class: 'small muted' }, '담당'), picker),
    sugBox);
  wrap.resetSuggest = () => { lastSug = null; updateView(); if (cur() !== 'jay' && cur() !== 'auto') fetchSuggest(); };
  setTimeout(() => { if (titleInput.value.trim() || (cur() !== 'jay' && cur() !== 'auto')) fetchSuggest(); }, 20);
  return wrap;
}

function parseSmartTime(raw, { allowBareDigits = false } = {}) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^(지금|바로|즉시)$/.test(s)) return '';
  const mRel = /(?:(\d{1,2})\s*시간(?:\s*(\d{1,2})\s*분|\s*(반))?|(\d{1,3})\s*분)\s*(?:뒤|후)(?:에)?/.exec(s);
  if (mRel) {
    const addH = mRel[1] ? Number(mRel[1]) : 0;
    const addM = mRel[3] ? 30 : mRel[2] ? Number(mRel[2]) : mRel[4] ? Number(mRel[4]) : 0;
    const tot = addH * 60 + addM;
    if (tot >= 1 && tot <= 720) {
      const d = new Date(Date.now() + tot * 60000);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  const adj = (mer, h) => {
    if (['오후', '저녁', '밤'].includes(mer) && h >= 1 && h <= 11) return h + 12;
    if (mer === '낮' && h >= 1 && h <= 6) return h + 12;
    if (['오전', '새벽'].includes(mer) && h === 12) return 0;
    return h;
  };
  const m0 = /(오전|오후|아침|점심|낮|저녁|밤|새벽)\s*(\d{1,2}):([0-5]\d)(?!\d)/.exec(s);
  if (m0) { const h = adj(m0[1], Number(m0[2])); if (h <= 23) return `${pad(h)}:${m0[3]}`; }
  const m1 = /(오전|오후|아침|점심|낮|저녁|밤|새벽)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?/.exec(s);
  if (m1) {
    const h = adj(m1[1], Number(m1[2]));
    const mi = m1[4] ? 30 : m1[3] ? Number(m1[3]) : 0;
    if (h <= 23 && mi <= 59) return `${pad(h)}:${pad(mi)}`;
  }
  const mPost = /(?<!\d)(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?\s*(오전|오후|아침|점심|낮|저녁|밤|새벽)/.exec(s);
  if (mPost) {
    const h = adj(mPost[4], Number(mPost[1]));
    const mi = mPost[3] ? 30 : mPost[2] ? Number(mPost[2]) : 0;
    if (h <= 23 && mi <= 59) return `${pad(h)}:${pad(mi)}`;
  }
  const m2 = /(?<!\d)(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분(?!마다)|\s*(반))/.exec(s);
  if (m2) {
    let h = Number(m2[1]);
    const mi = m2[3] ? 30 : Number(m2[2]);
    if (h <= 23 && mi <= 59) { if (h >= 1 && h <= 6) h += 12; return `${pad(h)}:${pad(mi)}`; }
  }
  const mBare = /(?<!\d)(\d{1,2})\s*시(?:에|까지|부터)(?!\d)/.exec(s);
  if (mBare) {
    let h = Number(mBare[1]);
    if (h <= 23) { if (h >= 1 && h <= 6) h += 12; return `${pad(h)}:00`; }
  }
  const sNoRatio = s.replace(/(?<!\d)(?:9:16|16:9|16:10|21:9|1:1|4:5|4:3|3:4|2:3|3:2)(?!\d)/g, ' ')
    .replace(/(?<!\d)\d{1,2}:\d{1,2}\s*(?:비율|화면비|쇼츠|숏츠|릴스|크롭|세로|가로|정사각형)/g, ' ');
  const m3 = /(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/.exec(sNoRatio);
  if (m3) return `${pad(Number(m3[1]))}:${m3[2]}`;
  if (allowBareDigits) {
    // 4자리(1830), 3자리(630 → 18:30), 1~2자리(18 → 18:00)
    const d4 = /^(\d{2})(\d{2})$/.exec(s);
    if (d4 && Number(d4[1]) <= 23 && Number(d4[2]) <= 59) return `${d4[1]}:${d4[2]}`;
    const d3 = /^(\d)(\d{2})$/.exec(s);
    if (d3 && Number(d3[2]) <= 59) { let h = Number(d3[1]); if (h >= 1 && h <= 6) h += 12; return `${pad(h)}:${d3[2]}`; }
    const d2 = /^(\d{1,2})$/.exec(s);
    if (d2 && Number(d2[1]) <= 23) { let h = Number(d2[1]); if (h >= 1 && h <= 6) h += 12; return `${pad(h)}:00`; }
  }
  return null;
}

function fmtKoTime(hhmm) {
  if (!hhmm) return '지금 바로';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const mer = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${mer} ${h12}시` : `${mer} ${h12}:${pad(m)}`;
}

function addMinutesHm(mins) {
  const d = new Date(Date.now() + mins * 60000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addBar() {
  const title = h('input', { class: 'in big', placeholder: '할 일을 적어 주세요', 'data-k': 'add-title', 'aria-label': '새 할 일' });
  const timeVal = h('input', { type: 'hidden', value: ui.addTime || '', 'data-k': 'add-time' });
  let manualTime = Boolean(ui.addTimeManual);
  const pop = h('div', { class: 'time-pop', role: 'dialog', 'aria-label': '시간 선택' });
  const lblEl = h('span', { class: 'time-btn-lbl' });
  const clearBtn = h('span', {
    class: 'time-x', role: 'button', tabindex: '0', title: '지금 바로로 되돌리기', 'aria-label': '시간 지우기',
    onclick: (ev) => { ev.stopPropagation(); setTime('', false); closePop(); },
  }, '×');
  const timeBtn = h('button', {
    type: 'button', class: 'time-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    onclick: (ev) => { ev.stopPropagation(); togglePop(); },
  }, h('span', { class: 'time-ic', 'aria-hidden': 'true' }, '◷'), lblEl, clearBtn);

  const syncBtn = () => {
    const v = timeVal.value;
    lblEl.textContent = fmtKoTime(v);
    timeBtn.classList.toggle('has', Boolean(v));
    clearBtn.style.display = v ? 'inline-grid' : 'none';
  };
  const setTime = (v, isManual = true) => {
    timeVal.value = v || '';
    ui.addTime = timeVal.value;
    manualTime = Boolean(v && isManual);
    ui.addTimeManual = manualTime;
    syncBtn();
  };
  syncBtn();

  const quickIn = h('input', { class: 'in sm', placeholder: '직접 입력 (예: 1830, 오후 6:30, 15분 뒤)', 'aria-label': '시간 직접 입력' });
  const applyQuick = () => {
    const parsed = parseSmartTime(quickIn.value, { allowBareDigits: true });
    if (parsed === null) { quickIn.focus(); toast('예: 1830, 오후 6:30, 15분 뒤 형식으로 적어 주세요'); return; }
    setTime(parsed, Boolean(parsed));
    quickIn.value = '';
    closePop();
  };
  quickIn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); applyQuick(); }
    if (ev.key === 'Escape') closePop();
  });

  const buildPop = () => {
    const rels = [[0, '지금 바로'], [5, '+5분'], [10, '+10분'], [30, '+30분'], [60, '+1시간']];
    const presets = [['09:00', '오전 9시'], ['10:00', '오전 10시'], ['14:00', '오후 2시'], ['18:00', '오후 6시'], ['20:00', '저녁 8시'], ['22:00', '밤 10시']];
    pop.replaceChildren(
      h('div', { class: 'time-pop-sec' },
        h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '빠른 예약 (지금 기준)'),
        h('div', { class: 'picker' }, rels.map(([m, label]) => h('button', {
          type: 'button', class: `chip sm${(m === 0 && !timeVal.value) ? ' on' : ''}`,
          onclick: () => { setTime(m === 0 ? '' : addMinutesHm(m), m > 0); closePop(); },
        }, label)))),
      h('div', { class: 'time-pop-sec' },
        h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '자주 쓰는 시각'),
        h('div', { class: 'picker' }, presets.map(([hhmm, label]) => h('button', {
          type: 'button', class: `chip sm${timeVal.value === hhmm ? ' on' : ''}`,
          onclick: () => { setTime(hhmm, true); closePop(); },
        }, label)))),
      h('div', { class: 'time-pop-sec' },
        h('div', { class: 'row', style: 'gap:6px' },
          quickIn,
          h('button', { type: 'button', class: 'btn sm dark', onclick: applyQuick }, '적용'))));
  };

  let onDocClick = null;
  const closePop = () => {
    pop.classList.remove('open');
    timeBtn.setAttribute('aria-expanded', 'false');
    if (onDocClick) { document.removeEventListener('click', onDocClick); onDocClick = null; }
  };
  const togglePop = () => {
    if (pop.classList.contains('open')) { closePop(); return; }
    buildPop();
    pop.classList.add('open');
    timeBtn.setAttribute('aria-expanded', 'true');
    quickIn.value = '';
    setTimeout(() => quickIn.focus(), 20);
    onDocClick = (ev) => { if (!timeWrap.contains(ev.target)) closePop(); };
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
  };

  const timeWrap = h('div', { class: 'time-wrap' }, timeVal, timeBtn, pop);

  // 제목에 "10분 뒤", "오후 6:30", "저녁 8시" 를 적으면 실시간으로 시간 버튼이 자동 채워짐!
  title.addEventListener('input', () => {
    if (manualTime) return;
    const detected = parseSmartTime(title.value, { allowBareDigits: false });
    if (detected !== null) {
      timeVal.value = detected;
      ui.addTime = detected;
      syncBtn();
    } else if (timeVal.value) {
      timeVal.value = '';
      ui.addTime = '';
      syncBtn();
    }
  });

  const whoBar = createWhoBar(title, 'taskPick');
  const collabOn = Boolean(ui.addCollab);
  const collabMode = ui.addCollabMode === 'parallel' ? 'parallel' : 'serial';
  const collabBtn = h('button', {
    type: 'button',
    class: `chip sm collab-chip${collabOn ? ' on' : ''}`,
    'aria-pressed': collabOn ? 'true' : 'false',
    title: '켜면 AI 직원 2~3명이 스킬·지식·토큰 여유에 맞춰 나눠 협업합니다',
    onclick: () => { ui.addCollab = !ui.addCollab; if (ui.addCollab) ui.taskPick = 'auto'; render(); },
  }, collabOn ? '✦ AI 협업 ON' : '+ AI 협업');
  const collabModeBtn = collabOn ? h('button', {
    type: 'button',
    class: 'chip sm collab-mode-chip',
    title: '클릭해 릴레이(순서대로) / 동시(병렬) 전환',
    onclick: () => { ui.addCollabMode = collabMode === 'parallel' ? 'serial' : 'parallel'; render(); },
  }, collabMode === 'parallel' ? '동시 실행 ⇄' : '릴레이 ⇄') : null;
  const whoPicker = whoBar.querySelector('.picker');
  const goldChip = whoPicker?.querySelector('.gold-auto');
  if (whoPicker && goldChip) {
    goldChip.after(...[collabBtn, collabModeBtn].filter(Boolean));
  } else {
    (whoPicker || whoBar).append(...[collabBtn, collabModeBtn].filter(Boolean));
  }

  const runDelegate = async () => {
    closePop();
    const tm = timeVal.value;
    const useCollab = Boolean(ui.addCollab);
    const useMode = ui.addCollabMode === 'parallel' ? 'parallel' : 'serial';
    const r = await submitInput(title, 'delegate-task', (v) => {
      setTime('', false);
      return act('POST', '/api/ui/coordinator/delegate', {
        title: v, time: tm, date: S.today,
        ...(useCollab ? { collab: true, collabMode: useMode } : {}),
      });
    });
    if (r) {
      whoBar.resetSuggest();
      if (r.createdRoutine) {
        const assigneeLabel = shortName(r.assignee);
        pushLiveCard({
          kind: 'connect',
          kicker: 'CONNECT AI · 오토메이션 자동 등록',
          title: `⏱ ${r.scheduleLabel || '반복'} 오토메이션을 등록했어요`,
          body: `${assigneeLabel}${r.membershipNote ? ` · ${r.membershipNote}` : ''} · ${r.title}`,
          empId: r.assignee !== 'jay' ? r.assignee : null,
          duration: 6500,
          actionLabel: '오토메이션 보기 →',
          onAction: () => { location.hash = '#daily'; },
        });
        document.querySelector('[data-k="add-title"]')?.focus();
        return;
      }
      const multi = Array.isArray(r.steps) && r.steps.length >= 2;
      const isHuman = r.assignee === 'jay';
      const isAlarm = Boolean(r.isAlarm);
      const unlinked = !isHuman && r.assigneeRunnable === false && !r.gate;
      const queued = Boolean(r.autoQueued && !r.autoStarted);
      const host = !isHuman && r.mainMachineName ? ` · ${r.mainMachineName}` : '';
      const schedTag = r.delaySec ? ` · ${r.delaySec}초 뒤 자동 실행` : (!r.autoStarted && r.time && !r.gate ? ` · ${fmtKoTime(r.time)} 예약` : '');
      const aiLabel = r.mainAiId ? shortName(r.mainAiId) : (r.mainAiName || '메인 AI');
      const assigneeLabel = shortName(r.assignee);
      if (r.autoStarted && r.id) markStartCardShown(r.id);
      pushLiveCard({
        kind: r.gate ? 'approve' : (unlinked || queued) ? 'handoff' : 'connect',
        kicker: `CONNECT AI · ${multi ? '멀티 팀 자동 배분' : isAlarm ? '알람 예약' : isHuman ? '대표 일정 분류' : queued ? 'RAM 보호 대기열' : r.membershipNote ? '멤버십 최적화 배분' : unlinked ? '미연결 AI 배정' : '자동 배분'}`,
        title: multi
          ? `${koSubject(aiLabel)} ${r.steps.length}단계로 팀에 배분했어요`
          : isAlarm
            ? `⏰ 알람을 예약했어요${r.delaySec ? ` (${r.delaySec}초 뒤)` : r.time ? ` (${fmtKoTime(r.time)})` : ''}`
            : isHuman
              ? '대표님이 직접 할 일로 분류했어요'
              : queued
                ? `${assigneeLabel} 배정 · RAM 보호 대기열`
                : unlinked
                  ? `${assigneeLabel} 배정 (미연결 · 수동 확인 필요)`
                  : aiLabel === assigneeLabel
                    ? `${assigneeLabel}${r.autoStarted ? ' 즉시 실행 시작' : ' 배정 완료'}`
                    : `${aiLabel} → ${assigneeLabel} 배정 완료`,
        body: isHuman
          ? (r.reason || '몸이나 현장이 필요한 일')
          : queued
            ? (r.queueReason || `${assigneeLabel}${host} · RAM 여유 생기면 자동 시작 (목록에서 "지금 바로 실행" 가능)`)
            : `${r.membershipNote ? `${r.membershipNote} · ` : ''}${r.stepSummary || shortName(r.assignee)}${host}${r.autoStarted ? ' · 즉시 실행 시작' : r.gate ? ` · ${r.gate} 승인 대기` : unlinked ? ' · AI 직원에서 연결하거나 복사 실행해 주세요' : schedTag}`,
        empId: r.assignee !== 'jay' ? r.assignee : null,
        taskId: r.id,
        actionLabel: isHuman ? '일정 보기 →' : queued ? '대기열 열기 →' : '배분 내역 보기 →',
      });
      if (multi) { ui.open = r.id; render(); }
      document.querySelector('[data-k="add-title"]')?.focus();
    }
  };
  const add = async () => {
    closePop();
    const tm = timeVal.value;
    const picked = ui.taskPick || 'auto';
    if (picked === 'auto' || ui.addCollab) { await runDelegate(); return; }
    const r = await submitInput(title, 'add-task', (v) => {
      setTime('', false);
      return act('POST', '/api/ui/tasks', { title: v, time: tm, date: S.today, assignee: picked });
    });
    if (r) {
      whoBar.resetSuggest();
      const comp = r.resource && res(r.resource) ? ` · ${res(r.resource).name}` : '';
      const msg = r.autoStarted
        ? `${shortName(r.assignee)}에게 맡기고 바로 작업을 시작했어요${comp}`
        : r.autoQueued
          ? `${shortName(r.assignee)} 대기열에 올렸어요 (여유 생기면 자동 착수)`
          : r.gate
            ? `${shortName(r.assignee)} · ${r.gate} 확인이 필요해 승인 대기 중이에요`
            : r.time
              ? `${shortName(r.assignee)} · ${fmtKoTime(r.time)} 예약했어요${comp}`
              : `${shortName(r.assignee)}에게 맡겼어요${comp}`;
      toast(msg);
      document.querySelector('[data-k="add-title"]')?.focus();
    }
  };
  const pickedId = ui.taskPick || 'auto';
  const pickedLabel = pickedId === 'auto' ? '자동' : pickedId === 'jay' ? '나' : `@${shortName(pickedId)}`;
  const pickSel = h('select', {
    class: 'in calm-pick-sel',
    'aria-label': '담당 선택',
    title: '담당 직원 선택 (위 사무실에서 캐릭터 클릭 가능)',
    onchange: (ev) => {
      ui.taskPick = ev.target.value || 'auto';
      ui.swarmSelected = ui.taskPick === 'auto' || ui.taskPick === 'jay' ? 'all' : ui.taskPick;
      render();
      setTimeout(() => document.querySelector('[data-k="add-title"]')?.focus(), 20);
    },
  },
  h('option', { value: 'auto', selected: pickedId === 'auto' }, '✦ 자동'),
  h('option', { value: 'jay', selected: pickedId === 'jay' }, '나'),
  ...S.data.employees.filter((e) => e.id !== 'jay' && shortName(e.id) !== '나').map((e) => h('option', { value: e.id, selected: pickedId === e.id }, shortName(e.id))));
  title.placeholder = pickedId === 'auto'
    ? '할 일을 적어 주세요 (위 사무실에서 직원 클릭 가능)'
    : `${pickedLabel}에게 시킬 일을 적어 주세요`;
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && !ui.composing) add(); });
  return h('div', { class: 'calm-add-wrap' },
    h('div', { class: 'addbar calm-add' },
      title,
      pickSel,
      timeWrap,
      h('button', { class: `mic-sm${ui.listening ? ' on' : ''}`, 'aria-label': ui.listening ? '듣기 멈추기' : '말로 적기', 'aria-pressed': ui.listening ? 'true' : 'false', title: '말로 적기', onclick: () => toggleMic(title) }, MIC_SVG()),
      h('button', { class: 'btn dark big', onclick: add }, '추가')));
}

function workBlocks(empId) {
  const start = new Date(`${S.today}T00:00:00`).getTime();
  const end = start + 86400000;
  const now = Date.now();
  const toMin = (ms) => Math.max(0, Math.min(1440, (ms - start) / 60000));
  const blocks = [];
  for (const t of S.data.tasks) {
    let open = null;
    for (const hs of t.history || []) {
      const at = Date.parse(hs.at);
      if (hs.by !== empId) { if (open !== null && hs.status !== '진행') { blocks.push([open, at, t.title]); open = null; } continue; }
      if (hs.status === '진행') { if (open === null) open = at; } else if (open !== null) { blocks.push([open, at, t.title]); open = null; } else if (hs.status === '완료') blocks.push([at - 5 * 60000, at, t.title]);
    }
    if (open !== null) blocks.push([open, now, t.title]);
  }
  for (const w of S.data.worklog || []) if (w.emp === empId) blocks.push([Date.parse(w.start), Date.parse(w.end), w.label]);
  for (const w of S.working) if (w.emp === empId) blocks.push([Date.parse(w.since), now, '일하는 중']);
  return blocks.filter(([a, b]) => b > start && a < end).map(([a, b, label]) => ({ start: toMin(a), end: toMin(b), label }));
}

function timeline() {
  const nowMin = (Date.now() - new Date(`${S.today}T00:00:00`).getTime()) / 60000;
  const any = S.data.employees.some((e) => workBlocks(e.id).length);
  return h('section', { class: 'sec small-sec' },
    secHead('AI 직원 근무', any ? '오늘 · 검정 = 일한 시간' : '오늘 아직 일한 기록 없음'),
    h('div', { class: 'tl' },
      h('div', { class: 'tl-axis' }, h('span'), h('div', { class: 'ticks' }, ['0', '6', '12', '18', '24'].map((x, i) => h('span', { style: `left:${i * 25}%` }, x)))),
      S.data.employees.map((e) => h('div', { class: 'tl-row' }, h('div', { class: 'nm', title: e.name }, shortName(e.id)), C.timelineRow(workBlocks(e.id), nowMin)))));
}

function recentTalk() {
  const list = S.data.messages.filter((m) => m.fromKind !== 'system' && m.thread.startsWith('task:')).slice(-5).reverse();
  return h('section', { class: 'sec small-sec' }, secHead('최근 대화'),
    list.length ? h('ul', { class: 'list' }, list.map((m) => {
      const tid = m.thread.slice(5);
      const t = S.data.tasks.find((x) => x.id === tid);
      const txt = m.kind === 'handoff' ? '인수인계를 남김' : m.kind === 'transcript' ? (m.summary || '작업 기록') : m.text;
      return h('li', null, h('div', { class: 'main' },
        h('div', { class: 't' }, h('b', { style: 'font-weight:600' }, m.from === 'jay' ? '나' : shortName(m.from)), ' ', txt.length > 70 ? `${txt.slice(0, 70)}…` : txt),
        h('div', { class: 's' }, `${t ? t.title : tid} · ${stamp(m.at)}`)),
      h('button', { class: 'btn sm', onclick: () => openTaskById(tid) }, '열기'));
    })) : h('div', { class: 'empty' }, '아직 대화가 없습니다'));
}

// 오늘 할 일(진행·대기·막힘) + 오늘 한 일(완료 & 결과물) 2단 분리
function doneCard(t) {
  const open = ui.open === t.id;
  const byId = t.completedBy || t.assignee || 'jay';
  const isAi = byId !== 'jay' && Boolean(emp(byId));
  const actorEmp = isAi ? emp(byId) : null;
  const resObj = latestResultOf(t);
  const trail = t.failoverTrail || [];
  const doneTime = t.completedAt ? stamp(t.completedAt) : (t.lastRunAt ? stamp(t.lastRunAt) : (t.time || ''));
  const chk = h('input', {
    type: 'checkbox', class: 'chk', checked: true, 'aria-label': `${t.title} 완료 해제`,
    onclick: (ev) => ev.stopPropagation(),
    onchange: () => act('PATCH', `/api/ui/tasks/${t.id}`, { status: '대기' }, '오늘 할 일로 되돌렸어요'),
  });
  const toggleOpen = () => { ui.open = open ? null : t.id; ui.picking = null; render(); };
  return h('li', { class: `done-card${open ? ' open' : ''}`, 'data-id': t.id },
    h('div', {
      class: 'done-card-top', tabindex: '0', role: 'button', 'aria-expanded': open ? 'true' : 'false',
      onclick: (ev) => { if (ev.target.closest('button,input,a')) return; toggleOpen(); },
      onkeydown: (ev) => { if (ev.target !== ev.currentTarget) return; if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleOpen(); } },
    },
    chk,
    actorEmp ? avatarEl(actorEmp, { size: 28 }) : h('span', { class: 'done-human-badge' }, '나'),
    h('div', { class: 'done-card-main' },
      h('div', { class: 'done-card-title' },
        h('b', null, t.title),
        doneTime ? h('span', { class: 'small muted' }, `${doneTime} 완료`) : null,
        h('span', { class: `tag${isAi ? ' solid' : ''}` }, isAi ? `${shortName(byId)} 완료` : '대표 완료'),
        trail.length ? h('span', { class: 'tag', title: trail.map((x) => `${x.fromName} → ${x.toName} (${x.reason})`).join(' / ') }, `⚡ 인계: ${trail[0].fromName} → ${trail[trail.length - 1].toName}`) : null),
      resObj
        ? h('div', { class: 'done-res clamp2' }, resObj.text)
        : h('div', { class: 'small muted' }, isAi ? '완료 보고됨 (눌러서 상세 보기)' : (t.note ? t.note : '대표가 직접 완료 체크함'))),
    h('button', { type: 'button', class: 'btn sm', onclick: (ev) => { ev.stopPropagation(); toggleOpen(); } }, open ? '접기' : (resObj ? '결과 보기' : '열기'))),
    open ? taskDetail(t, emp(t.assignee)) : null);
}

function todayOpenSection(today) {
  const f = ui.homeFilter || 'all';
  const openAll = today.filter((t) => t.status !== '완료');
  const mineCount = openAll.filter((t) => t.assignee === 'jay').length;
  const aiCount = openAll.filter((t) => t.assignee !== 'jay').length;
  const gateCount = openAll.filter((t) => (t.gate && !t.gateApprovedAt) || S.data.approvals.some((a) => a.status === '대기' && a.taskId === t.id)).length;
  const filterTabs = [
    ['all', `전체 (${openAll.length})`],
    ['me', `나 (${mineCount})`],
    ['ai', `AI (${aiCount})`],
    ...(gateCount || f === 'gate' ? [['gate', `확인 대기 (${gateCount})`]] : []),
  ];
  const filterBar = h('div', { class: 'filter-bar', role: 'group', 'aria-label': '오늘 할 일 보기' },
    filterTabs.map(([k, label]) => h('button', {
      type: 'button', class: `chip sm${f === k ? ' on' : ''}`, 'aria-pressed': f === k ? 'true' : 'false',
      onclick: () => { ui.homeFilter = k; render(); },
    }, label)));

  const open = openAll.filter((t) => {
    if (f === 'me') return t.assignee === 'jay';
    if (f === 'ai') return t.assignee !== 'jay';
    if (f === 'gate') return (t.gate && !t.gateApprovedAt) || S.data.approvals.some((a) => a.status === '대기' && a.taskId === t.id);
    return true;
  });

  if (open.length <= 30) {
    return h('div', null, filterBar, open.length ? taskList(open, { draggable: f === 'all' }) : h('div', { class: 'empty' }, f === 'all' ? '남은 할 일이 없습니다. 아래 「오늘 한 일」에서 완료 결과물을 확인하세요.' : '해당하는 할 일이 없습니다.'));
  }
  const order = ['jay', ...S.data.employees.map((e) => e.id), null];
  const keyOf = (t) => (t.assignee === 'jay' || emp(t.assignee) ? t.assignee : null);
  const groups = order.map((id) => [id, open.filter((t) => keyOf(t) === id)]).filter(([, l]) => l.length);
  return h('div', null,
    filterBar,
    groups.map(([id, list]) => h('div', { class: 'grp-list' }, h('div', { class: 'grp-name' }, `${id === 'jay' ? '나' : id ? shortName(id) : '담당 미정'} · ${list.length}`), taskList(list))));
}

function todayDoneSection(today) {
  const doneAll = today
    .filter((t) => t.status === '완료')
    .sort((a, b) => String(b.completedAt || b.lastRunAt || '').localeCompare(String(a.completedAt || a.lastRunAt || '')));
  const aiDone = doneAll.filter((t) => (t.completedBy || t.assignee) !== 'jay');
  const humanDone = doneAll.filter((t) => (t.completedBy || t.assignee) === 'jay');
  const df = ui.doneFilter || 'all';
  const shown = df === 'ai' ? aiDone : df === 'me' ? humanDone : doneAll;
  const visible = ui.showAllDone ? shown : shown.slice(0, 5);
  const moreCount = shown.length - visible.length;
  const tabs = [
    ['all', `전체 (${doneAll.length})`],
    ['ai', `AI 직원 (${aiDone.length})`],
    ['me', `나 (${humanDone.length})`],
  ];
  return h('section', { class: 'sec done-sec', 'data-k': 'today-done-sec' },
    secHead('오늘 완료', doneAll.length ? `${doneAll.length}건` : ''),
    doneAll.length ? h('div', { class: 'filter-bar', role: 'group', 'aria-label': '오늘 완료 분류' },
      tabs.map(([k, label]) => h('button', {
        type: 'button', class: `chip sm${df === k ? ' on' : ''}`, 'aria-pressed': df === k ? 'true' : 'false',
        onclick: () => { ui.doneFilter = k; render(); },
      }, label))) : null,
    visible.length
      ? [
        h('ul', { class: 'done-list' }, visible.map(doneCard)),
        moreCount > 0
          ? h('button', { type: 'button', class: 'btn sm clean-more-btn', onclick: () => { ui.showAllDone = true; render(); } }, `+ 완료된 일 ${moreCount}건 더 보기`)
          : (ui.showAllDone && shown.length > 5 ? h('button', { type: 'button', class: 'btn sm clean-more-btn', onclick: () => { ui.showAllDone = false; render(); } }, '접기') : null),
      ]
      : h('div', { class: 'empty' }, '오늘 완료된 일이 아직 없어요.'));
}

// 아침/오늘 보고 1줄 띠: AI 완료·확인 대기·막힘이 있을 때만 조용히 표시, 확인 누르면 사라짐
function morningBriefing(today) {
  const d = S.data;
  const aiDone = today.filter((t) => t.assignee !== 'jay' && t.status === '완료');
  const waiting = d.tasks.filter((t) => t.gate && !t.gateApprovedAt && t.status !== '완료' && t.assignee !== 'jay');
  const pendingAppr = d.approvals.filter((a) => a.status === '대기');
  const stuck = d.tasks.filter((t) => t.status === '막힘' && t.assignee !== 'jay');
  const total = aiDone.length + waiting.length + stuck.length + pendingAppr.length;
  if (!total) return null;
  const sig = `${S.today}:${aiDone.map((x) => x.id).join(',')}:${waiting.map((x) => x.id).join(',')}:${stuck.map((x) => x.id).join(',')}:${pendingAppr.map((x) => x.id).join(',')}`;
  try { if (localStorage.getItem('aihq_brief_ack') === sig) return null; } catch { /* ignore */ }
  const parts = [];
  if (aiDone.length) parts.push(`AI 완료 ${aiDone.length}`);
  if (waiting.length + pendingAppr.length) parts.push(`확인 대기 ${waiting.length + pendingAppr.length}`);
  if (stuck.length) parts.push(`막힘 ${stuck.length}`);
  const items = [...waiting.map((t) => ({ tag: `${t.gate} 확인`, t })), ...stuck.map((t) => ({ tag: '막힘', t })), ...aiDone.map((t) => ({ tag: '완료', t }))];
  return h('div', { class: 'briefing' },
    h('div', { class: 'briefing-bar' },
      h('div', { class: 'small' }, h('b', null, '오늘 AI 보고'), ' · ', parts.join(' · ')),
      h('div', { class: 'row' },
        items.length ? h('button', { class: 'btn sm', onclick: () => { ui.briefOpen = !ui.briefOpen; render(); } }, ui.briefOpen ? '접기' : '보기') : null,
        h('button', { class: 'btn sm dark', onclick: () => { try { localStorage.setItem('aihq_brief_ack', sig); } catch { /* ignore */ } ui.briefOpen = false; render(); } }, '확인'))),
    ui.briefOpen && items.length ? h('ul', { class: 'briefing-list' }, items.map(({ tag, t }) => h('li', { class: 'row', style: 'justify-content:space-between' },
      h('span', null, h('span', { class: 'tag', style: 'margin-right:8px' }, tag), t.title, ' ', h('span', { class: 'small muted' }, shortName(t.assignee))),
      h('button', { class: 'btn link', onclick: () => openTaskById(t.id) }, '열기')))) : null);
}

async function openDailyReport() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  setDlg(dlg, h('h3', null, '오늘의 자율 회사 리포트'), h('div', { class: 'small muted' }, '정리하는 중…'));
  dlg.showModal();
  try {
    const rep = await api('GET', '/api/ui/report/daily');
    setDlg(dlg, 
      h('h3', null, '오늘의 자율 회사 리포트'),
      h('p', { class: 'small muted', style: 'margin:-8px 0 14px' }, '매출 금액·계정 정보는 빼고 오늘 AI가 일한 숫자만 담았어요. 방송 오프닝이나 커뮤니티 인증에 바로 붙여 넣으세요.'),
      h('pre', { class: 'report-pre' }, rep.text),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); } }, '닫기'),
        h('button', { class: 'btn dark', onclick: async () => { await copyText(rep.text); toast('리포트를 복사했어요'); } }, '리포트 복사')));
  } catch {
    dlg.className = '';
    dlg.close();
  }
}

function formatApprovalOriginal(orig) {
  if (!orig) return null;
  if (typeof orig === 'string') return h('div', { class: 'orig' }, `원본 · ${orig}`);
  if (typeof orig === 'object') {
    const author = orig.author || orig.from || orig.user || '';
    const body = orig.text || orig.comment || orig.body || orig.content || orig.message || '';
    const safeUrl = typeof orig.url === 'string' && /^https?:\/\//i.test(orig.url) ? orig.url : '';
    const textLine = [author, body].filter(Boolean).join(' · ') || JSON.stringify(orig);
    return h('div', { class: 'orig' },
      h('span', null, `원본 · ${textLine}`),
      safeUrl ? h('a', { class: 'btn link', href: safeUrl, target: '_blank', rel: 'noopener noreferrer', style: 'margin-left:8px' }, '원본 보기 ↗') : null);
  }
  return h('div', { class: 'orig' }, `원본 · ${String(orig)}`);
}

function approvalInlineCard(a) {
  const hasDraft = a.draft !== null && a.draft !== undefined && a.draft !== '';
  const draftEl = hasDraft ? h('textarea', { class: 'in sm', rows: 3, 'data-k': `appr-draft-${a.id}`, 'aria-label': '보낼 초안 수정' }, a.draft) : null;
  const linkedTask = a.taskId ? S.data.tasks.find((t) => t.id === a.taskId) : null;
  const guardSvg = C.avatarSvg('sumunjang', { size: 38, state: 'working', style: 'pixel' });
  const rejecting = ui.rejectingAppr === a.id;
  const rejIn = rejecting ? h('input', { class: 'in sm', placeholder: '반려 이유 (선택)', 'data-k': `appr-rej-${a.id}`, 'aria-label': '반려 이유' }) : null;
  const submitReject = (noteVal = '') => once(`ap-r-${a.id}`, async () => {
    const clean = String(noteVal || rejIn?.value || '').trim();
    ui.rejectingAppr = null;
    const res = await act('POST', `/api/ui/approvals/${a.id}/decide`, { decision: '반려', note: clean });
    if (res) toast(clean ? `반려 완료 · "${clean}" 기준 학습됨` : '반려했어요 · 의사결정 학습 기록됨');
  });
  const submitApprove = () => once(`ap-a-${a.id}`, async () => {
    ui.rejectingAppr = null;
    triggerRoyalStampFx(a.kind || '결재');
    const res = await act('POST', `/api/ui/approvals/${a.id}/decide`, { decision: '승인', ...(draftEl ? { finalText: draftEl.value } : {}) });
    if (res) {
      const msg = res.rl?.outcome === 'edited'
        ? '도장 쾅! 승인 · 수정 스타일 AI 학습됨 (DPO)'
        : res.autoPromote?.message
          ? `도장 쾅! 승인 · ${res.autoPromote.message}`
          : '도장 쾅! 승인했어요';
      toast(msg);
    }
  });
  return h('div', { class: 'appr-inline' },
    h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
      h('div', { class: 'gate-guard', style: 'min-width:0;flex:1' },
        guardSvg,
        h('div', { style: 'min-width:0;flex:1' },
          h('div', { style: 'font-size:15px;font-weight:600' },
            a.accountName ? h('span', { class: 'tag', style: 'margin-right:8px' }, `${a.accountName}${a.accountAction ? ` · ${a.accountAction}` : ''}`) : null,
            a.what),
          h('div', { class: 'small muted', style: 'margin-top:3px' }, ['대표 승인 대기', a.kind, nameOf(a.from), linkedTask ? `할 일: ${linkedTask.title}` : '', stamp(a.requestedAt)].filter(Boolean).join(' · ')))),
      linkedTask ? h('button', { type: 'button', class: 'btn link', onclick: () => openTaskById(linkedTask.id) }, '할 일 열기') : null),
    formatApprovalOriginal(a.original),
    draftEl ? h('label', { class: 'field' }, h('span', { class: 'small muted' }, '초안'), draftEl) : null,
    rejecting ? h('div', { class: 'rl-rej-bar' },
      h('div', { class: 'picker' }, ['톤 조정 필요', '내용 부정확', '민감 · 보류'].map((tag) => h('button', {
        type: 'button', class: 'chip sm',
        onclick: () => submitReject(tag),
      }, tag))),
      h('div', { class: 'row', style: 'gap:6px;margin-top:6px' },
        h('div', { style: 'flex:1' }, rejIn),
        h('button', { type: 'button', class: 'btn sm', onclick: () => { ui.rejectingAppr = null; render(); } }, '취소'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: () => submitReject() }, '반려 확정'))) : null,
    !rejecting ? h('div', { class: 'row', style: 'justify-content:flex-end' },
      h('button', { type: 'button', class: 'btn sm', onclick: () => { ui.rejectingAppr = a.id; render(); setTimeout(() => document.querySelector(`[data-k="appr-rej-${a.id}"]`)?.focus(), 20); } }, '반려'),
      h('button', { type: 'button', class: 'btn sm stamp-trig-btn', onclick: submitApprove }, '승인')) : null);
}

// ───────── 조선 어보 · 한국식 대표 낙관 도장 ("쾅!") 결재 연출 ─────────
function koreanStampSvg(topLine = '代表', botLine = '決裁', size = 84) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, txt) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    if (txt != null) n.textContent = txt;
    return n;
  };
  const svg = el('svg', {
    viewBox: '0 0 96 96', width: size, height: size,
    class: 'kr-stamp-svg', role: 'img', 'aria-label': `한국 전통 대표 낙관 도장 ${topLine}${botLine}`,
  });
  // 전통 사각 이중 주홍 테두리 + 미세한 인주 틈새
  svg.appendChild(el('rect', { x: 5, y: 5, width: 86, height: 86, rx: 9, fill: 'rgba(200,40,32,0.06)', stroke: '#c82820', 'stroke-width': 4.5 }));
  svg.appendChild(el('rect', { x: 12, y: 12, width: 72, height: 72, rx: 5, fill: 'none', stroke: '#c82820', 'stroke-width': 1.8, 'stroke-dasharray': '18 2 24 1.5 20 2' }));
  // 미세 인주 질감 점
  for (const [cx, cy, r] of [[18, 17, 1], [77, 22, 1.2], [22, 79, 1.1], [75, 76, 1]]) {
    svg.appendChild(el('circle', { cx, cy, r, fill: '#c82820', opacity: '0.45' }));
  }
  svg.appendChild(el('text', {
    x: 48, y: 44, 'text-anchor': 'middle', fill: '#c82820',
    'font-size': '26', 'font-weight': '900', 'letter-spacing': '4',
    'font-family': '"AppleMyungjo", "Nanum Myeongjo", "Batang", Georgia, serif',
  }, topLine));
  svg.appendChild(el('text', {
    x: 48, y: 74, 'text-anchor': 'middle', fill: '#c82820',
    'font-size': '26', 'font-weight': '900', 'letter-spacing': '4',
    'font-family': '"AppleMyungjo", "Nanum Myeongjo", "Batang", Georgia, serif',
  }, botLine));
  return svg;
}

function triggerRoyalStampFx(gateLabel = '결재') {
  SND()?.play('approve');
  const existing = document.querySelector('.royal-stamp-overlay');
  if (existing) existing.remove();
  const topMap = { 결제: '決裁', 게시: '發刊', 업로드: '登錄', 발송: '發送', 삭제: '廢棄' };
  const botWord = topMap[gateLabel] || '承認';
  const ov = h('div', { class: 'royal-stamp-overlay', 'aria-hidden': 'true' },
    h('div', { class: 'royal-stamp-burst' },
      h('span', { class: 'royal-stamp-ring' }),
      h('div', { class: 'royal-stamp-seal' }, koreanStampSvg('代表', botWord, 128)),
      h('div', { class: 'royal-stamp-cap' }, `도장 쾅! · ${gateLabel} 승인 완료`)));
  document.body.appendChild(ov);
  setTimeout(() => ov.classList.add('out'), 780);
  setTimeout(() => ov.remove(), 1120);
}

function openStampApprovalModal(t) {
  const dlg = document.getElementById('dlg');
  dlg.className = 'stamp-dlg';
  const eObj = emp(t.assignee);
  const accObj = t.account ? res(t.account) : null;
  const brObj = t.browser ? res(t.browser) : null;
  const topMap = { 결제: '決裁', 게시: '發刊', 업로드: '登錄', 발송: '發送', 삭제: '廢棄' };
  const sealBot = topMap[t.gate] || '承認';
  let stamped = false;

  const docCard = h('div', { class: 'stamp-paper' });
  const sealSlot = h('div', { class: 'stamp-seal-slot' },
    h('span', { class: 'stamp-placeholder' }, '(인)'));
  const statusHint = h('div', { class: 'stamp-status-hint' }, '아래 버튼을 누르면 대표 낙관 도장이 쾅 찍히고 AI가 즉시 실행합니다.');
  const cancelBtn = h('button', { type: 'button', class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); } }, '취소');
  const canAutoForever = Boolean(t.routineId && (t.gate === '게시' || t.gate === '업로드'));
  const foreverBtn = canAutoForever
    ? h('button', { type: 'button', class: 'btn stamp-auto-btn', title: '이번 실행을 승인하고 앞으로 이 오토메이션은 게시 확인 없이 바로 실행합니다 (결제·삭제는 계속 보호)' }, '⚡ 승인 + 앞으로 바로 실행')
    : null;
  const confirmBtn = h('button', { type: 'button', class: 'btn stamp-go-btn' }, '도장 쾅! 이번만 승인');

  const doStamp = async (autoApproveRoutine = false) => {
    if (stamped) return;
    stamped = true;
    confirmBtn.disabled = true;
    if (foreverBtn) foreverBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = '어명 집행 중…';
    SND()?.play('approve');
    docCard.classList.add('is-slammed');
    sealSlot.replaceChildren(
      h('span', { class: 'stamp-ink-ring', 'aria-hidden': 'true' }),
      h('div', { class: 'stamp-mark-anim' }, koreanStampSvg('代表', sealBot, 86)));
    statusHint.className = 'stamp-status-hint is-done';
    statusHint.textContent = autoApproveRoutine
      ? `쾅! 대표 승인 완료 — 이제 이 오토메이션은 게시 확인 없이 바로 실행됩니다.`
      : `쾅! 대표 낙관 승인 완료 — ${shortName(t.assignee)} 직원이 즉시 실행에 들어갑니다.`;
    await new Promise((r) => setTimeout(r, 640));
    dlg.className = '';
    dlg.close();
    await act(
      'POST',
      `/api/ui/tasks/${t.id}/approve-gate`,
      autoApproveRoutine ? { autoApproveRoutine: true } : {},
      autoApproveRoutine ? '도장 쾅! 앞으로 이 오토메이션은 승인 없이 바로 실행돼요' : `도장 쾅! ${gateO(t.gate)} 승인했어요`,
    );
  };
  confirmBtn.addEventListener('click', () => doStamp(false));
  if (foreverBtn) foreverBtn.addEventListener('click', () => doStamp(true));

  const metaParts = [
    `${t.gate} 결재`,
    accObj ? accObj.name : '',
    brObj ? brObj.name : '',
    t.estCost ? `예산 ${won(t.estCost)}` : '',
  ].filter(Boolean);

  docCard.replaceChildren(
    h('div', { class: 'stamp-doc-top' },
      h('div', { class: 'stamp-doc-head' },
        h('div', { class: 'stamp-kicker' }, 'CONNECT AI HQ · 대표 결재서'),
        h('h3', { class: 'stamp-doc-h' }, `${t.gate} 승인 요청`),
        h('div', { class: 'stamp-meta-row' }, metaParts.map((m) => h('span', { class: 'stamp-meta-chip' }, m)))),
      h('div', { class: 'stamp-box-grid', 'aria-label': '결재란' },
        h('div', { class: 'stamp-box-col' },
          h('div', { class: 'stamp-box-th' }, '담당'),
          h('div', { class: 'stamp-box-td' },
            eObj ? avatarEl(eObj, { size: 36, stateOverride: 'working' }) : null,
            h('span', { class: 'stamp-emp-lbl' }, shortName(t.assignee)))),
        h('div', { class: 'stamp-box-col is-ceo' },
          h('div', { class: 'stamp-box-th' }, '대표 印'),
          h('div', { class: 'stamp-box-td' }, sealSlot)))),
    h('div', { class: 'stamp-doc-body' },
      h('div', { class: 'stamp-doc-lbl' }, '결재 안건'),
      h('div', { class: 'stamp-doc-title' }, t.title),
      t.note ? h('div', { class: 'stamp-doc-note' }, t.note.slice(0, 220) + (t.note.length > 220 ? '…' : '')) : null),
    statusHint,
    h('div', { class: 'stamp-doc-foot' }, cancelBtn, foreverBtn, confirmBtn));

  setDlg(dlg, docCard);
  dlg.showModal();
  confirmBtn.focus();
}

// ───────── CONNECT AI · LIVE CREW (매트 블랙 × 샴페인 골드 · K-Heritage 16비트 픽셀) ─────────

function empTeamInfo(e) {
  const teams = S.options?.teams || [];
  return teams.find((t) => t.key === e.team) || teams.find((t) => t.key === 'ops') || { key: 'ops', name: '운영 · OPS', short: '운영', code: 'OPS', color: '#38BDF8', hint: '운영 자동화' };
}

function teamSampleSprite(teamKey) {
  const map = { exec: 'sejong', dev: 'jangyeongsil', plan: 'seonbi', design: 'saimdang', marketing: 'bobusang', research: 'damo', ops: 'madangsoe' };
  return map[teamKey] || 'seonbi';
}

function openSwarmMissionModal(defaultKey = null) {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const missions = S.options?.swarmMissions || [];
  const teams = S.options?.teams || [];
  if (!missions.length) { toast('멀티 팀 프리셋을 불러오지 못했어요'); return; }
  let pickedKey = defaultKey && missions.some((m) => m.key === defaultKey) ? defaultKey : missions[0].key;
  const topicIn = h('input', { class: 'in big', placeholder: missions[0].placeholder || '실행할 주제를 적어 주세요', 'aria-label': '멀티 팀 실행 주제' });
  const cardsWrap = h('div', { class: 'mission-grid' });
  const previewWrap = h('div');

  const guessEmpForTeam = (teamKey) => {
    const pool = S.data.employees.filter((e) => (e.team || 'ops') === teamKey);
    if (pool.length) return pool.find((e) => e.runMode === 'auto') || pool[0];
    return S.data.employees.find((e) => e.runMode === 'auto') || S.data.employees[0] || null;
  };

  const renderMissionBody = () => {
    const cur = missions.find((m) => m.key === pickedKey) || missions[0];
    topicIn.placeholder = cur.placeholder || '실행할 주제를 적어 주세요';
    cardsWrap.replaceChildren(...missions.map((m) => h('button', {
      type: 'button', class: `mission-card${m.key === pickedKey ? ' on' : ''}`,
      onclick: () => { pickedKey = m.key; renderMissionBody(); },
    },
    h('div', { class: 'm-top' }, h('b', null, m.title), h('span', { class: 'tag' }, m.badge)),
    h('div', { class: 'small muted' }, m.hint),
    h('div', { class: 'mission-chain' }, m.steps.map((st, idx) => [
      C.avatarSvg(teamSampleSprite(st.team), { size: 24, state: 'working', style: 'pixel' }),
      idx < m.steps.length - 1 ? h('span', { class: 'small muted' }, m.mode === 'parallel' ? '+' : '→') : null,
    ])))));

    previewWrap.replaceChildren(
      h('div', { class: 'mission-step-list' },
        h('div', { class: 'row ms-head' },
          h('b', { class: 'ms-kicker' }, `${cur.mode === 'parallel' ? 'PARALLEL · 동시 실행' : 'RELAY · 순차 바통 터치'} · ${cur.steps.length} TEAMS`),
          h('span', { class: 'ms-hint' }, '자동 실행 AI는 즉시 가동됩니다')),
        ...cur.steps.map((st, idx) => {
          const tMeta = teams.find((t) => t.key === st.team);
          const assigned = guessEmpForTeam(st.team);
          const avKey = assigned && window.PixelCrew?.SPRITES[assigned.avatar] ? assigned.avatar : teamSampleSprite(st.team);
          return h('div', { class: 'mission-step-row' },
            h('span', { class: 'ms-num' }, String(idx + 1)),
            C.avatarSvg(avKey, { size: 30, state: 'working', style: 'pixel' }),
            h('div', { class: 'ms-body' },
              h('div', { class: 'ms-ttl' }, st.title),
              h('div', { class: 'ms-sub' }, `${tMeta?.name || st.team} · 담당: ${assigned ? shortName(assigned.id) : '대표'}`)));
        })));
  };

  renderMissionBody();
  const launch = () => once('swarm-dispatch', async () => {
    const r = await act('POST', '/api/ui/swarm/dispatch', { missionKey: pickedKey, topic: topicIn.value.trim() }, '멀티 팀 협업을 시작했어요');
    if (r) {
      closeDlg();
      if (ui.route !== 'home') location.hash = '#home';
      ui.open = r.id;
      render();
    }
  });
  topicIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) launch(); });

  setDlg(dlg,
    h('div', { class: 'swarm-kicker' }, 'CONNECT AI · SYSTEMIZATION'),
    h('h3', { class: 'coord-dlg-h' }, '멀티 팀 협업 실행'),
    h('p', { class: 'small muted coord-dlg-sub' }, '워크플로우를 고르고 주제만 적으면, 각 부서 AI 크루가 순서대로 또는 동시에 바로 가동됩니다.'),
    cardsWrap,
    h('label', { class: 'field' }, '실행 주제 (선택 · 각 팀 지시서에 자동 반영)', topicIn),
    previewWrap,
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '닫기'),
      h('button', { type: 'button', class: 'btn dark', onclick: launch }, '멀티 팀 실행')));
  dlg.showModal();
  topicIn.focus();
}

function openJoseonCodexModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const presets = (S.options?.avatarPresets || []).filter((p) => p.pack === 'joseon' || p.pack === 'k-crew');
  const groups = [
    ['대표 · 마스코트', ['som', 'sejong', 'queen', 'sumunjang']],
    ['수호신 (8)', ['haetae', 'dokkaebi', 'kkachi', 'horangi', 'cheongnyong', 'dalto', 'jangseung', 'bonghwang']],
    ['개발', ['jangyeongsil', 'cheomseong']],
    ['기획', ['seonbi', 'munin']],
    ['디자인', ['hwawon', 'saimdang', 'angyeon', 'yunbok', 'chusa']],
    ['마케팅', ['bobusang', 'yein']],
    ['리서치', ['hunter', 'damo']],
    ['운영 · 헬스', ['madangsoe', 'haengrang', 'heojun', 'daejanggeum']],
  ];
  let mode = 'working';
  const stateBar = h('div', { class: 'picker' });
  const body = h('div');

  const renderCodex = () => {
    stateBar.replaceChildren(
      ...[['working', '작업 중'], ['idle', '대기']].map(([mk, ml]) => h('button', {
        type: 'button', class: `chip sm${mode === mk ? ' on' : ''}`,
        onclick: () => { mode = mk; renderCodex(); },
      }, ml)));

    body.replaceChildren(...groups.map(([gTitle, keys]) => {
      const items = keys.map((k) => presets.find((p) => p.key === k)).filter(Boolean);
      return h('div', null,
        h('div', { class: 'codex-sec' }, gTitle),
        h('div', { class: 'codex-grid' }, items.map((p) => h('button', {
          type: 'button', class: 'codex-card',
          title: p.hint || p.name,
          onclick: () => {
            if (p.key === 'sejong' || p.key === 'queen' || p.key === 'som') {
              once('codex-royal', async () => {
                await act('PATCH', '/api/ui/settings', { ownerAvatar: p.key }, `캐릭터를 ${p.name.split(' ')[0]}(으)로 바꿨어요`);
                closeDlg();
              });
              return;
            }
            if (p.key === 'heojun' || p.key === 'daejanggeum') {
              once('codex-doc', async () => {
                await act('PATCH', '/api/ui/settings', { healthDoctor: p.key }, `헬스 캐릭터를 ${p.name.split(' ')[0]}(으)로 바꿨어요`);
                closeDlg();
              });
              return;
            }
            closeDlg();
            openAddEmployee({ pack: 'joseon', avatar: p.key, team: p.team || 'ops' });
          },
        },
        C.avatarSvg(p.key, { size: 54, state: mode, style: 'pixel' }),
        h('b', null, p.name.replace(/\s*\([^)]*\)/, ''))))));
    }));
  };

  renderCodex();
  setDlg(dlg,
    h('div', { class: 'row codex-top' },
      h('h3', { class: 'coord-dlg-h' }, '캐릭터 (29)'),
      stateBar),
    body,
    h('div', { class: 'bar' },
      h('button', {
        type: 'button', class: 'btn',
        onclick: () => once('codex-dress-all', async () => {
          await act('POST', '/api/ui/employees/avatar-style', { pack: 'joseon', avatarStyle: 'pixel', rebalanceTeams: true }, '전체 AI 직원에 적용했어요');
          closeDlg();
        }),
      }, '전체 적용'),
      h('button', { type: 'button', class: 'btn dark', onclick: closeDlg }, '닫기')));
  dlg.showModal();
}

const DEFAULT_AGENT_META = [
  { engine: 'claude', label: 'Claude', sub: 'Claude Code CLI', badge: '✦', tone: 'ag-claude' },
  { engine: 'codex', label: 'Codex', sub: 'OpenAI Codex CLI', badge: '◎', tone: 'ag-codex' },
  { engine: 'opencode', label: 'OpenCode', sub: '오픈소스 CLI', badge: '⌘', tone: 'ag-opencode' },
  { engine: 'agy', label: 'Antigravity', sub: 'Google AGY CLI', badge: '▲', tone: 'ag-agy' },
  { engine: 'gemini', label: 'Gemini CLI', sub: 'Google Gemini CLI', badge: '◆', tone: 'ag-gemini' },
];

function openCoordinatorConfigModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const d = S.data;
  const machines = d.resources.filter((r) => r.kind === '기계');
  const curMainEmp = d.employees.find((e) => e.id === d.settings?.mainAi) || null;
  let pickedType = curMainEmp && CLI_ENGINES.includes(curMainEmp.engine) && S.runners?.[curMainEmp.engine] ? 'engine' : 'emp';
  let pickedVal = pickedType === 'engine' ? curMainEmp.engine : (d.settings?.mainAi || '');
  let pickedMac = d.settings?.mainMachine || (machines.find((m) => m.isThisMac)?.id || machines[0]?.id || '');
  let autoStart = d.settings?.autoStartAdded !== false;
  let showMore = false;

  const installedCli = DEFAULT_AGENT_META.filter((m) => Boolean(S.runners?.[m.engine]));
  const localReadyEmps = d.employees.filter((e) => e.engine === 'local' && Boolean(e.model));
  const otherEmps = d.employees.filter((e) => {
    if (CLI_ENGINES.includes(e.engine) && S.runners?.[e.engine]) return false;
    if (e.engine === 'local' && Boolean(e.model)) return false;
    return true;
  });
  const uninstalledCli = DEFAULT_AGENT_META.filter((m) => !S.runners?.[m.engine]);

  if (!pickedVal) {
    if (installedCli.length) { pickedType = 'engine'; pickedVal = installedCli[0].engine; }
    else if (d.employees.length) { pickedType = 'emp'; pickedVal = d.employees[0].id; }
  }

  const agentsWrap = h('div');
  const moreWrap = h('div');
  const macWrap = h('div');

  const renderPicker = () => {
    const primaryCards = [
      ...installedCli.map((m) => {
        const linkedEmp = d.employees.find((e) => e.engine === m.engine);
        const on = pickedType === 'engine' && pickedVal === m.engine;
        return h('button', {
          type: 'button',
          class: `orca-agent-card${on ? ' on' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => { pickedType = 'engine'; pickedVal = m.engine; renderPicker(); },
        },
        h('span', { class: `orca-ic ${m.tone}`, 'aria-hidden': 'true' }, m.badge),
        h('span', { class: 'orca-agent-txt' },
          h('b', null, m.label),
          h('span', { class: 'orca-agent-sub' }, linkedEmp ? '연결됨 · 자동 실행' : '설치됨 · 클릭 시 바로 연결')),
        on ? h('span', { class: 'orca-chk', 'aria-hidden': 'true' }, '✓') : null);
      }),
      ...localReadyEmps.map((e) => {
        const on = pickedType === 'emp' && pickedVal === e.id;
        return h('button', {
          type: 'button',
          class: `orca-agent-card${on ? ' on' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => { pickedType = 'emp'; pickedVal = e.id; renderPicker(); },
        },
        h('span', { class: 'orca-ic ag-local', 'aria-hidden': 'true' }, '◈'),
        h('span', { class: 'orca-agent-txt' },
          h('b', null, shortName(e.id)),
          h('span', { class: 'orca-agent-sub' }, `로컬 모델 · ${e.model.replace(/^(ollama|lmstudio):/, '')}`)),
        on ? h('span', { class: 'orca-chk', 'aria-hidden': 'true' }, '✓') : null);
      }),
    ];

    agentsWrap.replaceChildren(
      h('div', { class: 'orca-sec-meta' },
        h('span', null, '이 맥에서 바로 실행 가능한 에이전트'),
        h('span', { class: 'orca-count' }, String(primaryCards.length))),
      primaryCards.length
        ? h('div', { class: 'orca-grid' }, primaryCards)
        : h('div', { class: 'skill-empty' }, '설치된 CLI 에이전트를 찾지 못했어요. 아래 "다른 AI 더 보기"에서 웹 AI를 선택하거나 Claude/Codex를 설치해 주세요.'));

    const moreTotal = otherEmps.length + uninstalledCli.length;
    const moreKids = [];
    if (moreTotal) {
      moreKids.push(h('button', {
        type: 'button', class: 'orca-more-btn',
        onclick: () => { showMore = !showMore; renderPicker(); },
      }, showMore ? '다른 AI 접기 ↑' : `다른 AI ${moreTotal}개 더 보기 →`));
    }
    if (showMore) {
      moreKids.push(h('div', { class: 'orca-grid orca-more-grid' },
        ...otherEmps.map((e) => {
          const on = pickedType === 'emp' && pickedVal === e.id;
          return h('button', {
            type: 'button',
            class: `orca-agent-card muted-card${on ? ' on' : ''}`,
            'aria-pressed': on ? 'true' : 'false',
            onclick: () => { pickedType = 'emp'; pickedVal = e.id; renderPicker(); },
          },
          h('span', { class: 'orca-ic ag-other', 'aria-hidden': 'true' }, '·'),
          h('span', { class: 'orca-agent-txt' },
            h('b', null, shortName(e.id)),
            h('span', { class: 'orca-agent-sub' }, `${empTeamInfo(e).short} · 미연결(수동)`)),
          on ? h('span', { class: 'orca-chk', 'aria-hidden': 'true' }, '✓') : null);
        }),
        ...uninstalledCli.map((m) => h('div', { class: 'orca-agent-card disabled-card' },
          h('span', { class: `orca-ic ${m.tone}`, 'aria-hidden': 'true' }, m.badge),
          h('span', { class: 'orca-agent-txt' },
            h('b', null, m.label),
            h('span', { class: 'orca-agent-sub' }, '이 맥에 미설치'))))));
    }
    moreWrap.replaceChildren(...moreKids);

    macWrap.replaceChildren(
      h('div', { class: 'orca-sec-meta coord-dlg-gap' },
        h('span', null, '메인 본사 컴퓨터 (RAM 85% 초과 시 자동 우회)'),
        h('span', { class: 'orca-count' }, String(machines.length))),
      h('div', { class: 'orca-grid' }, machines.map((m) => {
        const mh = S.machineHealth?.[m.id];
        const ram = typeof mh?.ramPct === 'number' ? `RAM ${mh.ramPct}%` : (m.isThisMac ? '이 컴퓨터' : '사무실');
        const on = pickedMac === m.id;
        return h('button', {
          type: 'button',
          class: `orca-agent-card${on ? ' on' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => { pickedMac = m.id; renderPicker(); },
        },
        h('span', { class: 'orca-ic ag-mac', 'aria-hidden': 'true' }, '⌘'),
        h('span', { class: 'orca-agent-txt' },
          h('b', null, m.name),
          h('span', { class: 'orca-agent-sub' }, `${m.isThisMac ? '이 컴퓨터 · ' : ''}${ram}`)),
        on ? h('span', { class: 'orca-chk', 'aria-hidden': 'true' }, '✓') : null);
      })));
  };

  renderPicker();

  const autoChk = h('input', {
    type: 'checkbox', checked: autoStart, 'aria-label': '즉시 자동 실행',
    onchange: (ev) => { autoStart = ev.target.checked; },
  });
  const save = () => once('coord-cfg', async () => {
    const payload = {
      mainMachine: pickedMac || null,
      autoStartAdded: autoStart,
    };
    if (pickedType === 'engine' && pickedVal) payload.defaultEngine = pickedVal;
    else payload.mainAi = pickedVal || null;
    const r = await act('PATCH', '/api/ui/settings', payload, '기본 에이전트와 메인 컴퓨터를 저장했어요');
    if (r) { closeDlg(); render(); }
  });

  setDlg(dlg,
    h('div', { class: 'swarm-kicker' }, 'CONNECT AI · DEFAULT AGENT'),
    h('h3', { class: 'coord-dlg-h' }, '기본 에이전트 (메인 AI) 선택'),
    h('p', { class: 'small muted coord-dlg-sub' }, '할 일을 적고 Enter만 누르면 선택한 기본 에이전트를 중심으로 자동 배분·실행합니다. 언제든 상단 바에서 바꿀 수 있어요.'),
    agentsWrap,
    moreWrap,
    macWrap,
    h('div', { class: 'orca-toggle-row' },
      h('div', { class: 'orca-toggle-txt' },
        h('b', null, '즉시 자동 실행'),
        h('div', { class: 'small muted' }, '할 일을 입력하고 Enter를 누르면 기본 에이전트가 바로 착수합니다. 결제·업로드·게시·삭제·메시지 발송은 대표 승인 전 항상 정지됩니다.')),
      h('label', { class: 'switch' }, autoChk, h('span', { class: 'tr' }))),
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '취소'),
      h('button', { type: 'button', class: 'btn dark', onclick: save }, '기본 에이전트 적용')));
  dlg.showModal();
}

// ───────── 집현전 집무실 · 살아 움직이는 16비트 픽셀 AI 오피스 무대 ─────────
const HANOK_DESKS = [
  { x: 23.2, y: 74.5 },
  { x: 36.6, y: 74.5 },
  { x: 50.0, y: 74.5 },
  { x: 63.4, y: 74.5 },
  { x: 76.6, y: 74.5 },
];
const HANOK_IDLE_SPOTS = [
  { x: 14.5, y: 94.0, line: '달빛 창호지 앞' },
  { x: 24.0, y: 96.0, line: '서안 점검 중' },
  { x: 35.5, y: 94.5, line: '차 한 잔 대기' },
  { x: 47.0, y: 96.5, line: '어명 대기 중' },
  { x: 58.5, y: 94.5, line: '에헴! 이상 무' },
  { x: 70.5, y: 96.0, line: '문서 정리 중' },
  { x: 83.5, y: 94.0, line: '규장각 서고 열람' },
];
const HANOK_SIM = {
  actors: new Map(),
  timer: null,
};

function hanokClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hanokPickTarget(actorId, allActors) {
  const spots = [...HANOK_IDLE_SPOTS].sort(() => Math.random() - 0.5);
  for (const sp of spots) {
    const jitterX = hanokClamp(sp.x + (Math.random() - 0.5) * 7, 13, 86);
    const jitterY = hanokClamp(sp.y + (Math.random() - 0.5) * 2.2, 92, 97.5);
    let crowded = false;
    for (const [id, other] of allActors.entries()) {
      if (id === actorId || other.mode === 'work') continue;
      if (Math.abs((other.tx ?? other.x) - jitterX) < 7.5) { crowded = true; break; }
    }
    if (!crowded) return { x: jitterX, y: jitterY, line: sp.line };
  }
  return { x: 18 + Math.random() * 64, y: 87 + Math.random() * 7, line: '어명 대기 중' };
}

function syncHanokActorVisual(el, actor) {
  el.style.left = `${actor.x.toFixed(2)}%`;
  el.style.top = `${actor.y.toFixed(2)}%`;
  el.style.zIndex = String(Math.round(actor.y));
  const moving = actor.moving && actor.mode !== 'cool';
  el.classList.toggle('is-walking', moving);
  el.classList.toggle('is-seated', actor.mode === 'work' && !actor.moving);
  const spriteBox = el.querySelector('.hanok-sprite-box');
  if (spriteBox) spriteBox.classList.toggle('is-flip', actor.facing < 0);
  const bub = el.querySelector('.hanok-bubble');
  if (bub && actor.mode === 'idle') {
    const show = Boolean(actor.bubble && Date.now() < actor.bubbleUntil);
    bub.classList.toggle('is-shown', show);
    if (show && bub.textContent !== actor.bubble) bub.textContent = actor.bubble;
  }
}

function ensureHanokSimLoop() {
  if (HANOK_SIM.timer) return;
  HANOK_SIM.timer = setInterval(() => {
    const stage = document.querySelector('.hanok-stage');
    if (!stage || !stage.isConnected) {
      clearInterval(HANOK_SIM.timer);
      HANOK_SIM.timer = null;
      return;
    }
    const now = Date.now();
    const nodes = stage.querySelectorAll('.hanok-actor[data-emp]');
    let ambientShown = 0;
    for (const a of HANOK_SIM.actors.values()) {
      if (a.mode === 'idle' && a.bubble && now < a.bubbleUntil) ambientShown++;
    }
    for (const el of nodes) {
      const id = el.getAttribute('data-emp');
      const actor = HANOK_SIM.actors.get(id);
      if (!actor) continue;
      const dx = actor.tx - actor.x;
      const dy = actor.ty - actor.y;
      const dist = Math.hypot(dx, dy);
      const speed = actor.mode === 'work' ? 1.15 : actor.mode === 'approve' ? 0.85 : 0.42;
      if (dist > speed) {
        actor.x += (dx / dist) * speed;
        actor.y += (dy / dist) * speed;
        if (Math.abs(dx) > 0.15) actor.facing = dx < 0 ? -1 : 1;
        actor.moving = true;
      } else {
        actor.x = actor.tx;
        actor.y = actor.ty;
        actor.moving = false;
        if (actor.mode === 'idle' && now >= actor.pauseUntil) {
          if (actor.justArrived) {
            actor.justArrived = false;
            actor.pauseUntil = now + 2600 + Math.random() * 3400;
            if (ambientShown < 2 && Math.random() < 0.42) {
              actor.bubble = actor.spotLine || '어명 대기 중';
              actor.bubbleUntil = now + 2600;
              ambientShown++;
            }
          } else {
            const next = hanokPickTarget(id, HANOK_SIM.actors);
            actor.tx = next.x;
            actor.ty = next.y;
            actor.spotLine = next.line;
            actor.justArrived = true;
          }
        }
      }
      syncHanokActorVisual(el, actor);
    }
  }, 110);
}

function buildHanokOfficeStage(emps, selEmp) {
  const d = S.data;
  const px = window.PixelCrew;
  const voiceOn = d.settings?.joseonVoice !== false;
  const pendingGatesByEmp = new Map();
  for (const t of (d.tasks || [])) {
    if (t.gate && !t.gateApprovedAt && t.status !== '완료' && t.assignee && t.assignee !== 'jay') {
      if (!pendingGatesByEmp.has(t.assignee)) pendingGatesByEmp.set(t.assignee, t);
    }
  }
  const activeDesks = new Set();
  const now = Date.now();
  const list = emps.slice(0, 8);

  const workingEmps = list.filter((e) => isWorking(e.id));
  const deskMap = new Map();
  workingEmps.forEach((e, idx) => {
    const slot = idx % HANOK_DESKS.length;
    deskMap.set(e.id, slot);
    activeDesks.add(slot);
  });

  const actorNodes = list.map((e, idx) => {
    const wJob = S.working.find((w) => w.emp === e.id) || null;
    const gateTask = !wJob ? (pendingGatesByEmp.get(e.id) || null) : null;
    const cooling = !wJob && isEmpCooling(e);
    const mode = wJob ? 'work' : gateTask ? 'approve' : cooling ? 'cool' : 'idle';

    let actor = HANOK_SIM.actors.get(e.id);
    if (!actor) {
      const spreadX = list.length <= 1 ? 50 : 17 + (idx / Math.max(1, list.length - 1)) * 66;
      const spreadY = 93.5 + (idx % 2) * 3.0;
      actor = {
        x: spreadX, y: spreadY, tx: spreadX, ty: spreadY,
        facing: idx % 2 === 0 ? 1 : -1,
        mode, moving: false, justArrived: false,
        pauseUntil: now + 900 + idx * 700,
        bubble: '', bubbleUntil: 0, spotLine: HANOK_IDLE_SPOTS[idx % HANOK_IDLE_SPOTS.length].line,
      };
      HANOK_SIM.actors.set(e.id, actor);
    }

    const prevMode = actor.mode;
    actor.mode = mode;
    if (mode === 'work') {
      const slot = deskMap.get(e.id) ?? (idx % HANOK_DESKS.length);
      actor.deskIdx = slot;
      actor.tx = HANOK_DESKS[slot].x;
      actor.ty = HANOK_DESKS[slot].y;
    } else if (mode === 'approve') {
      actor.tx = 44 + (idx % 3) * 6;
      actor.ty = 91;
    } else if (mode === 'cool') {
      actor.tx = idx % 2 === 0 ? 15.5 : 83.5;
      actor.ty = 89;
    } else if (prevMode !== 'idle') {
      const next = hanokPickTarget(e.id, HANOK_SIM.actors);
      actor.tx = next.x;
      actor.ty = next.y;
      actor.spotLine = next.line;
      actor.justArrived = true;
    }

    const spriteState = mode === 'work' ? 'working' : mode === 'cool' ? 'cooling' : 'walking';
    const spriteKey = px?.isJoseonKey(e.avatar) ? e.avatar : 'seonbi';
    const spriteVisual = e.avatarImage
      ? h('img', { src: e.avatarImage, alt: shortName(e.id), width: 42, height: 42, class: 'hanok-photo-av' })
      : px?.renderSvg(spriteKey, { size: 54, state: spriteState, showZ: mode === 'cool', transparent: true });

    const liveText = mode === 'work'
      ? `⚡ ${(wJob.statusLine || wJob.title || '집무 중').slice(0, 26)}`
      : mode === 'approve'
        ? `印 ${gateTask.gate} 결재 대기`
        : mode === 'cool'
          ? `💤 휴식 ${empCooldownMin(e)}m`
          : (actor.bubble && now < actor.bubbleUntil ? actor.bubble : '');
    const bubbleShown = Boolean(mode === 'work' || mode === 'approve' || mode === 'cool' || liveText);
    const isSel = Boolean(selEmp && selEmp.id === e.id);

    const btn = h('button', {
      type: 'button',
      class: `hanok-actor mode-${mode}${isSel ? ' is-sel' : ''}${actor.moving ? ' is-walking' : ''}${mode === 'work' && !actor.moving ? ' is-seated' : ''}`,
      'data-emp': e.id,
      title: mode === 'work'
        ? `${shortName(e.id)} 집무 중 · 클릭해 실시간 로그 열기`
        : mode === 'approve'
          ? `${shortName(e.id)} · ${gateTask.gate} 결재 대기 — 클릭해 도장 결재서 열기`
          : `${shortName(e.id)} · 클릭해 선택`,
      onclick: () => {
        if (mode === 'work' && wJob?.taskId) {
          openTaskById(wJob.taskId);
        } else if (mode === 'approve' && gateTask) {
          openStampApprovalModal(gateTask);
        } else {
          ui.swarmSelected = e.id;
          if (ui.route === 'home') ui.taskPick = e.id;
          actor.bubble = voiceOn ? '부르셨사옵니까?' : '무엇을 도와드릴까요?';
          actor.bubbleUntil = Date.now() + 2500;
          actor.pauseUntil = Date.now() + 2600;
          render();
        }
      },
    },
    h('span', { class: `hanok-bubble${bubbleShown ? ' is-shown' : ''}${mode === 'work' ? ' is-live' : mode === 'approve' ? ' is-seal' : ''}` }, liveText),
    h('span', { class: `hanok-sprite-box${actor.facing < 0 ? ' is-flip' : ''}` }, spriteVisual),
    h('span', { class: 'hanok-shadow', 'aria-hidden': 'true' }),
    h('span', { class: 'hanok-name' },
      h('i', { class: `hanok-st-dot st-${mode}` }),
      shortName(e.id)));

    btn.style.left = `${actor.x.toFixed(2)}%`;
    btn.style.top = `${actor.y.toFixed(2)}%`;
    btn.style.zIndex = String(Math.round(actor.y));
    return btn;
  });

  const deskGlows = HANOK_DESKS.map((dk, i) => {
    const g = h('span', { class: `hanok-desk-glow${activeDesks.has(i) ? ' is-active' : ''}`, 'aria-hidden': 'true' });
    g.style.left = `${dk.x}%`;
    g.style.top = `${dk.y - 6}%`;
    return g;
  });

  const lanternPositions = [21.5, 42.8, 58.2, 79.1];
  const lanternGlows = lanternPositions.map((lx, i) => {
    const lg = h('span', { class: `hanok-lantern-glow l-${i}`, 'aria-hidden': 'true' });
    lg.style.left = `${lx}%`;
    return lg;
  });

  const workCnt = workingEmps.length;
  const gateCnt = pendingGatesByEmp.size;
  const statusBadgeText = workCnt
    ? `${workCnt}명 작업 중`
    : gateCnt
      ? `승인 대기 ${gateCnt}건`
      : `${list.length}명 대기`;

  const stageEl = h('div', { class: 'hanok-stage', 'aria-label': 'AI 오피스 무대' },
    h('div', { class: 'hanok-stage-top' },
      h('span', { class: `hanok-pill${workCnt ? ' is-live' : ''}` },
        h('i', { class: `hanok-dot${workCnt ? ' is-live' : ''}` }),
        'LIVE'),
      h('div', { class: 'hanok-stage-right' },
        h('span', { class: 'hanok-pill is-sub' }, statusBadgeText),
        h('button', {
          type: 'button', class: 'hanok-hide-btn', title: '접기',
          onclick: () => {
            ui.hanokStage = false;
            try { localStorage.setItem('aihq_hanok_stage', '0'); } catch { /* ignore */ }
            render();
          },
        }, '접기'))),
    ...lanternGlows,
    ...deskGlows,
    ...actorNodes);

  setTimeout(ensureHanokSimLoop, 30);
  return stageEl;
}

function joseonSwarmPanel() {
  const d = S.data;
  if (!d.employees.length) return null;
  const teams = S.options?.teams || [];
  const px = window.PixelCrew;
  const isJoseonMode = d.employees.some((e) => px?.isJoseonKey(e.avatar));
  const teamFilter = ui.swarmTeam || 'all';
  const filtered = teamFilter === 'all' ? d.employees : d.employees.filter((e) => (e.team || 'ops') === teamFilter);
  const visible = teamFilter === 'all' ? d.employees : filtered;
  const selEmp = ui.swarmSelected && ui.swarmSelected !== 'all' ? d.employees.find((e) => e.id === ui.swarmSelected) : null;
  const royalOrder = ['sejong', 'som', 'queen'];
  const ownerAv = royalOrder.includes(d.settings?.ownerAvatar) ? d.settings.ownerAvatar : 'sejong';
  const nextOwnerAv = royalOrder[(royalOrder.indexOf(ownerAv) + 1) % royalOrder.length];
  const ownerLabels = { sejong: '세종대왕', som: '솜이', queen: '소헌왕후' };
  const workingCount = S.working.length;
  const activeTeamMeta = teams.find((t) => t.key === teamFilter);

  const assignTo = (empObj) => {
    ui.taskPick = empObj.id;
    if (ui.route !== 'home') {
      location.hash = '#home';
      setTimeout(() => document.querySelector('[data-k="add-title"]')?.focus(), 80);
    } else {
      render();
      setTimeout(() => document.querySelector('[data-k="add-title"]')?.focus(), 20);
    }
    toast(`${shortName(empObj.id)}에게 맡길 일을 적어 주세요`);
  };

  // 1. 상단 부서 필터 탭 + CONNECT AI 액션
  const teamTabs = [
    h('button', {
      type: 'button', class: `swarm-tab${teamFilter === 'all' ? ' on' : ''}`,
      onclick: () => { ui.swarmTeam = 'all'; ui.swarmSelected = 'all'; render(); },
    }, workingCount ? h('span', { class: 'st-live' }) : null, `ALL (${d.employees.length})`),
    ...teams.filter((t) => t.key !== 'exec' && (teamFilter === t.key || d.employees.some((e) => (e.team || 'ops') === t.key))).map((t) => {
      const members = d.employees.filter((e) => (e.team || 'ops') === t.key);
      const anyWork = members.some((e) => isWorking(e.id));
      return h('button', {
        type: 'button', class: `swarm-tab tm-${t.key}${teamFilter === t.key ? ' on' : ''}${members.length ? '' : ' empty-team'}`,
        title: `${t.name} · ${t.hint}`,
        onclick: () => { ui.swarmTeam = t.key; ui.swarmSelected = members.length === 1 ? members[0].id : 'all'; render(); },
      }, anyWork ? h('span', { class: 'st-live' }) : h('span', { class: 'st-dot' }), `${t.short} ${members.length}`);
    }),
  ];

  const voiceOn = d.settings?.joseonVoice !== false;
  const cliOn = Boolean(ui.cliMonitor);
  const topActions = h('div', { class: 'swarm-actions' },
    h('button', { type: 'button', class: 'swarm-btn gold', onclick: () => openSwarmMissionModal() }, '멀티 팀 실행'),
    h('button', {
      type: 'button', class: `swarm-btn${cliOn ? ' voice-on' : workingCount ? ' is-cli-live' : ''}`,
      title: 'ORCA 스타일 분할 CLI 모니터 열기/닫기',
      onclick: () => { ui.cliMonitor = !ui.cliMonitor; render(); },
    }, cliOn ? 'CLI ON' : (workingCount ? `● CLI (${workingCount})` : 'CLI')),
    h('button', {
      type: 'button', class: `swarm-btn${ui.hanokStage ? ' voice-on' : ''}`,
      title: '한옥 집현전 집무실에서 AI 직원들이 움직이며 일하는 무대 ON/OFF',
      onclick: () => {
        ui.hanokStage = !ui.hanokStage;
        try { localStorage.setItem('aihq_hanok_stage', ui.hanokStage ? '1' : '0'); } catch { /* ignore */ }
        render();
      },
    }, ui.hanokStage ? '오피스 ON' : '오피스 OFF'),
    h('button', {
      type: 'button', class: `swarm-btn${voiceOn ? ' voice-on' : ''}`,
      title: '사극 말투 ON/OFF',
      onclick: () => once('toggle-voice', () => act('PATCH', '/api/ui/settings', { joseonVoice: !voiceOn }, !voiceOn ? '사극 말투를 켰어요' : '기본 말투로 바꿨어요')),
    }, voiceOn ? '말투 ON' : '말투 OFF'),
    h('button', { type: 'button', class: 'swarm-btn', onclick: openJoseonCodexModal }, '캐릭터 (29)'),
    !isJoseonMode
      ? h('button', {
        type: 'button', class: 'swarm-btn',
        title: '전체 AI 직원에게 한국 16비트 픽셀 크루를 적용합니다',
        onclick: () => once('dress-joseon', () => act('POST', '/api/ui/employees/avatar-style', { pack: 'joseon', avatarStyle: 'pixel', rebalanceTeams: true }, '한국 픽셀 크루를 적용했어요')),
      }, 'K-픽셀 적용')
      : null);

  const isEmpLinked = (e) => {
    if (!e || e.runMode === 'off') return false;
    if (CLI_ENGINES.includes(e.engine)) return Boolean(S.runners?.[e.engine]);
    if (e.engine === 'local') return Boolean(e.model);
    return false;
  };
  const linkedEmps = d.employees.filter(isEmpLinked);

  // 2. 중앙 스포트라이트 (Coordinator OR 선택한 AI 직원)
  let heroNode;
  if (!selEmp) {
    const ownerName = d.owner?.name ? `${d.owner.name} · Coordinator` : 'THE FOUNDER · Coordinator';
    const anyWork = workingCount > 0;
    const teamPick = activeTeamMeta ? (visible.find(isEmpLinked) || visible[0]) : null;
    const heroSprite = activeTeamMeta ? teamSampleSprite(activeTeamMeta.key) : ownerAv;
    const mainAiEmp = (d.settings?.mainAi && d.employees.find((e) => e.id === d.settings.mainAi)) || linkedEmps[0] || d.employees[0];
    const mainMacObj = (d.settings?.mainMachine && d.resources.find((r) => r.id === d.settings.mainMachine && r.kind === '기계')) || d.resources.find((r) => r.kind === '기계' && r.isThisMac) || d.resources.find((r) => r.kind === '기계');
    const mainRam = mainMacObj && S.machineHealth?.[mainMacObj.id]?.ramPct != null ? ` · RAM ${S.machineHealth[mainMacObj.id].ramPct}%` : '';
    heroNode = h('div', { class: 'swarm-hero' },
      h('button', {
        type: 'button', class: 'swarm-hero-av',
        title: activeTeamMeta ? `${activeTeamMeta.name} — 클릭해 크루 에디션 열기` : `클릭해 Coordinator 캐릭터 전환 (${ownerLabels[ownerAv]} → ${ownerLabels[nextOwnerAv]})`,
        onclick: () => activeTeamMeta ? openJoseonCodexModal() : once('flip-royal', () => act('PATCH', '/api/ui/settings', { ownerAvatar: nextOwnerAv }, `Coordinator를 ${ownerLabels[nextOwnerAv]}(으)로 전환했어요`)),
      }, C.avatarSvg(heroSprite, { size: 62, state: anyWork ? 'working' : 'idle', style: 'pixel' })),
      h('div', { class: 'swarm-hero-info' },
        h('div', { class: 'swarm-kicker' }, activeTeamMeta ? `CONNECT AI · ${activeTeamMeta.code || activeTeamMeta.short}` : 'CONNECT AI · LIVE CREW'),
        h('div', { class: 'swarm-hero-title' },
          activeTeamMeta ? activeTeamMeta.name : ownerName,
          h('span', { class: `swarm-pill${anyWork ? ' live' : ' gold'}` }, anyWork ? `ACTIVE · ${workingCount} / ${d.employees.length}` : `실행 연결 ${linkedEmps.length} / ${d.employees.length}`)),
        activeTeamMeta
          ? h('div', { class: 'swarm-hero-sub' }, activeTeamMeta.hint)
          : [
            h('div', { class: 'swarm-brain-bar' },
              h('button', { type: 'button', class: 'swarm-brain-pill', title: '클릭해 메인 AI 및 메인 컴퓨터 변경', onclick: openCoordinatorConfigModal },
                '메인 AI ', h('b', null, mainAiEmp ? shortName(mainAiEmp.id) : '미지정'), ' ▾'),
              mainMacObj ? h('button', { type: 'button', class: 'swarm-brain-pill', title: '클릭해 메인 컴퓨터 변경 (RAM 85% 초과 시 자동 우회)', onclick: openCoordinatorConfigModal },
                '메인 컴퓨터 ', h('b', null, mainMacObj.name), mainRam, ' ▾') : null,
              S.egoProbe?.installed ? h('button', {
                type: 'button',
                class: `swarm-brain-pill${S.egoProbe.connected ? ' is-live' : ''}`,
                title: `${S.egoProbe.reason || 'Ego Lite 상태'} — 클릭해 지금 접속 다시 확인`,
                onclick: () => once('probe-ego-hero', async () => {
                  const resP = await api('GET', '/api/ui/browsers/probe');
                  if (resP?.ego) {
                    S.egoProbe = resP.ego;
                    toast(resP.ego.connected ? `Ego Lite 실시간 연결됨 (스페이스 ${resP.ego.spaces}개)` : (resP.ego.reason || 'Ego Lite 앱이 꺼져 있어요'), { kind: resP.ego.connected ? 'connect' : 'handoff' });
                    render();
                  }
                }),
              }, h('i', { class: `ego-live-dot${S.egoProbe.connected ? ' on' : ''}` }), 'Ego Lite ', h('b', null, S.egoProbe.connected ? '연결됨' : '대기')) : null,
              h('button', {
                type: 'button', class: 'swarm-brain-pill', title: '내 지식 · RAG 열기',
                onclick: () => { ui.resTab = 'knowledge'; location.hash = '#resources'; },
              }, '지식 · RAG ', h('b', null, String((d.knowledge || []).length + (d.ragSources || []).length)))),
            !linkedEmps.length ? h('div', { class: 'swarm-hero-sub' }, 'AI 직원 탭에서 실행할 AI를 연결해 주세요') : null,
          ]),
      h('div', { class: 'swarm-hero-acts' },
        activeTeamMeta && !visible.length
          ? h('button', { type: 'button', class: 'swarm-btn gold', onclick: () => openAddEmployee({ pack: 'joseon', team: activeTeamMeta.key, avatar: teamSampleSprite(activeTeamMeta.key) }) }, `+ ${activeTeamMeta.short}팀 추가`)
          : teamPick
            ? h('button', { type: 'button', class: 'swarm-btn gold', onclick: () => assignTo(teamPick) }, `${activeTeamMeta.short}팀에 맡기기 →`)
            : null));
  } else {
    const working = isWorking(selEmp.id);
    const linked = isEmpLinked(selEmp);
    const cooling = isEmpCooling(selEmp);
    const wJob = S.working.find((w) => w.emp === selEmp.id);
    const wTask = wJob ? d.tasks.find((t) => t.id === wJob.taskId) : null;
    const tInfo = empTeamInfo(selEmp);
    const preset = (S.options?.avatarPresets || []).find((p) => p.key === selEmp.avatar);
    heroNode = h('div', { class: 'swarm-hero' },
      h('button', {
        type: 'button', class: 'swarm-hero-av', title: '클릭해 캐릭터 · 팀 설정',
        onclick: () => openAvatarModal(selEmp, { tab: isJoseonMode ? 'joseon' : undefined }),
      }, avatarEl(selEmp, { size: 62, onDark: true })),
      h('div', { class: 'swarm-hero-info' },
        h('div', { class: 'swarm-kicker' }, `CONNECT AI · ${tInfo.code || tInfo.short}`),
        h('div', { class: 'swarm-hero-title' },
          `@${shortName(selEmp.id)}`,
          h('span', { class: `swarm-pill team-tag tm-${tInfo.key}` }, tInfo.name),
          h('span', { class: `swarm-pill${working ? ' live' : linked ? ' ready' : ' unlinked'}` },
            working ? 'ACTIVE' : cooling ? `COOLDOWN ${empCooldownMin(selEmp)}m` : linked ? '연결됨 · 자동 실행' : '미연결 · 수동')),
        h('div', { class: 'swarm-hero-sub' }, working && wTask
          ? `진행 중: ${wTask.title}`
          : [preset?.name, selEmp.role].filter(Boolean).join(' · ') || '클릭해서 바로 일을 맡겨 보세요'),
        skillPillsEl(selEmp, { onDark: true, max: 4 })),
      h('div', { class: 'swarm-hero-acts' },
        h('button', { type: 'button', class: 'swarm-btn gold', onclick: () => assignTo(selEmp) }, '일 맡기기'),
        h('button', { type: 'button', class: 'swarm-btn', onclick: () => openEmployeeSkillsModal(selEmp.id) }, '스킬 · GitHub'),
        h('button', { type: 'button', class: 'swarm-btn', onclick: () => openAvatarModal(selEmp, { tab: 'joseon' }) }, '캐릭터 · 팀')));
  }

  // 3. 하단 워커 타일 스트립 (All 3인 클러스터 + 팀 AI 직원들)
  const clusterKeys = (visible.length ? visible : d.employees).slice(0, 3).map((e) => (px?.SPRITES[e.avatar] ? e.avatar : 'seonbi'));
  const allItem = h('div', { class: `swarm-item${!selEmp ? ' on' : ''}` },
    h('button', {
      type: 'button', class: `swarm-tile${!selEmp ? ' on' : ''}`, title: '전체 보기 (Coordinator · 자동 배분)',
      onclick: () => { ui.swarmSelected = 'all'; if (ui.route === 'home') ui.taskPick = 'auto'; render(); },
    }, C.swarmAllSvg(clusterKeys, { size: 48 })),
    h('span', { class: 'swarm-lbl' }, 'All'));

  const workerItems = visible.map((e) => {
    const q = empQuotaInfo(e);
    const working = q.working;
    const on = selEmp && selEmp.id === e.id;
    const tInfo = empTeamInfo(e);
    const tileVisual = e.avatarImage
      ? h('img', { src: e.avatarImage, alt: shortName(e.id), width: 48, height: 48, class: 'swarm-av-img' })
      : (px?.SPRITES[e.avatar] || e.avatarStyle === 'pixel'
        ? C.avatarSvg(e.avatar, { size: 48, state: working ? 'working' : (q.cooling ? 'cooling' : 'idle'), style: 'pixel' })
        : avatarEl(e, { size: 48, onDark: true }));
    const fuelPct = q.unlimited ? 100 : (q.pctRemain !== null ? q.pctRemain : (q.linked ? 100 : 0));
    const fuelTone = working ? 'live' : q.level;
    const fuelTxt = working
      ? `⚡ ${fmtElapsedSec(q.job?.elapsedSec)}`
      : q.remainShort;
    const titleHint = working
      ? `${shortName(e.id)} · 지금 일하는 중 (${fmtElapsedSec(q.job?.elapsedSec)}) · ${q.job?.title || ''}`
      : `${shortName(e.id)} (${tInfo.name}) · ${q.unlimited ? '무제한 로컬' : q.pctRemain !== null ? `잔여 ${q.pctRemain}%${q.resetLong ? ` · ${q.resetLong}` : ''}` : q.source} — 클릭해 선택`;
    return h('div', { class: `swarm-item tm-${tInfo.key}${on ? ' on' : ''}${working ? ' is-working' : ''}` },
      h('button', {
        type: 'button', class: `swarm-tile${on ? ' on' : ''}${working ? ' is-working' : ''}`,
        title: titleHint,
        onclick: () => {
          ui.swarmSelected = e.id;
          if (ui.route === 'home') ui.taskPick = e.id;
          render();
        },
      },
      tileVisual,
      working ? h('i', { class: 'sw-dot', title: '가동 중' }) : null,
      h('i', { class: 'sw-team' })),
      h('span', { class: 'swarm-lbl' }, `@${shortName(e.id)}`),
      h('div', { class: `swarm-fuel lv-${fuelTone}`, title: titleHint },
        h('div', { class: 'swarm-fuel-track' }, h('i', { class: 'swarm-fuel-fill', style: `width:${fuelPct}%` })),
        h('span', { class: 'swarm-fuel-txt', 'data-live-since': working && q.job?.since ? q.job.since : null, 'data-live-prefix': working ? '⚡ ' : null }, fuelTxt)));
  });

  const addTile = h('div', { class: 'swarm-item' },
    h('button', {
      type: 'button', class: 'swarm-tile add-tile',
      title: '새 AI 직원 추가',
      onclick: () => openAddEmployee(activeTeamMeta ? { pack: 'joseon', team: activeTeamMeta.key, avatar: teamSampleSprite(activeTeamMeta.key) } : undefined),
    }, '+'),
    h('span', { class: 'swarm-lbl' }, '추가'));

  // 하단 1줄 실시간 운영 티커 (지금 움직이는 AI · 멤버십 최상 여유 · 컴퓨터 잔여량)
  const allQuotas = d.employees.map(empQuotaInfo);
  const hotQuotas = allQuotas.filter((q) => q.level === 'hot');
  const bestCloud = allQuotas
    .filter((q) => !q.unlimited && q.linked && q.pctRemain !== null && q.pctRemain > 15)
    .sort((a, b) => (b.pctRemain ?? 0) - (a.pctRemain ?? 0))[0] || null;
  const machines = d.resources.filter((r) => r.kind === '기계');
  const mainMacObj2 = (d.settings?.mainMachine && machines.find((r) => r.id === d.settings.mainMachine)) || machines.find((r) => r.isThisMac) || machines[0] || null;
  const mainMh = mainMacObj2 ? S.machineHealth?.[mainMacObj2.id] : null;
  const ramAvail2 = typeof mainMh?.ramAvailPct === 'number'
    ? mainMh.ramAvailPct
    : (typeof mainMh?.ramPct === 'number' ? Math.max(0, 100 - mainMh.ramPct) : null);
  const availGB2 = mainMh?.availGB ?? S.localTelemetry?.availGB ?? null;
  const movingMachines = machines.filter((m) => S.machineHealth?.[m.id]?.moving).length;

  const tickerNode = h('div', { class: `swarm-ticker${workingCount ? ' is-live' : ''}` },
    workingCount
      ? [
        h('span', { class: 'st-badge live' }, h('i', { class: 'st-pulse' }), `LIVE · ${workingCount}건 실행 중`),
        h('div', { class: 'st-feed' }, (S.working || []).slice(0, 2).map((w) => h('button', {
          type: 'button', class: 'st-job-chip',
          onclick: () => { if (w.taskId) openTaskById(w.taskId); else location.hash = '#dashboard'; },
        },
        h('b', null, shortName(w.emp)),
        h('span', { class: 'st-sep' }, '·'),
        h('span', null, w.machineName || '이 컴퓨터'),
        h('span', { class: 'st-sep' }, '·'),
        h('span', { class: 'st-gold', 'data-live-since': w.since || null }, fmtElapsedSec(w.elapsedSec)),
        w.title ? h('span', { class: 'st-task' }, w.title) : null))),
        ui.route !== 'dashboard'
          ? h('button', { type: 'button', class: 'st-link', onclick: () => { location.hash = '#dashboard'; } }, '라이브 현황 →')
          : null,
      ]
      : [
        h('span', { class: 'st-badge ready' }, h('i', { class: 'st-pulse' }), 'READY'),
        h('div', { class: 'st-summary' },
          bestCloud
            ? h('span', { class: 'st-seg' }, '멤버십 여유 ', h('b', { class: 'st-gold' }, `${bestCloud.shortBrand} ${bestCloud.pctRemain}% 남음`),
              hotQuotas.length ? h('span', { class: 'st-hot' }, ` (${hotQuotas[0].shortBrand} ${hotQuotas[0].pctRemain ?? 0}% 자동 우회)`) : null)
            : null,
          mainMacObj2 && ramAvail2 !== null
            ? h('span', { class: 'st-seg' }, `${mainMacObj2.name} `, h('b', null, `RAM ${ramAvail2}% 여유`),
              availGB2 != null ? ` (${availGB2}GB)` : '',
              machines.length > 1 ? ` · 컴퓨터 ${machines.length}대(${movingMachines ? `${movingMachines}대 가동` : '대기'})` : ' · 대기')
            : null),
        ui.route !== 'dashboard'
          ? h('button', { type: 'button', class: 'st-link', onclick: () => { location.hash = '#dashboard'; } }, '멤버십 · 리소스 보기 →')
          : null,
      ]);

  const liveConsoleNode = workingCount
    ? h('div', { class: 'swarm-live-console', role: 'log', 'aria-live': 'polite' },
      h('div', { class: 'slc-head' },
        h('span', { class: 'slc-title' }, 'LIVE EXECUTION STREAM · 실시간 작업 현황'),
        h('div', { class: 'row' },
          h('span', { class: 'slc-hint' }, '클릭하면 전체 로그가 열립니다'),
          workingCount > 1
            ? h('button', {
              type: 'button', class: 'slc-stop-btn',
              onclick: () => once('stop-all', () => act('POST', '/api/ui/working/stop-all', {}, '⏹️ 실행 중인 모든 AI를 즉시 중단했어요')),
            }, '■ 전체 중단')
            : null)),
      h('div', { class: 'slc-list' }, (S.working || []).slice(0, 3).map((w) => {
        const recent = (w.liveLines || []).slice(-3);
        return h('div', {
          class: 'slc-job', role: 'button', tabindex: '0',
          onclick: () => { if (w.taskId) openTaskById(w.taskId); },
          onkeydown: (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && w.taskId) { ev.preventDefault(); openTaskById(w.taskId); } },
        },
        h('div', { class: 'slc-job-top' },
          h('span', { class: 'slc-who' }, shortName(w.emp)),
          h('span', { class: 'slc-ttl' }, w.title || '작업 실행 중'),
          h('span', { class: 'slc-tm', 'data-live-since': w.since || null, 'data-live-prefix': '⚡ ' }, `⚡ ${fmtElapsedSec(w.elapsedSec)}`),
          w.taskId
            ? h('button', {
              type: 'button', class: 'slc-stop-btn',
              title: `${shortName(w.emp)} 작업 즉시 중단`,
              onclick: (ev) => { ev.stopPropagation(); stopRunningTask(w.taskId, w.emp); },
            }, '■ 중단')
            : null),
        h('div', { class: 'slc-lines' },
          recent.length
            ? recent.map((ln) => h('div', { class: 'slc-ln' },
              h('span', { class: 'lt-ts' }, ln.at || ''),
              h('span', { class: 'lt-txt' }, ln.text || '')))
            : h('div', { class: 'slc-ln muted' },
              h('span', { class: 'lt-ts' }, 'LIVE'),
              h('span', { class: 'lt-txt' }, w.statusLine || '에이전트 작업 출력을 수신하는 중…'))));
      })))
    : null;

  const buildCliMonitor = () => {
    const cliLogs = S.cliLogs || {};
    const runningByEmp = new Map((S.working || []).map((w) => [w.emp, w]));
    const cliEmps = (visible.length ? visible : d.employees).filter((e) => !['web', 'none'].includes(e.engine));
    const ordered = [
      ...cliEmps.filter((e) => runningByEmp.has(e.id)),
      ...cliEmps.filter((e) => !runningByEmp.has(e.id) && cliLogs[e.id]),
      ...cliEmps.filter((e) => !runningByEmp.has(e.id) && !cliLogs[e.id]),
    ].slice(0, Math.max(3, runningByEmp.size));
    return h('div', { class: 'cli-mon-wrap', role: 'region', 'aria-label': 'AI 직원 CLI 모니터' },
      h('div', { class: 'cli-mon-head' },
        h('div', { class: 'row', style: 'gap:8px' },
          h('span', { class: 'cli-mon-title' }, 'CLI MONITOR'),
          workingCount ? h('span', { class: 'cli-mon-live' }, `● ${workingCount}명 실행 중`) : h('span', { class: 'cli-mon-idle' }, '대기')),
        h('div', { class: 'row', style: 'gap:6px' },
          workingCount > 1 ? h('button', {
            type: 'button', class: 'slc-stop-btn',
            onclick: () => once('stop-all', () => act('POST', '/api/ui/working/stop-all', {}, '모든 AI 작업을 중단했어요')),
          }, '■ 전체 중단') : null,
          h('button', { type: 'button', class: 'cli-mon-close', onclick: () => { ui.cliMonitor = false; render(); } }, '닫기'))),
      h('div', { class: `cli-mon-grid cols-${Math.min(3, Math.max(1, ordered.length))}` }, ordered.map((e) => {
        const w = runningByEmp.get(e.id);
        const last = cliLogs[e.id];
        const lines = w ? (w.liveLines || []).slice(-10) : (last?.lines || []).slice(-8);
        const taskRefId = w?.taskId || last?.taskId || null;
        const taskTitle = w?.title || last?.title || '';
        const latestMsg = !w && !lines.length
          ? (S.data.messages || []).filter((m) => m.from === e.id && m.kind === 'result').slice(-1)[0]
          : null;
        return h('div', { class: `cli-pane${w ? ' is-live' : ''}` },
          h('div', { class: 'cli-pane-top' },
            h('div', { class: 'row', style: 'gap:6px;min-width:0' },
              avatarEl(e, { size: 20, stateOverride: w ? 'working' : 'idle', onDark: true }),
              h('b', { class: 'cli-pane-nm' }, shortName(e.id)),
              w
                ? h('span', { class: 'cli-pane-badge is-live', 'data-live-since': w.since || null, 'data-live-prefix': '● ' }, `● ${fmtElapsedSec(w.elapsedSec)}`)
                : h('span', { class: 'cli-pane-badge' }, e.engine)),
            h('div', { class: 'row', style: 'gap:4px' },
              h('button', { type: 'button', class: 'cli-pane-btn', title: '맥 Terminal 열기', onclick: () => openEmpTerminal(e.id, 'terminal') }, '터미널'),
              h('button', { type: 'button', class: 'cli-pane-btn', title: 'Cursor IDE 열기', onclick: () => openEmpTerminal(e.id, 'cursor') }, 'IDE'),
              w?.taskId ? h('button', { type: 'button', class: 'cli-pane-btn is-stop', title: '중단', onclick: () => stopRunningTask(w.taskId, e.id) }, '■') : null)),
          taskTitle ? h('button', {
            type: 'button', class: 'cli-pane-task',
            onclick: () => { if (taskRefId) openTaskById(taskRefId); },
          }, taskTitle) : null,
          h('div', { class: 'cli-pane-body', role: 'log' },
            lines.length
              ? lines.map((ln) => h('div', { class: 'cli-ln' },
                h('span', { class: 'cli-ts' }, ln.at || ''),
                h('span', { class: 'cli-txt' }, ln.text || '')))
              : latestMsg
                ? h('div', { class: 'cli-ln muted' },
                  h('span', { class: 'cli-ts' }, stamp(latestMsg.at)),
                  h('span', { class: 'cli-txt' }, latestMsg.text.replace(/\s+/g, ' ').slice(0, 120)))
                : h('div', { class: 'cli-ln muted' },
                  h('span', { class: 'cli-ts' }, '$'),
                  h('span', { class: 'cli-txt' }, `workspaces/${e.id} · 대기`)),
            w ? h('span', { class: 'live-term-cursor', 'aria-hidden': 'true' }, '▌') : null));
      })));
  };

  const stageNode = ui.hanokStage ? buildHanokOfficeStage(visible.length ? visible : d.employees, selEmp) : null;
  const cliMonitorNode = ui.cliMonitor ? buildCliMonitor() : null;

  return h('section', { class: 'swarm-card', 'aria-label': 'CONNECT AI LIVE CREW' },
    h('div', { class: 'swarm-top' }, h('div', { class: 'swarm-tabs' }, teamTabs), topActions),
    heroNode,
    stageNode,
    h('div', { class: 'swarm-strip' }, allItem, workerItems, addTile),
    cliMonitorNode || (workingCount ? liveConsoleNode : tickerNode));
}

function healthPillBtn() {
  const H = S.health || {};
  const td = H.today || null;
  const bpm = td?.heartRate ?? td?.restingHr ?? null;
  const score = H.score;
  const connected = Boolean(H.connected && (bpm != null || score != null));
  const tone = !connected ? 'idle' : H.level === 'best' ? 'best' : H.level === 'good' ? 'good' : H.level === 'caution' ? 'warn' : 'rest';
  const label = !connected
    ? '워치 연결'
    : [bpm != null ? `${bpm} bpm` : '', score != null ? `컨디션 ${score}` : ''].filter(Boolean).join(' · ');
  return h('button', {
    type: 'button',
    class: `hanji-health-pill is-${tone}`,
    title: connected ? `${H.levelLabel} — 클릭해 애플워치 심박·건강 최적화 보기` : '애플워치 심박·건강 최적화 연결하기',
    onclick: () => openHealthOverviewModal(),
  },
  h('span', { class: 'hh-heart', 'aria-hidden': 'true' }, '♥'),
  h('span', null, label));
}

function hanjiMiniOffice() {
  const d = S.data;
  if (!d.employees.length) return null;
  const selEmp = ui.taskPick && ui.taskPick !== 'auto' && ui.taskPick !== 'jay'
    ? d.employees.find((e) => e.id === ui.taskPick) || null
    : null;
  const workingCnt = (S.working || []).length;
  const pendingGates = (d.tasks || []).filter((t) => t.gate && !t.gateApprovedAt && t.status !== '완료' && t.assignee !== 'jay');
  const firstGate = pendingGates[0] || null;
  const stageEl = buildHanokOfficeStage(d.employees, selEmp);
  stageEl.classList.add('is-hanji');
  // 밝은 한지 무대 상단에는 이미 외곽 1줄 바가 있으므로 중복 내부 오버레이 바를 숨김
  const innerTop = stageEl.querySelector('.hanok-stage-top');
  if (innerTop) innerTop.remove();

  const statusText = workingCnt
    ? `${workingCnt}명 일하는 중`
    : `${d.employees.length}명 대기`;

  return h('section', { class: 'hanji-office', 'aria-label': '살아있는 미니 사무실' },
    h('div', { class: 'hanji-bar' },
      h('div', { class: 'hanji-bar-l' },
        h('i', { class: `hanji-live-dot${workingCnt ? ' is-live' : ''}` }),
        h('span', { class: 'hanji-status' }, statusText),
        selEmp ? h('button', {
          type: 'button', class: 'hanji-sel-pill', title: '클릭해 자동 배분으로 되돌리기',
          onclick: () => { ui.taskPick = 'auto'; ui.swarmSelected = 'all'; render(); },
        }, `@${shortName(selEmp.id)} ×`) : null),
      h('div', { class: 'hanji-bar-r' },
        healthPillBtn(),
        firstGate ? h('button', {
          type: 'button', class: 'hanji-gate-pill',
          onclick: () => openStampApprovalModal(firstGate),
        }, `결재 ${pendingGates.length}`) : null,
        h('button', {
          type: 'button', class: 'hanji-add-emp', title: 'AI 직원 추가', 'aria-label': 'AI 직원 추가',
          onclick: () => openAddEmployee(),
        }, '+'))),
    stageEl);
}

function pageHome() {
  const d = S.data;
  const day = new Date(`${S.today}T12:00:00`);
  const sorter = (a, b) => a.order - b.order;
  const today = d.tasks.filter((t) => t.date === S.today).sort(sorter);
  const overdue = d.tasks.filter((t) => t.date < S.today && t.status !== '완료').sort((a, b) => a.date.localeCompare(b.date) || sorter(a, b));
  const later = d.tasks.filter((t) => t.date > S.today).sort((a, b) => a.date.localeCompare(b.date) || sorter(a, b)).slice(0, 20);
  const pendingApprs = d.approvals.filter((a) => a.status === '대기');
  const openCount = today.filter((t) => t.status !== '완료').length;
  const ownerLabel = d.owner.name ? `${d.owner.name} 대표님` : '대표님';
  return h('div', { class: 'home-calm' },
    h('div', { class: 'head home-head-calm' },
      h('h1', null, `${greeting()}, `, h('b', null, ownerLabel)),
      h('span', { class: 'sub' }, `${day.getMonth() + 1}월 ${day.getDate()}일 (${WD[day.getDay()]})`)),
    S.health?.delegateRecommended ? h('div', { class: 'health-banner calm-hb' },
      h('span', { class: 'small' }, `♥ ${S.health.levelLabel}${S.health.score != null ? ` (${S.health.score})` : ''} · ${S.health.advice}`),
      h('button', { type: 'button', class: 'btn link', onclick: openHealthOverviewModal }, '보기')) : null,
    hanjiMiniOffice(),
    addBar(),
    !d.employees.length ? h('div', { class: 'callout' },
      h('b', null, 'AI 직원을 추가하세요'),
      h('button', { class: 'btn dark', onclick: openAddEmployee }, '+ AI 직원 추가')) : null,
    pendingApprs.length ? h('section', { class: 'sec' }, secHead('대표 확인', `${pendingApprs.length}건`),
      pendingApprs.map(approvalInlineCard)) : null,
    h('section', { class: 'sec' }, secHead('오늘 할 일', openCount ? `${openCount}건` : ''),
      today.length ? todayOpenSection(today) : h('div', { class: 'empty' }, '오늘 할 일이 없습니다. 위에 한 줄 적어 보세요.')),
    overdue.length ? h('details', { class: 'clean-fold', 'data-k': 'home-overdue-fold' },
      h('summary', null, `밀린 일 (${overdue.length}건)`),
      taskList(overdue, { draggable: false, overdue: true })) : null,
    todayDoneSection(today),
    later.length ? h('details', { class: 'clean-fold', 'data-k': 'home-later-fold' },
      h('summary', null, `예정 (${later.length}건)`),
      taskList(later, { draggable: false })) : null);
}

// ───────── 회사 대시보드 (White & Black SVG 라이브 구조도 · 텔레메트리) ─────────

function buildTopologyModel() {
  const d = S.data;
  const today = d.tasks.filter((t) => t.date === S.today);
  const aiRoutines = d.routines.filter((r) => r.enabled !== false && !r.feature && r.assignee && r.assignee !== 'jay');
  const machines = d.resources.filter((r) => r.kind === '기계');
  const phones = d.resources.filter((r) => r.kind === '스마트폰' && r.status !== '꺼짐');
  const browsers = d.resources.filter((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  const accounts = d.resources.filter((r) => r.kind === '계정' && r.status !== '꺼짐');
  const ossList = d.resources.filter((r) => r.kind === '오픈소스' && r.status !== '꺼짐');
  const designs = d.resources.filter((r) => r.kind === '디자인' && r.status !== '꺼짐');
  const thisMac = machines.find((m) => m.isThisMac) || machines[0] || null;
  const studio = machines.find((m) => /(스튜디오|studio)/i.test(m.name)) || null;
  const H = S.health || {};

  // 왼쪽 열: 대표 본사 + 활성 AI 자동 루틴
  const left = [{
    key: 'ceo', route: 'home', solid: true, dot: 'idle',
    title: `${d.owner.name || '대표'} · 본사`,
    badge: H.score != null ? `컨디션 ${H.score}` : (d.settings.autoOptimize !== false ? '최적화 ON' : '수동'),
    sub: H.score != null
      ? `${H.levelLabel} · 할 일 ${today.filter((t) => t.status !== '완료').length}건`
      : `오늘 할 일 ${today.filter((t) => t.status !== '완료').length}건 · 완료 ${today.filter((t) => t.status === '완료').length}건`,
    tooltip: '오늘 할 일로 이동',
  }];
  for (const r of aiRoutines.slice(0, 4)) {
    const sched = r.intervalMin ? (r.intervalMin === 60 ? '매1h' : `매${r.intervalMin}분`) : (r.time || '매일');
    left.push({
      key: `rt:${r.id}`, route: 'daily',
      title: r.title,
      badge: sched,
      sub: `${shortName(r.assignee)}${(r.steps || []).length ? ` · ${r.steps.length}단계 협업` : ''}`,
      tooltip: `${r.title} (${sched}) · 클릭 시 오토메이션으로 이동`,
    });
  }
  const adHocAi = today.filter((t) => t.assignee && t.assignee !== 'jay' && !t.routineId && t.status !== '완료');
  if (adHocAi.length || !aiRoutines.length) {
    left.push({
      key: 'adhoc', route: 'home',
      title: adHocAi.length ? `오늘 AI 할 일 (${adHocAi.length}건)` : '오토메이션 시작하기',
      badge: adHocAi.length ? '진행' : '오토메이션',
      sub: adHocAi.length ? adHocAi.slice(0, 2).map((x) => x.title).join(', ') : '5분 이메일 · 8시 영상 편집',
      tooltip: adHocAi.length ? '오늘 할 일로 이동' : '오토메이션에서 1클릭 팩 담기',
    });
  }

  // 가운데 열: AI 직원
  const employees = d.employees.map((e) => {
    const working = isWorking(e.id);
    const cooling = isEmpCooling(e);
    const rem = empCooldownMin(e);
    const cnt = today.filter((t) => t.assignee === e.id && t.status !== '완료').length;
    const fb = e.fallbackTo && emp(e.fallbackTo) ? shortName(e.fallbackTo) : null;
    return {
      key: `emp:${e.id}`, route: 'staff', empId: e.id,
      solid: working,
      cooling,
      highlight: cnt > 0 && !cooling,
      dot: working ? 'working' : cooling ? 'cool' : 'idle',
      title: shortName(e.id),
      badge: working ? '근무 중' : cooling ? `휴식 ${rem}m` : cnt ? `오늘 ${cnt}` : '대기',
      badgeSolid: cnt > 0 && !cooling,
      sub: cooling && fb ? `토큰 휴식 → ${fb} 자동 대체` : (e.role || ENGINE_LABEL[e.engine] || e.engine),
      tooltip: `${e.name}${fb ? ` · 막히면 대체: ${fb}` : ''} · 클릭 시 AI 직원으로 이동`,
    };
  });

  // 오른쪽 열: AI 사무실 (컴퓨터 + 스마트폰 + 브라우저/계정 + 오픈소스/디자인)
  const right = machines.map((m) => {
    const mh = S.machineHealth?.[m.id];
    const ramPct = typeof mh?.ramPct === 'number' ? mh.ramPct : null;
    const lvl = mh?.level || (m.status === '꺼짐' ? 'down' : 'ok');
    const fb = m.fallbackTo && res(m.fallbackTo) ? res(m.fallbackTo).name : null;
    return {
      key: `res:${m.id}`, route: 'resources', resTab: 'machines',
      highlight: m.isThisMac || lvl === 'overload',
      cooling: lvl === 'down',
      dot: lvl === 'overload' ? 'over' : lvl === 'down' ? 'cool' : 'idle',
      title: `${m.name}${m.computerUse ? ' · CU' : ''}`,
      badge: healthLabel(lvl),
      badgeSolid: lvl === 'overload',
      ramPct,
      maxRamPct: m.maxRamPct || 85,
      sub: ramPct === null ? [m.sshAlias ? `ssh ${m.sshAlias}` : '대기', m.computerUse ? '화면 조작' : '', fb ? `바쁘면 → ${fb}` : ''].filter(Boolean).join(' · ') : '',
      tooltip: `${m.name}${m.computerUse ? ' · 화면 조작(Computer Use) 켜짐' : ''} · RAM 상한 ${m.maxRamPct || 85}%${fb ? ` · 바쁘면 → ${fb}` : ''} · 클릭 시 내 자원으로 이동`,
    };
  });
  for (const ph of phones.slice(0, 2)) {
    const modeObj = (S.options.phoneModes || []).find((x) => x.key === ph.phoneMode);
    const host = ph.hostMachine ? res(ph.hostMachine) : null;
    right.push({
      key: `res:${ph.id}`, route: 'resources', resTab: 'mobile',
      highlight: ph.phoneMode === 'iphone-mirror',
      dot: 'idle',
      title: ph.name,
      badge: modeObj?.short || '스마트폰',
      sub: ph.phoneMode === 'mobile-ai'
        ? (ph.assignee ? `${shortName(ph.assignee)} 전담` : '모바일 AI 연결')
        : `${host ? host.name : '이 맥'} · ${ph.phoneMode === 'iphone-mirror' ? 'Computer Use 미러링' : 'adb · scrcpy'}`,
      tooltip: `${ph.name} (${modeObj?.name || '스마트폰'}) · 클릭 시 내 자원으로 이동`,
    });
  }
  const defBr = browsers.find((b) => b.isDefault) || browsers[0] || null;
  right.push({
    key: 'stack:web', route: 'resources', resTab: 'web',
    title: defBr ? `${defBr.name} · 계정` : '브라우저 · 계정',
    badge: `${accounts.length}개`,
    sub: accounts.slice(0, 3).map((a) => a.name.split(' · ')[0].split(' (')[0]).join(', ') || '계정 연결 전',
    tooltip: '내 자원 (브라우저 · 계정)으로 이동',
  });
  right.push({
    key: 'stack:tools', route: 'resources', resTab: 'tools',
    title: '오픈소스 · 디자인',
    badge: `${ossList.length + designs.length}개`,
    sub: [...designs.map((x) => x.name), ...ossList.map((x) => x.name)].slice(0, 2).join(' · ') || '도구 · 디자인 등록 전',
    tooltip: '내 자원 (도구 · 디자인)으로 이동',
  });

  // 연결선 구성
  const edges = [];
  const edgeSeen = new Set();
  const pushEdge = (ed) => {
    const k = `${ed.from}->${ed.to}:${ed.dashed ? 'd' : 's'}`;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push(ed);
  };

  // 왼쪽 → 가운데 (루틴/할 일 → AI 직원)
  for (const r of aiRoutines.slice(0, 4)) {
    pushEdge({ from: `rt:${r.id}`, to: `emp:${r.assignee}`, active: true, label: `${r.title} → ${shortName(r.assignee)}` });
  }
  for (const t of adHocAi) {
    pushEdge({ from: 'adhoc', to: `emp:${t.assignee}`, active: true, label: `${t.title} → ${shortName(t.assignee)}` });
  }
  for (const e of d.employees) {
    const hasLeft = edges.some((x) => x.to === `emp:${e.id}`);
    if (!hasLeft) pushEdge({ from: 'ceo', to: `emp:${e.id}`, active: isWorking(e.id), label: `대표 → ${e.name}` });
  }

  // 가운데 내부: AI 토큰 소진 대체 순위(fallbackTo) 점선 곡선
  for (const e of d.employees) {
    if (e.fallbackTo && d.employees.some((x) => x.id === e.fallbackTo)) {
      pushEdge({
        from: `emp:${e.id}`, to: `emp:${e.fallbackTo}`,
        dashed: true, active: isEmpCooling(e), gutterX: 590,
        label: `토큰 한도 시 대체: ${shortName(e.id)} → ${shortName(e.fallbackTo)}`,
      });
    }
  }

  // 가운데 → 오른쪽 (AI 직원 → 최적 컴퓨터 / 브라우저·도구)
  for (const e of d.employees) {
    const activeTask = today.find((t) => t.assignee === e.id && t.status !== '완료' && t.resource && res(t.resource)?.kind === '기계');
    const isHeavyEmp = /(영상|blender|블렌더|3d|렌더)/i.test(`${e.role} ${(e.tools || []).join(' ')}`);
    const targetMachine = activeTask ? res(activeTask.resource) : (isHeavyEmp && studio ? studio : thisMac);
    if (e.group === 'home-cloud') {
      const mobilePhone = phones.find((p) => p.assignee === e.id || (p.phoneMode === 'mobile-ai' && /스마트폰|피클/.test(`${e.name} ${e.role}`)));
      if (mobilePhone) pushEdge({ from: `emp:${e.id}`, to: `res:${mobilePhone.id}`, active: isWorking(e.id), label: `${shortName(e.id)} → ${mobilePhone.name}` });
      else pushEdge({ from: `emp:${e.id}`, to: 'stack:web', active: isWorking(e.id) || today.some((t) => t.assignee === e.id && t.status !== '완료'), label: `${shortName(e.id)} → 클라우드 · 계정` });
    } else if (targetMachine) {
      pushEdge({ from: `emp:${e.id}`, to: `res:${targetMachine.id}`, active: isWorking(e.id) || Boolean(activeTask), label: `${shortName(e.id)} → ${targetMachine.name}` });
      const cuPhone = phones.find((p) => (p.phoneMode === 'iphone-mirror' || p.phoneMode === 'android-adb') && (p.assignee === e.id || /컴퓨터\s*유즈/.test(e.role || '')));
      if (cuPhone) pushEdge({ from: `emp:${e.id}`, to: `res:${cuPhone.id}`, active: isWorking(e.id), label: `${shortName(e.id)} → ${cuPhone.name} (미러링)` });
    }
    if ((e.tools || []).length || isHeavyEmp) {
      pushEdge({ from: `emp:${e.id}`, to: 'stack:tools', active: false, label: `${shortName(e.id)} → 오픈소스 · 디자인` });
    }
  }

  // 오른쪽 내부: 컴퓨터 RAM 과부하 시 대체 컴퓨터(fallbackTo) 점선 곡선 + 스마트폰↔호스트 맥 연결
  for (const m of machines) {
    if (m.fallbackTo && machines.some((x) => x.id === m.fallbackTo)) {
      const mh = S.machineHealth?.[m.id];
      pushEdge({
        from: `res:${m.id}`, to: `res:${m.fallbackTo}`,
        dashed: true, active: mh?.level === 'overload', gutterX: 912,
        label: `RAM 과부하·혼잡 시 우회: ${m.name} → ${res(m.fallbackTo)?.name || ''}`,
      });
    }
  }
  for (const ph of phones.slice(0, 2)) {
    if (ph.hostMachine && machines.some((m) => m.id === ph.hostMachine)) {
      pushEdge({
        from: `res:${ph.hostMachine}`, to: `res:${ph.id}`,
        dashed: true, active: false, gutterX: 906,
        label: `${res(ph.hostMachine)?.name || '맥'} ↔ ${ph.name} 미러링 연결`,
      });
    }
  }

  return { left, employees, right, edges };
}

function openHealthLogModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const H = S.health || {};
  const td = H.today || {};
  const g = H.goals || { steps: 8000, sleepHours: 7.5, exerciseMin: 30, restingHrMax: 75 };
  const steps = h('input', { class: 'in', type: 'number', min: '0', max: '200000', value: td.steps ?? '', placeholder: `예: 6500 (목표 ${g.steps})` });
  const sleep = h('input', { class: 'in', type: 'number', step: '0.1', min: '0', max: '24', value: td.sleepHours ?? '', placeholder: `예: 7.2 (목표 ${g.sleepHours}시간)` });
  const hr = h('input', { class: 'in', type: 'number', min: '30', max: '220', value: td.restingHr ?? td.heartRate ?? '', placeholder: '예: 64 (bpm)' });
  const ex = h('input', { class: 'in', type: 'number', min: '0', max: '600', value: td.exerciseMin ?? '', placeholder: `예: 35 (목표 ${g.exerciseMin}분)` });
  let energyVal = td.energy ?? 4;
  const energyBtns = [1, 2, 3, 4, 5].map((n) => {
    const labels = { 1: '1 매우 피곤', 2: '2 피곤', 3: '3 보통', 4: '4 좋음', 5: '5 최상' };
    const b = h('button', {
      type: 'button', class: `chip${energyVal === n ? ' on' : ''}`,
      onclick: () => { energyVal = n; energyBtns.forEach((x, idx) => x.classList.toggle('on', idx + 1 === n)); },
    }, labels[n]);
    return b;
  });
  const goalSteps = h('input', { class: 'in sm', type: 'number', value: String(g.steps || 8000) });
  const goalSleep = h('input', { class: 'in sm', type: 'number', step: '0.5', value: String(g.sleepHours || 7.5) });
  const goalEx = h('input', { class: 'in sm', type: 'number', value: String(g.exerciseMin || 30) });

  setDlg(dlg,
    h('h3', null, '대표 컨디션 · 5초 기록'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 14px' }, '입력한 건강 기록은 이 컴퓨터에만 저장되며 외부 공유·AI 프롬프트로 나가지 않아요.'),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, '오늘 걸음 수', steps),
      h('label', { class: 'field' }, '어젯밤 수면 (시간)', sleep),
      h('label', { class: 'field' }, '안정시 심박수 (bpm)', hr),
      h('label', { class: 'field' }, '오늘 운동 (분)', ex)),
    h('div', { style: 'margin-top:12px' },
      h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '체감 컨디션'),
      h('div', { class: 'picker' }, energyBtns)),
    h('details', { style: 'margin-top:14px' },
      h('summary', null, '일일 목표 변경 (걸음 · 수면 · 운동)'),
      h('div', { class: 'grid2', style: 'margin-top:10px' },
        h('label', { class: 'field' }, '목표 걸음 수', goalSteps),
        h('label', { class: 'field' }, '목표 수면 (시간)', goalSleep),
        h('label', { class: 'field' }, '목표 운동 (분)', goalEx))),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, '취소'),
      h('button', {
        class: 'btn dark',
        onclick: () => once('save-health', async () => {
          const payload = {
            source: 'manual',
            steps: steps.value === '' ? undefined : Number(steps.value),
            sleepHours: sleep.value === '' ? undefined : Number(sleep.value),
            restingHr: hr.value === '' ? undefined : Number(hr.value),
            exerciseMin: ex.value === '' ? undefined : Number(ex.value),
            energy: energyVal,
            goals: {
              steps: Number(goalSteps.value) || 8000,
              sleepHours: Number(goalSleep.value) || 7.5,
              exerciseMin: Number(goalEx.value) || 30,
            },
          };
          dlg.close();
          await act('POST', '/api/ui/health', payload, '오늘 컨디션을 기록했어요');
        }),
      }, '저장')));
  dlg.showModal();
  steps.focus();
}

function openHealthOverviewModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const H = S.health || {};
  const td = H.today || {};
  const bpm = td.heartRate ?? td.restingHr ?? null;
  const trend = Array.isArray(H.trend7) ? H.trend7 : [];
  const metric = (lbl, val, unit = '') => h('div', { class: 'hov-card' },
    h('span', { class: 'hov-lbl' }, lbl),
    h('b', { class: 'hov-val' }, val != null ? `${val}${unit}` : '—'));

  setDlg(dlg,
    h('div', { class: 'hov-top' },
      h('div', null,
        h('h3', { style: 'margin:0' }, '내 건강 · 최적화'),
        h('div', { class: 'small muted', style: 'margin-top:2px' }, H.lastSyncAt ? `최근 동기화 · ${stamp(H.lastSyncAt)}` : '애플워치 · 아이폰 로컬 전용 (외부 전송 없음)')),
      H.score != null ? h('span', { class: `hov-score is-${H.level || 'good'}` }, `${H.score}점 · ${H.levelLabel}`) : null),
    h('div', { class: 'hov-advice' }, H.advice || '애플워치를 연결하면 심박수·HRV·수면 기준으로 AI 업무 배분을 자동 최적화합니다.'),
    h('div', { class: 'hov-grid' },
      metric('심박수', bpm, ' bpm'),
      metric('HRV', td.hrv, ' ms'),
      metric('수면', td.sleepHours, ' h'),
      metric('걸음', td.steps != null ? td.steps.toLocaleString('ko-KR') : null, '')),
    trend.some((x) => x.score != null) ? h('div', { class: 'hov-trend' },
      trend.map((x) => h('div', { class: 'hov-bar-col', title: `${x.date}${x.score != null ? ` · ${x.score}점` : ''}` },
        h('div', { class: 'hov-bar-track' },
          h('div', { class: `hov-bar-fill${x.score != null && x.score >= 80 ? ' is-hi' : ''}`, style: `height:${x.score != null ? Math.max(10, x.score) : 4}%` })),
        h('span', { class: 'hov-bar-lbl' }, x.label)))) : null,
    h('div', { class: 'bar', style: 'justify-content:space-between;margin-top:16px' },
      h('div', { class: 'row', style: 'gap:6px' },
        h('button', { type: 'button', class: 'btn sm dark', onclick: () => openHealthConnectModal() }, '애플워치 연결'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => openHealthLogModal() }, '5초 기록')),
      h('button', { type: 'button', class: 'btn sm', onclick: () => dlg.close() }, '닫기')));
  dlg.showModal();
}

function openHealthConnectModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const H = S.health || {};
  const lanOn = Boolean(S.lanInfo?.enabled);
  const url = H.ingestUrls?.[0] || H.localIngestUrl || 'http://127.0.0.1:8790/api/health/ingest';
  const tok = H.token || '(이 맥 화면에서만 표시)';
  const sampleJson = JSON.stringify({ heartRate: 68, restingHr: 61, hrv: 54, sleepHours: 7.3, steps: 7200, source: 'apple-watch' }, null, 2);

  setDlg(dlg,
    h('h3', null, '애플워치 · 아이폰 헬스 자동 연동 (로컬 전용)'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '외부 서버 없이 집·사무실 와이파이 안에서 대표님 맥의 HQ로만 전송됩니다.'),
    !lanOn ? h('div', { class: 'callout', style: 'margin:0 0 12px' },
      h('div', null, h('b', null, '1단계: 같은 와이파이 수신 켜기'), h('div', { class: 'small muted' }, '켜면 아이폰/애플워치가 집 와이파이에서 바로 이 맥으로 심박수를 보낼 수 있어요.')),
      h('button', { type: 'button', class: 'btn sm dark', onclick: () => once('lan-health', async () => { await act('POST', '/api/ui/lan', { on: true }, '와이파이 수신을 켰어요'); openHealthConnectModal(); }) }, '와이파이 수신 켜기')) : null,
    h('div', { class: 'health-cred' },
      h('div', { class: 'small muted' }, '로컬 수신 주소 (POST)'),
      h('div', { class: 'row', style: 'margin-top:4px;justify-content:space-between' },
        h('span', { class: 'mono small' }, url),
        h('button', { type: 'button', class: 'btn sm', onclick: async () => { await copyText(url); toast('수신 주소를 복사했어요'); } }, '주소 복사')),
      h('div', { class: 'small muted', style: 'margin-top:10px' }, '전용 보안 토큰 (헤더: X-AIHQ-Health-Token)'),
      h('div', { class: 'row', style: 'margin-top:4px;justify-content:space-between' },
        h('span', { class: 'mono small' }, tok),
        h('div', { class: 'row' },
          H.token ? h('button', { type: 'button', class: 'btn sm', onclick: async () => { await copyText(tok); toast('토큰을 복사했어요'); } }, '토큰 복사') : null,
          H.token ? h('button', { type: 'button', class: 'btn sm', onclick: () => once('rot-tok', async () => { await act('POST', '/api/ui/health/token', {}, '새 보안 토큰을 발급했어요'); openHealthConnectModal(); }) }, '재발급') : null))),
    h('div', { class: 'grid2', style: 'margin-top:14px' },
      h('div', { class: 'pane-box' },
        h('b', null, '방법 A · 아이폰 기본 단축어 (무료 · 워치 원탭)'),
        h('ol', { class: 'guide-ol' },
          h('li', null, '아이폰 단축어 앱 → 새 단축어 → "건강 샘플 찾기" (심박수 · 수면 · 걸음)'),
          h('li', null, '"URL의 콘텐츠 가져오기" (POST · JSON)에 위 주소와 X-AIHQ-Health-Token 입력'),
          h('li', null, '자동화(아침/점심/저녁) 등록 + "Apple Watch에서 보기" 켜면 워치에서 1탭 즉시 전송'))),
      h('div', { class: 'pane-box' },
        h('b', null, '방법 B · Health Auto Export (백그라운드 자동)'),
        h('ol', { class: 'guide-ol' },
          h('li', null, 'iOS Health Auto Export 앱 → Automations → REST API 추가'),
          h('li', null, 'URL에 위 로컬 주소, Header에 X-AIHQ-Health-Token 붙여넣기'),
          h('li', null, '심박수 · 안정시 심박 · HRV · 수면 · 걸음 켜 두면 백그라운드 자동 동기화')))),
    h('div', { style: 'margin-top:12px' },
      h('div', { class: 'small muted', style: 'margin-bottom:4px' }, '전송 JSON 예시 (심박수 하나만 보내도 바로 반영)'),
      h('pre', { class: 'full', style: 'margin:0' }, sampleJson)),
    h('div', { class: 'bar', style: 'justify-content:space-between' },
      h('button', {
        type: 'button', class: 'btn sm',
        onclick: () => once('test-health', async () => {
          const r = await act('POST', '/api/ui/health', { heartRate: 68, restingHr: 62, hrv: 56, steps: 6420, sleepHours: 7.4, exerciseMin: 35, energy: 4, source: 'apple-watch-test' }, '애플워치 테스트 데이터를 반영했어요');
          if (r) dlg.close();
        }),
      }, '샘플 심박 테스트'),
      h('button', { class: 'btn dark', onclick: () => dlg.close() }, '닫기')));
  dlg.showModal();
}

// ───────── 성과 아카이브 (오늘 · 일주일 · 한 달 · 전체 누적 비주얼 데이터) ─────────
const ARCHIVE_CATS = [
  { key: 'sns',      label: 'SNS · 마케팅',     color: '#d4a359', re: /유튜브|youtube|인스타|instagram|스레드|threads|트위터|\bx\.com\b|댓글|답글|포스팅|마케팅|홍보|블로그|크로스포스팅|sns/i },
  { key: 'video',    label: '영상 · 디자인',     color: '#14b8a6', re: /영상|쇼츠|shorts|릴스|모션|편집|썸네일|디자인|3d|블렌더|blender|remotion|ffmpeg|이미지|배너|자막/i },
  { key: 'dev',      label: '개발 · 자동화',     color: '#0a0a0c', re: /코드|코딩|개발|버그|테스트|깃허브|github|배포|서버|api|스크립트|자동화|오토메이션|브라우저|에고|ego/i },
  { key: 'research', label: '리서치 · 기획',     color: '#6366f1', re: /조사|리서치|분석|트렌드|브리핑|요약|해부|경쟁사|벤치마크|기획|대본|아이디어|회고/i },
  { key: 'ops',      label: '운영 · 메일 · 일상', color: '#94a3b8', re: /.*/ },
];

function classifyArchiveCat(title = '', note = '', skills = []) {
  const hay = `${title} ${note} ${(skills || []).join(' ')}`;
  for (const c of ARCHIVE_CATS) {
    if (c.key !== 'ops' && c.re.test(hay)) return c;
  }
  return ARCHIVE_CATS[ARCHIVE_CATS.length - 1];
}

function addDaysStr(baseYmd, delta) {
  const dt = new Date(`${baseYmd}T12:00:00`);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtSavedMinutes(mins) {
  const m = Math.max(0, Math.round(mins));
  if (m === 0) return '0분';
  if (m < 60) return `${m}분`;
  const hVal = Math.floor(m / 60);
  const rem = m % 60;
  return rem >= 10 ? `약 ${hVal}시간 ${rem}분` : `약 ${hVal}시간`;
}

function collectCompletedArchive(d, todayStr) {
  const entries = [];
  const coveredRoutineDays = new Set();

  for (const t of (d.tasks || [])) {
    if (t.status !== '완료') continue;
    const rawDate = t.date || (t.completedAt ? String(t.completedAt).slice(0, 10) : todayStr);
    const tsIso = t.completedAt || t.lastRunAt || t.createdAt || '';
    let hour = null;
    let timeStr = t.time || '';
    if (tsIso) {
      const dt = new Date(tsIso);
      if (!Number.isNaN(dt.getTime())) {
        hour = dt.getHours();
        timeStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      }
    }
    if (hour === null && t.time && /^\d{1,2}:\d{2}/.test(t.time)) {
      hour = Number(t.time.split(':')[0]);
    }
    const actorId = (t.completedBy && t.completedBy !== 'system') ? t.completedBy : (t.assignee || 'jay');
    const isAi = Boolean(actorId && actorId !== 'jay');
    const cat = classifyArchiveCat(t.title, `${t.note || ''} ${t.resultSummary || ''}`, t.skills);
    const savedMin = isAi ? ((t.steps || []).length > 1 ? 30 : (t.routineId || (t.skills || []).length || t.account) ? 18 : 12) : 0;
    if (t.routineId) coveredRoutineDays.add(`${t.routineId}|${rawDate}`);
    entries.push({
      id: t.id,
      taskId: t.id,
      date: rawDate,
      hour: hour ?? 12,
      timeStr,
      sortKey: `${rawDate}T${timeStr || '12:00'}|${tsIso}`,
      title: t.title,
      summary: t.resultSummary || t.reason || '',
      actorId,
      isAi,
      cat,
      savedMin,
      isRoutine: Boolean(t.routineId),
    });
  }

  // 과거 루틴 완료 기록(r.log) 중 d.tasks에 없는 날짜도 함께 누적 집계
  for (const r of (d.routines || [])) {
    for (const [dayKey, status] of Object.entries(r.log || {})) {
      if (status !== '완료' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
      if (coveredRoutineDays.has(`${r.id}|${dayKey}`)) continue;
      const actorId = r.assignee || 'jay';
      const isAi = actorId !== 'jay';
      const cat = classifyArchiveCat(r.title, r.instruction || '', r.skills);
      entries.push({
        id: `log-${r.id}-${dayKey}`,
        taskId: null,
        date: dayKey,
        hour: r.time && /^\d{1,2}:/.test(r.time) ? Number(r.time.split(':')[0]) : 12,
        timeStr: r.time || '',
        sortKey: `${dayKey}T${r.time || '12:00'}`,
        title: r.title,
        summary: '오토메이션 완료 기록',
        actorId,
        isAi,
        cat,
        savedMin: isAi ? 15 : 0,
        isRoutine: true,
      });
    }
  }

  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return entries;
}

function buildWorkArchiveCard() {
  const d = S.data;
  const todayStr = S.today;
  const range = ui.archiveRange || 'today';
  const selDay = ui.archiveDay || '';
  const allDone = collectCompletedArchive(d, todayStr);

  // 전체 날짜별 집계 (히트맵 + 스트릭 + 일 최고 기록)
  const dayMap = {};
  for (const it of allDone) {
    if (!dayMap[it.date]) dayMap[it.date] = { total: 0, ai: 0, human: 0 };
    dayMap[it.date].total += 1;
    if (it.isAi) dayMap[it.date].ai += 1; else dayMap[it.date].human += 1;
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dk = addDaysStr(todayStr, -i);
    if (dayMap[dk]?.total > 0) streak++;
    else if (i === 0) continue; // 오늘 아직 0건이면 어제까지 스트릭 유지 확인
    else break;
  }
  const bestDayEntry = Object.entries(dayMap).sort((a, b) => b[1].total - a[1].total)[0] || null;

  // 선택 기간 필터링
  const minDate = range === 'today'
    ? todayStr
    : range === 'week'
      ? addDaysStr(todayStr, -6)
      : range === 'month'
        ? addDaysStr(todayStr, -29)
        : '';
  const periodItems = minDate ? allDone.filter((x) => x.date >= minDate && x.date <= todayStr) : allDone;
  const activeItems = selDay ? allDone.filter((x) => x.date === selDay) : periodItems;

  const totalCnt = activeItems.length;
  const aiCnt = activeItems.filter((x) => x.isAi).length;
  const humanCnt = totalCnt - aiCnt;
  const aiRate = totalCnt ? Math.round((aiCnt / totalCnt) * 100) : 0;
  const savedMin = activeItems.reduce((sum, x) => sum + x.savedMin, 0);

  // 기간별 추이 차트 버킷 생성
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  let buckets = [];
  let trendTitle = '';
  if (range === 'today') {
    trendTitle = '오늘 시간대별 완료 분포 (3시간 단위)';
    const slots = [0, 3, 6, 9, 12, 15, 18, 21];
    buckets = slots.map((h0) => {
      const hit = periodItems.filter((x) => x.hour >= h0 && x.hour < h0 + 3);
      const ai = hit.filter((x) => x.isAi).length;
      return {
        label: `${pad(h0)}시`,
        ai,
        human: hit.length - ai,
        total: hit.length,
        isToday: new Date().getHours() >= h0 && new Date().getHours() < h0 + 3,
        tip: `${pad(h0)}:00~${pad(h0 + 3)}:00 · 총 ${hit.length}건 (AI ${ai} · 대표 ${hit.length - ai})`,
      };
    });
  } else if (range === 'week') {
    trendTitle = '최근 7일 일별 완료 추이';
    for (let i = 6; i >= 0; i--) {
      const dk = addDaysStr(todayStr, -i);
      const dt = new Date(`${dk}T12:00:00`);
      const info = dayMap[dk] || { total: 0, ai: 0, human: 0 };
      buckets.push({
        label: `${dt.getMonth() + 1}/${dt.getDate()}(${DOW[dt.getDay()]})`,
        ai: info.ai,
        human: info.human,
        total: info.total,
        isToday: dk === todayStr,
        tip: `${dk} (${DOW[dt.getDay()]}) · 총 ${info.total}건 (AI ${info.ai} · 대표 ${info.human})`,
      });
    }
  } else if (range === 'month') {
    trendTitle = '최근 30일 일별 누적 추이';
    for (let i = 29; i >= 0; i--) {
      const dk = addDaysStr(todayStr, -i);
      const dt = new Date(`${dk}T12:00:00`);
      const info = dayMap[dk] || { total: 0, ai: 0, human: 0 };
      buckets.push({
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        ai: info.ai,
        human: info.human,
        total: info.total,
        isToday: dk === todayStr,
        tip: `${dk} · 총 ${info.total}건 (AI ${info.ai} · 대표 ${info.human})`,
      });
    }
  } else {
    trendTitle = '최근 12주 주간 성과 성장 추이';
    for (let w = 11; w >= 0; w--) {
      const endDk = addDaysStr(todayStr, -w * 7);
      const startDk = addDaysStr(endDk, -6);
      const hit = allDone.filter((x) => x.date >= startDk && x.date <= endDk);
      const ai = hit.filter((x) => x.isAi).length;
      const dt = new Date(`${endDk}T12:00:00`);
      buckets.push({
        label: w === 0 ? '이번주' : `${dt.getMonth() + 1}/${dt.getDate()}`,
        ai,
        human: hit.length - ai,
        total: hit.length,
        isToday: w === 0,
        tip: `${startDk} ~ ${endDk} · 총 ${hit.length}건 (AI ${ai} · 대표 ${hit.length - ai})`,
      });
    }
  }

  // AI 직원 & 대표 MVP 랭킹
  const actorMap = new Map();
  for (const it of activeItems) {
    const k = it.actorId || 'jay';
    const cur = actorMap.get(k) || { id: k, count: 0, savedMin: 0 };
    cur.count += 1;
    cur.savedMin += it.savedMin;
    actorMap.set(k, cur);
  }
  const mvpList = [...actorMap.values()].sort((a, b) => b.count - a.count);
  const maxMvp = Math.max(1, mvpList[0]?.count || 1);

  // 업무 영역 분포
  const catCounts = ARCHIVE_CATS.map((c) => ({
    ...c,
    count: activeItems.filter((x) => x.cat.key === c.key).length,
  }));

  const rangeMeta = {
    today: { label: '오늘', sub: todayStr },
    week:  { label: '일주일 (7일)', sub: `${addDaysStr(todayStr, -6)} ~ ${todayStr}` },
    month: { label: '한 달 (30일)', sub: `${addDaysStr(todayStr, -29)} ~ ${todayStr}` },
    all:   { label: '전체 누적', sub: `총 ${Object.keys(dayMap).length}일 기록 누적` },
  };

  const copySummary = async () => {
    const scopeLbl = selDay ? `${selDay} 일간` : rangeMeta[range].label;
    const topEmp = mvpList[0] ? `${mvpList[0].id === 'jay' ? '대표' : shortName(mvpList[0].id)} ${mvpList[0].count}건` : '기록 없음';
    const topCat = [...catCounts].sort((a, b) => b.count - a.count)[0];
    const lines = [
      `📊 ${d.settings.companyName || 'CONNECT AI HQ'} · ${scopeLbl} 성과 리포트`,
      `- 총 완료: ${totalCnt}건 (AI ${aiCnt}건 · 대표 ${humanCnt}건 · AI 위임률 ${aiRate}%)`,
      `- 추정 절약 시간: ${fmtSavedMinutes(savedMin)} · 연속 가동: ${streak}일`,
      `- 최다 처리 MVP: ${topEmp}${topCat && topCat.count ? ` · 주력 영역: ${topCat.label} (${topCat.count}건)` : ''}`,
      ...activeItems.slice(0, 5).map((x, i) => `${i + 1}. [${x.cat.label}] ${x.title}${x.summary ? ` — ${x.summary.slice(0, 60)}` : ''}`),
    ];
    await copyText(lines.join('\n'));
    toast(`${scopeLbl} 성과 요약을 복사했어요`);
  };

  const visibleLogs = ui.archiveMore ? activeItems.slice(0, 30) : activeItems.slice(0, 6);

  return h('section', { class: 'ops-card arch-card', id: 'work-archive', 'aria-label': '성과 아카이브 비주얼 리포트' },
    h('div', { class: 'arch-head' },
      h('div', null,
        h('div', { class: 'ops-sec-k' }, 'WORK CHRONICLE · VISUAL ACHIEVEMENT ARCHIVE'),
        h('div', { class: 'arch-title-row' },
          h('h2', null, '쌓인 성과 비주얼 아카이브'),
          h('span', { class: 'small muted' }, selDay ? `${selDay} 선택됨` : rangeMeta[range].sub),
          selDay ? h('button', {
            type: 'button', class: 'arch-day-clr',
            onclick: () => { ui.archiveDay = ''; ui.archiveMore = false; render(); },
          }, `📅 ${selDay} 해제 ×`) : null)),
      h('div', { class: 'arch-controls' },
        h('div', { class: 'arch-tabs', role: 'tablist', 'aria-label': '성과 기간 선택' },
          [['today', '오늘'], ['week', '일주일'], ['month', '한 달'], ['all', '전체 누적']].map(([k, lbl]) => h('button', {
            type: 'button', role: 'tab', 'aria-selected': range === k && !selDay ? 'true' : 'false',
            class: `arch-tab${range === k && !selDay ? ' on' : ''}`,
            onclick: () => { ui.archiveRange = k; ui.archiveDay = ''; ui.archiveMore = false; render(); },
          }, lbl))),
        h('button', { type: 'button', class: 'btn sm', onclick: copySummary }, '요약 복사'))),

    // 4개 핵심 누적 KPI 카드
    h('div', { class: 'arch-kpis' },
      h('div', { class: 'arch-kpi is-dark' },
        h('span', { class: 'arch-kpi-k' }, `${selDay ? selDay : rangeMeta[range].label} 완료한 일`),
        h('div', { class: 'arch-kpi-v' }, `${totalCnt}건`),
        h('span', { class: 'arch-kpi-s' }, `AI ${aiCnt}건 · 대표 ${humanCnt}건`)),
      h('div', { class: 'arch-kpi' },
        h('span', { class: 'arch-kpi-k' }, 'AI 자율 위임률'),
        h('div', { class: 'arch-kpi-v is-gold' }, `${aiRate}%`),
        h('span', { class: 'arch-kpi-s' }, aiCnt ? '대표 대신 AI 직원이 완료' : 'AI에게 일을 맡겨 보세요')),
      h('div', { class: 'arch-kpi' },
        h('span', { class: 'arch-kpi-k' }, '절약한 대표 시간'),
        h('div', { class: 'arch-kpi-v' }, fmtSavedMinutes(savedMin)),
        h('span', { class: 'arch-kpi-s' }, `AI 처리 ${aiCnt}건 기준 추정`)),
      h('div', { class: 'arch-kpi' },
        h('span', { class: 'arch-kpi-k' }, '연속 가동 · 일 최고'),
        h('div', { class: 'arch-kpi-v' }, `${streak}일 연속`),
        h('span', { class: 'arch-kpi-s' }, bestDayEntry ? `최고 ${bestDayEntry[1].total}건 (${bestDayEntry[0].slice(5)})` : '오늘부터 기록 시작'))),

    // 비주얼 차트 1행: 기간 추이 바 차트 + 12주 잔디 히트맵
    h('div', { class: 'arch-grid-top' },
      h('div', { class: 'arch-panel' },
        h('div', { class: 'arch-panel-h' },
          h('b', null, trendTitle),
          h('div', { class: 'arch-legend' },
            h('span', null, h('i', { class: 'arch-dot-ai' }), 'AI 완료'),
            h('span', null, h('i', { class: 'arch-dot-me' }), '대표 완료'))),
        C.workTrendChart(buckets, { ariaLabel: trendTitle })),
      h('div', { class: 'arch-panel' },
        h('div', { class: 'arch-panel-h' },
          h('b', null, '최근 12주 누적 잔디'),
          h('div', { class: 'arch-legend arch-heat-leg' },
            h('span', null, '적음'),
            h('i', { class: 'hl-0' }), h('i', { class: 'hl-1' }), h('i', { class: 'hl-2' }), h('i', { class: 'hl-3' }), h('i', { class: 'hl-4' }),
            h('span', null, '많음'))),
        C.workHeatmap(dayMap, todayStr, {
          weeks: 12,
          selectedDay: selDay,
          onSelectDay: (dk) => { ui.archiveDay = dk; ui.archiveMore = false; render(); },
        }),
        h('div', { class: 'small muted arch-heat-hint' }, '날짜 칸을 클릭하면 그날 완료한 일만 바로 펼쳐봅니다 · 전체 누적 자동 보관'))),

    // 비주얼 차트 2행: AI 직원 MVP 랭킹 + 업무 영역 도넛
    h('div', { class: 'arch-grid-bot' },
      h('div', { class: 'arch-panel' },
        h('div', { class: 'arch-panel-h' },
          h('b', null, 'AI 직원 · 대표 공헌도 MVP'),
          h('span', { class: 'small muted' }, `${selDay || rangeMeta[range].label} 기준`)),
        mvpList.length
          ? h('div', { class: 'arch-mvp-list' }, mvpList.slice(0, 6).map((m, idx) => {
            const eObj = m.id !== 'jay' ? emp(m.id) : null;
            const share = totalCnt ? Math.round((m.count / totalCnt) * 100) : 0;
            const barPct = Math.max(8, Math.round((m.count / maxMvp) * 100));
            return h('div', { class: 'arch-mvp-row' },
              h('span', { class: `arch-rank${idx === 0 ? ' is-top' : ''}` }, String(idx + 1)),
              eObj ? avatarEl(eObj, { size: 30 }) : h('span', { class: 'ops-feed-me' }, '대표'),
              h('div', { class: 'arch-mvp-mid' },
                h('div', { class: 'arch-mvp-top' },
                  h('b', null, m.id === 'jay' ? '대표 (직접)' : shortName(m.id)),
                  h('span', { class: 'arch-mvp-cnt' }, `${m.count}건 · ${share}%`)),
                h('div', { class: 'arch-mvp-track' },
                  h('i', { class: `arch-mvp-fill${idx === 0 ? ' is-gold' : ''}`, style: `width:${barPct}%` }))));
          }))
          : h('div', { class: 'empty small' }, '선택한 기간에 완료된 기록이 없습니다')),
      h('div', { class: 'arch-panel' },
        h('div', { class: 'arch-panel-h' },
          h('b', null, '업무 영역 분포'),
          h('span', { class: 'small muted' }, '자동 분류')),
        h('div', { class: 'arch-cat-wrap' },
          C.categoryDonut(catCounts, totalCnt),
          h('div', { class: 'arch-cat-list' }, catCounts.map((c) => {
            const pct = totalCnt ? Math.round((c.count / totalCnt) * 100) : 0;
            return h('div', { class: `arch-cat-row${c.count === 0 ? ' is-zero' : ''}` },
              h('span', { class: 'arch-cat-dot', style: `background:${c.color}` }),
              h('span', { class: 'arch-cat-lbl' }, c.label),
              h('span', { class: 'arch-cat-val' }, `${c.count}건`),
              h('span', { class: 'arch-cat-pct' }, `${pct}%`));
          }))))),

    // 하단: 기간별 쌓인 성과 기록 리스트
    h('div', { class: 'arch-log-wrap' },
      h('div', { class: 'arch-panel-h' },
        h('b', null, `${selDay ? `${selDay} 완료한 일` : `${rangeMeta[range].label} 쌓인 성과 기록`} (${activeItems.length}건)`),
        activeItems.length > 6 ? h('button', {
          type: 'button', class: 'btn link',
          onclick: () => { ui.archiveMore = !ui.archiveMore; render(); },
        }, ui.archiveMore ? '접기' : `전체 ${activeItems.length}건 펼쳐보기 →`) : null),
      visibleLogs.length
        ? h('div', { class: 'arch-log-list' }, visibleLogs.map((it) => {
          const eObj = it.actorId && it.actorId !== 'jay' ? emp(it.actorId) : null;
          return h('button', {
            type: 'button',
            class: `arch-log-item${it.taskId ? '' : ' is-static'}`,
            onclick: () => { if (it.taskId) openTaskById(it.taskId); },
          },
          h('span', { class: 'arch-log-date' }, `${it.date.slice(5)}${it.timeStr ? ` ${it.timeStr}` : ''}`),
          eObj ? avatarEl(eObj, { size: 24 }) : h('span', { class: 'ops-feed-me sm' }, '대표'),
          h('span', { class: 'arch-log-cat', style: `border-color:${it.cat.color}` }, it.cat.label),
          h('div', { class: 'arch-log-main' },
            h('div', { class: 'arch-log-ttl' }, it.title),
            it.summary ? h('div', { class: 'arch-log-sum' }, it.summary) : null),
          it.taskId ? h('span', { class: 'arch-log-go' }, '열기 →') : null);
        }))
        : h('div', { class: 'empty small' }, '이 기간에는 아직 완료된 작업이 없어요. AI에게 일을 시키면 자동으로 차곡차곡 쌓입니다.')));
}

function pageDashboard() {
  const d = S.data;
  const today = d.tasks.filter((t) => t.date === S.today);
  const doneCnt = today.filter((t) => t.status === '완료').length;
  const pctDone = today.length ? Math.round((doneCnt / today.length) * 100) : 0;
  const workingList = S.working || [];
  const workingCnt = workingList.length;
  const linkedCnt = d.employees.filter(isEmpLinkedQuick).length;
  const coolCnt = d.employees.filter(isEmpCooling).length;
  const queueCnt = d.tasks.filter((t) => t.queued && t.status !== '완료').length;
  const aiRoutines = d.routines.filter((r) => r.enabled !== false && !r.feature && r.assignee && r.assignee !== 'jay');

  const machines = d.resources.filter((r) => r.kind === '기계');
  const phones = d.resources.filter((r) => r.kind === '스마트폰' && r.status !== '꺼짐');
  const thisMac = machines.find((m) => m.isThisMac) || machines[0] || null;
  const localH = thisMac ? S.machineHealth?.[thisMac.id] : null;
  const T = S.localTelemetry || null;
  const ramPct = T?.ramPct ?? localH?.ramPct ?? null;
  const ramAvailPct = ramPct !== null ? Math.max(0, 100 - ramPct) : null;
  const maxRamPct = thisMac?.maxRamPct || 85;
  const movingMachineCnt = machines.filter((m) => S.machineHealth?.[m.id]?.moving).length;

  // 멤버십 잔여량 정렬: 1) 지금 일하는 AI, 2) 5시간 한도 측정되는 클라우드 모델, 3) 기타 연결 CLI, 4) 무제한 로컬
  const quotaRows = d.employees.map(empQuotaInfo).sort((a, b) => {
    if (a.working !== b.working) return a.working ? -1 : 1;
    const rank = (x) => (x.pctRemain !== null && !x.unlimited ? 0 : x.unlimited ? 2 : x.linked ? 1 : 3);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (b.pctRemain ?? -1) - (a.pctRemain ?? -1);
  });
  const bestCloud = quotaRows.find((q) => !q.unlimited && q.linked && q.pctRemain !== null && q.pctRemain > 15)
    || quotaRows.find((q) => q.linked && q.level !== 'hot')
    || quotaRows[0]
    || null;
  const hotQuotas = quotaRows.filter((q) => q.level === 'hot');
  const autoOptOn = d.settings?.autoOptimize !== false;
  const routingSentence = hotQuotas.length && bestCloud && bestCloud.e.id !== hotQuotas[0].e.id
    ? `${autoOptOn ? '멤버십 최적화 ON' : '최적화 OFF'} · ${hotQuotas[0].shortBrand} 잔여 ${hotQuotas[0].pctRemain ?? 0}% → 신규 명령 시 ${bestCloud.shortBrand}(${bestCloud.unlimited ? '무제한' : `${bestCloud.pctRemain}% 남음`})로 자동 배분`
    : bestCloud
      ? `${autoOptOn ? '멤버십 최적화 ON' : '최적화 OFF'} · ${bestCloud.shortBrand}(${bestCloud.unlimited ? '무제한' : bestCloud.pctRemain !== null ? `${bestCloud.pctRemain}% 남음` : '즉시 가동'}) 중심 자동 배분 중`
      : 'AI 직원을 연결하면 멤버십 잔여량과 자동 배분이 실시간으로 표시됩니다';

  const H = S.health || { connected: false, score: null, level: 'none', levelLabel: '연동 대기', advice: '', today: null, goals: { steps: 8000, sleepHours: 7.5, exerciseMin: 30, restingHrMax: 75 }, trend7: [] };
  const tdH = H.today || {};
  const gH = H.goals || { steps: 8000, sleepHours: 7.5, exerciseMin: 30 };
  const stepsFrac = typeof tdH.steps === 'number' ? Math.min(1, tdH.steps / Math.max(1, gH.steps)) : null;
  const sleepFrac = typeof tdH.sleepHours === 'number' ? Math.min(1, tdH.sleepHours / Math.max(1, gH.sleepHours)) : null;
  const hrNow = tdH.restingHr ?? tdH.heartRate ?? null;
  const exFrac = typeof tdH.exerciseMin === 'number' ? Math.min(1, tdH.exerciseMin / Math.max(1, gH.exerciseMin)) : (hrNow != null ? Math.min(1, Math.max(0.15, 1 - Math.max(0, hrNow - 55) / 60)) : null);

  // 1) 브랜드 시그니처 옵시디언 라이브 히어로 (매트 블랙 #0A0A0C × 샴페인 골드 #D4A359)
  const heroMetric = (kicker, bigVal, sub, tone = '', onClick = null) => h('div', {
    class: `ops-kpi${tone ? ` t-${tone}` : ''}${onClick ? ' clickable' : ''}`,
    onclick: onClick || undefined,
  },
  h('span', { class: 'ops-kpi-k' }, kicker),
  h('div', { class: 'ops-kpi-v' }, bigVal),
  h('span', { class: 'ops-kpi-s' }, sub));

  const opsHero = h('section', { class: 'ops-hero', 'aria-label': 'CONNECT AI LIVE OPERATIONS' },
    h('div', { class: 'ops-hero-top' },
      h('div', { class: 'ops-hero-brand' },
        h('div', { class: 'ops-kicker' }, 'CONNECT AI LAB · LIVE OPERATIONS CENTER'),
        h('div', { class: 'ops-hero-status' },
          h('span', { class: `ops-beacon${workingCnt ? ' live' : ' ready'}` },
            h('i', { class: 'ops-dot' }),
            workingCnt ? `지금 ${workingCnt}명 일하는 중` : `즉시 가동 준비 · ${linkedCnt}명 연결`),
          h('span', { class: 'ops-route-note' }, routingSentence))),
      h('div', { class: 'ops-hero-acts' },
        h('button', { type: 'button', class: 'swarm-btn gold', onclick: () => { location.hash = '#home'; setTimeout(() => document.querySelector('[data-k="add-title"]')?.focus(), 80); } }, '+ 명령 시키기'),
        h('button', { type: 'button', class: 'swarm-btn', onclick: () => load() }, '새로고침'),
        h('button', { type: 'button', class: 'swarm-btn', onclick: openDailyReport }, '오늘 리포트'))),
    h('div', { class: 'ops-kpis' },
      heroMetric(
        '멤버십 최상 여유',
        bestCloud ? `${bestCloud.shortBrand} ${bestCloud.unlimited ? '무제한' : bestCloud.pctRemain !== null ? `${bestCloud.pctRemain}%` : '연결'}` : '—',
        hotQuotas.length ? `${hotQuotas[0].shortBrand} ${hotQuotas[0].pctRemain ?? 0}% 남음 · 자동 우회 중` : (bestCloud?.resetLong || '5시간 한도 여유 충분'),
        hotQuotas.length ? 'gold' : 'gold',
        () => { location.hash = '#staff'; },
      ),
      heroMetric(
        '지금 일하는 AI',
        workingCnt ? `${workingCnt}명 가동` : '전원 대기',
        workingCnt
          ? `${workingList.map((w) => shortName(w.emp)).slice(0, 2).join(' · ')} 실행 중`
          : `연결 ${linkedCnt}/${d.employees.length}명 · 대기열 ${queueCnt}건${coolCnt ? ` · 휴식 ${coolCnt}` : ''}`,
        workingCnt ? 'live' : '',
        () => { location.hash = '#home'; },
      ),
      heroMetric(
        '컴퓨터 남은 RAM',
        ramAvailPct !== null ? `${ramAvailPct}%` : '—',
        `${T?.availGB != null ? `${T.availGB}GB 남음` : '측정 중'} · ${movingMachineCnt ? `${movingMachineCnt}/${machines.length}대 가동 중` : `컴퓨터 ${machines.length}대 대기`}`,
        localH?.level === 'overload' ? 'hot' : movingMachineCnt ? 'live' : '',
        () => { ui.resTab = 'machines'; location.hash = '#resources'; },
      ),
      heroMetric(
        '오늘 처리 완료',
        today.length ? `${pctDone}%` : '—',
        `완료 ${doneCnt} / 전체 ${today.length}건 · 오토메이션 ${aiRoutines.length}개`,
        '',
        () => { document.getElementById('work-archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      )));

  // 2) 좌측: 멤버십 (플랫 1줄 행 · 중첩 박스/뱃지 도배 제거)
  const membershipCard = h('section', { class: 'ops-card ops-calm' },
    h('div', { class: 'ops-card-h' },
      h('h2', null, '멤버십'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { location.hash = '#staff'; } }, '관리')),
    quotaRows.length
      ? h('div', { class: 'flat-list' }, quotaRows.map((q) => {
        const barW = q.unlimited ? 100 : (q.pctRemain !== null ? q.pctRemain : (q.linked ? 100 : 0));
        const valTxt = q.working ? `● ${fmtElapsedSec(q.job?.elapsedSec)}`
          : q.cooling ? `휴식 ${q.coolMin}m`
            : q.unlimited ? '무제한'
              : q.pctRemain !== null ? `${q.pctRemain}%`
                : (q.linked ? '준비' : '꺼짐');
        return h('button', {
          type: 'button',
          class: `flat-row flat-mem${q.working ? ' is-live' : ''}`,
          onclick: () => openAvatarModal(q.e),
          title: [q.modelLabel, q.resetLong || q.source, q.runsToday ? `오늘 ${q.runsToday}건` : ''].filter(Boolean).join(' · '),
        },
        avatarEl(q.e, { size: 28 }),
        h('span', { class: 'flat-nm' }, shortName(q.e.id)),
        h('span', { class: 'flat-bar' }, h('i', { class: `ops-fuel-fill lv-${q.working ? 'live' : q.level}`, style: `width:${barW}%` })),
        h('span', { class: `flat-val${q.working ? ' is-live' : q.level === 'hot' ? ' is-hot' : ''}` }, valTxt));
      }))
      : h('div', { class: 'empty small' }, 'AI 직원 없음'));

  // 3) 우측: 최근 활동 (실행 중일 때만 라이브 행 · 불필요한 대기 박스/뱃지 제거)
  const recentFeed = [...d.tasks]
    .filter((t) => t.status === '완료' || (t.gate && !t.gateApprovedAt && t.status !== '완료') || t.queued)
    .sort((a, b) => String(b.completedAt || b.runStartedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.runStartedAt || a.createdAt || '')))
    .slice(0, 6);

  const liveActivityCard = h('section', { class: 'ops-card ops-calm' },
    h('div', { class: 'ops-card-h' },
      h('h2', null, workingCnt ? `실행 중 (${workingCnt})` : '최근 활동'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { location.hash = '#home'; } }, '할 일')),
    workingCnt
      ? h('div', { class: 'flat-list', style: 'margin-bottom:8px' }, workingList.map((w) => {
        const eObj = emp(w.emp);
        return h('button', {
          type: 'button', class: 'flat-row is-live',
          onclick: () => { if (w.taskId) openTaskById(w.taskId); },
        },
        eObj ? avatarEl(eObj, { size: 24, stateOverride: 'working' }) : null,
        h('span', { class: 'flat-title' }, w.title || w.label || '실행 중'),
        h('span', { class: 'flat-val is-live', 'data-live-since': w.since || null, 'data-live-prefix': '● ' }, `● ${fmtElapsedSec(w.elapsedSec)}`));
      }))
      : null,
    recentFeed.length
      ? h('div', { class: 'flat-list' }, recentFeed.map((t) => {
        const eObj = t.assignee && t.assignee !== 'jay' ? emp(t.assignee) : null;
        const isGateWait = Boolean(t.gate && !t.gateApprovedAt && t.status !== '완료');
        const tsRaw = t.completedAt || t.runStartedAt || t.createdAt;
        const tsDate = tsRaw ? new Date(tsRaw) : null;
        const tsStr = tsDate && !Number.isNaN(tsDate.getTime())
          ? `${pad(tsDate.getHours())}:${pad(tsDate.getMinutes())}`
          : (t.time || '');
        const rightMeta = isGateWait ? `${t.gate} 대기` : [shortName(t.assignee), tsStr].filter(Boolean).join(' · ');
        return h('button', {
          type: 'button', class: 'flat-row',
          onclick: () => openTaskById(t.id),
        },
        eObj ? avatarEl(eObj, { size: 24 }) : h('span', { class: 'ops-feed-me' }, '나'),
        h('span', { class: 'flat-title' }, t.title),
        h('span', { class: `flat-meta${isGateWait ? ' is-hot' : ''}` }, rightMeta));
      }))
      : h('div', { class: 'empty small' }, '기록 없음'));

  // 4) 전폭: 컴퓨터 (4단 중첩 링 박스 제거 → 플랫 1줄 지표)
  const machinesCard = h('section', { class: 'ops-card ops-calm ops-machines-card' },
    h('div', { class: 'ops-card-h' },
      h('h2', null, `컴퓨터 (${machines.length})`),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { ui.resTab = 'machines'; location.hash = '#resources'; } }, '관리')),
    h('div', { class: 'flat-list' }, machines.map((m) => {
      const mh = S.machineHealth?.[m.id] || {};
      const mRamUsed = typeof mh.ramPct === 'number' ? mh.ramPct : (m.isThisMac ? ramPct : null);
      const mRamAvail = mRamUsed !== null ? Math.max(0, 100 - mRamUsed) : null;
      const mAvailGB = mh.availGB ?? (m.isThisMac ? T?.availGB : null);
      const mTotalGB = mh.totalGB ?? (m.isThisMac ? T?.totalGB : null);
      const mDiskFreeGB = mh.diskFreeGB ?? (m.isThisMac ? T?.diskFreeGB : null);
      const mCpuFree = mh.cpuFreePct ?? (m.isThisMac ? T?.cpuFreePct : null);
      const mChip = mh.chip || (m.isThisMac ? T?.chip : '') || '';
      const activeJobs = Array.isArray(mh.activeJobs) ? mh.activeJobs : [];
      const isMoving = activeJobs.length > 0;
      const hasLive = mRamAvail !== null || mCpuFree !== null;

      return h('div', { class: `flat-mach${isMoving ? ' is-live' : ''}` },
        h('div', { class: 'flat-mach-l' },
          h('b', null, m.name),
          mChip ? h('span', { class: 'small muted' }, mChip) : null,
          isMoving ? h('span', { class: 'flat-val is-live' }, `● ${activeJobs.length}건 실행`) : null),
        hasLive
          ? h('div', { class: 'flat-mach-stats' },
            mRamAvail !== null ? h('span', { class: 'flat-stat' }, h('span', { class: 'muted' }, 'RAM 여유 '), h('b', null, `${mRamAvail}%`), mAvailGB != null ? h('span', { class: 'muted' }, ` (${mAvailGB}/${mTotalGB || ''}G)`) : null) : null,
            mCpuFree !== null ? h('span', { class: 'flat-stat' }, h('span', { class: 'muted' }, 'CPU 여유 '), h('b', null, `${mCpuFree}%`)) : null,
            mDiskFreeGB != null ? h('span', { class: 'flat-stat' }, h('span', { class: 'muted' }, '디스크 '), h('b', null, `${Math.round(mDiskFreeGB)}GB`)) : null)
          : h('span', { class: 'small muted' }, m.status === '꺼짐' ? '꺼짐' : '원격 대기'));
    })));

  // 5) 하단: 구조도 · 근무 타임라인 · 대표 컨디션(미연동 시 컴팩트 1줄)
  const topoModel = buildTopologyModel();
  const topoSvg = C.companyGraph(topoModel, {
    onSelect: (node) => {
      if (node.resTab) ui.resTab = node.resTab;
      location.hash = `#${node.route || 'home'}`;
    },
  });

  const barItems = d.employees.map((e) => {
    const list = today.filter((t) => t.assignee === e.id);
    return {
      name: shortName(e.id),
      total: list.length,
      done: list.filter((t) => t.status === '완료').length,
      working: isWorking(e.id),
      cooling: isEmpCooling(e),
    };
  });

  const healthSection = H.score == null
    ? h('section', { class: 'dash-card ops-health-compact' },
      h('div', { class: 'ops-hc-left' },
        h('button', {
          type: 'button', class: 'health-doc-btn', title: '클릭해 어의 허준 ↔ 의녀 대장금 전환',
          onclick: () => {
            const nextDoc = d.settings?.healthDoctor === 'daejanggeum' ? 'heojun' : 'daejanggeum';
            once('flip-doc', () => act('PATCH', '/api/ui/settings', { healthDoctor: nextDoc }, nextDoc === 'daejanggeum' ? '의녀 대장금으로 바꿨어요' : '어의 허준으로 바꿨어요'));
          },
        }, C.avatarSvg(d.settings?.healthDoctor === 'daejanggeum' ? 'daejanggeum' : 'heojun', { size: 34, state: 'idle', style: 'pixel' })),
        h('div', { class: 'ops-hc-title' }, h('b', null, '대표 컨디션'))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: openHealthLogModal }, '5초 기록'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: openHealthConnectModal }, '폰 연동')))
    : h('section', { class: 'dash-card' },
      h('div', { class: 'dash-card-h' },
        h('div', { class: 'health-doc-badge' },
          h('button', {
            type: 'button', class: 'health-doc-btn', title: '클릭해 어의 허준 ↔ 의녀 대장금 전환',
            onclick: () => {
              const nextDoc = d.settings?.healthDoctor === 'daejanggeum' ? 'heojun' : 'daejanggeum';
              once('flip-doc', () => act('PATCH', '/api/ui/settings', { healthDoctor: nextDoc }, nextDoc === 'daejanggeum' ? '의녀 대장금으로 바꿨어요' : '어의 허준으로 바꿨어요'));
            },
          }, C.avatarSvg(d.settings?.healthDoctor === 'daejanggeum' ? 'daejanggeum' : 'heojun', { size: 30, state: 'working', style: 'pixel' })),
          h('h2', null, `대표 컨디션 · ${H.score}점 (${H.levelLabel})`)),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn sm', onclick: openHealthLogModal }, '5초 기록'),
          h('button', { type: 'button', class: 'btn sm', onclick: openHealthConnectModal }, '폰 연동'))),
      h('div', { class: 'gauge-grid' },
        h('div', { class: 'gauge-box' }, C.ring(stepsFrac, { label: '오늘 걸음 수', tone: 'gold' }),
          h('div', null, h('div', { class: 'g-k' }, '오늘 걸음'), h('div', { class: 'g-v' }, typeof tdH.steps === 'number' ? `${tdH.steps.toLocaleString('ko-KR')}보` : `목표 ${(gH.steps || 8000).toLocaleString('ko-KR')}`))),
        h('div', { class: 'gauge-box' }, C.ring(sleepFrac, { label: '수면 시간', tone: 'gold' }),
          h('div', null, h('div', { class: 'g-k' }, '수면'), h('div', { class: 'g-v' }, typeof tdH.sleepHours === 'number' ? `${tdH.sleepHours}시간` : `목표 ${gH.sleepHours || 7.5}시간`))),
        h('div', { class: 'gauge-box' }, C.ring(exFrac, { label: '심박 · 운동', tone: 'ink' }),
          h('div', null, h('div', { class: 'g-k' }, '심박 · 운동'), h('div', { class: 'g-v' }, [hrNow != null ? `${hrNow}bpm` : '', typeof tdH.exerciseMin === 'number' ? `${tdH.exerciseMin}분` : ''].filter(Boolean).join(' · ') || '기록 전')))),
      C.healthChart(H.trend7 || []),
      h('div', { class: 'health-advice' },
        h('span', { class: `tag${H.delegateRecommended ? ' solid' : ''}` }, H.levelLabel),
        h('span', { class: 'small' }, H.advice)));

  const dashTab = ui.dashTab || 'archive';
  return h('div', { class: 'ops-page' },
    h('div', { class: 'head' },
      h('div', null,
        h('h1', null, h('b', null, '대시보드')),
        h('div', { class: 'sub' }, `${d.settings.companyName || 'CONNECT AI'} · AI 직원 ${d.employees.length}명 · 컴퓨터 ${machines.length}대`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => { location.hash = '#pocket'; } }, '폰 뷰'),
        h('button', { class: 'btn sm', onclick: openHealthLogModal }, '컨디션 기록'))),
    opsHero,
    h('div', { class: 'picker dash-tabs', role: 'tablist', 'aria-label': '대시보드 보기' },
      [['archive', '성과 아카이브'], ['ops', '실시간 운영 · 구조도']].map(([k, lbl]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': dashTab === k ? 'true' : 'false',
        class: `chip${dashTab === k ? ' on' : ''}`,
        onclick: () => { ui.dashTab = k; render(); },
      }, lbl))),
    dashTab === 'archive'
      ? buildWorkArchiveCard()
      : [
        h('div', { class: 'ops-deck' }, membershipCard, liveActivityCard),
        machinesCard,
        h('section', { class: 'dash-card' },
          h('div', { class: 'dash-card-h' }, h('h2', null, '라이브 구조도')),
          h('div', { class: 'topo-wrap' }, topoSvg)),
        h('section', { class: 'dash-card' },
          h('div', { class: 'dash-card-h' },
            h('h2', null, '업무 분포 · 타임라인'),
            h('div', { class: 'wbar-legend' },
              h('span', null, h('i', { class: 'wbar-dot-done' }), '완료'),
              h('span', null, h('i', { class: 'wbar-dot-open' }), '진행 · 대기'))),
          h('div', { class: 'dash-staff-grid' },
            h('div', null, barItems.length ? C.workloadBars(barItems) : h('div', { class: 'empty' }, 'AI 직원을 추가하면 표시됩니다')),
            h('div', null, timeline()))),
        healthSection,
      ]);
}

// ───────── AI 직원 캐릭터 · 5시간 토큰 바 · 스마트폰 포켓 라이브 뷰 (#pocket) ─────────

function fmtResetMin(m) {
  if (!m) return '';
  return m >= 60 ? `약 ${Math.floor(m / 60)}시간 ${m % 60}분 뒤 리셋` : `약 ${m}분 뒤 리셋`;
}

const LEGACY_AVATAR = { fox: 'dokkaebi', cat: 'haetae', owl: 'kkachi', whale: 'cheongnyong', rabbit: 'dalto', bot: 'jangseung', bear: 'bonghwang', spark: 'horangi' };
function normAvatarKey(k) { return LEGACY_AVATAR[k] || k || 'haetae'; }

function avatarEl(e, { size = 44, clickable = false, stateOverride = null, styleOverride = null, onDark = false } = {}) {
  const working = stateOverride ? stateOverride === 'working' : isWorking(e.id);
  const cooling = stateOverride ? stateOverride === 'cooling' : isEmpCooling(e);
  const state = working ? 'working' : cooling ? 'cooling' : 'idle';
  const key = normAvatarKey(e.avatar);
  const isJoseon = Boolean(window.PixelCrew?.isJoseonKey(key));
  const style = isJoseon ? 'pixel' : (styleOverride || e.avatarStyle || 'studio');
  let inner;
  if (e.avatarImage) {
    inner = h('div', { class: `avatar-img-wrap${working ? ' working' : ''}${cooling ? ' cool' : ''}`, style: `width:${size}px;height:${size}px` },
      h('img', { src: e.avatarImage, alt: `${e.name} 캐릭터`, width: size, height: size }),
      working ? h('i', { class: 'av-dot' }) : null,
      cooling ? h('span', { class: 'av-zz' }, 'zZ') : null);
  } else if (style === 'pixel' || isJoseon) {
    inner = h('div', { class: `av-px-wrap${working ? ' working' : ''}${cooling ? ' cool' : ''}${onDark ? ' on-dark' : ''}`, style: `width:${size}px;height:${size}px` },
      C.avatarSvg(key, { size, state, style: 'pixel' }),
      working ? h('i', { class: 'av-dot' }) : null,
      cooling ? h('span', { class: 'av-cool-badge' }, '휴식') : null);
  } else if (style === 'studio') {
    inner = h('div', { class: `avatar-img-wrap studio${working ? ' working' : ''}${cooling ? ' cool' : ''}`, style: `width:${size}px;height:${size}px` },
      h('img', { src: `/mascots/${key}.jpg`, alt: `${e.name} 캐릭터`, width: size, height: size, loading: 'lazy' }),
      working ? h('i', { class: 'av-dot' }) : null,
      cooling ? h('span', { class: 'av-zz' }, 'zZ') : null);
  } else {
    inner = C.avatarSvg(key, { size, state, style });
  }
  if (!clickable) return inner;
  return h('button', {
    type: 'button', class: 'avatar-btn', title: `${e.name} 캐릭터 스튜디오 열기`,
    onclick: (ev) => { ev.stopPropagation(); openAvatarModal(e); },
  }, inner);
}

function usageBarEl(e) {
  const q = empQuotaInfo(e);
  if (q.pctRemain === null && !q.unlimited && q.source === 'HQ 실행 기록') return null;
  const barW = q.unlimited ? 100 : (q.pctRemain !== null ? q.pctRemain : 0);
  return h('div', { class: 'usage-line' },
    (q.pctRemain !== null || q.unlimited)
      ? h('div', { class: 'ops-fuel-track sm', title: q.unlimited ? '무제한 로컬 실행' : `5시간 한도 ${q.pctRemain}% 남음 (사용 ${q.pctUsed}%)` },
        h('i', { class: `ops-fuel-fill lv-${q.working ? 'live' : q.level}`, style: `width:${barW}%` }))
      : null,
    h('span', { class: 'small muted' }, q.unlimited
      ? '무제한 · 로컬 실행'
      : q.pctRemain !== null
        ? `${q.pctRemain}% 남음${q.resetLong ? ` · ${q.resetLong}` : ''}`
        : q.source),
    q.level === 'hot' ? h('span', { class: 'ops-pill sm is-hot' }, q.cooling ? '휴식 중' : '자동 우회') : null);
}

function resizeImageToDataUrl(file, grayscale = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽을 수 없어요.'));
    reader.onload = () => {
      // GIF 애니메이션은 180KB 이하면 움직임 그대로 유지
      if (file.type === 'image/gif' && !grayscale && String(reader.result).length <= 235000) {
        resolve(String(reader.result));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('이미지가 아니에요.'));
      img.onload = () => {
        const size = 192;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        if (grayscale) ctx.filter = 'grayscale(100%) contrast(108%)';
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function buildAvatarPrompt(emp, vibe, prop) {
  const vibeDesc = {
    k3d: 'National Museum of Korea MU:DS x Pop Mart style ultra-cute full-color 3D matte clay vinyl toy bust figurine of a Korean traditional heritage guardian character (like baby Haetae, Dokkaebi, Kkachi with Gat, Minhwa tiger, Cheongnyong, or Jangseung), Korean pastel Obangsaek colors',
    '3d': 'Pop Mart x Pixar style ultra-cute full-color 3D matte clay vinyl toy bust figurine, soft pastel studio lighting',
    illust: 'Warm editorial Korean Minhwa & kawaii full-color character illustration, clean soft outlines, rosy cheeks, cheerful pastel palette',
    pixel: 'Cute vibrant 16-bit full-color retro pixel art Korean heritage character portrait, crisp pixel edges, pastel studio background',
  }[vibe] || 'ultra-cute full-color 3D chibi vinyl toy bust portrait';
  const roleHint = emp.role ? `representing the AI role: "${emp.role}"` : 'for a 1-person AI company teammate';
  const propHint = prop ? `, holding or wearing: ${prop}` : '';
  return `1:1 square centered bust portrait for CONNECT AI LAB, ${roleHint}${propHint}. Style: ${vibeDesc}. Joyful big glossy kawaii eyes, rosy cheeks, vibrant harmonious colors, clean solid soft pastel Hanji background with generous padding, zero text, zero watermark.`;
}

function openAvatarModal(e, opts = {}) {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const presets = (S.options.avatarPresets || []).filter((p) => p.pack === 'joseon' || p.pack === 'k-crew');
  const teams = S.options.teams || [];
  const packs = (S.options.avatarPacks || [
    { key: 'joseon', name: '조선 집현전 픽셀 (21종)' },
    { key: 'k-crew', name: '한국 수호신 픽셀 (8종)' },
  ]).filter((pk) => pk.key === 'joseon' || pk.key === 'k-crew');
  let pickedKey = normAvatarKey(e.avatar);
  if (!presets.some((p) => p.key === pickedKey)) pickedKey = presets[0]?.key || 'jangyeongsil';
  const pickedStyle = 'pixel';
  let pickedTeam = e.team || 'ops';
  let customImg = e.avatarImage || '';
  const initialPack = presets.find((p) => p.key === pickedKey)?.pack || 'joseon';
  let pickedTab = (opts.tab && (opts.tab === 'joseon' || opts.tab === 'k-crew' || opts.tab === 'custom'))
    ? opts.tab
    : (customImg ? 'custom' : initialPack);
  let previewState = 'working';
  let genVibe = 'k3d';
  const avatarNameIn = h('input', { class: 'in', value: e.avatarName || '', placeholder: `예: 장영실 팀장 · 보부상 과장 (비우면 ${e.name})`, maxlength: '40', 'data-k': 'av-name' });
  const personaIn = h('input', { class: 'in', value: e.persona || '', placeholder: '예: 해시계·자동화 담당 · 밤새 갓 쓰고 기획', maxlength: '80', 'data-k': 'av-persona' });
  const teamSel = h('select', { class: 'in', 'aria-label': '소속 팀(부서)' }, teams.map((t) => h('option', { value: t.key, selected: t.key === pickedTeam }, t.name)));
  teamSel.addEventListener('change', () => { pickedTeam = teamSel.value; });
  const propIn = h('input', { class: 'in sm', placeholder: '추가 소품 (선택, 예: 복주머니, 갓, 노트북, 붓)' });
  const grayChk = h('input', { type: 'checkbox', checked: false });
  const previewWrap = h('div', { class: 'av-preview-bar' });
  const packBar = h('div', { class: 'picker' });
  const bodyWrap = h('div');
  const promptPre = h('pre', { class: 'full', style: 'margin:8px 0 0;font-size:11px;max-height:110px' });

  const syncPrompt = () => { promptPre.textContent = buildAvatarPrompt(e, genVibe, propIn.value.trim()); };
  propIn.addEventListener('input', syncPrompt);
  avatarNameIn.addEventListener('input', () => renderPreview());

  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: 'display:none' });
  const applyImageFile = async (f, fromPaste = false) => {
    if (!f) return;
    try {
      customImg = await resizeImageToDataUrl(f, grayChk.checked);
      pickedTab = 'custom';
      renderPackBar();
      renderBody();
      renderPreview();
      toast(fromPaste ? '붙여넣은 이미지를 캐릭터로 적용했어요' : '캐릭터 이미지를 적용했어요');
    } catch (err) {
      toast(err.message || '이미지 처리 오류');
    }
  };
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; fileIn.value = ''; applyImageFile(f, false); });

  const onPaste = (ev) => {
    if (!dlg.open) return;
    const items = ev.clipboardData?.items || [];
    for (const it of items) {
      if (it.kind === 'file' && /^image\/(png|jpeg|webp|gif)$/.test(it.type)) {
        ev.preventDefault();
        applyImageFile(it.getAsFile(), true);
        return;
      }
    }
  };
  window.addEventListener('paste', onPaste);
  const closeDlg = () => {
    window.removeEventListener('paste', onPaste);
    dlg.className = '';
    if (dlg.open) dlg.close();
  };
  dlg.addEventListener('close', () => window.removeEventListener('paste', onPaste), { once: true });

  const vibeBtns = [['k3d', 'K-전통 3D 피규어'], ['3d', '모던 3D 피규어'], ['illust', '한국 민화 일러스트'], ['pixel', '컬러 픽셀']].map(([vk, vl]) => h('button', {
    type: 'button', class: `chip sm${genVibe === vk ? ' on' : ''}`,
    onclick: (ev) => {
      genVibe = vk;
      for (const b of ev.currentTarget.parentElement.children) b.classList.toggle('on', b === ev.currentTarget);
      syncPrompt();
    },
  }, vl));

  const aiPromptBox = h('details', { class: 'pack-box', style: 'margin-top:10px' },
    h('summary', null, 'AI로 나만의 캐릭터 이미지 생성하기 (프롬프트 1클릭 복사 → ⌘V 바로 적용)'),
    h('div', { style: 'margin-top:10px;display:flex;flex-direction:column;gap:8px' },
      h('div', { class: 'picker' }, vibeBtns),
      propIn,
      promptPre,
      h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:4px' },
        h('div', { class: 'row' },
          h('a', { class: 'btn sm', href: 'https://gemini.google.com/app', target: '_blank', rel: 'noopener noreferrer' }, 'Gemini 열기 ↗'),
          h('a', { class: 'btn sm', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, 'ChatGPT 열기 ↗')),
        h('button', { type: 'button', class: 'btn sm dark', onclick: async () => { await copyText(promptPre.textContent); toast('이미지 생성 프롬프트를 복사했어요'); } }, '프롬프트 복사'))));

  const renderPackBar = () => {
    const tabs = [...packs, { key: 'custom', name: '직접 만들기 (내 이미지)' }];
    packBar.replaceChildren(...tabs.map((pk) => h('button', {
      type: 'button', class: `chip${pickedTab === pk.key ? ' on' : ''}`, 'data-tab': pk.key,
      onclick: () => {
        pickedTab = pk.key;
        if (pk.key !== 'custom') {
          const firstInPack = presets.find((p) => p.pack === pk.key);
          if (firstInPack && presets.find((p) => p.key === pickedKey)?.pack !== pk.key) pickedKey = firstInPack.key;
          customImg = '';
        }
        renderPackBar();
        renderBody();
        renderPreview();
      },
    }, pk.name)));
  };

  const renderPreview = () => {
    const customName = avatarNameIn.value.trim();
    const displayName = customName || e.name;
    const fakeEmp = { ...e, name: displayName, avatar: pickedKey, avatarStyle: pickedStyle, avatarImage: customImg };
    const prObj = presets.find((x) => x.key === pickedKey);
    const pkObj = packs.find((x) => x.key === pickedTab);
    const stateBtns = [['idle', '대기'], ['working', '근무 중'], ['cooling', '휴식']].map(([sk, sl]) => h('button', {
      type: 'button', class: `chip sm${previewState === sk ? ' on' : ''}`,
      onclick: () => { previewState = sk; renderPreview(); },
    }, sl));
    previewWrap.replaceChildren(...[
      h('div', { class: 'row', style: 'gap:14px;align-items:center;min-width:0' },
        avatarEl(fakeEmp, { size: 64, stateOverride: previewState, styleOverride: pickedStyle }),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            h('span', { style: 'font-weight:600;font-size:15px' }, displayName),
            customName && customName !== e.name ? h('span', { class: 'tag' }, e.name) : null),
          h('div', { class: 'small muted', style: 'margin-top:2px' }, customImg ? '직접 올린 내 캐릭터 이미지 · GIF' : `${prObj?.name || pickedKey} · 16비트 픽셀`),
          h('div', { class: 'row', style: 'gap:5px;margin-top:6px' }, h('span', { class: 'small muted' }, '모션'), stateBtns))),
      pickedTab !== 'custom' ? h('button', {
        type: 'button', class: 'btn sm',
        title: '모든 AI 직원에게 이 팩을 한 번에 적용합니다',
        onclick: () => once('all-av-style', async () => {
          await act('POST', '/api/ui/employees/avatar-style', { avatarStyle: 'pixel', pack: pickedTab }, `전체 직원을 "${pkObj?.name || pickedTab}"로 맞췄어요`);
        }),
      }, '전체 직원 통일') : null,
    ].filter(Boolean));
  };

  const renderBody = () => {
    if (pickedTab !== 'custom') {
      const visible = presets.filter((p) => p.pack === pickedTab);
      const grid = h('div', { class: 'avatar-grid' }, visible.map((p) => {
        const fake = { id: `pre-${p.key}`, name: p.name, avatar: p.key, avatarStyle: 'pixel', avatarImage: '' };
        return h('button', {
          type: 'button', class: `avatar-opt${!customImg && pickedKey === p.key ? ' on' : ''}`,
          onclick: () => {
            pickedKey = p.key;
            if (p.team && teams.some((t) => t.key === p.team)) { pickedTeam = p.team; teamSel.value = p.team; }
            customImg = '';
            renderBody();
            renderPreview();
          },
        }, avatarEl(fake, { size: 46, stateOverride: 'working', styleOverride: 'pixel' }), h('b', null, p.name), h('span', { class: 'small muted' }, p.hint));
      }));
      bodyWrap.replaceChildren(
        grid,
        h('div', { class: 'bp-bar' },
          h('span', { class: 'small muted' }, '직접 만든 그림·사진·GIF로 바꾸고 싶다면?'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { pickedTab = 'custom'; renderPackBar(); renderBody(); renderPreview(); } }, '내 이미지 올리기 →')));
      return;
    }

    const saved = S.data.settings?.customAvatars || [];
    const dropzone = h('div', {
      class: `av-dropzone${customImg ? ' has-img' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': '캐릭터 이미지 올리기 (클릭, 드래그 앤 드롭, 붙여넣기)',
      onclick: () => fileIn.click(),
      onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fileIn.click(); } },
    },
    customImg
      ? h('img', { src: customImg, alt: '올린 캐릭터 미리보기', class: 'av-drop-thumb' })
      : h('div', { class: 'av-drop-ic', 'aria-hidden': 'true' }, '+'),
    h('div', { class: 'av-drop-txt' },
      h('b', null, customImg ? '이미지 적용됨 · 클릭하거나 새 파일을 끌어다 놓아 교체' : '내 캐릭터 이미지 · GIF 올리기'),
      h('span', { class: 'small muted' }, '클릭, 드래그&드롭, 또는 이미지 복사 후 ⌘V 붙여넣기 (PNG · JPG · WebP · GIF)')));

    dropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropzone.classList.add('over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
    dropzone.addEventListener('drop', (ev) => {
      ev.preventDefault();
      dropzone.classList.remove('over');
      const f = ev.dataTransfer?.files?.[0];
      if (f) applyImageFile(f, false);
    });

    const saveToLibBtn = h('button', {
      type: 'button', class: 'btn sm dark', disabled: !customImg,
      onclick: () => once('save-cav', async () => {
        const nm = avatarNameIn.value.trim();
        if (!nm) { avatarNameIn.focus(); toast('보관함에 저장할 캐릭터 이름을 먼저 적어 주세요'); return; }
        if (!customImg) { toast('먼저 캐릭터 이미지를 올려 주세요'); return; }
        const created = await act('POST', '/api/ui/avatars', { name: nm, image: customImg, hint: personaIn.value.trim() }, `"${nm}"을(를) 내 캐릭터 보관함에 저장했어요`);
        if (created) renderBody();
      }),
    }, '내 보관함에 저장');

    const libSec = saved.length ? h('div', { style: 'margin-top:12px' },
      h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' },
        h('span', { class: 'small', style: 'font-weight:600' }, `내 캐릭터 보관함 (${saved.length}/16)`),
        h('span', { class: 'small muted' }, '클릭하면 이름과 이미지가 함께 적용돼요')),
      h('div', { class: 'av-custom-grid' }, saved.map((c) => h('div', { class: `av-custom-item${customImg === c.image ? ' on' : ''}` },
        h('button', {
          type: 'button', class: 'av-custom-pick',
          onclick: () => {
            customImg = c.image;
            avatarNameIn.value = c.name;
            if (c.hint && !personaIn.value.trim()) personaIn.value = c.hint;
            renderBody();
            renderPreview();
          },
        },
        h('img', { src: c.image, alt: c.name, width: 44, height: 44 }),
        h('b', null, c.name),
        c.hint ? h('span', { class: 'small muted clamp' }, c.hint) : null),
        h('button', {
          type: 'button', class: 'av-custom-del', title: '보관함에서 삭제', 'aria-label': `${c.name} 삭제`,
          onclick: (ev) => {
            ev.stopPropagation();
            once(`del-cav-${c.id}`, async () => {
              await act('DELETE', `/api/ui/avatars/${c.id}`, undefined, `"${c.name}"을(를) 보관함에서 뺐어요`);
              renderBody();
            });
          },
        }, '×'))))) : null;

    bodyWrap.replaceChildren(
      dropzone,
      h('div', { class: 'bp-bar' },
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => fileIn.click() }, '파일 선택'),
          h('label', { class: 'chk-l small' }, grayChk, '흑백 필터')),
        h('div', { class: 'row' },
          customImg ? h('button', { type: 'button', class: 'btn link', onclick: () => { customImg = ''; renderBody(); renderPreview(); } }, '이미지 비우기') : null,
          saveToLibBtn)),
      libSec,
      aiPromptBox);
  };

  renderPackBar();
  renderBody();
  renderPreview();
  syncPrompt();

  setDlg(dlg,
    h('h3', null, `${shortName(e.id)} · CONNECT AI LAB 캐릭터 스튜디오`),
    h('p', { class: 'small muted', style: 'margin:-6px 0 10px' }, '조선 집현전(21종) · 한국 수호신(8종) 16비트 픽셀 크루 중에서 고르거나, 직접 이름과 내 이미지를 넣어 나만의 AI 직원을 만드세요.'),
    fileIn,
    previewWrap,
    h('div', { class: 'grid2', style: 'margin-bottom:12px' },
      h('label', { class: 'field' }, '캐릭터 이름 · 호칭 (선택)', avatarNameIn),
      h('label', { class: 'field' }, '소속 팀 (부서)', teamSel)),
    h('div', { style: 'margin-bottom:12px' },
      h('label', { class: 'field' }, '한 줄 소개 (폰 뷰에 표시, 선택)', personaIn)),
    h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px' }, packBar),
    bodyWrap,
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: closeDlg }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once(`av-${e.id}`, async () => {
        const nextAvatarName = avatarNameIn.value.trim();
        const label = nextAvatarName || e.name;
        closeDlg();
        await act('PATCH', `/api/ui/employees/${e.id}`, {
          avatar: pickedKey,
          avatarStyle: pickedStyle,
          team: pickedTeam,
          avatarName: nextAvatarName,
          avatarImage: customImg,
          persona: personaIn.value.trim(),
        }, `${label} 캐릭터를 저장했어요`);
      }) }, '저장')));
  dlg.showModal();
}

function pagePocket() {
  const d = S.data;
  const today = d.tasks.filter((t) => t.date === S.today);
  const doneCnt = today.filter((t) => t.status === '완료').length;
  const H = S.health || {};
  const thisMac = d.resources.find((r) => r.kind === '기계' && r.isThisMac) || d.resources.find((r) => r.kind === '기계');
  const localH = thisMac ? S.machineHealth?.[thisMac.id] : null;
  const ramPct = S.localTelemetry?.ramPct ?? localH?.ramPct ?? null;
  const pendingApprs = d.approvals.filter((a) => a.status === '대기');
  const pendingGates = today.filter((t) => t.gate && !t.gateApprovedAt && t.status !== '완료' && t.assignee !== 'jay');

  const pickEmpId = ui.pocketPick || (d.employees[0]?.id || 'jay');
  const cmdIn = h('input', { class: 'in', placeholder: '폰에서 바로 일 시키기 (예: 오늘 댓글 요약해 줘)', 'data-k': 'pocket-cmd', 'aria-label': '빠른 지시' });
  const sendCmd = () => submitInput(cmdIn, 'pocket-add', async (v) => {
    const r = await act('POST', '/api/ui/tasks', { title: v, assignee: pickEmpId });
    if (r) {
      toast(r.autoStarted ? `${shortName(r.assignee)}이(가) 바로 작업을 시작했어요` : r.gate ? `${r.gate} 확인이 필요해 승인 대기 중이에요` : `${shortName(r.assignee)}에게 맡겼어요`);
    }
    return r;
  });
  cmdIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) sendCmd(); });

  return h('div', { class: 'pocket' },
    h('div', { class: 'pocket-head' },
      h('div', null,
        h('div', { class: 'pocket-title' }, d.settings.companyName || 'CONNECT AI HQ'),
        h('div', { class: 'small muted' }, `${d.owner.name || '대표'}의 삶과 AI 일을 최적화하는 주머니 속 본사 · 완료 ${doneCnt}/${today.length}`)),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { location.hash = '#dashboard'; } }, '대시보드'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: openHealthLogModal }, '컨디션'))),
    h('div', { class: 'pocket-pills' },
      h('div', { class: 'pocket-pill', onclick: openHealthLogModal },
        h('span', { class: 'small muted' }, '대표 컨디션'),
        h('b', null, H.score != null ? `${H.score}점` : '기록 전')),
      h('div', { class: 'pocket-pill', onclick: () => { location.hash = '#resources'; } },
        h('span', { class: 'small muted' }, '본사 RAM'),
        h('b', null, ramPct != null ? `${ramPct}%` : '—')),
      h('div', { class: 'pocket-pill' },
        h('span', { class: 'small muted' }, '안정화'),
        h('b', null, S.runtime?.active ? '절전방지 ON' : '감시 ON'))),
    h('section', { class: 'pocket-sec' },
      h('div', { class: 'pocket-sec-h' },
        h('b', null, `내 AI 직원 (${d.employees.length}명)`),
        h('span', { class: 'small muted' }, '캐릭터 탭 · 이름·이미지 자유 설정')),
      h('div', { class: 'picker' },
        (S.options.avatarPacks || []).map((pk) => {
          const packKeys = new Set((S.options.avatarPresets || []).filter((p) => p.pack === pk.key).map((p) => p.key));
          const isPack = d.employees.length > 0 && d.employees.every((x) => !x.avatarImage && packKeys.has(normAvatarKey(x.avatar)));
          return h('button', {
            type: 'button', class: `chip sm${isPack ? ' on' : ''}`,
            onclick: () => once(`ppack-${pk.key}`, () => act('POST', '/api/ui/employees/avatar-style', { pack: pk.key }, `${pk.name}으로 바꿨어요`)),
          }, pk.key === 'k-crew' ? '한국 전통' : '모던 크루');
        }),
        (S.options.avatarStyles || []).map((st) => {
          const allSame = d.employees.length > 0 && d.employees.every((x) => (x.avatarStyle || 'studio') === st.key && !x.avatarImage);
          return h('button', {
            type: 'button', class: `chip sm${allSame ? ' on' : ''}`,
            onclick: () => once(`pstyle-${st.key}`, () => act('POST', '/api/ui/employees/avatar-style', { avatarStyle: st.key }, `캐릭터를 ${st.name} 스타일로 바꿨어요`)),
          }, st.name);
        }),
        d.employees.length ? h('button', {
          type: 'button', class: 'chip sm',
          onclick: () => openAvatarModal(emp(pickEmpId) || d.employees[0], { tab: 'custom' }),
        }, '+ 내 이미지·이름') : null),
      h('div', { class: 'pocket-grid' }, d.employees.map((e) => {
        const w = S.working.find((x) => x.emp === e.id);
        const cooling = isEmpCooling(e);
        const coolMin = empCooldownMin(e);
        const cnt = today.filter((t) => t.assignee === e.id && t.status !== '완료').length;
        const u = S.employeeUsage?.[e.id];
        const pct = typeof u?.pct5h === 'number' ? u.pct5h : null;
        return h('div', { class: `pocket-card${w ? ' working' : ''}${cooling ? ' cool' : ''}` },
          h('div', { class: 'pocket-card-top' },
            avatarEl(e, { size: 52, clickable: true }),
            h('span', { class: `tag${w || cooling ? ' solid' : ''}` }, w ? '근무 중' : cooling ? `휴식 ${coolMin}m` : cnt ? `오늘 ${cnt}` : '대기')),
          h('div', { class: 'pocket-name', title: e.avatarName && e.avatarName !== e.name ? `${e.avatarName} · ${e.name}` : e.name }, shortName(e.id)),
          h('div', { class: 'pocket-sub' }, w?.statusLine || e.persona || e.role || ENGINE_LABEL[e.engine]),
          pct !== null ? h('div', { class: 'pocket-meter' },
            h('div', { class: 'ram-bar', style: 'flex:1;width:auto' }, h('div', { class: `ram-fill${pct >= 80 ? ' over' : ''}`, style: `width:${Math.min(100, pct)}%` })),
            h('span', { class: 'mono', style: 'font-size:10px' }, `${pct}%`)) : null,
          h('div', { class: 'pocket-acts' },
            h('button', { type: 'button', class: `chip sm${pickEmpId === e.id ? ' on' : ''}`, onclick: () => { ui.pocketPick = e.id; render(); cmdIn.focus(); } }, '지시'),
            cooling
              ? h('button', { type: 'button', class: 'chip sm', onclick: () => act('POST', `/api/ui/employees/${e.id}/cooldown`, { minutes: 0 }, `${shortName(e.id)} 복귀`) }, '복귀')
              : h('button', { type: 'button', class: 'chip sm', onclick: () => openCooldownModal(e) }, '휴식')));
      }))),
    (pendingApprs.length || pendingGates.length) ? h('section', { class: 'pocket-sec' },
      h('div', { class: 'pocket-sec-h' }, h('b', null, `대표 확인 대기 (${pendingApprs.length + pendingGates.length}건)`)),
      pendingGates.map((t) => h('div', { class: 'pocket-appr' },
        h('div', null, h('div', { style: 'font-weight:600;font-size:13px' }, t.title), h('div', { class: 'small muted' }, `${shortName(t.assignee)} · ${t.gate} 확인 필요`)),
        h('button', { type: 'button', class: 'btn sm stamp-trig-btn', onclick: () => { triggerRoyalStampFx(t.gate || '결재'); act('POST', `/api/ui/tasks/${t.id}/approve-gate`, {}, '승인했어요'); } }, '승인'))),
      pendingApprs.map((a) => h('div', { class: 'pocket-appr' },
        h('div', null, h('div', { style: 'font-weight:600;font-size:13px' }, a.title || a.kind), h('div', { class: 'small muted' }, a.summary || a.body || '')),
        h('button', { type: 'button', class: 'btn sm stamp-trig-btn', onclick: () => { triggerRoyalStampFx(a.kind || '결재'); act('POST', `/api/ui/approvals/${a.id}/decide`, { decision: '승인' }, '승인했어요'); } }, '승인')))) : null,
    h('section', { class: 'pocket-cmd' },
      h('div', { class: 'small muted', style: 'margin-bottom:6px' }, `받는 직원: `, h('b', null, shortName(pickEmpId))),
      h('div', { class: 'row' }, cmdIn, h('button', { type: 'button', class: 'btn dark', onclick: sendCmd }, '보내기'))));
}

// ───────── 워크플로우 청사진 공유 (수강생·팀 배포용) ─────────

async function openBlueprintExport() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  setDlg(dlg, h('h3', null, '워크플로우 청사진 내보내기'), h('div', { class: 'small muted' }, '개인 정보를 제거하고 청사진을 만드는 중…'));
  dlg.showModal();
  try {
    const bp = await api('GET', '/api/ui/blueprint/export');
    const jsonText = JSON.stringify(bp, null, 2);
    const download = () => {
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `connect-ai-hq-blueprint-${S.today}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('청사진 JSON 파일을 저장했어요');
    };
    setDlg(dlg, 
      h('h3', null, '워크플로우 청사진 내보내기'),
      h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '로컬 파일 경로, 이메일, API 키, 매출 기록, 개인 루틴은 모두 자동으로 제거했습니다. 수강생이나 팀원에게 안전하게 공유할 수 있어요.'),
      h('div', { class: 'row', style: 'margin-bottom:12px' },
        h('span', { class: 'tag' }, `오픈소스 ${(bp.openSource || []).length}개`),
        h('span', { class: 'tag' }, `직원 스킬 ${bp.summary?.employeeSkills || 0}개`),
        h('span', { class: 'tag' }, `디자인 ${(bp.designs || []).length}개`),
        h('span', { class: 'tag' }, `계정 틀 ${(bp.accounts || []).length}개`),
        h('span', { class: 'tag' }, `AI 루틴 ${(bp.routines || []).length}개`)),
      h('pre', { class: 'report-pre mono' }, jsonText),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); } }, '닫기'),
        h('button', { class: 'btn', onclick: download }, '파일 저장 (.json)'),
        h('button', { class: 'btn dark', onclick: async () => { await copyText(jsonText); toast('워크플로우 청사진을 복사했어요'); } }, 'JSON 복사')));
  } catch {
    dlg.className = '';
    dlg.close();
  }
}

function openBlueprintImport() {
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide';
  const ta = h('textarea', { class: 'in mono', rows: 10, placeholder: '공유받은 청사진 JSON을 붙여 넣거나, 아래에서 .json 파일을 골라 주세요.', 'aria-label': '청사진 JSON' });
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': '청사진 파일 선택', onchange: async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    ta.value = await file.text();
  } });
  const doImport = () => once('bp-import', async () => {
    const raw = ta.value.trim();
    if (!raw) { ta.focus(); return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { toast('올바른 JSON 형식이 아니에요'); return; }
    dlg.className = '';
    dlg.close();
    const res = await act('POST', '/api/ui/blueprint/import', { blueprint: parsed });
    if (res?.added) {
      const a = res.added;
      const sum = [];
      if (a.employees) sum.push(`직원 ${a.employees}`);
      if (a.openSource) sum.push(`오픈소스 ${a.openSource}`);
      if (a.skills) sum.push(`직원 스킬 ${a.skills}`);
      if (a.designs) sum.push(`디자인 ${a.designs}`);
      if (a.accounts) sum.push(`계정 ${a.accounts}`);
      if (a.routines) sum.push(`루틴 ${a.routines}`);
      toast(sum.length ? `청사진을 가져왔어요 · ${sum.join(' · ')}` : '이미 모든 항목이 들어 있어요');
    }
  });
  setDlg(dlg, 
    h('h3', null, '워크플로우 청사진 가져오기'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '같은 이름의 직원·도구·루틴은 건너뛰고, 새로 추가되는 워크플로우만 안전하게 담아옵니다.'),
    h('div', { class: 'row', style: 'margin-bottom:10px' }, fileIn),
    ta,
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.className = ''; dlg.close(); render(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: doImport }, '가져오기')));
  dlg.showModal();
  ta.focus();
}

// ───────── 매일 할 일 ─────────

function dayPicker(selected) {
  const state = new Set(selected);
  const wrap = h('div', { class: 'days', role: 'group', 'aria-label': '요일' });
  WD.forEach((w, i) => {
    const b = h('button', { type: 'button', class: `chip${state.has(i) ? ' on' : ''}`, 'aria-pressed': state.has(i) ? 'true' : 'false',
      onclick: () => { if (state.has(i)) state.delete(i); else state.add(i); b.classList.toggle('on'); b.setAttribute('aria-pressed', state.has(i) ? 'true' : 'false'); } }, w);
    wrap.appendChild(b);
  });
  wrap.getDays = () => [...state].sort();
  return wrap;
}

function daysText(days) {
  if (days.length === 7) return '매일';
  if (days.join() === '1,2,3,4,5') return '월~금';
  if (days.join() === '0,6') return '주말';
  return days.map((x) => WD[x]).join(' ');
}

function dots7(r) {
  const today = new Date(`${S.today}T12:00:00`);
  const items = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const done = r.log?.[key] === '완료';
    const sched = (r.days || []).includes(d.getDay());
    items.push(h('i', { class: done ? 'ok' : sched ? 'miss' : '', title: `${key} ${done ? '완료' : sched ? '기록 없음' : '쉬는 날'}` }));
  }
  return h('span', { class: 'dots7', 'aria-label': '최근 7일 기록' }, items);
}

function fmtIntervalLabel(m) {
  const n = Number(m) || 0;
  if (!n) return '';
  return n >= 60 && n % 60 === 0 ? `${n / 60}시간마다` : `${n}분마다`;
}

const AUTOMATION_TPL_CATS = [
  ['all', '전체'],
  ['youtube', '유튜브'],
  ['sns', '인스타 · X · 스레드'],
  ['life', '일상 · 라이프'],
  ['work', '업무 · 이메일 · 개발'],
];

const AUTOMATION_TEMPLATES = [
  // 유튜브 (YouTube)
  {
    key: 'yt-benchmark',
    cat: 'youtube',
    kicker: 'YOUTUBE · BENCHMARK',
    title: '유튜브 업로드 전 벤치마크 & 훅 분석',
    desc: '경쟁 유튜브 채널 최신 영상의 조회수·썸네일·첫 5초 훅 구조를 분석해 촬영 전 리포트로 정리합니다.',
    intervalMin: null,
    time: '09:00',
    days: [2, 5],
    assignee: 'auto',
    skills: ['connect-ai-marketer'],
    instruction: 'connect-ai-marketer와 Ego Lite로 국내외 AI·테크 경쟁 유튜브 채널 최신 급상승 영상 5개의 제목·썸네일·첫 5초 훅 구조를 벤치마크하고, 내 다음 영상용 제목 5안과 훅 3안을 정리하세요.',
  },
  {
    key: 'creator-edit',
    cat: 'youtube',
    kicker: 'YOUTUBE · VIDEO MOTION',
    title: '유튜브 · 쇼츠 영상 편집 & 9:16 체크리스트',
    desc: '신규 촬영본을 connect-ai-video-motion 기준으로 몸 인식 모션그래픽·컷 편집·9:16 크롭 계획을 세웁니다.',
    intervalMin: null,
    time: '08:00',
    days: [1, 2, 3, 4, 5],
    assignee: 'auto',
    skills: ['connect-ai-video-motion', 'connect-ai-motion'],
    instruction: '신규 촬영본 폴더를 확인하고 connect-ai-video-motion 기준으로 1) 몸 인식 모션그래픽 배치 포인트, 2) 무음·군더더기 컷 편집 구간, 3) 9:16 쇼츠·1:1 클립 구간과 썸네일 카피 시안을 준비하세요. 최종 업로드는 대표 승인 전 정지하세요.',
  },
  {
    key: 'yt-comment-faq',
    cat: 'youtube',
    kicker: 'YOUTUBE · AUDIENCE',
    title: '유튜브 댓글 질문 모아 FAQ · 다음 영상 주제 추출',
    desc: '시청자가 반복해서 묻는 질문과 반응 좋은 포인트를 모아 다음 쇼츠·강의 주제를 자동 추천합니다.',
    intervalMin: null,
    time: '20:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    skills: ['connect-ai-marketer'],
    instruction: 'Ego Lite에서 최근 유튜브 영상 댓글을 읽고 반복 질문 Top 5, 공감 포인트, 다음 쇼츠·롱폼 영상으로 다루면 좋은 주제 3가지를 표로 정리하세요. 답글은 초안만 작성하세요.',
  },
  // 인스타 · X · 스레드 (SNS)
  {
    key: 'ig-comment-draft',
    cat: 'sns',
    kicker: 'INSTAGRAM · REPLY DRAFT',
    title: '30분마다 인스타 댓글 · DM 문의 답글 초안',
    desc: 'Ego Lite에서 새 인스타그램 댓글과 협업·강의 문의를 확인해 브랜드 톤에 맞춘 답글 초안만 안전하게 준비합니다.',
    intervalMin: 30,
    time: '',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    skills: ['connect-ai-marketer'],
    instruction: 'Ego Lite와 connect-ai-marketer로 새 인스타그램 댓글과 문의를 확인하세요. 내 지식 베이스의 브랜드 톤에 맞춰 자연스러운 답글 초안만 작성하고, 실제 게시나 DM 발송은 절대 하지 말고 대표 승인 대기로 남기세요.',
  },
  {
    key: 'x-threads-listen',
    cat: 'sns',
    kicker: 'X · THREADS LISTENING',
    title: '2시간마다 X · 스레드 AI 트렌드 리스닝 요약',
    desc: 'X.com과 스레드에서 지금 터지고 있는 AI 자동화·클로드·코덱스 화제 글과 반응 패턴을 3줄 요약합니다.',
    intervalMin: 120,
    time: '',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    skills: ['connect-ai-marketer'],
    instruction: 'connect-ai-marketer와 Ego Lite로 X.com 및 Threads에서 AI 에이전트·자동화·클로드·코덱스 관련 급상승 글 5건을 스캔해 핵심 인사이트 3줄과 내가 반응·인용할 글 초안 2개를 작성하세요.',
  },
  {
    key: 'sns-repurpose',
    cat: 'sns',
    kicker: 'CROSS-POSTING DRAFT',
    title: '새 유튜브 → 인스타·스레드·X·블로그 4채널 초안 생성',
    desc: '새 영상 대본이나 메모 1개를 인스타 릴스 캡션, 스레드 타래, X 스레드, 블로그 요약 초안으로 한 번에 변환합니다.',
    intervalMin: null,
    time: '14:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    skills: ['connect-ai-marketer'],
    instruction: '최근 완료된 유튜브 기획·대본 또는 브리핑 1건을 골라 1) 인스타그램 캡션+해시태그, 2) 스레드 3연속 타래, 3) X.com 요약 스레드, 4) 네이버 블로그 핵심 정리 초안을 브랜드 톤에 맞춰 작성하세요. 실제 게시는 하지 말고 초안만 보고하세요.',
  },
  // 일상 · 라이프 (Daily Life)
  {
    key: 'morning-brief',
    cat: 'life',
    kicker: 'MORNING BRIEFING',
    title: '매일 아침 대표 브리핑 (일정 · AI 현황 · AI 뉴스 3줄)',
    desc: '출근 전 오늘 일정, 밤사이 AI가 처리한 결과, 승인 대기 항목, 최신 AI 핵심 뉴스 3줄을 한눈에 브리핑합니다.',
    intervalMin: null,
    time: '08:30',
    days: [1, 2, 3, 4, 5],
    assignee: 'auto',
    instruction: '오늘 일정과 대기·완료된 AI 작업, 대표 확인(승인) 필요 항목, 그리고 오늘 꼭 알아야 할 최신 AI 뉴스 3가지를 군더더기 없는 1분 브리핑으로 정리하세요.',
  },
  {
    key: 'night-review',
    cat: 'life',
    kicker: 'DAILY REFLECTION',
    title: '매일 밤 10시 하루 회고 & 내일 Top 3 정리',
    desc: '오늘 완료된 작업과 미뤄진 일을 자동 정리하고, 내일 아침 가장 먼저 처리할 핵심 3가지를 제안합니다.',
    intervalMin: null,
    time: '22:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    instruction: '오늘 완료한 작업, 미완료 항목, AI 직원별 성과를 요약하고 내일 대표가 집중할 Top 3와 AI에게 미리 넘길 작업 2가지를 제안하세요. 재사용할 패턴은 내 지식(AI 학습 메모)에 남기세요.',
  },
  {
    key: 'water-stretch-alarm',
    cat: 'life',
    kicker: 'LIFE HABIT ALARM',
    title: '2시간마다 물 마시기 · 스트레칭 대표 알람',
    desc: '작업에 몰입하느라 놓치기 쉬운 수분 섭취와 목·어깨 스트레칭을 자는 시간 제외 2시간마다 알려줍니다.',
    intervalMin: 120,
    time: '',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'jay',
    instruction: '',
  },
  // 업무 · 이메일 · 개발 (Work & Dev)
  {
    key: 'inbox-triage',
    cat: 'work',
    kicker: 'INBOX TRIAGE',
    title: '15분마다 이메일 · 수강생 문의 분류 & 답장 초안',
    desc: 'Ego Lite에서 새 메일과 영수증·협업·수강생 문의를 우선순위별 분류하고 답장 초안만 안전하게 저장합니다.',
    intervalMin: 15,
    time: '',
    days: [0, 1, 2, 3, 4, 5, 6],
    assignee: 'auto',
    instruction: 'Ego Lite 이메일 스페이스에서 새로 들어온 메일과 수강생·협업 문의를 확인해 긴급/일반/영수증으로 분류하고 답장 초안만 저장하세요. 실제 발송이나 삭제는 절대 하지 말고 대표 승인 대기로 남기세요.',
  },
  {
    key: 'growth-rebiz',
    cat: 'work',
    kicker: 'REVERSE BUSINESS',
    title: '경쟁사 · 신규 AI 서비스 자동 해부 (reversebusiness)',
    desc: '주목할 AI 서비스·경쟁 채널의 수익화 구조와 차별화 포인트를 reversebusiness 방식으로 해부해 보고합니다.',
    intervalMin: null,
    time: '09:00',
    days: [1, 4],
    assignee: 'auto',
    skills: ['reversebusiness'],
    instruction: '주목할 신규 AI 서비스·크리에이터 사례 2~3건을 reversebusiness 관점(타깃·유입·가격·수익화·차별화·겹침 검사)으로 해부해 비교 표와 우리 제품 적용 아이디어 3가지를 정리하세요.',
  },
  {
    key: 'github-morning-check',
    cat: 'work',
    kicker: 'DEV · GITHUB OPS',
    title: '매일 아침 깃허브 PR · 이슈 · 막힘 자동 점검',
    desc: '내 GitHub 저장소의 새 이슈·PR·실패한 워크플로와 멈춘 AI 작업을 출근 전 한 번에 점검합니다.',
    intervalMin: null,
    time: '07:30',
    days: [1, 2, 3, 4, 5],
    assignee: 'auto',
    instruction: '로컬/GitHub CLI(gh/git)로 내 주요 저장소의 열린 이슈, PR, 최근 커밋·테스트 상태와 HQ 막힘 작업을 점검해 오늘 바로 조치할 항목만 3~5줄로 요약 보고하세요.',
  },
];

function openNewAutomationModal(preset = null) {
  const dlg = document.getElementById('dlg');
  const d = S.data;
  const ivList = S.options.intervalMins || [5, 15, 30, 60, 120, 180, 360];
  let pickedAssignee = preset?.assignee || 'auto';
  const pickedSkills = new Set(Array.isArray(preset?.skills) ? preset.skills : []);
  const pickedKbIds = new Set(Array.isArray(preset?.knowledgeIds) ? preset.knowledgeIds : []);
  const pickedRagIds = new Set(Array.isArray(preset?.ragIds) ? preset.ragIds : []);
  let pickedAccount = preset?.account || '';
  let autoApproveOn = Boolean(preset?.autoApprove);
  let showAllSkills = false;
  let showQuickKb = false;
  const initSched = preset?.intervalMin ? String(preset.intervalMin) : 'time';
  const initTime = preset?.intervalMin ? '' : (preset?.time || '09:00');
  const skillPool = allSelectableSkills();
  const accList = (d.resources || []).filter((r) => r.kind === '계정' && r.status !== '꺼짐');
  const kbCats = S.options.knowledgeCategories || ['브랜드', '비즈니스', '업무 규칙', '참고 자료', 'AI 학습 메모'];

  const titleIn = h('input', {
    class: 'in auto-m-title',
    value: preset?.title || '',
    placeholder: '예: 인스타그램 최신 컨텐츠 댓글 해당 언어로 답글 작성, 쇼츠 영상 모션 편집',
    'aria-label': '오토메이션 이름',
  });
  const schedSel = h('select', { class: 'in', 'aria-label': '반복 주기' },
    h('option', { value: 'time', selected: initSched === 'time' }, '매일 지정 시각'),
    ivList.map((m) => h('option', { value: String(m), selected: initSched === String(m) }, `${fmtIntervalLabel(m)} 반복`)));
  const timeIn = h('input', {
    class: `in${initSched === 'time' ? '' : ' is-hidden'}`,
    type: 'time',
    value: initTime,
    'aria-label': '실행 시각',
  });
  const timeWrap = h('div', { class: `auto-m-field${initSched === 'time' ? '' : ' is-hidden'}` },
    h('label', { class: 'auto-m-lbl' }, '실행 시각'),
    timeIn);
  schedSel.addEventListener('change', () => {
    const isIv = schedSel.value !== 'time';
    timeIn.classList.toggle('is-hidden', isIv);
    timeWrap.classList.toggle('is-hidden', isIv);
  });

  const days = dayPicker(preset?.days || [0, 1, 2, 3, 4, 5, 6]);
  const promptIn = h('textarea', {
    class: 'in auto-m-prompt',
    rows: 2,
    placeholder: 'AI가 실행할 지시서를 자유롭게 적어 주세요.\n예: Ego Lite에서 인스타그램 최신 게시물 댓글을 읽고 작성자 언어에 맞춰 2문장 이내로 답글 초안을 작성해줘',
    'aria-label': '프롬프트 지시서',
  }, preset?.instruction || '');
  const promptField = h('div', { class: 'auto-m-field' },
    h('label', { class: 'auto-m-lbl' }, '프롬프트 지시서 (선택)'),
    promptIn);
  const alarmHint = h('div', { class: 'auto-m-hint is-hidden' },
    '대표 알람으로 등록됩니다. 지정한 요일·시각에 이 맥 알림과 사운드가 울립니다.');

  const blueprintBar = h('div', { class: 'auto-bp-summary' });
  const assigneeRow = h('div', { class: 'auto-m-chips', role: 'group', 'aria-label': '담당 선택' });
  const skillHeadMeta = h('div', { class: 'auto-sec-meta' });
  const skillRow = h('div', { class: 'auto-m-chips auto-skill-chips', role: 'group', 'aria-label': '사용할 스킬 선택' });
  const kbHeadMeta = h('div', { class: 'auto-sec-meta' });
  const kbRow = h('div', { class: 'auto-m-chips auto-kb-chips', role: 'group', 'aria-label': '참고할 내 지식 선택' });
  const quickKbWrap = h('div', { class: 'auto-qkb-box is-hidden' });
  const accRow = h('div', { class: 'auto-m-chips', role: 'group', 'aria-label': '연결 계정 선택' });

  const qkbCat = h('select', { class: 'in sm auto-qkb-cat', 'aria-label': '지식 분류' },
    kbCats.map((c) => h('option', { value: c, selected: c === '업무 규칙' }, c)));
  const qkbTitle = h('input', { class: 'in sm auto-qkb-title', placeholder: '지식 제목 (예: 인스타 다국어 댓글 규칙, 쇼츠 훅 공식)', 'aria-label': '새 지식 제목' });
  const qkbContent = h('textarea', {
    class: 'in auto-qkb-body', rows: 3,
    placeholder: 'AI가 반드시 지켜야 할 톤·규칙·참고 자료를 적어 주세요.\n예: 영어 댓글엔 영어로, 일본어 댓글엔 일본어로 2문장 이내 친근하게 답글. 과장 금지.',
    'aria-label': '새 지식 내용',
  });
  const saveQuickKb = async () => {
    const t = qkbTitle.value.trim();
    const c = qkbContent.value.trim();
    if (!t) { qkbTitle.focus(); toast('지식 제목을 입력해 주세요'); return; }
    if (!c) { qkbContent.focus(); toast('지식 내용을 입력해 주세요'); return; }
    const created = await once('auto-modal-add-kb', () => api('POST', '/api/ui/knowledge', {
      title: t, category: qkbCat.value, content: c, tags: [], scope: 'all',
    }));
    if (created && created.id) {
      if (!Array.isArray(S.data.knowledge)) S.data.knowledge = [];
      if (!S.data.knowledge.some((k) => k.id === created.id)) S.data.knowledge.unshift(created);
      pickedKbIds.add(created.id);
      qkbTitle.value = '';
      qkbContent.value = '';
      showQuickKb = false;
      quickKbWrap.classList.add('is-hidden');
      SND()?.play('ok');
      toast(`"${created.title}" 지식을 만들고 바로 연결했어요`);
      renderKnowledgeChips();
      renderSummary();
    }
  };
  quickKbWrap.replaceChildren(
    h('div', { class: 'auto-qkb-row' }, qkbCat, qkbTitle),
    qkbContent,
    h('div', { class: 'auto-qkb-foot' },
      h('span', { class: 'small muted' }, '저장하면 내 지식 베이스에 보관되고 이 오토메이션에 즉시 연결됩니다'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => { showQuickKb = false; quickKbWrap.classList.add('is-hidden'); renderKnowledgeChips(); } }, '취소'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: saveQuickKb }, '저장하고 바로 연결'))));

  const currentHintText = () => `${titleIn.value} ${promptIn.value}`;

  const renderSummary = () => {
    if (pickedAssignee === 'jay') {
      blueprintBar.classList.add('is-hidden');
      return;
    }
    blueprintBar.classList.remove('is-hidden');
    const whoLabel = pickedAssignee === 'auto' ? '자동 배분' : shortName(pickedAssignee);
    const skArr = [...pickedSkills].map((k) => skillChipMeta(k).shortTitle);
    const skText = skArr.length ? (skArr.length <= 2 ? skArr.join(' · ') : `${skArr[0]} 외 ${skArr.length - 1}개`) : '자동 매칭';
    const kbArr = [...pickedKbIds].map((id) => (S.data.knowledge || []).find((k) => k.id === id)?.title).filter(Boolean);
    const ragArr = [...pickedRagIds].map((id) => (S.data.ragSources || []).find((r) => r.id === id)?.name).filter(Boolean);
    const kbRagAll = [...ragArr.map((x) => `RAG:${x}`), ...kbArr];
    const kbText = kbRagAll.length ? (kbRagAll.length === 1 ? kbRagAll[0] : `${kbRagAll[0]} 외 ${kbRagAll.length - 1}건`) : '공용 지식·RAG 자동 참고';
    const accObj = pickedAccount ? accList.find((a) => a.id === pickedAccount) : null;
    const accText = accObj ? accObj.name.split(' · ')[0] : '자동 감지';
    blueprintBar.replaceChildren(
      h('span', { class: 'auto-bp-kicker' }, 'BLUEPRINT'),
      h('div', { class: 'auto-bp-items' },
        h('span', { class: 'auto-bp-seg' }, h('b', null, '직원'), ' ', whoLabel),
        h('span', { class: 'auto-bp-sep', 'aria-hidden': 'true' }, '×'),
        h('span', { class: `auto-bp-seg${skArr.length ? ' is-pinned' : ''}` }, h('b', null, '스킬'), ' ', skText),
        h('span', { class: 'auto-bp-sep', 'aria-hidden': 'true' }, '×'),
        h('span', { class: `auto-bp-seg${kbArr.length ? ' is-pinned' : ''}` }, h('b', null, '지식'), ' ', kbText),
        accList.length ? h('span', { class: 'auto-bp-sep', 'aria-hidden': 'true' }, '×') : null,
        accList.length ? h('span', { class: `auto-bp-seg${accObj ? ' is-pinned' : ''}` }, h('b', null, '계정'), ' ', accText) : null));
  };

  const renderSkillChips = () => {
    const recKeys = suggestSkillsForText(currentHintText());
    const recSet = new Set(recKeys);
    const readyList = skillPool.filter((s) => s.published);
    const baseList = showAllSkills
      ? skillPool
      : readyList.filter((s) => s.connectAiPack || pickedSkills.has(s.key) || recSet.has(s.key) || ['ffmpeg', 'whisper', 'playwright', 'orca-computer', 'firecrawl'].includes(s.key));
    const displayList = baseList.length ? baseList : readyList.slice(0, 10);
    const hiddenCount = Math.max(0, skillPool.length - displayList.length);
    const unpickedRecs = recKeys.filter((k) => !pickedSkills.has(k) && skillPool.some((s) => s.key === k));

    skillHeadMeta.replaceChildren(...[
      pickedSkills.size ? h('span', { class: 'auto-cnt-pill is-on' }, `${pickedSkills.size}개 지정`) : h('span', { class: 'auto-cnt-pill' }, '자동 매칭'),
      unpickedRecs.length ? h('button', {
        type: 'button', class: 'auto-rec-btn',
        onclick: () => { for (const k of unpickedRecs) pickedSkills.add(k); renderSkillChips(); renderSummary(); },
      }, `✨ 추천 적용 (${unpickedRecs.map((k) => skillChipMeta(k).shortTitle).join(' · ')})`) : null,
      hiddenCount > 0 || showAllSkills ? h('button', {
        type: 'button', class: 'btn link auto-more-btn',
        onclick: () => { showAllSkills = !showAllSkills; renderSkillChips(); },
      }, showAllSkills ? '접기' : `전체 (+${hiddenCount})`) : null,
    ].filter(Boolean));

    skillRow.replaceChildren(...displayList.map((sk) => {
      const on = pickedSkills.has(sk.key);
      const isRec = recSet.has(sk.key);
      return h('button', {
        type: 'button',
        class: `chip bp-chip${on ? ' on' : ''}${isRec && !on ? ' is-rec' : ''}${!sk.published ? ' is-soon' : ''}`,
        'aria-pressed': on ? 'true' : 'false',
        title: `${sk.titleKo}${sk.flow ? ` · ${sk.flow}` : ''}${!sk.published ? ' (준비 중)' : ''}`,
        onclick: () => {
          if (on) pickedSkills.delete(sk.key); else pickedSkills.add(sk.key);
          renderSkillChips();
          renderSummary();
        },
      },
      skillPixelIconSvg(sk.icon, 15),
      h('span', null, sk.shortTitle),
      isRec && !on ? h('span', { class: 'bp-rec-dot' }, '추천') : null);
    }));
  };

  const renderKnowledgeChips = () => {
    const kbs = Array.isArray(S.data.knowledge) ? S.data.knowledge : [];
    const rags = (Array.isArray(S.data.ragSources) ? S.data.ragSources : []).filter((r) => r.enabled !== false);
    const totalPicked = pickedKbIds.size + pickedRagIds.size;
    kbHeadMeta.replaceChildren(
      totalPicked ? h('span', { class: 'auto-cnt-pill is-on' }, `${totalPicked}건 필수 연결`) : h('span', { class: 'auto-cnt-pill' }, '공용 자동 참고'),
      h('button', {
        type: 'button', class: `btn sm auto-qkb-toggle${showQuickKb ? ' dark' : ''}`,
        onclick: () => {
          showQuickKb = !showQuickKb;
          quickKbWrap.classList.toggle('is-hidden', !showQuickKb);
          renderKnowledgeChips();
          if (showQuickKb) setTimeout(() => qkbTitle.focus(), 20);
        },
      }, showQuickKb ? '입력 닫기' : '+ 새 지식 바로 추가'));

    if (!kbs.length && !rags.length) {
      kbRow.replaceChildren(h('div', { class: 'small muted auto-kb-empty' }, '저장된 지식·RAG가 아직 없어요. 오른쪽 "+ 새 지식 바로 추가" 또는 내 자원 탭에서 RAG를 연결해 보세요.'));
      return;
    }
    const ragChips = rags.map((rg) => {
      const on = pickedRagIds.has(rg.id);
      return h('button', {
        type: 'button',
        class: `chip bp-chip bp-rag-chip${on ? ' on' : ''}`,
        'aria-pressed': on ? 'true' : 'false',
        title: `RAG [${ragTypeLabel(rg.type)}]: ${rg.name}`,
        onclick: () => {
          if (on) pickedRagIds.delete(rg.id); else pickedRagIds.add(rg.id);
          renderKnowledgeChips();
          renderSummary();
        },
      },
      h('span', { class: 'bp-rag-tag' }, 'RAG'),
      h('span', null, rg.name));
    });
    const kbChips = kbs.map((kb) => {
      const on = pickedKbIds.has(kb.id);
      return h('button', {
        type: 'button',
        class: `chip bp-chip bp-kb-chip${on ? ' on' : ''}`,
        'aria-pressed': on ? 'true' : 'false',
        title: `[${kb.category}] ${kb.content.slice(0, 180)}`,
        onclick: () => {
          if (on) pickedKbIds.delete(kb.id); else pickedKbIds.add(kb.id);
          renderKnowledgeChips();
          renderSummary();
        },
      },
      h('span', { class: 'bp-kb-cat' }, kb.category),
      h('span', null, kb.title));
    });
    kbRow.replaceChildren(...ragChips, ...kbChips);
  };

  const renderAccountChips = () => {
    if (!accList.length) return;
    const recAccId = suggestAccountForText(currentHintText());
    accRow.replaceChildren(
      h('button', {
        type: 'button', class: `chip${!pickedAccount ? ' on' : ''}`,
        'aria-pressed': !pickedAccount ? 'true' : 'false',
        onclick: () => { pickedAccount = ''; renderAccountChips(); renderSummary(); },
      }, '자동 감지'),
      ...accList.map((a) => {
        const on = pickedAccount === a.id;
        const isRec = !pickedAccount && recAccId === a.id;
        return h('button', {
          type: 'button', class: `chip bp-chip${on ? ' on' : ''}${isRec ? ' is-rec' : ''}`,
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => { pickedAccount = on ? '' : a.id; renderAccountChips(); renderSummary(); },
        }, a.name.split(' · ')[0], isRec ? h('span', { class: 'bp-rec-dot' }, '추천') : null);
      }));
  };

  const aiPillarsWrap = h('div', { class: `auto-bp-stack${pickedAssignee === 'jay' ? ' is-hidden' : ''}` },
    h('div', { class: 'auto-bp-sec' },
      h('div', { class: 'auto-sec-head' },
        h('label', { class: 'auto-m-lbl' }, '② 사용할 스킬 (무엇을 할 줄 아는가)'),
        skillHeadMeta),
      skillRow),
    h('div', { class: 'auto-bp-sec' },
      h('div', { class: 'auto-sec-head' },
        h('label', { class: 'auto-m-lbl' }, '③ 참고할 내 지식 (우리 브랜드 톤 · 규칙 · 기준)'),
        kbHeadMeta),
      kbRow,
      quickKbWrap),
    accList.length ? h('div', { class: 'auto-bp-sec' },
      h('div', { class: 'auto-sec-head' },
        h('label', { class: 'auto-m-lbl' }, '④ 연결 계정 (선택 · 어느 채널에서 일할까)')),
      accRow) : null);

  const renderAssigneeChips = () => {
    const opts = [
      { id: 'auto', label: '✦ 자동 배분', empObj: null, live: false },
      { id: 'jay', label: '나 (대표 알람)', empObj: null, live: false },
      ...d.employees.map((e) => ({ id: e.id, label: shortName(e.id), empObj: e, live: canRun(e) && e.runMode !== 'off' })),
    ];
    assigneeRow.replaceChildren(...opts.map((o) => h('button', {
      type: 'button',
      class: `chip bp-who-chip${pickedAssignee === o.id ? ' on' : ''}`,
      'aria-pressed': pickedAssignee === o.id ? 'true' : 'false',
      onclick: () => {
        pickedAssignee = o.id;
        const isHuman = pickedAssignee === 'jay';
        promptField.classList.toggle('is-hidden', isHuman);
        aiPillarsWrap.classList.toggle('is-hidden', isHuman);
        autoApproveWrap.classList.toggle('is-hidden', isHuman);
        alarmHint.classList.toggle('is-hidden', !isHuman);
        if (isHuman && schedSel.value !== 'time') {
          schedSel.value = 'time';
          timeIn.classList.remove('is-hidden');
          timeWrap.classList.remove('is-hidden');
        }
        renderAssigneeChips();
        renderSummary();
      },
    },
    o.empObj ? avatarEl(o.empObj, { size: 18, onDark: pickedAssignee === o.id }) : null,
    o.live ? h('i', { class: 'auto-eng-dot', title: '실행 연결됨' }) : null,
    o.label)));
  };

  const syncSuggestions = () => {
    renderSkillChips();
    renderAccountChips();
    renderSummary();
  };
  titleIn.addEventListener('input', syncSuggestions);
  promptIn.addEventListener('input', syncSuggestions);

  renderAssigneeChips();
  renderSkillChips();
  renderKnowledgeChips();
  renderAccountChips();
  renderSummary();

  const autoApproveChk = h('input', {
    type: 'checkbox',
    checked: autoApproveOn,
    onchange: (ev) => {
      autoApproveOn = ev.target.checked;
      autoApproveHint.textContent = autoApproveOn
        ? '⚡ 게시·댓글·업로드는 확인 없이 바로 실행 (결제·삭제만 대표 승인 보호)'
        : '게시·업로드 승인 없이 바로 실행 (끄면 게시 전 대표 확인)';
      autoApproveWrap.classList.toggle('is-on', autoApproveOn);
    },
  });
  const autoApproveHint = h('span', { class: 'auto-ap-txt' }, autoApproveOn
    ? '⚡ 게시·댓글·업로드는 확인 없이 바로 실행 (결제·삭제만 대표 승인 보호)'
    : '게시·업로드 승인 없이 바로 실행 (끄면 게시 전 대표 확인)');
  const autoApproveWrap = h('label', { class: `switch auto-ap-sw${autoApproveOn ? ' is-on' : ''}${pickedAssignee === 'jay' ? ' is-hidden' : ''}` },
    autoApproveChk,
    h('span', { class: 'tr' }),
    autoApproveHint);

  const submitBtn = h('button', { type: 'button', class: 'btn dark' }, '만들기 ⌘↵');
  const submit = async () => {
    const v = titleIn.value.trim();
    if (!v) { titleIn.focus(); toast('오토메이션 이름을 입력해 주세요'); return; }
    const iv = schedSel.value === 'time' ? null : Number(schedSel.value);
    const tm = iv ? '' : timeIn.value;
    const isHuman = pickedAssignee === 'jay';
    const body = {
      title: v,
      time: tm,
      intervalMin: iv,
      days: days.getDays(),
      assignee: pickedAssignee,
      instruction: isHuman ? '' : promptIn.value.trim(),
      skills: isHuman ? [] : [...pickedSkills],
      knowledgeIds: isHuman ? [] : [...pickedKbIds],
      ragIds: isHuman ? [] : [...pickedRagIds],
      autoApprove: isHuman ? false : autoApproveOn,
      ...(pickedAccount && !isHuman ? { account: pickedAccount } : {}),
    };
    const r = await once('modal-add-routine', () => act('POST', '/api/ui/routines', body));
    if (r) {
      closeDlg();
      ui.autoTab = 'list';
      const skCnt = (r.skills || []).length;
      const kbCnt = (r.knowledgeIds || []).length;
      const extra = [skCnt ? `스킬 ${skCnt}` : '', kbCnt ? `지식 ${kbCnt}` : '', r.autoApprove ? '⚡ 바로 실행' : ''].filter(Boolean).join(' · ');
      toast(`${shortName(r.assignee)} 오토메이션을 추가했어요${extra ? ` (${extra})` : ''}`);
      render();
    }
  };
  submitBtn.addEventListener('click', submit);

  const onKey = (ev) => {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && !ev.isComposing) {
      ev.preventDefault();
      submit();
    }
  };
  titleIn.addEventListener('keydown', onKey);
  promptIn.addEventListener('keydown', onKey);

  dlg.className = 'wide auto-dlg arsenal-dlg';
  setDlg(dlg,
    h('div', { class: 'auto-m-top' },
      h('div', { class: 'auto-m-head' },
        preset?.kicker ? h('span', { class: 'auto-tpl-kicker' }, preset.kicker) : null,
        h('h3', { class: 'auto-m-title-h' }, preset ? '템플릿으로 오토메이션 만들기' : '새 오토메이션'),
        h('p', { class: 'small muted auto-m-sub' }, '어떤 AI 직원이 · 어떤 스킬로 · 어떤 내 지식을 참고해 실행할지 한 번에 조립합니다.')),
      h('button', { type: 'button', class: 'auto-m-x', 'aria-label': '닫기', onclick: closeDlg }, '×')),
    h('div', { class: 'auto-m-body' },
      h('div', { class: 'auto-m-field' },
        h('label', { class: 'auto-m-lbl' }, '이름'),
        titleIn),
      h('div', { class: 'auto-m-sched-row' },
        h('div', { class: 'auto-m-field auto-m-sched-col' },
          h('label', { class: 'auto-m-lbl' }, '반복 주기'),
          schedSel),
        timeWrap,
        h('div', { class: 'auto-m-field auto-m-days-col' },
          h('label', { class: 'auto-m-lbl' }, '실행 요일'),
          days)),
      h('div', { class: 'auto-m-field' },
        h('label', { class: 'auto-m-lbl' }, '① 담당 AI 직원 / 알람'),
        assigneeRow),
      aiPillarsWrap,
      promptField,
      alarmHint,
      blueprintBar),
    h('div', { class: 'auto-m-foot' },
      autoApproveWrap,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '취소'),
        submitBtn)));
  dlg.showModal();
  setTimeout(() => titleIn.focus(), 20);
}

function pageDaily() {
  const d = S.data;
  const visible = d.routines.filter((r) => !r.feature || features()[r.feature]);
  const ivList = S.options.intervalMins || [5, 15, 30, 60];
  const routineMap = new Map(d.routines.map((r) => [r.id, r]));
  const allRuns = d.tasks
    .filter((t) => t.routineId)
    .sort((a, b) => String(b.completedAt || b.lastRunAt || b.createdAt || b.date).localeCompare(String(a.completedAt || a.lastRunAt || a.createdAt || a.date)));
  const activeCount = visible.filter((r) => r.enabled !== false).length;
  const ivCount = visible.filter((r) => r.assignee !== 'jay' && r.enabled !== false && r.intervalMin).length;
  const doneToday = allRuns.filter((t) => t.date === S.today && t.status === '완료').length;

  const row = (r) => {
    const e = emp(r.assignee);
    const human = r.assignee === 'jay';
    const picking = ui.rtPicking === r.id;
    const runHistory = allRuns.filter((t) => t.routineId === r.id);
    const todayTask = runHistory.find((t) => t.date === S.today) || runHistory[0] || null;
    const latestRun = runHistory[0] || null;
    const schedText = r.intervalMin ? `${fmtIntervalLabel(r.intervalMin)} 반복` : (r.time || '시간 없음');
    const autoText = human ? `대표 알람 · ${r.intervalMin ? `${fmtIntervalLabel(r.intervalMin)} 맥 알림(자는 시간 제외)` : '정해진 시각에 맥 알림과 사운드가 울립니다'}` : !e ? '담당을 고르면 스케줄마다 자동 생성됩니다'
      : e.runMode === 'auto' && canRun(e) ? `자동 실행 · ${r.intervalMin ? `${fmtIntervalLabel(r.intervalMin)} 자동 점검` : '정해진 시각에 자동 실행'}`
        : `미연결 · ${e.name} (${RUN_LABEL[e.runMode]})`;

    const rTitle = h('input', { class: 'in sm auto-edit-title', value: r.title, 'data-k': `rt-ttl-${r.id}`, 'aria-label': '오토메이션 이름' });
    const rCost = !human ? h('input', { class: 'in sm auto-edit-cost', inputmode: 'numeric', value: r.estCost ? String(r.estCost) : '', 'data-k': `rt-cost-${r.id}`, placeholder: '예상 비용 (원)', 'aria-label': '예상 비용 (원)' }) : null;
    const rDays = dayPicker(r.days || [0, 1, 2, 3, 4, 5, 6]);
    const ins = h('textarea', {
      class: 'in prompt-box', rows: 4, 'data-k': `rt-ins-${r.id}`, 'aria-label': '프롬프트 지시서',
      placeholder: 'AI에게 시킬 내용을 편하게 적어 주세요.\n예: 5분마다 Ego Lite 이메일 스페이스에서 새 메일과 영수증 요청 확인하고 초안만 저장해줘\n예: 8시 영상 편집 — 모션 그래픽은 Hyperframes로 미니멀 스타일, 3D는 Office 1에서 Blender로 해줘',
    }, r.instruction || '');
    const rTime = h('input', { class: `in sm auto-edit-time${r.intervalMin ? ' is-hidden' : ''}`, type: 'time', value: r.time || '', 'data-k': `rt-tm-${r.id}`, 'aria-label': '실행 시각' });
    const rSched = h('select', { class: 'in sm auto-edit-sched', 'data-k': `rt-iv-${r.id}`, 'aria-label': '반복 주기', onchange: (ev) => {
      const v = ev.target.value;
      if (v === 'time') { rTime.classList.remove('is-hidden'); act('PATCH', `/api/ui/routines/${r.id}`, { intervalMin: null }, '매일 시각 방식으로 바꿨어요'); }
      else { rTime.classList.add('is-hidden'); act('PATCH', `/api/ui/routines/${r.id}`, { intervalMin: Number(v) }, `${fmtIntervalLabel(Number(v))} 반복으로 바꿨어요`); }
    } },
    h('option', { value: 'time', selected: !r.intervalMin }, '매일 시각'),
    ivList.map((m) => h('option', { value: String(m), selected: r.intervalMin === m }, fmtIntervalLabel(m))));
    rTime.addEventListener('change', () => act('PATCH', `/api/ui/routines/${r.id}`, { time: rTime.value || null }, '시간을 바꿨어요'));

    const dirtyEl = h('span', { class: 'p-dirty' }, '');
    const isDirty = () => rTitle.value !== r.title || (!human && (ins.value !== (r.instruction || '') || (rCost && rCost.value.trim() !== (r.estCost ? String(r.estCost) : ''))));
    const syncDirty = () => { dirtyEl.textContent = isDirty() ? '저장 안 됨 · ⌘↵' : ''; };
    rTitle.addEventListener('input', syncDirty);
    if (!human) {
      ins.addEventListener('input', syncDirty);
      if (rCost) rCost.addEventListener('input', syncDirty);
    }
    const saveRoutine = async (silent = false) => {
      const body = { title: rTitle.value, days: rDays.getDays() };
      if (!human) {
        body.instruction = ins.value;
        if (rCost) body.estCost = rCost.value.trim() === '' ? null : rCost.value.trim();
      }
      return act('PATCH', `/api/ui/routines/${r.id}`, body, silent ? null : '저장했어요');
    };
    const flushRoutine = async () => { if (isDirty()) await saveRoutine(true); };
    rTitle.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) saveRoutine(); });
    ins.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); saveRoutine(); } });

    const insDrawer = !human ? promptInsertDrawer(ins, `r-${r.id}`) : null;
    const relay = !human ? h('div', { class: 'r-relay' },
      h('span', null, '끝나면 넘기기'),
      h('select', { class: 'in sm', 'aria-label': '끝나면 넘기기', onchange: (ev) => act('PATCH', `/api/ui/routines/${r.id}`, { nextAssignee: ev.target.value || null }, '바꿨어요') },
        h('option', { value: '' }, '넘기지 않음'),
        h('option', { value: 'jay', selected: r.nextAssignee === 'jay' }, '나 (대표 확인)'),
        d.employees.filter((x) => x.id !== r.assignee).map((x) => h('option', { value: x.id, selected: r.nextAssignee === x.id }, x.name)))) : null;
    const toolNames = [res(r.resource)?.name, res(r.browser)?.name, res(r.design)?.name, ...(r.tools || []).map((id) => res(id)?.name)].filter(Boolean);
    const stepOffices = [...new Set((r.steps || []).map((s) => res(s.resource)?.name).filter(Boolean))];
    const stepSummary = (r.steps || []).length ? `${r.steps.length}단계 협업${stepOffices.length ? ` (${stepOffices.join(' · ')})` : ''}` : '';
    const foldLabel = human ? '편집 · 8주 기록' : [
      r.instruction ? '프롬프트 (지시서)' : '프롬프트 쓰기',
      (r.skills || []).length ? `스킬 ${(r.skills || []).length}` : '',
      (r.knowledgeIds || []).length ? `지식 ${(r.knowledgeIds || []).length}` : '',
      (r.steps || []).length ? `팀 분업 ${(r.steps || []).length}단계` : '',
      r.nextAssignee ? `끝나면 → ${shortName(r.nextAssignee)}` : '',
      '8주 기록',
    ].filter(Boolean).join(' · ');
    const whoBtn = h('button', {
      type: 'button', class: `who-chip${r.assignee === 'jay' ? '' : r.assignee ? ' ai' : ' none'}`,
      'aria-expanded': picking ? 'true' : 'false', title: '눌러서 담당 바꾸기',
      onclick: () => { ui.rtPicking = picking ? null : r.id; render(); },
    }, e ? avatarEl(e, { size: 17, onDark: true }) : null, shortName(r.assignee));

    const rSkillPool = !human ? allSelectableSkills().filter((sk) => sk.published) : [];
    const rKbList = !human && Array.isArray(d.knowledge) ? d.knowledge : [];
    const rRagList = !human && Array.isArray(d.ragSources) ? d.ragSources.filter((x) => x.enabled !== false) : [];
    const rAccList = !human ? (d.resources || []).filter((x) => x.kind === '계정' && x.status !== '꺼짐') : [];
    const rMacList = !human ? (d.resources || []).filter((x) => x.kind === '기계' && x.status !== '꺼짐') : [];
    const rBlueprintEditor = !human ? h('div', { class: 'rt-bp-editor' },
      rSkillPool.length ? h('div', { class: 'd-tools' },
        h('span', { class: 'small muted' }, '지정 스킬'),
        h('div', { class: 'picker' }, rSkillPool.slice(0, 12).map((sk) => {
          const has = (r.skills || []).includes(sk.key);
          return h('button', {
            type: 'button', class: `chip sm bp-chip${has ? ' on' : ''}`,
            title: `${sk.titleKo}${sk.flow ? ` · ${sk.flow}` : ''}`,
            onclick: () => {
              const next = has ? (r.skills || []).filter((x) => x !== sk.key) : [...(r.skills || []), sk.key];
              act('PATCH', `/api/ui/routines/${r.id}`, { skills: next }, has ? `${sk.shortTitle} 스킬 해제했어요` : `${sk.shortTitle} 스킬 지정했어요`);
            },
          }, skillPixelIconSvg(sk.icon, 13), sk.shortTitle);
        }))) : null,
      h('div', { class: 'd-tools' },
        h('span', { class: 'small muted' }, '참고 지식'),
        h('div', { class: 'picker' },
          rKbList.map((kb) => {
            const has = (r.knowledgeIds || []).includes(kb.id);
            return h('button', {
              type: 'button', class: `chip sm bp-chip bp-kb-chip${has ? ' on' : ''}`,
              title: `[${kb.category}] ${kb.content.slice(0, 140)}`,
              onclick: () => {
                const next = has ? (r.knowledgeIds || []).filter((x) => x !== kb.id) : [...(r.knowledgeIds || []), kb.id];
                act('PATCH', `/api/ui/routines/${r.id}`, { knowledgeIds: next }, has ? `${kb.title} 지식 해제했어요` : `${kb.title} 지식 연결했어요`);
              },
            }, h('span', { class: 'bp-kb-cat' }, kb.category), kb.title);
          }),
          h('button', { type: 'button', class: 'chip sm', onclick: () => openKnowledgeModal() }, '+ 새 지식'))),
      h('div', { class: 'd-tools' },
        h('span', { class: 'small muted' }, '연결 RAG'),
        h('div', { class: 'picker' },
          rRagList.map((rg) => {
            const has = (r.ragIds || []).includes(rg.id);
            return h('button', {
              type: 'button', class: `chip sm bp-chip bp-rag-chip${has ? ' on' : ''}`,
              title: `[${ragTypeLabel(rg.type)}] ${rg.name}`,
              onclick: () => {
                const next = has ? (r.ragIds || []).filter((x) => x !== rg.id) : [...(r.ragIds || []), rg.id];
                act('PATCH', `/api/ui/routines/${r.id}`, { ragIds: next }, has ? `${rg.name} RAG 해제했어요` : `${rg.name} RAG 연결했어요`);
              },
            }, h('span', { class: 'bp-rag-tag' }, 'RAG'), rg.name);
          }),
          h('button', { type: 'button', class: 'chip sm', onclick: () => openRagModal() }, '+ RAG 연결'))),
      rAccList.length ? h('div', { class: 'd-tools' },
        h('span', { class: 'small muted' }, '연결 계정'),
        h('div', { class: 'picker' },
          h('button', { type: 'button', class: `chip sm${!r.account ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/routines/${r.id}`, { account: null }, '계정을 자동 감지로 바꿨어요') }, '자동'),
          ...rAccList.map((a) => h('button', {
            type: 'button', class: `chip sm${r.account === a.id ? ' on' : ''}`,
            onclick: () => act('PATCH', `/api/ui/routines/${r.id}`, { account: a.id }, `${a.name} 연결했어요`),
          }, a.name.split(' · ')[0])))) : null,
      rMacList.length ? h('div', { class: 'd-tools' },
        h('span', { class: 'small muted' }, '실행 컴퓨터'),
        h('div', { class: 'picker' },
          h('button', { type: 'button', class: `chip sm${!r.resource ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/routines/${r.id}`, { resource: null }, '컴퓨터를 자동 최적화로 바꿨어요') }, '자동 최적화'),
          ...rMacList.map((m) => h('button', {
            type: 'button', class: `chip sm${r.resource === m.id ? ' on' : ''}`,
            onclick: () => act('PATCH', `/api/ui/routines/${r.id}`, { resource: m.id }, `${m.name}에서 실행하도록 지정했어요`),
          }, m.name)))) : null,
      h('div', { class: 'rt-auto-ap-row' },
        h('label', { class: `switch auto-ap-sw${r.autoApprove ? ' is-on' : ''}` },
          h('input', {
            type: 'checkbox',
            checked: Boolean(r.autoApprove),
            onchange: (ev) => act('PATCH', `/api/ui/routines/${r.id}`, { autoApprove: ev.target.checked }, ev.target.checked ? '⚡ 앞으로 게시·업로드 확인 없이 바로 실행해요' : '게시 전 대표 승인 대기로 돌렸어요'),
          }),
          h('span', { class: 'tr' }),
          h('span', { class: 'auto-ap-txt' }, r.autoApprove
            ? '⚡ 게시·댓글·업로드 승인 없이 바로 실행 켜짐 (결제·삭제는 계속 보호)'
            : '게시·댓글·업로드 승인 없이 바로 실행 (켜면 매번 승인 안 물음)')))) : null;

    const autoApproveCardBtn = !human && (r.autoApprove || r.gate === '게시' || r.gate === '업로드')
      ? h('button', {
        type: 'button',
        class: `btn sm auto-ap-pill${r.autoApprove ? ' is-on' : ''}`,
        title: r.autoApprove
          ? '게시·업로드 승인 없이 바로 실행 중 · 누르면 승인 대기로 전환'
          : `${r.gate} 전 대표 확인 대기 중 · 누르면 승인 없이 바로 실행으로 전환`,
        onclick: () => act('PATCH', `/api/ui/routines/${r.id}`, { autoApprove: !r.autoApprove }, !r.autoApprove ? '⚡ 이제 게시 확인 없이 바로 실행돼요!' : '게시 전 대표 확인으로 바꿨어요'),
      }, r.autoApprove ? '⚡ 바로 실행' : `🔒 ${r.gate} 승인 후`)
      : null;

    const runNowBtn = h('button', {
      type: 'button', class: 'btn sm auto-run-btn',
      title: '이 오토메이션을 지금 바로 1회 실행합니다',
      onclick: () => once(`run-rt-${r.id}`, async () => {
        const resRun = await act('POST', `/api/ui/routines/${r.id}/run-now`, {});
        if (!resRun) return;
        if (resRun.notified) {
          pushLiveCard({ kind: 'connect', kicker: 'CONNECT AI · 오토메이션', title: `⏰ ${r.title}`, body: '알람을 지금 바로 보냈습니다' });
        } else if (resRun.started) {
          pushLiveCard({ kind: 'connect', kicker: 'CONNECT AI · 오토메이션 실행', title: `${shortName(r.assignee)} 실행 시작`, body: r.title, empId: r.assignee, taskId: resRun.task?.id, actionLabel: '진행 보기 →' });
        } else if (resRun.gate) {
          pushLiveCard({ kind: 'approve', kicker: 'CONNECT AI · 승인 대기', title: `${resRun.gate} 확인 필요`, body: r.title, taskId: resRun.task?.id, actionLabel: '승인하기 →', seal: true });
        } else {
          pushLiveCard({ kind: 'handoff', kicker: 'CONNECT AI · 오토메이션', title: `${shortName(r.assignee)} 할 일에 올렸어요`, body: resRun.runnable === false ? '미연결 AI라 수동(복사) 실행이 필요합니다' : r.title, taskId: resRun.task?.id, actionLabel: '열기 →' });
        }
      }),
    }, '▶ 실행');

    const recentLogEl = runHistory.length ? h('div', { class: 'auto-log-box' },
      h('div', { class: 'auto-log-h' }, `최근 실행 기록 (${runHistory.length}건)`),
      h('div', { class: 'auto-log-list' }, runHistory.slice(0, 5).map((rt) => h('div', { class: 'auto-log-row' },
        h('span', { class: `stat-pill ${rt.status}` }, rt.status),
        h('span', { class: 'auto-log-ts' }, `${rt.date}${rt.time ? ` ${rt.time}` : ''}`),
        h('span', { class: 'auto-log-who' }, shortName(rt.completedBy || rt.assignee)),
        h('span', { class: 'auto-log-res' }, rt.resultSummary || rt.reason || rt.title),
        h('button', { type: 'button', class: 'btn link', onclick: () => openTaskById(rt.id) }, '열기 →'))))) : null;

    const openRow = ui.openRoutine === r.id;
    const whoName = human ? '나' : shortName(r.assignee);
    const metaLine = [daysText(r.days), schedText, whoName].filter(Boolean).join(' · ');

    return h('li', { class: `routine auto-item auto-calm${r.enabled === false ? ' off' : ''}` },
      h('div', { class: 'r-top auto-calm-row' },
        h('button', {
          type: 'button', class: 'r-main auto-calm-main',
          onclick: () => { ui.openRoutine = openRow ? null : r.id; render(); },
        },
        h('div', { class: 'auto-calm-title' }, r.title),
        h('div', { class: 'small muted auto-calm-meta' }, metaLine)),
        h('div', { class: 'r-ctl auto-calm-ctl' },
          h('button', {
            type: 'button', class: 'btn sm',
            onclick: () => once(`run-rt-${r.id}`, async () => {
              const resRun = await act('POST', `/api/ui/routines/${r.id}/run-now`, {});
              if (!resRun) return;
              if (resRun.notified) pushLiveCard({ kind: 'connect', kicker: '오토메이션', title: r.title, body: '알람 전송' });
              else if (resRun.started) pushLiveCard({ kind: 'connect', kicker: '실행 시작', title: `${shortName(r.assignee)} 실행`, body: r.title, empId: r.assignee, taskId: resRun.task?.id, actionLabel: '보기 →' });
              else if (resRun.gate) pushLiveCard({ kind: 'approve', kicker: '승인 대기', title: `${resRun.gate} 필요`, body: r.title, taskId: resRun.task?.id, actionLabel: '승인 →', seal: true });
              else pushLiveCard({ kind: 'handoff', kicker: '오토메이션', title: `${shortName(r.assignee)} 등록`, body: r.title, taskId: resRun.task?.id, actionLabel: '열기 →' });
            }),
          }, '실행'),
          h('label', { class: 'switch', title: r.enabled !== false ? '켜짐' : '꺼짐' },
            h('input', { type: 'checkbox', checked: r.enabled !== false, onchange: (ev) => act('PATCH', `/api/ui/routines/${r.id}`, { enabled: ev.target.checked }) }),
            h('span', { class: 'tr' })))),
      openRow ? h('div', { class: 'r-fold auto-calm-fold' },
        h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:8px' },
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            whoBtn,
            autoApproveCardBtn,
            human ? h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: r.alarm, onchange: (ev) => act('PATCH', `/api/ui/routines/${r.id}`, { alarm: ev.target.checked }) }), h('span', { class: 'tr' }), '알람') : null),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { if (confirm(`삭제할까요?\n${r.title}`)) { ui.openRoutine = null; act('DELETE', `/api/ui/routines/${r.id}`, undefined, '삭제했어요'); } } }, '삭제')),
        picking ? h('div', { class: 'r-who' }, assigneePicker(r.assignee, (id) => { ui.rtPicking = null; act('PATCH', `/api/ui/routines/${r.id}`, { assignee: id }, `${shortName(id)} 배정`); })) : null,
        h('div', { class: 'r-sched-row' }, rTitle, rSched, rTime, rCost),
        h('div', { class: 'r-sched-row' }, h('span', { class: 'small muted' }, '요일'), rDays),
        rBlueprintEditor,
        !human ? h('div', { class: 'p-wrap' },
          h('div', { class: 'p-toolbar' },
            h('div', { class: 'row' }, insDrawer.btn, dirtyEl),
            h('button', { type: 'button', class: 'btn link', onclick: () => openPromptPreview('routines', r.id, flushRoutine) }, '지시서 보기')),
          insDrawer.panel,
          ins,
          h('div', { class: 'row auto-fold-foot' },
            todayTask ? h('button', { type: 'button', class: 'btn link', onclick: () => openTaskById(todayTask.id) }, '오늘 할 일 →') : h('span'),
            h('button', { type: 'button', class: 'btn sm dark', onclick: () => saveRoutine() }, '저장')))
          : h('div', { class: 'row auto-fold-foot' },
            todayTask ? h('button', { type: 'button', class: 'btn link', onclick: () => openTaskById(todayTask.id) }, '오늘 할 일 →') : h('span'),
            h('button', { type: 'button', class: 'btn sm dark', onclick: () => saveRoutine() }, '저장')),
        relay,
        !human ? stepsEditor('routines', r) : null,
        recentLogEl) : null);
  };

  // 상단 심플 2-탭 바
  const topBar = h('div', { class: 'auto-top-bar' },
    h('div', { class: 'auto-tabs', role: 'tablist', 'aria-label': '오토메이션 보기 전환' },
      h('button', {
        type: 'button', role: 'tab', 'aria-selected': ui.autoTab !== 'runs' ? 'true' : 'false',
        class: `auto-tab${ui.autoTab !== 'runs' ? ' on' : ''}`,
        onclick: () => { ui.autoTab = 'list'; render(); },
      }, '오토메이션', h('span', { class: 'auto-tab-cnt' }, String(visible.length))),
      h('button', {
        type: 'button', role: 'tab', 'aria-selected': ui.autoTab === 'runs' ? 'true' : 'false',
        class: `auto-tab${ui.autoTab === 'runs' ? ' on' : ''}`,
        onclick: () => { ui.autoTab = 'runs'; render(); },
      }, '기록', h('span', { class: 'auto-tab-cnt' }, String(allRuns.length)))),
    h('div', { class: 'auto-top-acts' },
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: d.settings.alarmsEnabled, onchange: (ev) => act('PATCH', '/api/ui/settings', { alarmsEnabled: ev.target.checked }) }),
        h('span', { class: 'tr' }),
        h('span', { class: 'small' }, '알람')),
      h('button', { type: 'button', class: 'btn dark auto-new-cta', onclick: () => openNewAutomationModal() }, '+ 추가')));

  if (ui.autoTab === 'runs') {
    const runFilter = ui.autoRunsFilter || 'all';
    const statuses = [
      ['all', `전체 ${allRuns.length}`],
      ['완료', `완료 ${allRuns.filter((t) => t.status === '완료').length}`],
      ['진행', `진행 ${allRuns.filter((t) => t.status === '진행').length}`],
      ['막힘', `막힘 ${allRuns.filter((t) => t.status === '막힘').length}`],
      ['대기', `대기 ${allRuns.filter((t) => t.status === '대기').length}`],
    ];
    const filteredRuns = runFilter === 'all' ? allRuns : allRuns.filter((t) => t.status === runFilter);
    const fmtRunTs = (t) => {
      const iso = t.completedAt || t.lastRunAt || t.createdAt;
      if (iso) {
        const dt = new Date(iso);
        if (!Number.isNaN(dt.getTime())) {
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          const hh = String(dt.getHours()).padStart(2, '0');
          const mi = String(dt.getMinutes()).padStart(2, '0');
          return `${mm}-${dd} ${hh}:${mi}`;
        }
      }
      return `${t.date}${t.time ? ` ${t.time}` : ''}`;
    };

    return h('div', { class: 'auto-page' },
      topBar,
      h('div', { class: 'auto-toolbar' },
        h('div', { class: 'auto-filters', role: 'group', 'aria-label': '실행 상태 필터' },
          statuses.map(([k, label]) => h('button', {
            type: 'button', class: `chip sm${runFilter === k ? ' on' : ''}`,
            onclick: () => { ui.autoRunsFilter = k; render(); },
          }, label))),
        h('button', {
          type: 'button', class: 'btn sm auto-refresh-btn', title: '실행 기록 새로고침', 'aria-label': '새로고침',
          onclick: async () => { await load(); toast('실행 기록을 새로고침했어요'); },
        }, '↻')),
      filteredRuns.length
        ? h('div', { class: 'auto-runs-list' }, filteredRuns.slice(0, 60).map((t) => {
          const rt = routineMap.get(t.routineId);
          const actorId = (t.completedBy && t.completedBy !== 'system') ? t.completedBy : t.assignee;
          const actorEmp = emp(actorId);
          const actorLabel = actorId === 'jay' ? '대표 알람' : shortName(actorId);
          const schedTag = rt ? (rt.intervalMin ? fmtIntervalLabel(rt.intervalMin) : (rt.time || '매일')) : '오토메이션';
          return h('div', { class: 'auto-run-card' },
            h('div', { class: 'auto-run-left' },
              h('span', { class: `stat-pill ${t.status}` }, t.status),
              h('div', { class: 'auto-run-info' },
                h('div', { class: 'auto-run-title' },
                  rt?.title || t.title,
                  h('span', { class: 'auto-run-sched' }, schedTag)),
                h('div', { class: 'auto-run-summary' }, t.resultSummary || (t.gate && !t.gateApprovedAt ? `승인 대기 · ${t.gate}` : t.reason || t.title)))),
            h('div', { class: 'auto-run-right' },
              h('div', { class: 'auto-run-actor' },
                actorEmp ? avatarEl(actorEmp, { size: 22 }) : null,
                h('span', null, actorLabel)),
              h('span', { class: 'auto-run-ts' }, fmtRunTs(t)),
              h('button', { type: 'button', class: 'btn sm', onclick: () => openTaskById(t.id) }, '결과 열기 →')));
        }))
        : h('div', { class: 'auto-empty-center' },
          h('div', { class: 'auto-empty-title' }, allRuns.length ? '해당 상태의 실행 기록이 없어요' : '아직 실행된 오토메이션 기록이 없어요'),
          h('p', { class: 'small muted' }, '오토메이션 탭에서 ▶ 실행 버튼을 누르거나 스케줄이 도래하면 여기에 실시간으로 기록됩니다.'),
          h('button', { type: 'button', class: 'btn dark', onclick: () => { ui.autoTab = 'list'; render(); } }, '오토메이션으로 이동')));
  }

  // Tab 1: 오토메이션 목록 + 검색/필터 + 템플릿으로 바로 시작
  const listWrap = h('div', { class: 'auto-list-wrap' });
  const renderList = () => {
    const q = String(ui.autoQuery || '').trim().toLowerCase();
    const f = ui.autoFilter || 'all';
    const filtered = visible.filter((r) => {
      if (f === 'ai' && r.assignee === 'jay') return false;
      if (f === 'alarm' && r.assignee !== 'jay') return false;
      if (f === 'interval' && !r.intervalMin) return false;
      if (q) {
        const hay = `${r.title} ${r.instruction || ''} ${r.where || ''} ${shortName(r.assignee)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!visible.length) {
      listWrap.replaceChildren(
        h('div', { class: 'auto-empty-msg' }, '아직 등록된 오토메이션이 없습니다. 아래 템플릿을 누르거나 우측 상단 + 새 오토메이션을 눌러 시작하세요.'));
      return;
    }
    if (!filtered.length) {
      listWrap.replaceChildren(
        h('div', { class: 'auto-empty-center compact' },
          h('div', { class: 'auto-empty-title' }, '조건에 맞는 오토메이션이 없어요'),
          h('button', {
            type: 'button', class: 'btn sm',
            onclick: () => { ui.autoQuery = ''; ui.autoFilter = 'all'; render(); },
          }, '필터 초기화')));
      return;
    }
    listWrap.replaceChildren(h('ul', { class: 'routines auto-list' }, filtered.map(row)));
  };

  const searchIn = h('input', {
    class: 'in auto-search-in',
    type: 'search',
    value: ui.autoQuery || '',
    placeholder: '오토메이션 이름 · 담당 AI · 프롬프트 검색...',
    'aria-label': '오토메이션 검색',
  });
  searchIn.addEventListener('input', () => {
    ui.autoQuery = searchIn.value;
    renderList();
  });

  const filters = [
    ['all', '전체'],
    ['ai', 'AI 실행'],
    ['interval', '주기 반복'],
    ['alarm', '대표 알람'],
  ];
  const filterBtns = filters.map(([k, label]) => h('button', {
    type: 'button',
    class: `chip sm${(ui.autoFilter || 'all') === k ? ' on' : ''}`,
    onclick: () => {
      ui.autoFilter = k;
      filterBtns.forEach((b, idx) => b.classList.toggle('on', filters[idx][0] === k));
      renderList();
    },
  }, label));

  renderList();

  const haveTitles = new Set(d.routines.map((r) => r.title));
  const curTplCat = ui.autoTplCat || 'all';
  const tplList = curTplCat === 'all' ? AUTOMATION_TEMPLATES : AUTOMATION_TEMPLATES.filter((t) => t.cat === curTplCat);
  const templateInner = [
    h('div', { class: 'auto-tpl-cats', role: 'group', 'aria-label': '템플릿 분야 필터' },
      AUTOMATION_TPL_CATS.map(([k, lbl]) => {
        const cnt = k === 'all' ? AUTOMATION_TEMPLATES.length : AUTOMATION_TEMPLATES.filter((t) => t.cat === k).length;
        return h('button', {
          type: 'button',
          class: `chip sm${curTplCat === k ? ' on' : ''}`,
          onclick: () => { ui.autoTplCat = k; render(); },
        }, `${lbl} (${cnt})`);
      })),
    h('div', { class: 'auto-tpl-grid' },
      tplList.map((tpl) => {
        const already = haveTitles.has(tpl.title);
        const dayPrefix = tpl.days.length === 7 ? '매일' : daysText(tpl.days);
        const schedBadge = tpl.intervalMin ? fmtIntervalLabel(tpl.intervalMin) : `${dayPrefix} ${tpl.time}`;
        return h('button', {
          type: 'button',
          class: `auto-tpl-card${already ? ' added' : ''}`,
          onclick: () => openNewAutomationModal(tpl),
        },
        h('div', { class: 'auto-tpl-top' },
          h('span', { class: 'auto-tpl-kicker' }, tpl.kicker),
          h('span', { class: 'auto-tpl-sched' }, already ? `${schedBadge} · 등록됨` : `${schedBadge} →`)),
        h('div', { class: 'auto-tpl-title' }, tpl.title));
      })),
  ];
  const templateSection = visible.length
    ? h('details', { class: 'clean-fold auto-tpl-fold', 'data-k': 'auto-tpl-fold' },
      h('summary', null, `자동화 템플릿 (${AUTOMATION_TEMPLATES.length})`),
      h('div', { class: 'auto-tpl-fold-body' }, templateInner))
    : h('section', { class: 'auto-tpl-sec' },
      h('div', { class: 'auto-tpl-head' }, h('h2', { class: 'auto-tpl-h' }, '템플릿으로 시작')),
      templateInner);

  const packs = S.options.routinePacks || [];
  const packBox = h('details', { class: 'pack-box auto-pack-drawer', 'data-k': 'rt-packs' },
    h('summary', null, '오토메이션 팩 · 청사진 · 알림 시험'),
    packs.length ? h('div', { class: 'pack-grid' }, packs.map((p) => {
      const doneAll = p.titles.every((tt) => haveTitles.has(tt));
      return h('div', { class: 'pack-card' },
        h('div', { class: 'top' }, h('span', { class: 'tag' }, p.badge), h('b', null, p.title)),
        h('ul', { class: 'pack-list' }, p.titles.map((tt) => h('li', null, tt))),
        h('div', { class: 'row auto-pack-acts' },
          doneAll ? h('span', { class: 'tag solid' }, '담김')
            : h('button', { type: 'button', class: 'btn sm dark', onclick: () => once(`pack-${p.key}`, async () => {
              const r = await act('POST', '/api/ui/routines/pack', { key: p.key });
              if (r) toast(r.added ? `${p.title} ${r.added}개를 담았어요` : '이미 모두 담겨 있어요');
            }) }, '이 팩 담기')));
    })) : null,
    h('div', { class: 'bp-bar' },
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => act('POST', '/api/ui/alarms/test', {}, '시험 알림을 보냈어요') }, '알림 시험'),
        h('button', { type: 'button', class: 'btn sm', onclick: openBlueprintExport }, '청사진 내보내기'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: openBlueprintImport }, '청사진 가져오기'))));

  return h('div', { class: 'auto-page' },
    topBar,
    h('div', { class: 'auto-toolbar' },
      searchIn,
      h('div', { class: 'auto-filters', role: 'group', 'aria-label': '필터' }, filterBtns)),
    listWrap,
    templateSection,
    packBox);
}

// ───────── 내 직원 ─────────

async function ensureModels() {
  if (ui.models) return;
  ui.models = [];
  try { ui.models = await (await fetch('/api/models')).json(); } catch { ui.models = []; }
  render();
}

function openCooldownModal(e) {
  const dlg = document.getElementById('dlg');
  const opts = [
    [30, '30분 휴식'],
    [60, '1시간 휴식'],
    [300, '5시간 휴식 (5시간 한도)'],
    [1440, '오늘 하루 휴식'],
  ];
  const fbName = e.fallbackTo ? shortName(e.fallbackTo) : '여유 AI 자동 선택';
  setDlg(dlg,
    h('h3', null, `${e.name} · 토큰 한도 휴식`),
    h('p', { class: 'small muted', style: 'margin:-8px 0 14px' }, `휴식하는 동안 이 직원에게 들어오는 일은 대체 AI(${fbName})로 자동 전환됩니다.`),
    h('div', { class: 'picker' }, opts.map(([mins, label]) => h('button', {
      type: 'button', class: 'btn sm',
      onclick: () => once(`cd-${e.id}`, async () => {
        dlg.close();
        await act('POST', `/api/ui/employees/${e.id}/cooldown`, { minutes: mins, reason: `대표가 ${label} 지정` }, `${e.name}: ${label} 설정했어요 (대체: ${fbName})`);
      }),
    }, label))),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, '취소')));
  dlg.showModal();
}

function empCard(e) {
  const editing = ui.editingEmp === e.id;
  const openEdit = (field) => { ui.editingEmp = e.id; ui.empDraftEngine[e.id] = e.engine; render(); setTimeout(() => document.querySelector(`[data-k="emp-${field}-${e.id}"]`)?.focus(), 0); };
  const valOr = (v, field) => (v ? v : h('button', { class: 'input-me', onclick: () => openEdit(field) }, '입력'));
  const today = S.data.tasks.filter((t) => t.date === S.today && t.assignee === e.id);
  const cooling = isEmpCooling(e);
  const coolMin = empCooldownMin(e);
  if (!editing) {
    const how = engineText(e);
    const runSeg = h('div', { class: 'seg', role: 'group', 'aria-label': '실행 방식' }, S.options.runModes.map((m) => h('button', {
      type: 'button', class: e.runMode === m ? 'on' : '', 'aria-pressed': e.runMode === m ? 'true' : 'false', disabled: ['none', 'web'].includes(e.engine) && m !== 'off',
      onclick: () => act('PATCH', `/api/ui/employees/${e.id}`, { runMode: m }, `${e.name}: ${RUN_LABEL[m]}`),
    }, RUN_LABEL[m])));
    const coolBtn = cooling
      ? h('button', { class: 'btn sm dark', onclick: () => once(`cd0-${e.id}`, () => act('POST', `/api/ui/employees/${e.id}/cooldown`, { minutes: 0 }, `${e.name} 휴식을 해제했어요`)) }, '휴식 해제')
      : h('button', { class: 'btn sm', title: '멤버십 토큰이 다 썼을 때 대체 AI로 넘김', onclick: () => openCooldownModal(e) }, '휴식');
    const workJob = S.working.find((w) => w.emp === e.id);
    const tInfo = empTeamInfo(e);
    const kbInfo = empKnowledgeDocs(e);
    const resNames = e.resources.map((id) => res(id)?.name).filter(Boolean);
    const kvRows = [
      h('dt', null, '스킬'), h('dd', null, skillPillsEl(e, { max: 4 })),
      h('dt', null, '지식 · RAG'), h('dd', null, empKbPillsEl(e, { max: 3 })),
    ];
    if (resNames.length) {
      kvRows.push(h('dt', null, '자원'), h('dd', null, resNames.join(', ')));
    }
    if (e.fallbackTo && emp(e.fallbackTo)) {
      kvRows.push(h('dt', null, '대체 AI 직원'), h('dd', null, shortName(e.fallbackTo)));
    }
    if (e.tools?.length) {
      kvRows.push(h('dt', null, '도구'), h('dd', null, e.tools.join(', ')));
    }
    if (e.manual) {
      kvRows.push(h('dt', null, '매뉴얼'), h('dd', null, h('span', { class: 'clamp2' }, e.manual)));
    }
    if (e.salary !== null && e.salary !== undefined && e.salary > 0) {
      kvRows.push(h('dt', null, '월급'), h('dd', null, `월 ${won(e.salary)}`));
    }
    return h('div', { class: 'card' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
        h('div', { class: 'row', style: 'gap:12px;align-items:flex-start;min-width:0' },
          avatarEl(e, { size: 46, clickable: true }),
          h('div', { style: 'min-width:0' },
            h('h3', null,
              e.avatarName || e.name,
              e.avatarName && e.avatarName !== e.name ? h('span', { class: 'tag', style: 'margin-left:6px' }, e.name) : null,
              h('span', { class: `team-pill tm-${tInfo.key}`, title: tInfo.hint }, h('i'), tInfo.short)),
            h('div', { class: 'small muted', style: 'margin-top:2px' }, workJob?.statusLine ? `진행 중: ${workJob.statusLine}` : (e.role || how)))),
        cooling ? h('span', { class: 'tag solid', title: e.cooldownReason || '토큰 휴식' }, `휴식 ${coolMin}분`)
          : workJob ? h('span', { class: 'tag solid' }, '일하는 중') : today.length ? h('span', { class: 'tag' }, `오늘 ${today.length}`) : null),
      usageBarEl(e),
      h('dl', { class: 'kv' }, kvRows),
      h('div', { class: 'foot' },
        ['none', 'web'].includes(e.engine) ? h('span', { class: 'small muted' }, e.engine === 'web' ? '복사 실행' : 'MCP 보고') : runSeg,
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', onclick: () => openEmployeeSkillsModal(e.id) }, `스킬${e.skills?.length ? ` (${e.skills.length})` : ''}`),
          h('button', { class: 'btn sm', onclick: () => openEmployeeKnowledgeModal(e.id) }, `지식${kbInfo.total ? ` (${kbInfo.total})` : ''}`),
          coolBtn,
          h('button', { class: 'btn sm', onclick: () => { ui.editingEmp = e.id; ui.empDraftEngine[e.id] = e.engine; render(); } }, '편집'))));
  }
  const curEng = ui.empDraftEngine[e.id] ?? e.engine;
  if (curEng === 'local') ensureModels();
  const k = (f) => `emp-${f}-${e.id}`;
  const assignableRes = S.data.resources.filter((r) => ['기계', '멤버십', '폴더'].includes(r.kind));
  const resBoxes = assignableRes.map((r) => h('label', { class: 'chk-l' }, h('input', { type: 'checkbox', value: r.id, checked: e.resources.includes(r.id), class: 'res-box', 'data-k': `emp-res-${e.id}-${r.id}` }), `${r.name}`));
  const assignableKb = Array.isArray(S.data.knowledge) ? S.data.knowledge : [];
  const kbBoxes = assignableKb.map((kb) => h('label', { class: 'chk-l' }, h('input', { type: 'checkbox', value: kb.id, checked: (e.knowledgeIds || []).includes(kb.id), class: 'kb-box', 'data-k': `emp-kb-${e.id}-${kb.id}` }), `[${kb.category}] ${kb.title}`));
  const assignableRag = (Array.isArray(S.data.ragSources) ? S.data.ragSources : []).filter((x) => x.enabled !== false);
  const ragBoxes = assignableRag.map((rg) => h('label', { class: 'chk-l' }, h('input', { type: 'checkbox', value: rg.id, checked: (e.ragIds || []).includes(rg.id), class: 'rag-box', 'data-k': `emp-rag-${e.id}-${rg.id}` }), `[RAG] ${rg.name}`));
  const f = {
    name: h('input', { class: 'in sm', value: e.name, 'data-k': k('name') }),
    avatarName: h('input', { class: 'in sm', value: e.avatarName || '', placeholder: '비우면 AI 이름 그대로 표시', maxlength: '40', 'data-k': k('avatarName') }),
    team: h('select', { class: 'in sm', 'data-k': k('team') }, (S.options.teams || []).map((t) => h('option', { value: t.key, selected: (e.team || 'ops') === t.key }, t.name))),
    role: h('input', { class: 'in sm', value: e.role, 'data-k': k('role') }),
    tools: h('input', { class: 'in sm', value: e.tools.join(', '), placeholder: '쉼표로 구분', 'data-k': k('tools') }),
    runsOn: h('input', { class: 'in sm', value: e.runsOn, 'data-k': k('runsOn') }),
    command: h('input', { class: 'in sm', value: e.command, 'data-k': k('command') }),
    salary: h('input', { class: 'in sm', value: e.salary === null || e.salary === undefined ? '' : String(e.salary), inputmode: 'numeric', placeholder: '원 단위, 무료는 0', 'data-k': k('salary') }),
    fallbackTo: h('select', { class: 'in sm', 'data-k': k('fallbackTo') },
      h('option', { value: '' }, '자동으로 여유 AI 선택'),
      S.data.employees.filter((x) => x.id !== e.id).map((x) => h('option', { value: x.id, selected: e.fallbackTo === x.id }, `${shortName(x.id)} (${x.id})`))),
    engine: h('select', { class: 'in sm', 'data-k': k('engine'), onchange: (ev) => { ui.empDraftEngine[e.id] = ev.target.value; render(); } },
      [['web', '복사해서 맡기기 (ChatGPT, Claude, Gemini, Dots, Muse 등)'], ['local', '로컬 모델 (이 컴퓨터 안에서 바로 답)'],
        ['claude', `Claude Code (${S.runners.claude ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음'})`], ['codex', `Codex (${S.runners.codex ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음'})`],
        ['gemini', `Gemini CLI (${S.runners.gemini ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음'})`],
        ['agy', `Antigravity (agy) (${S.runners.agy ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음'})`],
        ['opencode', `OpenCode (${S.runners.opencode ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음'})`],
        ['none', '스스로 보고 (MCP, CLI 로 연결한 AI)']].map(([v, t]) => h('option', { value: v, selected: curEng === v }, t))),
    webUrl: h('input', { class: 'in sm', value: e.webUrl || '', placeholder: 'https://', 'data-k': k('webUrl') }),
    model: h('select', { class: 'in sm', 'data-k': k('model') }, h('option', { value: '' }, ui.models && ui.models.length ? '모델 고르기' : '로컬 모델을 찾는 중이거나 없음'),
      (ui.models || []).map((m) => h('option', { value: m.id, selected: e.model === m.id }, `${m.label}${m.size ? ` · ${m.size}` : ''}`))),
    manual: h('textarea', { class: 'in', rows: 6, 'data-k': k('manual'), placeholder: '이 직원이 일하는 방식, 말투, 하지 말아야 할 것' }, e.manual || ''),
  };
  const fld = (label, el) => h('label', { class: 'field' }, label, el);
  const save = async () => {
    const r = await act('PATCH', `/api/ui/employees/${e.id}`, {
      name: f.name.value.trim() || e.name,
      avatarName: f.avatarName.value.trim(),
      team: f.team.value,
      role: f.role.value, tools: f.tools.value, runsOn: f.runsOn.value, command: f.command.value,
      salary: f.salary.value.trim() === '' ? null : f.salary.value, engine: f.engine.value,
      fallbackTo: f.fallbackTo.value || null,
      model: f.engine.value === 'local' ? f.model.value : undefined, manual: f.manual.value,
      webUrl: f.engine.value === 'web' ? f.webUrl.value : undefined,
      resources: [...document.querySelectorAll('.res-box')].filter((x) => x.checked).map((x) => x.value),
      knowledgeIds: [...document.querySelectorAll('.kb-box')].filter((x) => x.checked).map((x) => x.value),
      ragIds: [...document.querySelectorAll('.rag-box')].filter((x) => x.checked).map((x) => x.value),
    }, '저장했어요');
    if (r) { delete ui.empDraftEngine[e.id]; ui.editingEmp = null; render(); }
  };
  return h('div', { class: 'card wide' },
    h('h3', null, `${shortName(e.id)} 편집`, h('span', { class: 'emp-id' }, e.id)),
    h('div', { class: 'f-grid' }, fld('AI 서비스 이름', f.name), fld('캐릭터 이름 · 호칭 (선택)', f.avatarName), fld('소속 팀 (부서)', f.team), fld('역할', f.role), fld('도구', f.tools), fld('근무 위치', f.runsOn), fld('명령 방법', f.command), fld('월급 (월, 원)', f.salary), fld('막히면 대신할 AI (토큰 소진 시)', f.fallbackTo), fld('일 시키는 방법', f.engine), curEng === 'local' ? fld('로컬 모델', f.model) : null, curEng === 'web' ? fld('열 주소 (선택)', f.webUrl) : null),
    assignableRes.length ? h('div', { style: 'margin-top:16px' }, h('div', { class: 'small', style: 'color:#555;margin-bottom:6px' }, '쓸 수 있는 내 자원 (컴퓨터 · 멤버십 · 폴더)'), h('div', { class: 'chk-wrap' }, resBoxes)) : null,
    assignableKb.length ? h('div', { style: 'margin-top:14px' }, h('div', { class: 'small', style: 'color:#555;margin-bottom:6px' }, '필수 참고 지식 (작업마다 프롬프트에 자동 포함)'), h('div', { class: 'chk-wrap' }, kbBoxes)) : null,
    assignableRag.length ? h('div', { style: 'margin-top:14px' }, h('div', { class: 'small', style: 'color:#555;margin-bottom:6px' }, '우선 연결할 내 RAG 소스'), h('div', { class: 'chk-wrap' }, ragBoxes)) : null,
    h('div', { style: 'margin-top:16px' }, fld('업무 매뉴얼', f.manual), h('div', { class: 'warn' }, '비밀번호, 인증 코드, 카드 번호는 여기에 쓰지 마세요. 이 글은 AI에게 그대로 전달됩니다.')),
    CLI_ENGINES.includes(curEng) ? h('p', { class: 'small muted' }, S.runners[curEng] ? `실행을 누르면 ${ENGINE_LABEL[curEng]}를 workspaces/${e.id} 폴더에서 한 번 실행합니다. 권한을 건너뛰는 옵션은 쓰지 않아요.` : `이 컴퓨터에 ${ENGINE_LABEL[curEng]}가 없어요. 그래도 할 일에서 복사해서 맡기기로 같은 일을 시킬 수 있어요.`) : null,
    h('div', { class: 'row', style: 'justify-content:space-between;margin-top:16px' },
      h('button', { class: 'btn sm', onclick: () => { if (confirm(`${e.name}, 명단에서 뺄까요?`)) { delete ui.empDraftEngine[e.id]; ui.editingEmp = null; act('DELETE', `/api/ui/employees/${e.id}`, undefined, '명단에서 뺐어요'); } } }, '명단에서 빼기'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { delete ui.empDraftEngine[e.id]; ui.editingEmp = null; load(); } }, '취소'), h('button', { class: 'btn dark', onclick: save }, '저장'))));
}

// 지금 쓰는 모델 한 줄, 바뀌었으면 한 줄 더
function modelLine(e) {
  const m = e.modelNow;
  if (!m) return null;
  const last = (e.modelHistory || []).slice(-1)[0];
  return h('div', { class: 'small muted' }, `모델 ${m.name}`,
    last ? h('div', null, `모델 바뀜: ${last.from} → ${last.to} (${dateK(last.at.slice(0, 10))})`) : null);
}

function engineText(e) {
  if (e.engine === 'web') return `복사해서 맡기기${e.webUrl ? ` · ${e.webUrl.replace(/^https:\/\//, '').replace(/\/.*$/, '')}` : ''}`;
  if (e.engine === 'local') return `로컬 모델 · ${e.model ? e.model.replace(/^(ollama|lmstudio):/, '') : '모델을 골라 주세요'}`;
  if (CLI_ENGINES.includes(e.engine)) {
    const extra = [e.model, e.effort ? ({ low: 'Low', medium: 'Med', high: 'High' }[e.effort] || e.effort) : ''].filter(Boolean).join(' · ');
    return `${ENGINE_LABEL[e.engine]}${extra ? ` (${extra})` : ''} · ${S.runners[e.engine] ? '이 컴퓨터에 설치됨' : '이 컴퓨터에 없음, 복사해서 맡기기로 씀'}`;
  }
  return ENGINE_LABEL[e.engine] || e.engine;
}

const BOT_AGENT_OPTIONS = [
  { engine: 'claude', label: 'Claude', badge: '✦', tone: 'ag-claude', hasEffort: true, models: [['', '기본 모델 (CLI 설정)'], ['sonnet', 'Claude Sonnet (빠름 · 균형)'], ['opus', 'Claude Opus (최고 추론)'], ['haiku', 'Claude Haiku (초고속)']] },
  { engine: 'codex', label: 'Codex', badge: '◎', tone: 'ag-codex', hasEffort: true, models: [['', '기본 모델 (CLI 설정)'], ['gpt-5.4', 'GPT-5.4 (최신 코딩·추론)'], ['gpt-5.4-mini', 'GPT-5.4 Mini (빠름)'], ['o3', 'o3 (깊은 추론)']] },
  { engine: 'agy', label: 'Antigravity', badge: '▲', tone: 'ag-agy', hasEffort: false, models: [['', '기본 모델 (CLI 설정)'], ['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash', 'Gemini 2.5 Flash']] },
  { engine: 'opencode', label: 'OpenCode', badge: '⌘', tone: 'ag-opencode', hasEffort: false, models: [['', '기본 모델 (CLI 설정)']] },
  { engine: 'gemini', label: 'Gemini CLI', badge: '◆', tone: 'ag-gemini', hasEffort: false, models: [['', '기본 모델 (CLI 설정)'], ['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash', 'Gemini 2.5 Flash']] },
  { engine: 'local', label: '로컬 AI', badge: '◈', tone: 'ag-local', hasEffort: false, models: [] },
  { engine: 'web', label: '웹 복사', badge: '↗', tone: 'ag-other', hasEffort: false, models: [] },
];

function openAddEmployee(opts = {}) {
  const cfg = opts && !opts.target ? opts : {};
  const dlg = document.getElementById('dlg');
  dlg.className = 'wide arsenal-dlg';

  const d = S.data;
  const machines = d.resources.filter((r) => r.kind === '기계');
  const defaultMainEmp = (d.settings?.mainAi && d.employees.find((e) => e.id === d.settings.mainAi)) || null;
  const firstInstalled = BOT_AGENT_OPTIONS.find((o) => CLI_ENGINES.includes(o.engine) && S.runners?.[o.engine]);
  let pickedEngine = (defaultMainEmp && CLI_ENGINES.includes(defaultMainEmp.engine) && S.runners?.[defaultMainEmp.engine])
    ? defaultMainEmp.engine
    : (firstInstalled?.engine || 'web');
  let pickedModel = '';
  let pickedEffort = '';
  let pickedMac = d.settings?.mainMachine || machines.find((m) => m.isThisMac)?.id || machines[0]?.id || '';
  let pickedPack = cfg.pack || 'joseon';
  let pickedAvatar = cfg.avatar || 'jangyeongsil';
  let pickedTeam = cfg.team || 'dev';
  let customImg = '';
  let avOpen = false;
  let agentOpen = false;
  const pickedSkills = new Set();
  const pickedKbIds = new Set();
  const pickedRagIds = new Set();
  let quickKbOpen = false;

  const allPresets = S.options.avatarPresets || [];
  const teams = S.options.teams || [];
  const savedCustom = d.settings?.customAvatars || [];
  const ossCatalog = [...(S.options?.ossCatalog || [])];

  const nameIn = h('input', { class: 'bot-name-in', 'aria-label': 'AI 직원 이름', placeholder: '이름 (예: 문어봇 · 영상편집 팀장 · 마케터)' });
  const bioIn = h('textarea', {
    class: 'in bot-bio-in', rows: 3, 'aria-label': '역할 및 업무 설명',
    placeholder: '이 직원이 누구고 어떤 일을 하나요?\n예: 유튜브 쇼츠와 모션그래픽을 Remotion으로 제작하는 영상편집 전담 AI',
  });
  const ghSkillIn = h('input', { class: 'in sm', 'aria-label': 'GitHub 스킬 주소 (선택)', placeholder: '+ 커스텀 GitHub·npx 스킬 주소 직접 추가 (선택 · 예: https://github.com/remotion-dev/remotion)' });
  const teamOpts = teams.filter((t) => t.key !== 'exec');
  if (!teamOpts.some((t) => t.key === pickedTeam)) pickedTeam = teamOpts[0]?.key || 'dev';
  const teamSel = h('select', { class: 'in sm bot-team-sel', 'aria-label': '소속 팀' },
    teamOpts.map((t) => h('option', { value: t.key, selected: t.key === pickedTeam }, t.name)));
  teamSel.value = pickedTeam;
  teamSel.addEventListener('change', () => { pickedTeam = teamSel.value; });

  const macSel = h('select', { class: 'in', 'aria-label': '실행 컴퓨터', onchange: (ev) => { pickedMac = ev.target.value; } },
    h('option', { value: '', selected: !pickedMac }, '자동 최적화 (메인 컴퓨터)'),
    ...machines.map((m) => {
      const mh = S.machineHealth?.[m.id];
      const ram = typeof mh?.ramPct === 'number' ? ` · RAM ${mh.ramPct}%` : '';
      return h('option', { value: m.id, selected: m.id === pickedMac }, `${m.name}${m.isThisMac ? ' (Local Mac)' : ''}${ram}`);
    }));

  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'hidden' });
  const avBtnWrap = h('button', {
    type: 'button', class: 'bot-av-btn', title: '클릭해 캐릭터 또는 내 이미지 변경',
    onclick: () => { avOpen = !avOpen; renderAvDrawer(); },
  });
  const avDrawer = h('div', { class: 'bot-av-drawer hidden' });
  const agentTrigger = h('button', {
    type: 'button', class: 'in bot-agent-trigger',
    onclick: () => {
      agentOpen = !agentOpen;
      if (agentOpen && pickedEngine === 'local') ensureModels();
      renderAgentPanel();
    },
  });
  const agentPanel = h('div', { class: 'bot-agent-panel hidden' });
  const skillChipsWrap = h('div', { class: 'bot-arsenal-wrap' });

  const renderAvButton = () => {
    const fake = { id: 'new-emp', name: nameIn.value.trim() || '새 AI 직원', avatar: pickedAvatar, avatarStyle: 'pixel', avatarImage: customImg };
    avBtnWrap.replaceChildren(
      avatarEl(fake, { size: 54, stateOverride: 'working', styleOverride: 'pixel' }),
      h('span', { class: 'bot-av-edit', 'aria-hidden': 'true' }, '✎'));
  };

  const renderAvDrawer = () => {
    renderAvButton();
    avDrawer.classList.toggle('hidden', !avOpen);
    if (!avOpen) { avDrawer.replaceChildren(); return; }
    const koreanAll = allPresets.filter((p) => p.pack === 'joseon' || p.pack === 'k-crew');
    const presets = pickedPack === 'all-kr'
      ? koreanAll
      : allPresets.filter((p) => p.pack === pickedPack);
    avDrawer.replaceChildren(
      h('div', { class: 'picker bot-av-packs' },
        [['joseon', '조선 집현전 픽셀 (21)'], ['k-crew', '한국 수호신 픽셀 (8)'], ['all-kr', `전체 한국 픽셀 (${koreanAll.length})`]].map(([pk, pl]) => h('button', {
          type: 'button', class: `chip sm${pickedPack === pk ? ' on' : ''}`,
          onclick: () => {
            pickedPack = pk;
            const list = pk === 'all-kr' ? koreanAll : allPresets.filter((p) => p.pack === pk);
            if (list.length && !list.some((p) => p.key === pickedAvatar)) pickedAvatar = list[0].key;
            customImg = '';
            renderAvDrawer();
          },
        }, pl))),
      h('div', { class: 'add-av-strip' },
        ...presets.map((p) => h('button', {
          type: 'button', class: `add-av-btn${!customImg && pickedAvatar === p.key ? ' on' : ''}`, title: `${p.name} — ${p.hint}`,
          onclick: () => {
            pickedAvatar = p.key;
            if (p.team && teamOpts.some((t) => t.key === p.team)) { pickedTeam = p.team; teamSel.value = p.team; }
            customImg = '';
            renderAvDrawer();
          },
        },
        C.avatarSvg(p.key, { size: 34, state: 'working', style: 'pixel' }),
        h('span', null, p.name.replace(/\s*\([^)]*\)/, '').replace(/^(민화|꼬마|아기|단원|혜원|추사|어의|의녀|궁궐|집현전|착호)\s+/, '').split(' ')[0]))),
        ...savedCustom.slice(0, 4).map((c) => h('button', {
          type: 'button', class: `add-av-btn${customImg === c.image ? ' on' : ''}`, title: c.name,
          onclick: () => { customImg = c.image; renderAvDrawer(); },
        }, h('img', { src: c.image, alt: c.name, width: 34, height: 34 }), h('span', null, c.name))),
        h('button', { type: 'button', class: 'add-av-btn add-up', onclick: () => fileIn.click() },
          h('b', { class: 'bot-up-plus' }, '+'), h('span', null, '내 이미지'))));
  };

  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    try {
      customImg = await resizeImageToDataUrl(f, false);
      renderAvDrawer();
      toast('내 캐릭터 이미지를 올렸어요');
    } catch (err) { toast(err.message || '이미지 처리 오류'); }
  });

  let modelQuery = '';
  const renderAgentTrigger = () => {
    const meta = BOT_AGENT_OPTIONS.find((o) => o.engine === pickedEngine) || BOT_AGENT_OPTIONS[0];
    const installed = CLI_ENGINES.includes(meta.engine) ? Boolean(S.runners?.[meta.engine]) : true;
    const efLbl = pickedEffort ? ({ low: 'Low', medium: 'Med', high: 'High' }[pickedEffort] || pickedEffort) : '';
    const subParts = [pickedModel ? pickedModel.replace(/^(ollama|lmstudio):/, '') : '기본 모델', efLbl, !installed ? '미설치→복사' : ''].filter(Boolean);
    agentTrigger.replaceChildren(
      h('span', { class: `orca-ic bot-mini-ic ${meta.tone}`, 'aria-hidden': 'true' }, meta.badge),
      h('span', { class: 'bot-agent-val' },
        h('b', null, meta.label),
        h('span', { class: 'bot-agent-meta' }, subParts.join(' · '))),
      h('span', { class: 'bot-caret', 'aria-hidden': 'true' }, agentOpen ? '▴' : '▾'));
  };

  const renderAgentPanel = () => {
    renderAgentTrigger();
    agentPanel.classList.toggle('hidden', !agentOpen);
    if (!agentOpen) { agentPanel.replaceChildren(); return; }
    const meta = BOT_AGENT_OPTIONS.find((o) => o.engine === pickedEngine) || BOT_AGENT_OPTIONS[0];
    const searchIn = h('input', {
      class: 'in sm bot-model-search', value: modelQuery,
      placeholder: `${meta.label} 모델 검색 또는 직접 입력 (예: sonnet, gpt-5.4)...`,
      'aria-label': '모델 검색',
      oninput: (ev) => { modelQuery = ev.target.value; renderModelList(); },
    });
    const modelListEl = h('div', { class: 'bot-model-list' });
    const renderModelList = () => {
      const q = modelQuery.trim().toLowerCase();
      let list = meta.engine === 'local'
        ? (ui.models || []).map((m) => [m.id, `${m.label}${m.size ? ` · ${m.size}` : ''}`])
        : meta.models;
      if (q) list = list.filter(([id, lbl]) => id.toLowerCase().includes(q) || lbl.toLowerCase().includes(q));
      const items = list.map(([id, lbl]) => h('button', {
        type: 'button',
        class: `bot-model-opt${pickedModel === id ? ' on' : ''}`,
        onclick: () => { pickedModel = id; renderAgentTrigger(); renderModelList(); },
      }, h('span', null, lbl), pickedModel === id ? h('span', { class: 'bot-m-chk' }, '✓') : null));
      if (q && meta.engine !== 'web' && meta.engine !== 'local' && !list.some(([id]) => id.toLowerCase() === q)) {
        items.push(h('button', {
          type: 'button', class: `bot-model-opt${pickedModel === modelQuery.trim() ? ' on' : ''}`,
          onclick: () => { pickedModel = modelQuery.trim(); renderAgentTrigger(); renderModelList(); },
        }, h('span', null, `직접 모델 ID 사용: ${modelQuery.trim()}`)));
      }
      if (!items.length) {
        items.push(h('div', { class: 'bot-model-empty' }, meta.engine === 'local' ? '실행 중인 Ollama / LM Studio 모델이 없습니다' : meta.engine === 'web' ? '웹 복사 모드는 별도 모델 지정 없이 바로 복사해 맡깁니다' : '일치하는 모델이 없습니다'));
      }
      modelListEl.replaceChildren(...items);
    };
    renderModelList();

    const kids = [
      h('div', { class: 'bot-eng-tabs', role: 'tablist' }, BOT_AGENT_OPTIONS.map((o) => {
        const installed = CLI_ENGINES.includes(o.engine) && Boolean(S.runners?.[o.engine]);
        return h('button', {
          type: 'button',
          class: `bot-eng-tab${pickedEngine === o.engine ? ' on' : ''}`,
          title: `${o.label}${CLI_ENGINES.includes(o.engine) ? (installed ? ' (설치됨)' : ' (미설치)') : ''}`,
          onclick: () => {
            pickedEngine = o.engine;
            pickedModel = '';
            pickedEffort = '';
            modelQuery = '';
            if (o.engine === 'local') ensureModels();
            renderAgentPanel();
          },
        },
        h('span', { class: `orca-ic bot-mini-ic ${o.tone}` }, o.badge),
        h('span', { class: 'bot-eng-lbl' }, o.label),
        installed ? h('i', { class: 'bot-eng-dot', title: '이 맥에 설치됨' }) : null);
      })),
    ];
    if (meta.engine !== 'web') kids.push(searchIn);
    kids.push(modelListEl);
    if (meta.hasEffort) {
      kids.push(h('div', { class: 'bot-effort-bar' },
        h('span', { class: 'small muted' }, '사고 강도'),
        h('div', { class: 'bot-effort-pills' }, [['', 'Default'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']].map(([ek, el]) => h('button', {
          type: 'button', class: `bot-effort-btn${pickedEffort === ek ? ' on' : ''}`,
          onclick: () => { pickedEffort = ek; renderAgentPanel(); },
        }, el)))));
    }
    agentPanel.replaceChildren(...kids);
  };

  const skillArsenal = buildSkillArsenal({
    catalog: ossCatalog,
    compact: true,
    isSelected: (c) => pickedSkills.has(c.key),
    onToggle: (c, rerender) => {
      if (pickedSkills.has(c.key)) pickedSkills.delete(c.key);
      else pickedSkills.add(c.key);
      rerender();
    },
  });
  skillChipsWrap.replaceChildren(skillArsenal.el);

  const kbPickWrap = h('div', { class: 'picker' });
  const quickKbTitle = h('input', { class: 'in sm', placeholder: '새 지식 제목 (예: 채널 말투 가이드)', 'aria-label': '새 지식 제목' });
  const quickKbBody = h('textarea', { class: 'in sm', rows: 2, placeholder: '이 직원이 꼭 알고 일해야 할 규칙이나 자료', 'aria-label': '새 지식 내용' });
  const quickKbBox = h('div', { class: 'kb-inline-add hidden' });
  const renderBotKb = () => {
    const kbs = Array.isArray(S.data?.knowledge) ? S.data.knowledge : [];
    const rags = (Array.isArray(S.data?.ragSources) ? S.data.ragSources : []).filter((r) => r.enabled !== false);
    const items = [
      ...rags.map((rg) => {
        const on = pickedRagIds.has(rg.id);
        return h('button', {
          type: 'button',
          class: `chip sm bp-chip bp-rag-chip${on ? ' on' : ''}`,
          onclick: () => {
            if (pickedRagIds.has(rg.id)) pickedRagIds.delete(rg.id);
            else pickedRagIds.add(rg.id);
            renderBotKb();
          },
        }, h('span', { class: 'bp-rag-tag' }, 'RAG'), rg.name);
      }),
      ...kbs.map((kb) => {
        const on = pickedKbIds.has(kb.id);
        return h('button', {
          type: 'button',
          class: `chip sm bp-chip bp-kb-chip${on ? ' on' : ''}`,
          onclick: () => {
            if (pickedKbIds.has(kb.id)) pickedKbIds.delete(kb.id);
            else pickedKbIds.add(kb.id);
            renderBotKb();
          },
        }, h('span', { class: 'bp-kb-cat' }, kb.category), kb.title);
      }),
    ];
    if (!items.length) items.push(h('span', { class: 'small muted' }, '등록된 지식·RAG가 없어요. 오른쪽 "+ 새 지식 추가"로 바로 만들 수 있어요.'));
    kbPickWrap.replaceChildren(...items);
    quickKbBox.classList.toggle('hidden', !quickKbOpen);
  };
  quickKbBox.replaceChildren(
    quickKbTitle,
    quickKbBody,
    h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:6px' },
      h('button', {
        type: 'button', class: 'btn sm dark',
        onclick: () => once('add-emp-kb', async () => {
          const t = quickKbTitle.value.trim();
          const c = quickKbBody.value.trim();
          if (!t || !c) { toast('지식 제목과 내용을 입력해 주세요'); return; }
          const created = await api('POST', '/api/ui/knowledge', { title: t, category: '업무 규칙', scope: 'all', content: c });
          if (created && created.id) {
            if (!Array.isArray(S.data.knowledge)) S.data.knowledge = [];
            if (!S.data.knowledge.some((k) => k.id === created.id)) S.data.knowledge.unshift(created);
            pickedKbIds.add(created.id);
            quickKbTitle.value = '';
            quickKbBody.value = '';
            quickKbOpen = false;
            renderBotKb();
            toast(`"${t}" 지식을 만들고 선택했어요`);
          }
        }),
      }, '+ 저장하고 선택')));
  renderBotKb();

  renderAvButton();
  renderAgentTrigger();

  const closeAdd = () => { dlg.className = ''; dlg.close(); render(); };
  const submitBot = () => once('add-emp', async () => {
    const nm = nameIn.value.trim();
    if (!nm) { nameIn.focus(); toast('AI 직원 이름을 적어 주세요'); return; }
    const bio = bioIn.value.trim();
    const roleLine = bio ? bio.split('\n')[0].slice(0, 120) : '';
    const skillsPayload = [...pickedSkills].map((k) => {
      const p = (S.options?.ossCatalog || []).find((c) => c.key === k);
      return p ? { presetKey: p.key, preset: p.key, name: p.name, repo: p.repo, command: p.command, when: p.when, note: p.hint, published: p.published !== false } : null;
    }).filter(Boolean);
    const rawGh = ghSkillIn.value.trim();
    if (rawGh) skillsPayload.push({ sourceInput: rawGh, repo: /^(https?:\/\/|github:|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$)/i.test(rawGh) ? rawGh : '' });

    dlg.className = '';
    dlg.close();
    const r = await act('POST', '/api/ui/employees', {
      name: nm,
      role: roleLine,
      manual: bio,
      engine: pickedEngine,
      model: pickedModel || undefined,
      effort: pickedEffort || undefined,
      machineId: pickedMac || undefined,
      team: pickedTeam,
      avatar: pickedAvatar,
      avatarStyle: 'pixel',
      avatarName: nm,
      avatarImage: customImg,
      skills: skillsPayload,
      knowledgeIds: [...pickedKbIds],
      ragIds: [...pickedRagIds],
    }, `${nm} 직원을 채용했어요`);
    if (r && r.reassigned?.task?.length) toast(`${nm} 채용 완료 · 담당 없던 일 ${r.reassigned.task.length}개 자동 배분`);
  });

  const onKey = (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); submitBot(); } };
  nameIn.addEventListener('keydown', onKey);
  bioIn.addEventListener('keydown', onKey);

  setDlg(dlg,
    h('div', { class: 'row codex-top' },
      h('div', null,
        h('div', { class: 'swarm-kicker' }, 'CONNECT AI · NEW TEAMMATE'),
        h('h3', { class: 'coord-dlg-h' }, '새 AI 직원 만들기')),
      h('button', { type: 'button', class: 'x', 'aria-label': '닫기', onclick: closeAdd }, '×')),
    fileIn,
    h('div', { class: 'bot-head-row' }, avBtnWrap, nameIn, teamSel),
    avDrawer,
    bioIn,
    h('div', { class: 'grid2 bot-ca-grid' },
      h('label', { class: 'field' }, '실행 컴퓨터 (내 자원)', macSel),
      h('div', { class: 'field' }, h('span', null, 'Agent (두뇌 · 모델)'), agentTrigger)),
    agentPanel,
    h('div', { class: 'bot-skill-box' },
      h('div', { class: 'bot-skill-head' },
        h('span', { class: 'bot-skill-lbl' }, '스킬'),
        h('span', { class: 'bot-skill-sub' }, `총 ${ossCatalog.length}종 · 카테고리·검색 지원`)),
      skillChipsWrap,
      ghSkillIn),
    h('div', { class: 'bot-skill-box bot-kb-box' },
      h('div', { class: 'bot-skill-head' },
        h('span', { class: 'bot-skill-lbl' }, '📚 참고할 내 지식 (선택)'),
        h('button', {
          type: 'button', class: 'btn sm',
          onclick: () => { quickKbOpen = !quickKbOpen; renderBotKb(); if (quickKbOpen) setTimeout(() => quickKbTitle.focus(), 20); },
        }, '+ 새 지식 추가')),
      kbPickWrap,
      quickKbBox),
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn', onclick: closeAdd }, '취소'),
      h('button', { type: 'button', class: 'btn dark', onclick: submitBot }, '만들기 ⌘↵')));
  dlg.showModal();
  nameIn.focus();
}

// 자는 시간: 이 시간에는 AI 가 대표를 부르지 않는다 (직원들이 whoami 로 본다)
function quietLine() {
  const q = S.data.settings.quietHours;
  const save = (from, to) => once('quiet', () => act('PATCH', '/api/ui/settings', { quietHours: from && to ? { from, to } : null }, '자는 시간을 바꿨어요'));
  const from = h('input', { class: 'in', type: 'time', value: q?.from || '', 'aria-label': '자는 시간 시작', onchange: (ev) => save(ev.target.value, to.value) });
  const to = h('input', { class: 'in', type: 'time', value: q?.to || '', 'aria-label': '자는 시간 끝', onchange: (ev) => save(from.value, ev.target.value) });
  return h('div', { class: 'quiet' }, h('b', null, '자는 시간'), from, h('span', { class: 'muted', 'aria-hidden': 'true' }, '~'), to);
}

function pageStaff() {
  const d = S.data;
  return h('div', null,
    h('div', { class: 'head' }, h('div', null, h('h1', null, h('b', null, 'AI 직원'))),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn gold sm',
        title: 'connect-ai-video-motion, connect-ai-marketer, reversebusiness 등 CONNECT AI LAB 7종 콘텐츠 스킬을 직원별로 자동 등록합니다',
        onclick: () => once('connect-ai-pack', async () => {
          const r = await act('POST', '/api/ui/skills/connect-ai-pack', {});
          if (r) {
            pushLiveCard({
              kind: 'connect',
              kicker: 'CONNECT AI · 스킬 7종',
              title: `주요 스킬 ${r.total}종을 AI 직원에게 연결했어요`,
              body: `신규 ${r.added} · 업데이트 ${r.updated}`,
              duration: 5000,
            });
          }
        }),
      }, '기본 스킬'),
      h('button', { class: 'btn sm', onclick: openJoseonCodexModal }, '캐릭터'),
      h('button', { class: 'btn sm', onclick: openConnectModal }, '도구 연결'),
      h('button', { class: 'btn dark sm', onclick: () => openAddEmployee() }, '+ AI 직원 추가'))),
    !d.employees.length ? h('div', { class: 'empty' }, '아직 AI 직원이 없어요. + AI 직원 추가를 눌러 시작하세요.') : null,
    d.groups.length <= 1 ? h('div', { class: 'cards' }, d.employees.map(empCard)) : d.groups.filter((g) => d.employees.some((e) => e.group === g.id)).map((g, i) => {
      const list = d.employees.filter((e) => e.group === g.id);
      const grpTitle = g.title === '내 사무실에서 근무' ? '메인 AI 직원' : g.title === '내 컴퓨터 상주' ? '로컬 AI 직원' : g.title;
      return h('section', { class: 'grp' },
        h('div', { class: 'grp-h' }, h('span', { class: 'n0' }, String(i + 1)), h('h2', null, grpTitle), h('span', { class: 'n' }, `${list.length}명`)),
        h('div', { class: 'cards' }, list.map(empCard)));
    }),
    quietLine());
}

// ───────── 내 리소스 ─────────

const GB = (b) => `${(b / 1024 ** 3).toFixed(b > 100 * 1024 ** 3 ? 0 : 1)}GB`;
function uptimeK(sec) {
  const dd = Math.floor(sec / 86400);
  const hh = Math.floor((sec % 86400) / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  return dd ? `${dd}일 ${hh}시간` : hh ? `${hh}시간 ${mm}분` : `${mm}분`;
}
async function loadOffice() {
  try { ui.office = await (await fetch('/api/office')).json(); } catch { ui.office = { error: true }; }
  render();
}

function resRow(r) {
  const users = S.data.employees.filter((e) => e.resources.includes(r.id)).map((e) => shortName(e.id));
  const busy = S.working.filter((w) => { const t = S.data.tasks.find((x) => x.id === w.taskId); return t && t.resource === r.id; }).map((w) => shortName(w.emp));
  const status = h('select', { class: `in sm st-sel${r.status === '꺼짐' ? ' off' : ''}`, 'aria-label': `${r.name} 상태`, onchange: (ev) => act('PATCH', `/api/ui/resources/${r.id}`, { status: ev.target.value }, '상태를 바꿨어요') },
    S.options.resStatus.map((s) => h('option', { value: s, selected: s === r.status }, s)));
  let extra = null;
  const mh = r.kind === '기계' ? S.machineHealth?.[r.id] : null;
  const otherMachines = r.kind === '기계' ? S.data.resources.filter((x) => x.kind === '기계' && x.id !== r.id) : [];
  const workTagCatalog = S.options.machineWorkTags || [
    { key: 'daily', label: '일상 · 브라우저 · SNS' },
    { key: 'code', label: '코딩 · 문서 · 리서치' },
    { key: 'video', label: '영상 · 쇼츠 · 모션' },
    { key: '3d', label: '3D · 블렌더 · 렌더' },
    { key: 'local', label: '로컬 AI (Ollama)' },
  ];
  const curTags = Array.isArray(r.workTags) ? r.workTags : [];
  const workTagBar = r.kind === '기계' ? h('div', { class: 'res-tags-row' },
    h('span', { class: 'small muted res-tags-lbl' }, '담당 작업'),
    h('div', { class: 'picker' }, workTagCatalog.map((wt) => {
      const on = curTags.includes(wt.key);
      return h('button', {
        type: 'button',
        class: `chip sm bp-chip${on ? ' on' : ''}`,
        onclick: () => {
          const next = on ? curTags.filter((k) => k !== wt.key) : [...curTags, wt.key];
          act('PATCH', `/api/ui/resources/${r.id}`, { workTags: next }, on ? `${r.name}: ${wt.label} 해제` : `${r.name}에 ${wt.label} 배정했어요`);
        },
      }, wt.label);
    }))) : null;
  const optBar = r.kind === '기계' ? h('details', { class: 'clean-fold sm res-opt-fold', 'data-k': `res-opt-${r.id}` },
    h('summary', null, `상세 · 담당 작업${curTags.length ? ` (${curTags.length})` : ''} · RAM ${r.maxRamPct || 85}%`),
    workTagBar,
    !r.isThisMac ? h('div', { class: 'row', style: 'margin-top:6px;flex-wrap:wrap' },
      (() => {
        const host = h('input', { class: 'in sm', value: r.hostname || '', placeholder: '호스트 또는 IP', 'data-k': `host-${r.id}`, style: 'max-width:170px', 'aria-label': `${r.name} 호스트` });
        const alias = h('input', { class: 'in sm', value: r.sshAlias || '', placeholder: 'ssh 별칭 (예: mac-studio)', 'data-k': `alias-${r.id}`, style: 'max-width:165px', 'aria-label': `${r.name} ssh 별칭` });
        const lc = r.lastCheck;
        return [
          host, alias,
          h('button', { class: 'btn sm dark', onclick: () => act('PATCH', `/api/ui/resources/${r.id}`, { hostname: host.value.trim(), sshAlias: alias.value.trim() }, '연결 정보를 저장했어요') }, '저장'),
          h('button', { class: 'btn sm', disabled: !r.hostname && !r.sshAlias, onclick: () => act('POST', `/api/ui/resources/${r.id}/check`, {}, '연결을 확인했어요') }, '확인'),
          lc ? h('span', { class: 'small muted' }, lc.ok ? '연결됨 ✓' : lc.reason) : null,
        ];
      })()) : null,
    h('div', { class: 'opt-row' },
      h('label', { class: 'switch', title: '화면 조작(Computer Use) 허용' },
        h('input', { type: 'checkbox', checked: Boolean(r.computerUse), onchange: (ev) => act('PATCH', `/api/ui/resources/${r.id}`, { computerUse: ev.target.checked }, ev.target.checked ? '화면 조작을 켰어요' : '화면 조작을 껐어요') }),
        h('span', { class: 'tr' }),
        h('span', { class: 'small' }, '화면 조작(CU)')),
      h('select', { class: 'in sm', 'aria-label': `${r.name} RAM 상한`, onchange: (ev) => act('PATCH', `/api/ui/resources/${r.id}`, { maxRamPct: Number(ev.target.value) }, `RAM 상한을 ${ev.target.value}%로 바꿨어요`) },
        [75, 80, 85, 90].map((p) => h('option', { value: String(p), selected: (r.maxRamPct || 85) === p }, `RAM 상한 ${p}%`))),
      h('select', { class: 'in sm', 'aria-label': `${r.name} 동시 무거운 작업 상한`, onchange: (ev) => act('PATCH', `/api/ui/resources/${r.id}`, { maxHeavy: Number(ev.target.value) }, `동시 작업 상한을 ${ev.target.value}개로 바꿨어요`) },
        [1, 2].map((n) => h('option', { value: String(n), selected: (r.maxHeavy || 1) === n }, `무거운 작업 ${n}개`))),
      otherMachines.length ? h('select', { class: 'in sm', 'aria-label': `${r.name} 바쁘면 넘길 컴퓨터`, onchange: (ev) => act('PATCH', `/api/ui/resources/${r.id}`, { fallbackTo: ev.target.value || null }, '대체 컴퓨터를 바꿨어요') },
        h('option', { value: '' }, '바쁘면 → 자동'),
        otherMachines.map((m) => h('option', { value: m.id, selected: r.fallbackTo === m.id }, `바쁘면 → ${m.name}`))) : null)) : null;

  const ramLine = mh && typeof mh.ramPct === 'number' ? h('div', { class: 'ram-line' },
    h('div', { class: 'ram-bar', title: `RAM ${mh.ramPct}% (상한 ${mh.maxRamPct}%)` },
      h('div', { class: `ram-fill${mh.level === 'overload' ? ' over' : ''}`, style: `width:${Math.min(100, mh.ramPct)}%` })),
    h('span', { class: 'small muted' }, `${r.isThisMac && ui.office?.local?.chip ? `${ui.office.local.chip} · ` : ''}RAM ${mh.ramPct}%${mh.availGB != null ? ` · 여유 ${mh.availGB}GB` : ''}`),
    h('span', { class: `tag${mh.level === 'overload' ? ' solid' : mh.level === 'busy' ? ' dash' : ''}` }, healthLabel(mh.level))) : null;

  if (r.kind === '기계' && r.isThisMac) {
    extra = h('div', null, ramLine, optBar);
  } else if (r.kind === '기계') {
    const o = (S.offices || []).find((x) => x.id === r.id);
    const oLine = o ? (o.state === 'busy' ? `실행 중 · ${o.title || ''}` : o.state === 'down' ? `미연결 · ${o.reason}` : '연결됨') : null;
    extra = h('div', null, ramLine, oLine ? h('div', { class: 'small office-line' }, oLine) : null, optBar);
  } else if (r.kind === '폴더') {
    extra = h('div', { class: 'small muted mono' }, r.path || '');
  }
  let title;
  if (ui.renamingRes === r.id) {
    const nm = h('input', { class: 'in sm', value: r.name, 'data-k': `rename-${r.id}`, style: 'max-width:220px', 'aria-label': `${r.name} 새 이름` });
    const save = () => { const v = nm.value.trim(); ui.renamingRes = null; if (v && v !== r.name) act('PATCH', `/api/ui/resources/${r.id}`, { name: v }, `이름을 바꿨어요: ${v}`); else render(); };
    nm.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) save(); if (ev.key === 'Escape') { ui.renamingRes = null; render(); } });
    title = h('div', { class: 'row' }, nm, h('button', { class: 'btn sm', onclick: save }, '저장'), h('button', { class: 'btn link', onclick: () => { ui.renamingRes = null; render(); } }, '취소'));
  } else {
    title = h('div', { class: 't' }, r.name,
      h('button', { class: 'btn link', style: 'margin-left:8px', 'aria-label': `${r.name} 이름 바꾸기`, onclick: () => { ui.renamingRes = r.id; render(); } }, '이름 바꾸기'),
      busy.length ? h('span', { class: 'tag solid', style: 'margin-left:8px' }, `${busy.join(', ')} 사용 중`) : null);
  }
  return h('li', { class: 'res' },
    h('div', { class: 'main' },
      title,
      h('div', { class: 's' }, [r.note, users.length ? `쓰는 직원: ${users.join(', ')}` : ''].filter(Boolean).join(' · ')),
      extra),
    h('div', { class: 'row' }, status,
      h('button', { class: 'x', 'aria-label': `${r.name} 지우기`, onclick: () => { if (confirm(`이 리소스를 지울까요?\n${r.name}`)) act('DELETE', `/api/ui/resources/${r.id}`, undefined, '지웠어요'); } }, '×')));
}

// 같은 와이파이의 폰에서 보기 (기본 꺼짐, 본사 컴퓨터 화면에서만 켜고 끈다)
function lanPanel() {
  const onMac = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (!onMac) return null;
  const info = S.lanInfo || { enabled: false, urls: [] };
  const L = ui.lan && ui.lan.enabled === info.enabled ? ui.lan : info;
  const toggle = (on) => once('lan', async () => {
    try { ui.lan = await api('POST', '/api/ui/lan', { on }); toast(on ? '폰에서 볼 수 있게 열었어요' : '폰에서 보기를 껐어요'); } catch { ui.lan = null; }
    await load();
  });
  const fresh = () => once('lan-code', async () => { try { ui.lan = await api('POST', '/api/ui/lan/code', {}); render(); } catch { /* toast */ } });
  const left = L.expiresAt ? Math.max(0, Math.round((Date.parse(L.expiresAt) - Date.now()) / 60000)) : 0;
  return h('section', { class: 'sec' }, secHead('폰에서 보기'),
    h('div', { class: 'lan' },
      h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: info.enabled, onchange: (ev) => toggle(ev.target.checked) }), h('span', { class: 'tr' }), h('b', null, '같은 와이파이 폰 연결')),
      info.enabled ? h('div', { class: 'lan-on' },
        h('div', null, h('div', { class: 'small muted' }, '폰에서 열 주소'), (L.urls || info.urls).map((u) => h('div', { class: 'row', style: 'margin-top:4px' },
          h('span', { class: 'mono lan-url' }, u),
          h('button', { type: 'button', class: 'btn sm', onclick: async () => { await copyText(u); toast('주소를 복사했어요'); } }, '주소 복사')))),
        L.code && left > 0 ? h('div', null, h('div', { class: 'small muted' }, `연결 코드 · ${left}분 동안, 한 번만`), h('div', { class: 'pair-code', 'aria-label': '연결 코드' }, L.code))
          : h('button', { class: 'btn', onclick: fresh }, '연결 코드 받기')) : null));
}

// Muse 읽기 (읽기만, 기본 꺼짐). 읽을 곳 (이 컴퓨터 / 사무실), 스위치 하나, 상태 한 줄.
function musePanel() {
  const onMac = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  const m = S.data.settings.muse;
  if (!onMac || !m) return null;
  const host = m.host === 'office' ? 'office' : 'local';
  const offices = S.data.resources.filter(isOfficeRes);
  const office = res(m.res) || offices[0];
  const officeLabel = office ? office.name.replace(/\s*\(.*\)\s*$/, '') : '사무실';
  const place = host === 'office' ? officeLabel : '이 컴퓨터';
  const toggle = (on) => once('muse', () => act('POST', '/api/ui/muse', { on }, on ? 'Muse 읽기를 켰어요' : 'Muse 읽기를 껐어요'));
  const setHost = (v) => once('muse-host', () => act('POST', '/api/ui/muse', { host: v }, v === 'office' ? `${officeLabel}에서 읽어요` : '이 컴퓨터에서 읽어요'));
  const need = ['login', 'nobrowser', 'noego'].includes(m.status);
  const line = !m.enabled ? '' : `${m.statusText || ''}${m.lastRunAt ? ` · ${stamp(m.lastRunAt)}` : ''}`;
  const hostPick = h('div', { class: 'picker', role: 'group', 'aria-label': 'Muse 를 읽을 곳' },
    h('button', { type: 'button', class: `chip${host === 'local' ? ' on' : ''}`, 'aria-pressed': host === 'local' ? 'true' : 'false', onclick: () => host !== 'local' && setHost('local') }, '이 컴퓨터'),
    h('button', { type: 'button', class: `chip${host === 'office' ? ' on' : ''}`, 'aria-pressed': host === 'office' ? 'true' : 'false', disabled: !offices.length, title: offices.length ? '' : '내 자원 탭에서 맥 스튜디오 같은 컴퓨터의 ssh 별칭을 넣으면 고를 수 있어요', onclick: () => host !== 'office' && setHost('office') }, officeLabel));
  const how = host === 'office' ? `한 번만: 화면 공유로 ${place}에 들어가 Ego Lite를 열고 Muse에 직접 로그인해 두세요.` : '한 번만: 이 컴퓨터에서 Ego Lite를 열고 Muse에 직접 로그인해 두세요.';
  return h('section', { class: 'sec' }, secHead('Muse'),
    h('div', { class: 'lan' },
      h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: Boolean(m.enabled), onchange: (ev) => toggle(ev.target.checked) }), h('span', { class: 'tr' }),
        h('b', null, `Muse 대화 읽어 오기 (${place}, ${m.everyMin || 30}분마다)`)),
      h('div', { class: 'muse-host' }, h('span', { class: 'small muted' }, '읽는 곳'), hostPick),
      line ? h('p', { class: `small${need ? '' : ' muted'}` }, line) : null));
}

async function loadTools() {
  try { ui.tools = await (await fetch('/api/tools/detect')).json(); } catch { ui.tools = { browsers: [], openSource: [] }; }
  render();
}

function parseOssInputClient(raw) {
  const s = String(raw || '').trim();
  const gh = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/.*)?$/i.exec(s);
  if (gh) return { name: gh[2], repo: `https://github.com/${gh[1]}/${gh[2]}`, command: `npx github:${gh[1]}/${gh[2]}` };
  const ghShort = /^(?:npx\s+(?:-y\s+)?)?github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i.exec(s);
  if (ghShort) return { name: ghShort[2], repo: `https://github.com/${ghShort[1]}/${ghShort[2]}`, command: s.startsWith('npx') ? s : `npx ${s}` };
  const npx = /^npx\s+(?:-y\s+)?(@?[A-Za-z0-9_./@-]+)/i.exec(s);
  if (npx) return { name: npx[1].split('/').pop().replace(/@[^@]+$/, ''), repo: '', command: s };
  return { name: s, repo: '', command: '' };
}

function openAddOss() {
  const dlg = document.getElementById('dlg');
  const src = h('input', { class: 'in', placeholder: 'GitHub 주소 또는 npx 명령 (예: https://github.com/... 또는 npx hyperframes)', 'aria-label': 'GitHub 주소 또는 npx 명령' });
  const name = h('input', { class: 'in', placeholder: '예: Hyperframes, Remotion, Blender', 'aria-label': '도구 이름' });
  const when = h('input', { class: 'in', placeholder: '예: 모션 그래픽, 3D 영상, 자막 추출', 'aria-label': '언제 쓰나요' });
  const cmd = h('input', { class: 'in', placeholder: '실행 명령 (예: npx hyperframes)', 'aria-label': '실행 명령' });
  const repo = h('input', { class: 'in', placeholder: 'GitHub 주소 (선택)', 'aria-label': 'GitHub 주소' });
  const skillPath = h('input', { class: 'in', placeholder: '스킬 파일 경로 (선택)', 'aria-label': '스킬 파일 경로' });
  const preview = h('div', { class: 'small muted', style: 'margin-top:6px' }, 'GitHub 주소나 npx 명령을 붙여넣으면 이름과 실행법이 자동으로 채워집니다.');
  src.addEventListener('input', () => {
    const p = parseOssInputClient(src.value);
    if (p.name) name.value = p.name;
    if (p.command) cmd.value = p.command;
    if (p.repo) repo.value = p.repo;
    preview.textContent = p.command || p.repo ? `자동 인식됨 → ${p.name}${p.command ? ` · ${p.command}` : ''}` : '직접 이름을 입력해도 됩니다.';
  });
  setDlg(dlg, 
    h('h3', null, '오픈소스 도구 추가'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '등록해 두면 프롬프트에 이름만 적었을 때 AI가 이 GitHub/npx 명령을 정확히 사용합니다.'),
    h('label', { class: 'field' }, 'GitHub 주소 또는 npx 명령 (1줄 붙여넣기)', src),
    preview,
    h('label', { class: 'field', style: 'margin-top:12px' }, '도구 이름', name),
    h('label', { class: 'field', style: 'margin-top:12px' }, '언제 쓰나요? (쉼표로 구분)', when),
    h('details', { style: 'margin-top:12px' }, h('summary', null, '세부 명령 · 저장소 (자동 채워짐)'),
      h('label', { class: 'field', style: 'margin-top:10px' }, '실행 명령', cmd),
      h('label', { class: 'field', style: 'margin-top:10px' }, 'GitHub 주소', repo),
      h('label', { class: 'field', style: 'margin-top:10px' }, '스킬 파일 경로', skillPath)),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once('add-oss', async () => {
        if (!name.value.trim() && !src.value.trim()) { src.focus(); return; }
        dlg.close();
        await act('POST', '/api/ui/resources', { kind: '오픈소스', sourceInput: src.value, name: name.value, when: when.value, note: when.value, command: cmd.value, repo: repo.value, skillPath: skillPath.value }, '오픈소스를 추가했어요');
      }) }, '추가')));
  dlg.showModal();
  src.focus();
}

function openEditOss(r) {
  const dlg = document.getElementById('dlg');
  const name = h('input', { class: 'in', value: r.name || '', 'aria-label': '도구 이름' });
  const when = h('input', { class: 'in', value: r.when || r.note || '', placeholder: '예: 모션 그래픽, 3D 영상, 자막 추출', 'aria-label': '언제 쓰나요' });
  const cmd = h('input', { class: 'in', value: r.command || '', placeholder: '실행 명령 (예: npx hyperframes)', 'aria-label': '실행 명령' });
  const repo = h('input', { class: 'in', value: r.repo || '', placeholder: 'GitHub 주소 (선택)', 'aria-label': 'GitHub 주소' });
  const skillPath = h('input', { class: 'in', value: r.skillPath || '', placeholder: '스킬 파일 경로 (선택)', 'aria-label': '스킬 파일 경로' });
  setDlg(dlg, 
    h('h3', null, `${r.name} 편집`),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '실행 명령, GitHub 주소, 언제 쓰는지를 수정하면 프롬프트 지시서에 즉시 반영됩니다.'),
    h('label', { class: 'field' }, '도구 이름', name),
    h('label', { class: 'field', style: 'margin-top:12px' }, '언제 쓰나요? (쉼표로 구분)', when),
    h('label', { class: 'field', style: 'margin-top:12px' }, '실행 명령 (npx · CLI)', cmd),
    h('label', { class: 'field', style: 'margin-top:12px' }, 'GitHub 주소 (선택)', repo),
    h('label', { class: 'field', style: 'margin-top:12px' }, '스킬 파일 경로 (선택)', skillPath),
    h('div', { class: 'bar', style: 'justify-content:space-between' },
      h('button', { class: 'btn sm', onclick: () => { if (confirm(`${r.name}을 도구함에서 뺄까요?`)) { dlg.close(); act('DELETE', `/api/ui/resources/${r.id}`, undefined, '뺐어요'); } } }, '도구함에서 빼기'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
        h('button', { class: 'btn dark', onclick: () => once(`edit-oss-${r.id}`, async () => {
          if (!name.value.trim()) { name.focus(); return; }
          dlg.close();
          await act('PATCH', `/api/ui/resources/${r.id}`, { name: name.value, when: when.value, note: when.value, command: cmd.value, repo: repo.value, skillPath: skillPath.value }, '오픈소스 설정을 저장했어요');
        }) }, '저장'))));
  dlg.showModal();
  name.focus();
}

function openAddDesign() {
  const dlg = document.getElementById('dlg');
  const name = h('input', { class: 'in', placeholder: '예: CONNECT AI 미니멀, 야학당 썸네일', 'aria-label': '디자인 이름' });
  const rules = h('textarea', { class: 'in', rows: 3, placeholder: '예: 흰 배경(#fff), 검정 글자(#111), 넓은 여백, 깔끔한 표 중심, 이모지 남발 금지', 'aria-label': '디자인 규칙' });
  const assetPath = h('input', { class: 'in', placeholder: '참고 파일·캐릭터 폴더 경로 (선택, 예: ~/Brand/DESIGN.md)', 'aria-label': '에셋 폴더' });
  const refUrl = h('input', { class: 'in', placeholder: '참고 사이트 주소 (선택, https://...)', 'aria-label': '참고 주소' });
  setDlg(dlg, 
    h('h3', null, '내 디자인 스타일 추가'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '등록해 두면 프롬프트에 스타일 이름만 적었을 때 AI가 이 디자인 규칙과 캐릭터/에셋 폴더를 그대로 따릅니다.'),
    h('label', { class: 'field' }, '스타일 이름', name),
    h('label', { class: 'field', style: 'margin-top:12px' }, '디자인 규칙 (색상·폰트·톤·금지사항)', rules),
    h('label', { class: 'field', style: 'margin-top:12px' }, '캐릭터 · 에셋 폴더 또는 DESIGN.md (선택)', assetPath),
    h('label', { class: 'field', style: 'margin-top:12px' }, '참고 주소 (선택)', refUrl),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once('add-des', async () => {
        if (!name.value.trim()) { name.focus(); return; }
        dlg.close();
        await act('POST', '/api/ui/resources', { kind: '디자인', name: name.value, rules: rules.value, assetPath: assetPath.value, refUrl: refUrl.value, note: rules.value.slice(0, 60) }, '디자인 스타일을 추가했어요');
      }) }, '추가')));
  dlg.showModal();
  name.focus();
}

function openEditDesign(r) {
  const dlg = document.getElementById('dlg');
  const name = h('input', { class: 'in', value: r.name || '', 'aria-label': '스타일 이름' });
  const rules = h('textarea', { class: 'in', rows: 4, placeholder: '색상·폰트·톤·금지사항', 'aria-label': '디자인 규칙' }, r.rules || '');
  const assetPath = h('input', { class: 'in', value: r.assetPath || '', placeholder: '예: ~/Brand/DESIGN.md 또는 캐릭터 폴더', 'aria-label': '에셋 폴더' });
  const refUrl = h('input', { class: 'in', value: r.refUrl || '', placeholder: 'https://...', 'aria-label': '참고 주소' });
  setDlg(dlg, 
    h('h3', null, `${r.name} 편집`),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '디자인 규칙이나 캐릭터·DESIGN.md 경로를 넣어 두면 AI가 매번 정확히 참고합니다.'),
    h('label', { class: 'field' }, '스타일 이름', name),
    h('label', { class: 'field', style: 'margin-top:12px' }, '디자인 규칙 (색상·폰트·톤·금지사항)', rules),
    h('label', { class: 'field', style: 'margin-top:12px' }, '캐릭터 · 에셋 폴더 또는 DESIGN.md (선택)', assetPath),
    h('label', { class: 'field', style: 'margin-top:12px' }, '참고 주소 (선택)', refUrl),
    h('div', { class: 'bar', style: 'justify-content:space-between' },
      h('button', { class: 'btn sm', onclick: () => { if (confirm(`${r.name} 스타일을 지울까요?`)) { dlg.close(); act('DELETE', `/api/ui/resources/${r.id}`, undefined, '지웠어요'); } } }, '지우기'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
        h('button', { class: 'btn dark', onclick: () => once(`edit-des-${r.id}`, async () => {
          if (!name.value.trim()) { name.focus(); return; }
          dlg.close();
          await act('PATCH', `/api/ui/resources/${r.id}`, { name: name.value, rules: rules.value, assetPath: assetPath.value, refUrl: refUrl.value, note: rules.value.slice(0, 60) }, '디자인 스타일을 저장했어요');
        }) }, '저장'))));
  dlg.showModal();
  name.focus();
}

function designPanel() {
  const saved = S.data.resources.filter((r) => r.kind === '디자인');
  const presets = S.options.designPresets || [];
  const presetCards = presets.map((p) => {
    const existing = saved.find((r) => r.preset === p.key || r.name === p.name);
    const on = Boolean(existing && existing.status !== '꺼짐');
    const mainBtn = h('button', {
      type: 'button', class: `tool-card${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false',
      title: existing?.rules || p.rules || '',
      onclick: () => once(`des-${p.key}`, () => existing
        ? act('DELETE', `/api/ui/resources/${existing.id}`, undefined, `${p.name}을 뺐어요`)
        : act('POST', '/api/ui/resources', { kind: '디자인', name: p.name, preset: p.key, rules: p.rules, note: p.rules.slice(0, 60) }, `${p.name} 스타일을 켰어요`)),
    },
    h('div', { class: 'top' }, h('b', null, existing ? existing.name : p.name), on ? h('span', { class: 'tag solid' }, '사용 중') : null));
    if (!on || !existing) return mainBtn;
    return h('div', { class: 'tool-card-wrap' }, mainBtn,
      h('button', { type: 'button', class: 'tool-card-edit', onclick: (ev) => { ev.stopPropagation(); openEditDesign(existing); } }, '편집'));
  });
  const custom = saved.filter((r) => !presets.some((p) => p.key === r.preset || p.name === r.name));
  return h('section', { class: 'sec' }, secHead('디자인 스타일', '', h('button', { class: 'btn sm', onclick: openAddDesign }, '+ 추가')),
    h('div', { class: 'tool-cards' }, presetCards,
      custom.map((r) => h('button', {
        type: 'button', class: 'tool-card on', title: r.rules || '',
        onclick: () => openEditDesign(r),
      }, h('div', { class: 'top' }, h('b', null, r.name), h('span', { class: 'tag solid' }, '편집'))))));
}

// 내가 쓰는 브라우저 (Ego Lite, Aside, Chrome, Dia, Comet 등) — 1클릭 선택 및 직접 추가
function openAddBrowser() {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const name = h('input', { class: 'in', placeholder: '예: Brave, Perplexity Comet, Edge', 'aria-label': '브라우저 이름' });
  const cmd = h('input', { class: 'in', placeholder: 'CLI 명령 (선택, 예: aside 또는 ego-browser)', 'aria-label': 'CLI 명령' });
  const guide = h('input', { class: 'in', placeholder: 'AI 사용법 메모 (선택, 예: 프로필 1번 창 사용)', 'aria-label': '사용법' });
  setDlg(dlg,
    h('h3', null, '브라우저 추가'),
    h('label', { class: 'field' }, '이름', name),
    h('label', { class: 'field', style: 'margin-top:12px' }, '실행 명령 (선택)', cmd),
    h('label', { class: 'field', style: 'margin-top:12px' }, 'AI 안내 메모 (선택)', guide),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once('add-br', async () => {
        if (!name.value.trim()) { name.focus(); return; }
        dlg.close();
        await act('POST', '/api/ui/resources', { kind: '브라우저', name: name.value, command: cmd.value, guide: guide.value, note: guide.value || '직접 추가', isDefault: true }, `${name.value.trim()}을 기본 브라우저로 추가했어요`);
      }) }, '추가')));
  dlg.showModal();
  name.focus();
}

function browserPanel() {
  const saved = S.data.resources.filter((r) => r.kind === '브라우저');
  const detected = ui.tools?.browsers || [];
  const egoP = S.egoProbe || null;
  const cards = detected.map((b) => {
    const existing = saved.find((r) => r.preset === b.key || r.name.toLowerCase() === b.name.toLowerCase());
    const on = Boolean(existing && existing.status !== '꺼짐');
    const isDef = Boolean(existing?.isDefault);
    const isEgo = b.key === 'ego-lite';
    const egoTag = isEgo && egoP?.installed
      ? h('span', { class: `tag${egoP.connected ? ' ego-ok-tag' : ''}`, title: egoP.reason || '' }, egoP.connected ? `● 실시간 연결 (${egoP.spaces})` : '앱 꺼짐')
      : null;
    return h('button', {
      type: 'button', class: `tool-card${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false',
      title: isEgo && egoP?.reason ? egoP.reason : b.hint,
      onclick: () => once(`br-${b.key}`, () => {
        if (!existing) return act('POST', '/api/ui/resources', { kind: '브라우저', name: b.name, preset: b.key, command: b.command, guide: b.guide, note: b.hint, isDefault: true }, `${b.name}을 기본 브라우저로 켰어요`);
        if (!isDef) return act('PATCH', `/api/ui/resources/${existing.id}`, { status: '사용 가능', isDefault: true }, `${b.name}을 기본 브라우저로 바꿨어요`);
        if (!confirm(`${b.name}을 기본 브라우저에서 끌까요?`)) return null;
        return act('DELETE', `/api/ui/resources/${existing.id}`, undefined, `${b.name}을 껐어요`);
      }),
    },
    h('div', { class: 'top' }, h('b', null, b.name),
      h('span', { class: 'row' },
        egoTag,
        isDef ? h('span', { class: 'tag solid' }, '기본') : on ? h('span', { class: 'tag' }, '켜짐') : b.found ? h('span', { class: 'tag' }, '설치됨') : null)));
  });
  const custom = saved.filter((r) => !detected.some((b) => b.key === r.preset || b.name.toLowerCase() === r.name.toLowerCase()));
  const probeBtn = h('button', {
    type: 'button', class: 'btn sm',
    onclick: () => once('probe-ego-btn', async () => {
      const resP = await api('GET', '/api/ui/browsers/probe');
      if (resP?.ego) {
        S.egoProbe = resP.ego;
        toast(resP.ego.connected ? `Ego Lite 실시간 연결됨 (스페이스 ${resP.ego.spaces}개)` : (resP.ego.reason || 'Ego Lite 앱이 꺼져 있어요'), { kind: resP.ego.connected ? 'connect' : 'handoff' });
        render();
      }
    }),
  }, '접속 확인');
  return h('section', { class: 'sec' }, secHead('브라우저', '', probeBtn, h('button', { class: 'btn sm', onclick: openAddBrowser }, '+ 추가')),
    h('div', { class: 'tool-cards' }, cards,
      custom.map((r) => h('button', {
        type: 'button', class: `tool-card${r.status !== '꺼짐' ? ' on' : ''}`,
        onclick: () => {
          if (r.isDefault) {
            if (confirm(`${r.name}을 브라우저 목록에서 뺄까요?`)) act('DELETE', `/api/ui/resources/${r.id}`, undefined, '뺐어요');
          } else {
            act('PATCH', `/api/ui/resources/${r.id}`, { isDefault: true, status: '사용 가능' }, `${r.name}을 기본 브라우저로 바꿨어요`);
          }
        },
      }, h('div', { class: 'top' }, h('b', null, r.name), r.isDefault ? h('span', { class: 'tag solid' }, '기본') : null)))));
}

// 스마트폰 · 아이폰 미러링 (Computer Use) · 안드로이드 (adb/scrcpy) · 모바일 AI
function openAddPhone(defaultMode = 'iphone-mirror') {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const modes = S.options.phoneModes || [];
  const machines = S.data.resources.filter((r) => r.kind === '기계');
  const thisMac = machines.find((m) => m.isThisMac) || machines[0] || null;
  let pickedMode = defaultMode;
  const defNames = { 'iphone-mirror': '내 iPhone (미러링)', 'android-adb': '내 Android (adb)', 'mobile-ai': '모바일 AI (피클)' };
  const name = h('input', { class: 'in', value: defNames[defaultMode] || '내 스마트폰', placeholder: '예: Jay iPhone, 갤럭시 S25' });
  const hostSel = h('select', { class: 'in' },
    machines.map((m) => h('option', { value: m.id, selected: m.id === thisMac?.id }, `${m.name}${m.computerUse ? ' (화면 조작 ON)' : ''}`)));
  const empSel = h('select', { class: 'in' },
    h('option', { value: '' }, '자동 선택 (Computer Use / 모바일 가능 AI)'),
    S.data.employees.map((e) => h('option', { value: e.id, selected: defaultMode === 'mobile-ai' && (e.catalog === 'pickle' || /피클/.test(e.name)) }, `${e.name}${e.role ? ` · ${e.role}` : ''}`)));
  const note = h('input', { class: 'in', placeholder: '메모 (선택, 예: 인스타 앱·카톡 확인용)' });
  const hostWrap = h('label', { class: 'field', style: 'margin-top:12px' }, '미러링 · 연결할 컴퓨터', hostSel);
  const modeBtns = [];
  const syncVisibility = () => {
    hostWrap.style.display = pickedMode === 'mobile-ai' ? 'none' : '';
  };
  const modePicker = h('div', { class: 'picker' }, modes.map((m) => {
    const b = h('button', {
      type: 'button', class: `chip${m.key === pickedMode ? ' on' : ''}`,
      onclick: () => {
        const wasDef = Object.values(defNames).includes(name.value.trim());
        pickedMode = m.key;
        if (wasDef || !name.value.trim()) name.value = defNames[m.key] || '';
        modeBtns.forEach((x) => x.classList.toggle('on', x === b));
        syncVisibility();
      },
    }, m.name);
    modeBtns.push(b);
    return b;
  }));
  syncVisibility();

  setDlg(dlg,
    h('h3', null, '스마트폰 연결'),
    modePicker,
    h('label', { class: 'field', style: 'margin-top:12px' }, '기기 이름', name),
    hostWrap,
    h('label', { class: 'field', style: 'margin-top:12px' }, '전담 AI 직원', empSel),
    h('label', { class: 'field', style: 'margin-top:12px' }, '메모', note),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => dlg.close() }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once('add-phone', async () => {
        if (!name.value.trim()) { name.focus(); return; }
        dlg.close();
        await act('POST', '/api/ui/resources', {
          kind: '스마트폰', name: name.value, phoneMode: pickedMode,
          hostMachine: pickedMode === 'mobile-ai' ? null : (hostSel.value || null),
          assignee: empSel.value || null, note: note.value,
        }, `${name.value.trim()}을 연결했어요`);
      }) }, '연결 추가')));
  dlg.showModal();
  name.focus();
}

function phonePanel() {
  const phones = S.data.resources.filter((r) => r.kind === '스마트폰');
  const modes = S.options.phoneModes || [];
  const br = S.bridges || ui.tools?.bridges || {};
  const modeHintTag = (key) => {
    if (key === 'iphone-mirror') return br.iphoneMirroringApp ? 'iPhone Mirroring 감지됨' : (br.orca ? 'orca computer 감지됨' : 'macOS 미러링');
    if (key === 'android-adb') return br.adb || br.scrcpy ? [br.adb ? 'adb' : '', br.scrcpy ? 'scrcpy' : ''].filter(Boolean).join('·') + ' 감지됨' : 'USB · Wi-Fi';
    return '클라우드';
  };
  const quickCards = modes.map((m) => {
    const existing = phones.find((p) => p.phoneMode === m.key && p.status !== '꺼짐');
    return h('button', {
      type: 'button', class: `tool-card${existing ? ' on' : ''}`, title: m.hint || '',
      onclick: () => openAddPhone(m.key),
    },
    h('div', { class: 'top' }, h('b', null, m.name),
      existing ? h('span', { class: 'tag solid' }, '연결됨') : h('span', { class: 'tag' }, modeHintTag(m.key))));
  });

  const listEl = phones.length ? h('ul', { class: 'list', style: 'margin-top:12px' }, phones.map((p) => {
    const modeObj = modes.find((m) => m.key === p.phoneMode);
    const host = p.hostMachine ? res(p.hostMachine) : null;
    const pinned = p.assignee ? emp(p.assignee) : null;
    const sub = [
      modeObj?.name || p.phoneMode,
      host ? `연결 컴퓨터: ${host.name}${host.computerUse ? ' (화면 조작 ON)' : ' (화면 조작 꺼짐)'}` : '',
      pinned ? `전담 AI: ${shortName(pinned.id)}` : '',
      p.note,
    ].filter(Boolean).join(' · ');
    return h('li', { class: 'res' },
      h('div', { class: 'main' },
        h('div', { class: 't' }, p.name, h('span', { class: 'tag', style: 'margin-left:8px' }, modeObj?.short || '스마트폰')),
        h('div', { class: 's' }, sub)),
      h('div', { class: 'row' },
        h('button', { class: 'x', 'aria-label': `${p.name} 지우기`, onclick: () => { if (confirm(`${p.name} 연결을 지울까요?`)) act('DELETE', `/api/ui/resources/${p.id}`, undefined, '지웠어요'); } }, '×')));
  })) : null;

  return h('section', { class: 'sec' },
    secHead('스마트폰', '', h('button', { class: 'btn sm', onclick: () => openAddPhone('iphone-mirror') }, '+ 추가')),
    h('div', { class: 'tool-cards' }, quickCards),
    listEl);
}

function healthPanel() {
  const H = S.health || {};
  const td = H.today || {};
  const stats = [
    H.score != null ? `컨디션 ${H.score}점 (${H.levelLabel})` : '기록 없음',
    typeof td.steps === 'number' ? `걸음 ${td.steps.toLocaleString('ko-KR')}보` : '',
    typeof td.sleepHours === 'number' ? `수면 ${td.sleepHours}시간` : '',
    (td.restingHr ?? td.heartRate) != null ? `심박 ${td.restingHr ?? td.heartRate}bpm` : '',
    typeof td.exerciseMin === 'number' ? `운동 ${td.exerciseMin}분` : '',
  ].filter(Boolean).join(' · ');
  return h('section', { class: 'sec' },
    secHead('대표 헬스'),
    h('div', { class: 'lan' },
      h('div', { class: 'row', style: 'justify-content:space-between;flex-wrap:wrap;gap:10px' },
        h('div', { style: 'font-weight:600;font-size:14px' }, stats),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn sm', onclick: openHealthLogModal }, '5초 기록'),
          h('button', { type: 'button', class: 'btn sm dark', onclick: openHealthConnectModal }, '연동 설정')))));
}

// 내가 쓰는 오픈소스 도구 — 이 컴퓨터에서 찾은 것부터 원클릭 켜기/끄기
function ossPanel() {
  const saved = S.data.resources.filter((r) => r.kind === '오픈소스');
  const detected = ui.tools?.openSource || [];
  const sorted = [...detected.filter((x) => x.found), ...detected.filter((x) => !x.found)];
  const cards = sorted.map((o) => {
    const existing = saved.find((r) => r.preset === o.key || r.name.toLowerCase() === o.name.toLowerCase());
    const on = Boolean(existing && existing.status !== '꺼짐');
    const mainBtn = h('button', {
      type: 'button', class: `tool-card${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false',
      title: o.hint || '',
      onclick: () => once(`oss-${o.key}`, () => existing
        ? act('DELETE', `/api/ui/resources/${existing.id}`, undefined, `${o.name}을 뺐어요`)
        : act('POST', '/api/ui/resources', { kind: '오픈소스', name: o.name, preset: o.key, when: o.when, command: o.command, repo: o.repo || '', skillPath: o.skillPath, note: o.hint }, `${o.name}을 도구함에 넣었어요`)),
    },
    h('div', { class: 'top' }, h('b', null, existing ? existing.name : o.name),
      on ? h('span', { class: 'tag solid' }, '사용 중') : o.found ? h('span', { class: 'tag' }, '설치됨') : o.command && /^npx\b/i.test(o.command) ? h('span', { class: 'tag' }, 'npx') : null));
    if (!on || !existing) return mainBtn;
    return h('div', { class: 'tool-card-wrap' }, mainBtn,
      h('button', { type: 'button', class: 'tool-card-edit', onclick: (ev) => { ev.stopPropagation(); openEditOss(existing); } }, '편집'));
  });
  const custom = saved.filter((r) => !detected.some((o) => o.key === r.preset || o.name.toLowerCase() === r.name.toLowerCase()));
  return h('section', { class: 'sec' }, secHead('오픈소스 도구', '', h('button', { class: 'btn sm', onclick: openAddOss }, '+ 추가')),
    h('div', { class: 'tool-cards' }, cards,
      custom.map((r) => h('button', {
        type: 'button', class: 'tool-card on', title: r.command || r.note || '',
        onclick: () => openEditOss(r),
      }, h('div', { class: 'top' }, h('b', null, r.name), h('span', { class: 'tag solid' }, '편집'))))));
}

// ───────── 연결 계정 · 컴퓨터 유즈 권한 ─────────

function accountPlatformOf(r) {
  const list = S.options.accountPlatforms || [];
  return list.find((p) => p.key === r.platform) || list[list.length - 1] || { key: 'generic', name: '계정', actions: [] };
}

function defaultBrowser() {
  const browsers = S.data.resources.filter((x) => x.kind === '브라우저' && x.status !== '꺼짐');
  return browsers.find((b) => b.isDefault) || browsers[0] || null;
}

function accountSummaryText(r) {
  const p = accountPlatformOf(r);
  const perms = r.permissions || {};
  const br = (r.browser ? res(r.browser) : null) || defaultBrowser();
  const pinnedEmp = r.assignee ? emp(r.assignee) : null;
  const parts = [];
  if (br && br.kind === '브라우저') parts.push(r.spaceName ? `${br.name} (${r.spaceName})` : br.name);
  else if (r.spaceName) parts.push(`스페이스: ${r.spaceName}`);
  if (pinnedEmp) parts.push(`${shortName(pinnedEmp.id)} 전담`);
  if (r.preset === 'readonly') {
    parts.push('읽기만 (안전)');
  } else {
    const allow = [];
    const approval = [];
    const deny = [];
    for (const a of p.actions) {
      const lv = perms[a.key] || a.locked || 'deny';
      const short = a.short || a.label.split(' ')[0].replace(/·.+/, '');
      if (lv === 'allow') allow.push(short);
      else if (lv === 'approval') approval.push(short);
      else deny.push(short);
    }
    if (allow.length) parts.push(`${allow.join('·')} 자동`);
    if (approval.length) parts.push(`${approval.join('·')} 승인 후`);
    if (deny.length) parts.push(`${deny.join('·')} 금지`);
  }
  return parts.join(' · ') || '권한을 정해 주세요';
}

function openAddAccount() {
  const dlg = document.getElementById('dlg');
  const plats = S.options.accountPlatforms || [];
  const cats = S.options.accountCategories || [{ key: 'media', label: '영상 · 숏폼 · SNS' }, { key: 'business', label: '블로그 · 고객 · 커머스' }, { key: 'ops', label: '개발 · 결제 · 기타' }];
  const browsers = S.data.resources.filter((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  const defBr = browsers.find((b) => b.isDefault) || browsers[0] || null;
  let pickedPlat = plats[0]?.key || 'youtube';
  let pickedPreset = 'approval';
  let pickedBr = '';
  let pickedEmp = '';
  const name = h('input', { class: 'in', value: plats[0]?.name || '', placeholder: '예: 네이버 블로그, 네이버 클립, YouTube', 'aria-label': '계정 이름' });
  const spaceIn = h('input', { class: 'in', placeholder: '예: 이메일, 네이버, 결제, SNS (선택)', 'aria-label': '프로필 또는 스페이스' });
  const note = h('input', { class: 'in', placeholder: '메모 (선택, 예: 검색 유입·숏폼 채널)', 'aria-label': '메모' });
  const presetRow = h('div', { class: 'picker' });
  const renderPresets = () => {
    const curPlat = plats.find((x) => x.key === pickedPlat);
    const isPay = pickedPlat === 'payment';
    if (isPay) pickedPreset = 'readonly';
    else if (pickedPreset === 'draft_auto' && !curPlat?.supportsDraftAuto) pickedPreset = 'approval';
    const opts = [
      { key: 'readonly', label: '읽기만 (안전)' },
      ...(isPay ? [] : [{ key: 'approval', label: '초안·승인 후 (추천)' }]),
      ...(curPlat?.supportsDraftAuto ? [{ key: 'draft_auto', label: '임시저장만 자동 (크리에이터)' }] : []),
    ];
    presetRow.replaceChildren(...opts.map((pr) => h('button', {
      type: 'button', class: `chip${pickedPreset === pr.key ? ' on' : ''}`,
      onclick: () => { pickedPreset = pr.key; renderPresets(); },
    }, pr.label)));
  };
  const allChipBtns = [];
  const platGroups = h('div', { class: 'plat-groups' }, cats.map((cat) => {
    const items = plats.filter((p) => (p.category || 'ops') === cat.key);
    if (!items.length) return null;
    return h('div', { class: 'plat-group' },
      h('div', { class: 'small muted', style: 'margin-bottom:5px' }, cat.label),
      h('div', { class: 'picker' }, items.map((p) => {
        const btn = h('button', {
          type: 'button', class: `chip${p.key === pickedPlat ? ' on' : ''}`,
          onclick: () => {
            const prevPlat = plats.find((x) => x.key === pickedPlat);
            pickedPlat = p.key;
            if (!name.value.trim() || name.value === prevPlat?.name) name.value = p.name;
            for (const b of allChipBtns) b.classList.toggle('on', b === btn);
            renderPresets();
          },
        }, p.name);
        allChipBtns.push(btn);
        return btn;
      })));
  }));
  renderPresets();
  const brSel = browsers.length ? h('select', { class: 'in', 'aria-label': '연결 브라우저', onchange: (ev) => { pickedBr = ev.target.value; } },
    h('option', { value: '' }, defBr ? `기본 브라우저 자동 사용 (${defBr.name})` : '기본 브라우저 자동 사용'),
    browsers.map((b) => h('option', { value: b.id, selected: b.id === pickedBr }, `${b.name}${b.isDefault ? ' (기본)' : ''}`))) : null;
  const empSel = S.data.employees.length ? h('select', { class: 'in', 'aria-label': '담당 AI 모델', onchange: (ev) => { pickedEmp = ev.target.value; } },
    h('option', { value: '' }, '자동 배정 (할 일에 맞춰 고름)'),
    S.data.employees.map((e) => h('option', { value: e.id }, `${e.name}${e.role ? ` · ${e.role}` : ''}`))) : null;
  setDlg(dlg, 
    h('h3', null, '연결 계정 추가'),
    h('p', { class: 'small muted', style: 'margin:-8px 0 12px' }, '브라우저(Ego Lite 등)로 들어갈 계정을 고르면, 알맞은 안전 권한이 미리 채워집니다.'),
    platGroups,
    h('label', { class: 'field', style: 'margin-top:12px' }, '계정 이름', name),
    brSel ? h('label', { class: 'field', style: 'margin-top:12px' }, '연결 브라우저', brSel) : null,
    h('label', { class: 'field', style: 'margin-top:12px' }, '프로필 · 스페이스 (선택)', spaceIn),
    empSel ? h('label', { class: 'field', style: 'margin-top:12px' }, '전담 AI 직원 (선택)', empSel) : null,
    h('div', { style: 'margin-top:12px' }, h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '처음 권한'), presetRow),
    h('label', { class: 'field', style: 'margin-top:12px' }, '메모 (선택)', note),
    h('div', { class: 'bar' },
      h('button', { class: 'btn', onclick: () => { dlg.close(); render(); } }, '취소'),
      h('button', { class: 'btn dark', onclick: () => once('add-acc', async () => {
        if (!name.value.trim()) { name.focus(); return; }
        dlg.close();
        const created = await act('POST', '/api/ui/resources', {
          kind: '계정', name: name.value, platform: pickedPlat, preset: pickedPreset, browser: pickedBr || null, spaceName: spaceIn.value.trim(), assignee: pickedEmp || null, note: note.value,
        }, '계정을 추가했어요');
        if (created?.id) { ui.openAccount = created.id; render(); }
      }) }, '추가')));
  dlg.showModal();
  name.focus();
}

function accountCard(r) {
  const p = accountPlatformOf(r);
  const perms = r.permissions || {};
  const browsers = S.data.resources.filter((x) => x.kind === '브라우저' && x.status !== '꺼짐');
  const defBr = defaultBrowser();
  const activeBr = (r.browser ? res(r.browser) : null) || defBr;
  const openUrl = r.url || p.url || '';
  const open = ui.openAccount === r.id;
  const levels = S.options.permLevels || ['deny', 'approval', 'allow'];
  const labels = S.options.permLabels || { deny: '금지', approval: '승인 후', allow: '자동' };
  const toggleOpen = () => { ui.openAccount = open ? null : r.id; render(); };
  const setPreset = (preset) => act('PATCH', `/api/ui/resources/${r.id}`, { preset },
    preset === 'readonly' ? '읽기만으로 바꿨어요' : preset === 'draft_auto' ? '임시저장만 자동으로 바꿨어요' : '초안·승인 후로 바꿨어요');
  const setPerm = (key, lv) => act('PATCH', `/api/ui/resources/${r.id}`, { permissions: { [key]: lv } }, `${p.actions.find((a) => a.key === key)?.label || key}: ${labels[lv]}`);
  const isPay = p.key === 'payment';
  return h('li', { class: `acc-item${open ? ' open' : ''}`, 'data-acc': r.id },
    h('div', { class: 'acc-head' },
      h('div', { class: 'main', onclick: toggleOpen, style: 'cursor:pointer' },
        h('div', { class: 't' }, r.name, h('span', { class: 'tag', style: 'margin-left:8px' }, p.name)),
        h('div', { class: 's' }, accountSummaryText(r))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: `btn sm${open ? ' dark' : ''}`, 'aria-expanded': open ? 'true' : 'false', onclick: toggleOpen }, open ? '닫기' : '권한 설정'),
        h('button', { class: 'x', 'aria-label': `${r.name} 지우기`, onclick: () => { if (confirm(`이 계정을 지울까요?\n${r.name}`)) { if (ui.openAccount === r.id) ui.openAccount = null; act('DELETE', `/api/ui/resources/${r.id}`, undefined, '지웠어요'); } } }, '×'))),
    open ? h('div', { class: 'acc-body' },
      h('div', { class: 'acc-row' },
        h('span', { class: 'small muted' }, '연결 브라우저'),
        browsers.length ? h('div', { class: 'picker' },
          h('button', { type: 'button', class: `chip${!r.browser ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/resources/${r.id}`, { browser: null }, defBr ? `기본 브라우저(${defBr.name})를 씁니다` : '기본 브라우저를 씁니다') }, defBr ? `기본 (${defBr.name})` : '기본 브라우저'),
          browsers.map((b) => h('button', { type: 'button', class: `chip${r.browser === b.id ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/resources/${r.id}`, { browser: b.id }, `${b.name}로 고정했어요`) }, b.name)),
          openUrl ? h('a', { class: 'btn link', href: openUrl, target: '_blank', rel: 'noopener noreferrer', style: 'margin-left:4px' }, '사이트 열기 ↗') : null)
          : h('span', { class: 'small muted' }, '위에서 Ego Lite를 한 번만 켜 두면 모든 연결 계정이 자동으로 접속돼요')),
      (() => {
        const sp = h('input', { class: 'in sm', value: r.spaceName || '', 'data-k': `acc-sp-${r.id}`, placeholder: '예: 이메일, 네이버, 결제, SNS (선택)', style: 'max-width:220px', 'aria-label': '프로필 또는 스페이스' });
        const saveSp = () => act('PATCH', `/api/ui/resources/${r.id}`, { spaceName: sp.value.trim() }, '프로필·스페이스 이름을 저장했어요');
        sp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) saveSp(); });
        return h('div', { class: 'acc-row' }, h('span', { class: 'small muted' }, '프로필·스페이스'), h('div', { class: 'row' }, sp, h('button', { type: 'button', class: 'btn sm', onclick: saveSp }, '저장')));
      })(),
      S.data.employees.length ? h('div', { class: 'acc-row' },
        h('span', { class: 'small muted' }, '전담 AI'),
        h('div', { class: 'picker' },
          h('button', { type: 'button', class: `chip${!r.assignee ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/resources/${r.id}`, { assignee: null }, '할 일에 맞춰 자동 배정해요') }, '자동 배정'),
          S.data.employees.map((e) => h('button', { type: 'button', class: `chip${r.assignee === e.id ? ' on' : ''}`, onclick: () => act('PATCH', `/api/ui/resources/${r.id}`, { assignee: e.id }, `${shortName(e.id)}을 전담 AI로 연결했어요`) }, shortName(e.id))))) : null,
      h('div', { class: 'acc-row' },
        h('span', { class: 'small muted' }, '빠른 설정'),
        h('div', { class: 'picker' },
          h('button', { type: 'button', class: `chip${r.preset === 'readonly' ? ' on' : ''}`, onclick: () => setPreset('readonly') }, '읽기만 (안전)'),
          !isPay ? h('button', { type: 'button', class: `chip${r.preset === 'approval' ? ' on' : ''}`, onclick: () => setPreset('approval') }, '초안·승인 후 (추천)') : null,
          p.supportsDraftAuto ? h('button', { type: 'button', class: `chip${r.preset === 'draft_auto' ? ' on' : ''}`, onclick: () => setPreset('draft_auto') }, '임시저장만 자동') : null,
          r.preset === 'custom' ? h('span', { class: 'tag' }, '직접 설정') : null)),
      h('div', { class: 'perm-list' }, p.actions.map((a) => {
        const cur = perms[a.key] || a.locked || 'deny';
        return h('div', { class: 'perm-row' },
          h('span', { class: 'perm-label' }, a.label),
          a.locked
            ? h('span', { class: 'tag' }, '항상 금지 · 대표만')
            : h('div', { class: 'seg', role: 'group', 'aria-label': `${a.label} 권한` }, levels.map((lv) => h('button', {
              type: 'button', class: cur === lv ? 'on' : '', 'aria-pressed': cur === lv ? 'true' : 'false',
              onclick: () => cur !== lv && setPerm(a.key, lv),
            }, labels[lv]))));
      })),
      h('p', { class: 'small muted acc-guard' }, `${activeBr ? `${activeBr.name}에서 처음 한 번만 직접 로그인해 두면 AI가 위 권한 안에서 접속해요. ` : ''}고정 안전선: ${(S.options.hardGuardrails || ['비밀번호 입력', '본인인증', '결제·송금']).join(' · ')}은 대표님만 할 수 있어요.`)) : null);
}

function accountsPanel() {
  const list = S.data.resources.filter((r) => r.kind === '계정');
  return h('section', { class: 'sec' },
    secHead('연결 계정', '', h('button', { class: 'btn sm', onclick: openAddAccount }, '+ 추가')),
    list.length
      ? h('ul', { class: 'acc-list' }, list.map(accountCard))
      : h('div', { class: 'empty' }, '연결된 계정 없음'));
}

// ───────── 통합 내 RAG 허브 (로컬 폴더 · HTTP API · MCP · 웹 지식) ─────────

const RAG_TYPE_FALLBACK = [
  { key: 'folder', label: '로컬 폴더 · 옵시디언', short: '로컬 폴더', hint: '내 맥의 마크다운·텍스트 폴더를 자동 인덱싱 (BM25 + Ollama 하이브리드)' },
  { key: 'http',   label: 'HTTP API · RAG 서버', short: 'HTTP API',  hint: 'FastAPI · Dify · Open WebUI · AnythingLLM · n8n 등 내 RAG 서버 연결' },
  { key: 'mcp',    label: 'MCP RAG 서버',        short: 'MCP',       hint: 'QMD · Obsidian MCP · NotebookLM MCP 등 기존 MCP 도구 연결' },
  { key: 'web',    label: '웹 지식 · NotebookLM · Notion', short: '웹 지식', hint: 'Ego Lite 로그인 NotebookLM · Notion · Drive 주소 연결' },
];

function ragTypeLabel(type) {
  const m = { folder: '로컬 폴더', http: 'HTTP API', mcp: 'MCP', web: '웹 지식' };
  return m[type] || type || 'RAG';
}

function openRagModal(existing = null, defaultType = 'folder', prefill = null) {
  const dlg = document.getElementById('dlg');
  dlg.className = 'auto-dlg';

  const types = (S.options?.ragTypes || RAG_TYPE_FALLBACK);
  let curType = existing?.type || defaultType || 'folder';
  let curLayer = existing ? ragLayerOf(existing) : (prefill?.layer || 'shared');
  const emps = S.data.employees || [];
  let curEmpScope = (existing?.scope && existing.scope !== 'all')
    ? existing.scope
    : (prefill?.scope && prefill.scope !== 'all' ? prefill.scope : (emps[0]?.id || 'all'));

  const nameIn = h('input', { class: 'in auto-m-title', value: existing?.name || '', placeholder: '예: 옵시디언 강의 노트 · 내 RAG API · NotebookLM 리서치', 'aria-label': 'RAG 이름' });
  const empScopeSel = h('select', { class: 'in sm', 'aria-label': '전용 AI 직원' },
    emps.map((e) => h('option', { value: e.id, selected: curEmpScope === e.id }, `${shortName(e.id)} 전용`)));
  empScopeSel.addEventListener('change', () => { curEmpScope = empScopeSel.value; });
  const layerPickWrap = h('div', { class: 'kb-layer-pick' });
  const renderLayerPick = () => {
    const opts = [
      ['owner', '나의 RAG (대표)'],
      ['shared', '공용 RAG (전체 AI)'],
      ['agent', 'AI 직원 전용'],
    ];
    layerPickWrap.replaceChildren(
      h('div', { class: 'picker' }, opts.map(([k, lbl]) => h('button', {
        type: 'button', class: `chip sm${curLayer === k ? ' on' : ''}`,
        onclick: () => { curLayer = k; renderLayerPick(); },
      }, lbl))),
      curLayer === 'agent' && emps.length ? empScopeSel : null);
  };
  renderLayerPick();
  const noteIn = h('input', { class: 'in', value: existing?.note || '', placeholder: '어떤 자료가 들어 있는지 1줄 메모 (선택)', 'aria-label': '설명' });

  // folder fields
  const folderIn = h('input', { class: 'in', value: existing?.folderPath || '', placeholder: '예: ~/Documents/Obsidian 또는 /Users/.../강의자료', 'aria-label': '폴더 경로' });
  const extIn = h('input', { class: 'in sm', value: (existing?.extensions || ['.md', '.txt', '.json']).join(', '), placeholder: '.md, .txt, .json, .csv', 'aria-label': '파일 확장자' });
  const ollamaChk = h('input', { type: 'checkbox', checked: existing?.useOllamaEmbed !== false });

  // http fields
  const endpointIn = h('input', { class: 'in', value: existing?.endpoint || '', placeholder: '예: http://127.0.0.1:8000/query 또는 https://my-rag.example.com/search', 'aria-label': 'API 주소' });
  const methodSel = h('select', { class: 'in sm', 'aria-label': 'HTTP 메서드' },
    h('option', { value: 'POST', selected: (existing?.method || 'POST') === 'POST' }, 'POST (JSON)'),
    h('option', { value: 'GET', selected: existing?.method === 'GET' }, 'GET (쿼리스트링)'));
  const authHeaderIn = h('input', { class: 'in sm', value: existing?.authHeader || 'Authorization', placeholder: 'Authorization 또는 X-API-Key', 'aria-label': '인증 헤더' });
  const authTokenIn = h('input', {
    class: 'in sm', type: 'password', autocomplete: 'off',
    placeholder: existing?.hasAuth ? '토큰 저장됨 (바꿀 때만 새로 입력)' : 'Bearer sk-... (선택 · 로컬에만 저장)',
    'aria-label': '인증 토큰',
  });
  const clearAuthChk = h('input', { type: 'checkbox' });
  const queryFieldIn = h('input', { class: 'in sm', value: existing?.queryField || 'query', placeholder: 'query', 'aria-label': '쿼리 키' });
  const resultPathIn = h('input', { class: 'in sm', value: existing?.resultPath || '', placeholder: '비우면 자동 추출 (예: results, data.chunks)', 'aria-label': '응답 경로' });

  // mcp fields
  const mcpServerIn = h('input', { class: 'in', value: existing?.mcpServer || '', placeholder: '예: qmd, obsidian, notebooklm', 'aria-label': 'MCP 서버 이름' });
  const mcpToolIn = h('input', { class: 'in sm', value: existing?.mcpTool || '', placeholder: '예: search, query_notes (선택)', 'aria-label': 'MCP 도구 이름' });
  const mcpCmdIn = h('input', { class: 'in sm', value: existing?.mcpCommand || '', placeholder: '참고 실행 명령 (선택 · 예: npx qmd mcp)', 'aria-label': '실행 명령 메모' });

  // web fields
  const webUrlIn = h('input', { class: 'in', value: existing?.webUrl || '', placeholder: '예: https://notebooklm.google.com/notebook/... 또는 https://notion.so/...', 'aria-label': '웹 지식 주소' });
  const spaceIn = h('input', { class: 'in sm', value: existing?.spaceName || '', placeholder: 'Ego Lite 스페이스 이름 (선택 · 예: 리서치)', 'aria-label': 'Ego Lite 스페이스' });

  const typeTabs = h('div', { class: 'picker' });
  const dynamicWrap = h('div', { class: 'rag-dyn-fields' });

  const renderDynamic = () => {
    typeTabs.replaceChildren(...types.map((t) => h('button', {
      type: 'button',
      class: `chip sm${curType === t.key ? ' on' : ''}`,
      onclick: () => { curType = t.key; renderDynamic(); },
    }, t.label)));

    if (curType === 'folder') {
      dynamicWrap.replaceChildren(
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '폴더 경로'), folderIn),
        h('div', { class: 'auto-m-grid2' },
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '확장자'), extIn),
          h('div', { class: 'auto-m-field', style: 'justify-content:flex-end' },
            h('label', { class: 'chk-l small' }, ollamaChk, 'Ollama 벡터 검색'))));
    } else if (curType === 'http') {
      dynamicWrap.replaceChildren(
        h('div', { class: 'auto-m-grid2' },
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, 'API URL'), endpointIn),
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '메서드'), methodSel)),
        h('div', { class: 'auto-m-grid2' },
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '인증 헤더'), authHeaderIn),
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '인증 토큰'), authTokenIn)),
        existing?.hasAuth ? h('label', { class: 'chk-l small' }, clearAuthChk, '토큰 삭제') : null,
        h('div', { class: 'auto-m-grid2' },
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '질문 키'), queryFieldIn),
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '응답 경로'), resultPathIn)));
    } else if (curType === 'mcp') {
      dynamicWrap.replaceChildren(
        h('div', { class: 'auto-m-grid2' },
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, 'MCP 서버'), mcpServerIn),
          h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '도구 이름'), mcpToolIn)),
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '실행 명령'), mcpCmdIn));
    } else {
      dynamicWrap.replaceChildren(
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '웹 주소 (https://)'), webUrlIn),
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, 'Ego Lite 스페이스'), spaceIn));
    }
  };
  renderDynamic();

  const submit = () => once(existing ? `rag-edit-${existing.id}` : 'rag-add', async () => {
    const nm = nameIn.value.trim();
    if (!nm) { nameIn.focus(); toast('RAG 소스 이름을 입력해 주세요'); return; }
    const payload = {
      name: nm,
      type: curType,
      layer: curLayer,
      scope: curLayer === 'agent' ? (empScopeSel.value || curEmpScope || 'all') : 'all',
      note: noteIn.value.trim(),
    };
    if (curType === 'folder') {
      payload.folderPath = folderIn.value.trim();
      payload.extensions = extIn.value.trim();
      payload.useOllamaEmbed = ollamaChk.checked;
    } else if (curType === 'http') {
      payload.endpoint = endpointIn.value.trim();
      payload.method = methodSel.value;
      payload.authHeader = authHeaderIn.value.trim();
      if (authTokenIn.value.trim()) payload.authToken = authTokenIn.value.trim();
      if (clearAuthChk.checked) payload.clearAuth = true;
      payload.queryField = queryFieldIn.value.trim() || 'query';
      payload.resultPath = resultPathIn.value.trim();
    } else if (curType === 'mcp') {
      payload.mcpServer = mcpServerIn.value.trim();
      payload.mcpTool = mcpToolIn.value.trim();
      payload.mcpCommand = mcpCmdIn.value.trim();
    } else {
      payload.webUrl = webUrlIn.value.trim();
      payload.spaceName = spaceIn.value.trim();
    }
    const r = existing
      ? await act('PATCH', `/api/ui/rag/${existing.id}`, payload)
      : await act('POST', '/api/ui/rag', payload);
    if (r) {
      closeDlg();
      const extra = r.type === 'folder' && r.stats
        ? (r.stats.lastError ? ` · 주의: ${r.stats.lastError}` : ` · 문서 ${r.stats.files}개 · 청크 ${r.stats.chunks}개 인덱싱 완료`)
        : '';
      toast(`${nm} RAG를 ${existing ? '저장' : '연결'}했어요${extra}`);
      render();
    }
  });

  setDlg(dlg,
    h('div', { class: 'auto-m-top' },
      h('div', { class: 'auto-m-head' },
        h('h3', { class: 'auto-m-title-h' }, existing ? `${existing.name} 편집` : 'RAG 연결')),
      h('button', { type: 'button', class: 'auto-m-x', 'aria-label': '닫기', onclick: closeDlg }, '×')),
    h('div', { class: 'auto-m-body' },
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '연결 방식'), typeTabs),
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '이름'), nameIn),
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '계층'), layerPickWrap),
      dynamicWrap,
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '메모'), noteIn)),
    h('div', { class: 'auto-m-foot', style: 'justify-content:flex-end' },
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '취소'),
        h('button', { type: 'button', class: 'btn dark', onclick: submit }, existing ? '저장' : '연결'))));
  dlg.showModal();
  setTimeout(() => nameIn.focus(), 20);
}

function ragPanel() {
  const list = Array.isArray(S.data.ragSources) ? S.data.ragSources : [];
  const types = S.options?.ragTypes || RAG_TYPE_FALLBACK;

  // 라이브 RAG 검색 테스트
  const testResWrap = h('div', { class: 'rag-test-results' });
  const renderTestResult = (res) => {
    if (!res) { testResWrap.replaceChildren(); return; }
    const hits = res.hits || [];
    const dirs = res.directives || [];
    const errs = res.errors || [];
    if (!hits.length && !dirs.length && !errs.length) {
      testResWrap.replaceChildren(h('div', { class: 'small muted', style: 'padding:8px 2px' }, '일치하는 문서 구절이 없습니다. 다른 키워드로 검색해 보세요.'));
      return;
    }
    testResWrap.replaceChildren(
      ...hits.map((ht) => h('div', { class: 'rag-hit-card' },
        h('div', { class: 'rag-hit-top' },
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            h('span', { class: 'rag-type-pill' }, ht.ragName),
            h('b', { class: 'rag-hit-file' }, ht.file),
            ht.heading && ht.heading !== ht.file ? h('span', { class: 'small muted' }, `› ${ht.heading}`) : null),
          h('span', { class: 'tag' }, `유사도 ${Math.round((ht.score || 0) * 100)}%`)),
        h('div', { class: 'rag-hit-body' }, ht.snippet))),
      ...dirs.map((dr) => h('div', { class: 'rag-hit-card is-dir' },
        h('div', { class: 'rag-hit-top' },
          h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            h('span', { class: `rag-type-pill is-${dr.type}` }, ragTypeLabel(dr.type)),
            h('b', { class: 'rag-hit-file' }, dr.ragName)),
          h('span', { class: 'tag' }, dr.type === 'mcp' ? 'MCP 도구' : 'Ego Lite')),
        h('div', { class: 'small muted' }, dr.type === 'mcp'
          ? `작업 시 AI 직원이 MCP ${dr.mcpServer}${dr.mcpTool ? `/${dr.mcpTool}` : ''} 도구로 직접 조회합니다.`
          : `작업 시 Ego Lite로 ${dr.webUrl} 에 접속해 근거를 조회합니다.`))),
      ...errs.map((er) => h('div', { class: 'small', style: 'color:#b42318' }, `${er.ragName}: ${er.error}`)));
  };
  if (ui.ragTestResult) renderTestResult(ui.ragTestResult);

  const testIn = h('input', {
    class: 'in sm',
    value: ui.ragTestQuery || '',
    placeholder: '연결된 내 RAG에서 바로 검색 테스트 (예: 유튜브 훅 공식, 가격 정책, 강의 커리큘럼)...',
    'aria-label': 'RAG 검색 테스트',
  });
  const runTest = () => once('rag-test-q', async () => {
    const q = testIn.value.trim();
    if (!q) { testIn.focus(); return; }
    ui.ragTestQuery = q;
    const res = await api('POST', '/api/ui/rag/query', { query: q, topK: 5 });
    if (res) {
      ui.ragTestResult = res;
      renderTestResult(res);
    }
  });
  testIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.isComposing) runTest(); });

  const bodyEl = list.length
    ? h('div', { class: 'rag-wrap' },
      h('div', { class: 'rag-grid' }, list.map((rg) => {
        const targetTxt = rg.type === 'folder' ? rg.folderPath
          : rg.type === 'http' ? `${rg.method || 'POST'} ${rg.endpoint}`
            : rg.type === 'mcp' ? `MCP: ${rg.mcpServer}${rg.mcpTool ? ` / ${rg.mcpTool}` : ''}`
              : rg.webUrl;
        const statTxt = rg.type === 'folder'
          ? (rg.stats?.lastError ? `오류: ${rg.stats.lastError}` : `문서 ${rg.stats?.files || 0}개 · 청크 ${rg.stats?.chunks || 0}개${rg.stats?.embedModel ? ` · ${rg.stats.embedModel}` : ' · BM25'}`)
          : rg.type === 'http'
            ? (rg.stats?.ok === true ? `API 정상 · 응답 ${rg.stats.sampleCount ?? 0}건` : rg.stats?.ok === false ? `연결 오류: ${rg.stats.lastError}` : (rg.hasAuth ? '인증 토큰 저장됨' : '연결 테스트 전'))
            : rg.type === 'mcp' ? '작업 시 AI가 MCP 도구 호출'
              : (rg.spaceName ? `Ego Lite · ${rg.spaceName}` : 'Ego Lite 브라우저 조회');

        return h('article', { class: `rag-card${rg.enabled === false ? ' is-off' : ''}` },
          h('div', { class: 'rag-card-top' },
            h('div', { class: 'kb-badges' },
              h('span', { class: `rag-type-pill is-${rg.type}` }, ragTypeLabel(rg.type)),
              kbLayerPill(rg, true),
              rg.type === 'folder' && rg.stats?.embedModel ? h('span', { class: 'tag solid' }, '하이브리드 벡터') : null),
            h('div', { class: 'row', style: 'gap:6px' },
              h('label', { class: 'switch', title: '활성화 / 일시 중지' },
                h('input', { type: 'checkbox', checked: rg.enabled !== false, onchange: (ev) => act('PATCH', `/api/ui/rag/${rg.id}`, { enabled: ev.target.checked }, ev.target.checked ? `${rg.name} RAG를 켰어요` : `${rg.name} RAG를 껐어요`) }),
                h('span', { class: 'tr' })),
              h('button', {
                type: 'button', class: 'x', 'aria-label': `${rg.name} 삭제`,
                onclick: () => { if (confirm(`"${rg.name}" RAG 연결을 해제할까요?`)) act('DELETE', `/api/ui/rag/${rg.id}`, undefined, 'RAG 연결을 해제했어요'); },
              }, '×'))),
          h('h3', { class: 'kb-title' }, rg.name),
          h('div', { class: 'rag-target' }, targetTxt),
          rg.note ? h('div', { class: 'small muted' }, rg.note) : null,
          h('div', { class: 'rag-card-foot' },
            h('span', { class: `small${rg.stats?.lastError ? '' : ' muted'}`, style: rg.stats?.lastError ? 'color:#b42318' : '' }, statTxt),
            h('div', { class: 'row', style: 'gap:6px' },
              (rg.type === 'folder' || rg.type === 'http') ? h('button', {
                type: 'button', class: 'btn sm',
                onclick: () => once(`rag-sync-${rg.id}`, async () => {
                  const resSync = await act('POST', `/api/ui/rag/${rg.id}/sync`, {});
                  if (resSync?.ok) {
                    toast(rg.type === 'folder'
                      ? `${rg.name} 재색인 완료 (문서 ${resSync.stats?.files || 0}개 · 청크 ${resSync.stats?.chunks || 0}개)`
                      : `${rg.name} API 연결 정상 (샘플 ${resSync.stats?.sampleCount ?? 0}건)`);
                  }
                }),
              }, rg.type === 'folder' ? '재색인' : '연결 테스트') : null,
              h('button', { type: 'button', class: 'btn sm', onclick: () => openRagModal(rg) }, '편집'))));
      })),
      h('div', { class: 'rag-test-box' },
        h('div', { class: 'rag-test-bar' },
          testIn,
          h('button', { type: 'button', class: 'btn sm dark', onclick: runTest }, 'RAG 검색 테스트')),
        testResWrap))
    : h('div', { class: 'rag-starter-grid' }, types.map((t) => h('button', {
      type: 'button', class: 'rag-starter-card',
      title: t.hint || '',
      onclick: () => openRagModal(null, t.key),
    },
    h('div', { class: 'rag-starter-top' },
      h('span', { class: `rag-type-pill is-${t.key}` }, ragTypeLabel(t.key)),
      h('span', { class: 'rag-starter-go' }, '+ 연결')),
    h('b', { class: 'rag-starter-title' }, t.label))));

  return h('section', { class: 'sec rag-sec' },
    secHead('내 RAG', '',
      h('button', { type: 'button', class: 'btn sm dark', onclick: () => openRagModal() }, '+ RAG 연결')),
    bodyEl);
}

// ───────── 3계층 지식 베이스 (나의 지식[대표 노하우] · 공용 지식[AI 협업] · AI 직원별) ─────────

function openKnowledgeModal(existing = null, prefill = null) {
  const dlg = document.getElementById('dlg');
  const cats = S.options.knowledgeCategories || ['브랜드', '비즈니스', '업무 규칙', '참고 자료', 'AI 학습 메모'];
  const emps = S.data.employees || [];
  let curLayer = existing ? kbLayerOf(existing) : (prefill?.layer || 'owner');
  let curEmpScope = (existing?.scope && existing.scope !== 'all')
    ? existing.scope
    : (prefill?.scope && prefill.scope !== 'all' ? prefill.scope : (emps[0]?.id || 'all'));

  const titleIn = h('input', { class: 'in auto-m-title', value: existing?.title || prefill?.title || '', placeholder: '예: CONNECT AI LAB 브랜드 톤 · 협업 규칙 · 담당 AI 전용 가이드', 'aria-label': '지식 제목' });
  const catSel = h('select', { class: 'in', 'aria-label': '카테고리' },
    cats.map((c) => h('option', { value: c, selected: (existing?.category || prefill?.category || (curLayer === 'shared' ? '업무 규칙' : '브랜드')) === c }, c)));
  const empScopeSel = h('select', { class: 'in sm', 'aria-label': '전용 AI 직원' },
    emps.map((e) => h('option', { value: e.id, selected: curEmpScope === e.id }, `${shortName(e.id)} 전용`)));
  empScopeSel.addEventListener('change', () => { curEmpScope = empScopeSel.value; });

  const layerPickWrap = h('div', { class: 'kb-layer-pick' });
  const renderLayerPick = () => {
    const opts = [
      ['owner', '나의 지식 (대표)'],
      ['shared', '공용 지식 (AI 협업)'],
      ['agent', 'AI 직원 전용'],
    ];
    layerPickWrap.replaceChildren(
      h('div', { class: 'picker' }, opts.map(([k, lbl]) => h('button', {
        type: 'button', class: `chip sm${curLayer === k ? ' on' : ''}`,
        onclick: () => { curLayer = k; renderLayerPick(); },
      }, lbl))),
      curLayer === 'agent' && emps.length ? empScopeSel : null);
  };
  renderLayerPick();

  const tagsIn = h('input', { class: 'in', value: (existing?.tags || []).join(', '), placeholder: '태그 (쉼표)', 'aria-label': '태그' });
  const contentIn = h('textarea', {
    class: 'in kb-content-in', rows: 7, 'aria-label': '지식 내용',
    placeholder: '내용',
  }, existing?.content || prefill?.content || '');

  const submit = async () => {
    const titleVal = titleIn.value.trim();
    const contentVal = contentIn.value.trim();
    if (!titleVal) { titleIn.focus(); toast('지식 제목을 입력해 주세요'); return; }
    if (!contentVal) { contentIn.focus(); toast('지식 내용을 입력해 주세요'); return; }
    const body = {
      title: titleVal,
      category: catSel.value,
      layer: curLayer,
      scope: curLayer === 'agent' ? (empScopeSel.value || curEmpScope) : 'all',
      tags: tagsIn.value.trim(),
      content: contentVal,
    };
    const r = existing
      ? await once(`kb-edit-${existing.id}`, () => act('PATCH', `/api/ui/knowledge/${existing.id}`, body, '지식을 수정했어요'))
      : await once('kb-add', () => act('POST', '/api/ui/knowledge', body, '지식에 저장했어요'));
    if (r) { closeDlg(); render(); }
  };
  contentIn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); submit(); } });

  dlg.className = 'auto-dlg';
  setDlg(dlg,
    h('div', { class: 'auto-m-top' },
      h('div', { class: 'auto-m-head' },
        h('h3', { class: 'auto-m-title-h' }, existing ? '지식 편집' : '새 지식')),
      h('button', { type: 'button', class: 'auto-m-x', 'aria-label': '닫기', onclick: closeDlg }, '×')),
    h('div', { class: 'auto-m-body' },
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '계층'), layerPickWrap),
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '제목'), titleIn),
      h('div', { class: 'auto-m-grid2' },
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '분류'), catSel),
        h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '태그'), tagsIn)),
      h('div', { class: 'auto-m-field' }, h('label', { class: 'auto-m-lbl' }, '내용'), contentIn)),
    h('div', { class: 'auto-m-foot', style: 'justify-content:flex-end' },
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: closeDlg }, '취소'),
        h('button', { type: 'button', class: 'btn dark', onclick: submit }, existing ? '저장' : '추가'))));
  dlg.showModal();
  setTimeout(() => titleIn.focus(), 20);
}

function knowledgePanel() {
  const list = Array.isArray(S.data.knowledge) ? S.data.knowledge : [];
  const emps = S.data.employees || [];
  const cats = ['all', ...(S.options.knowledgeCategories || ['브랜드', '비즈니스', '업무 규칙', '참고 자료', 'AI 학습 메모'])];
  const curLayer = ui.kbLayer || 'all';
  const curEmp = ui.kbEmp || 'all';

  const ownerCnt = list.filter((k) => kbLayerOf(k) === 'owner').length;
  const sharedCnt = list.filter((k) => kbLayerOf(k) === 'shared').length;
  const agentCnt = list.filter((k) => kbLayerOf(k) === 'agent').length;

  const defaultPrefill = () => {
    const layer = curLayer === 'all' ? 'owner' : curLayer;
    const scope = layer === 'agent' && curEmp !== 'all' ? curEmp : undefined;
    return { layer, ...(scope ? { scope } : {}) };
  };

  const fileIn = h('input', { type: 'file', accept: '.md,.txt,.json', class: 'is-hidden' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (!f) return;
    const raw = (await f.text()).slice(0, 6000).trim();
    if (!raw) { toast('비어 있는 파일입니다'); return; }
    openKnowledgeModal(null, { ...defaultPrefill(), title: f.name.replace(/\.(md|txt|json)$/i, ''), category: '참고 자료', content: raw });
  });

  const gridWrap = h('div', { class: 'kb-list-wrap' });
  const renderList = () => {
    const q = String(ui.kbQuery || '').trim().toLowerCase();
    const cat = ui.kbCat || 'all';
    const layer = ui.kbLayer || 'all';
    const empPick = ui.kbEmp || 'all';
    const filtered = list.filter((k) => {
      const kl = kbLayerOf(k);
      if (layer !== 'all' && kl !== layer) return false;
      if (layer === 'agent' && empPick !== 'all' && k.scope !== empPick) return false;
      if (cat !== 'all' && k.category !== cat) return false;
      if (q && !`${k.title} ${k.category} ${(k.tags || []).join(' ')} ${k.content}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!filtered.length) {
      const emptyLabel = layer === 'owner' ? '아직 등록된 나의 지식(대표 노하우)이 없어요'
        : layer === 'shared' ? '아직 공용 지식(AI 협업)이 없어요'
          : layer === 'agent' ? (empPick !== 'all' ? `${shortName(empPick)} 전용 지식이 아직 없어요` : '아직 AI 직원별 전용 지식이 없어요')
            : (list.length ? '조건에 맞는 지식 문서가 없어요' : '아직 저장된 지식이 없어요');
      const addLabel = layer === 'agent' && empPick !== 'all' ? `+ ${shortName(empPick)} 전용 지식 추가` : '+ 지식 추가';
      gridWrap.replaceChildren(h('div', { class: 'auto-empty-center compact' },
        h('div', { class: 'auto-empty-title' }, emptyLabel),
        h('button', { type: 'button', class: 'btn dark sm', onclick: () => openKnowledgeModal(null, defaultPrefill()) }, addLabel)));
      return;
    }
    gridWrap.replaceChildren(h('div', { class: 'kb-grid' }, filtered.map((k) => {
      const byAi = k.updatedBy && k.updatedBy !== 'jay';
      return h('article', { class: 'kb-card' },
        h('div', { class: 'kb-card-top' },
          h('div', { class: 'kb-badges' },
            kbLayerPill(k),
            h('span', { class: `kb-cat-pill${k.category === '브랜드' || k.category === '업무 규칙' ? ' is-core' : ''}` }, k.category),
            byAi ? h('span', { class: 'skill-ai-tag' }, `${shortName(k.updatedBy)} 정리`) : null),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'btn sm', onclick: () => openKnowledgeModal(k) }, '편집'),
            h('button', {
              type: 'button', class: 'x', 'aria-label': `${k.title} 삭제`,
              onclick: () => { if (confirm(`"${k.title}" 지식을 지울까요?`)) act('DELETE', `/api/ui/knowledge/${k.id}`, undefined, '지식을 지웠어요'); },
            }, '×'))),
        h('h3', { class: 'kb-title' }, k.title),
        h('p', { class: 'kb-preview' }, k.content),
        (k.tags || []).length ? h('div', { class: 'kb-tags' }, k.tags.map((tg) => h('span', { class: 'kb-tag' }, `#${tg}`))) : null);
    })));
  };

  const layerTabs = [
    ['all', `전체 (${list.length})`],
    ['owner', `나의 지식 · 대표 (${ownerCnt})`],
    ['shared', `공용 지식 · AI 협업 (${sharedCnt})`],
    ['agent', `AI 직원별 (${agentCnt})`],
  ];
  const layerBar = h('div', { class: 'picker kb-layer-tabs', role: 'tablist', 'aria-label': '지식 계층' },
    layerTabs.map(([k, lbl]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': curLayer === k ? 'true' : 'false',
      class: `chip sm kb-ltab${k === 'owner' ? ' is-owner' : ''}${curLayer === k ? ' on' : ''}`,
      onclick: () => { ui.kbLayer = k; if (k !== 'agent') ui.kbEmp = 'all'; render(); },
    }, lbl)));

  const empStrip = curLayer === 'agent' ? h('div', { class: 'picker kb-emp-strip', role: 'group', 'aria-label': 'AI 직원 필터' },
    h('button', {
      type: 'button', class: `chip sm${curEmp === 'all' ? ' on' : ''}`,
      onclick: () => { ui.kbEmp = 'all'; render(); },
    }, `전체 AI 직원 (${agentCnt})`),
    ...emps.map((e) => {
      const cnt = list.filter((k) => kbLayerOf(k) === 'agent' && k.scope === e.id).length;
      return h('button', {
        type: 'button', class: `chip sm${curEmp === e.id ? ' on' : ''}`,
        onclick: () => { ui.kbEmp = e.id; render(); },
      }, `${shortName(e.id)}${cnt ? ` (${cnt})` : ''}`);
    })) : null;

  const searchIn = h('input', {
    class: 'in auto-search-in', type: 'search', value: ui.kbQuery || '',
    placeholder: '지식 검색 (제목 · 태그 · 내용)...', 'aria-label': '지식 검색',
  });
  searchIn.addEventListener('input', () => { ui.kbQuery = searchIn.value; renderList(); });

  const catBtns = cats.map((c) => h('button', {
    type: 'button', class: `chip sm${(ui.kbCat || 'all') === c ? ' on' : ''}`,
    onclick: () => {
      ui.kbCat = c;
      catBtns.forEach((b, i) => b.classList.toggle('on', cats[i] === c));
      renderList();
    },
  }, c === 'all' ? '전체 분류' : c));

  renderList();

  return h('section', { class: 'sec' },
    secHead('지식 베이스', '',
      fileIn,
      h('button', { type: 'button', class: 'btn sm', onclick: () => fileIn.click() }, '.md 불러오기'),
      h('button', { type: 'button', class: 'btn sm dark', onclick: () => openKnowledgeModal(null, defaultPrefill()) }, '+ 지식 추가')),
    layerBar,
    empStrip,
    h('div', { class: 'auto-toolbar kb-toolbar' }, searchIn, h('div', { class: 'auto-filters' }, catBtns)),
    gridWrap);
}

function machinesRoutingPanel() {
  const d = S.data;
  const machines = d.resources.filter((r) => r.kind === '기계');
  const activeMachines = machines.filter((r) => r.status !== '꺼짐');
  const thisMac = activeMachines.find((m) => m.isThisMac) || activeMachines[0] || null;
  const studio = activeMachines.find((m) => !m.isThisMac && /(스튜디오|studio|데스크톱|워크스테이션|office)/i.test(m.name)) || activeMachines.find((m) => m.id !== thisMac?.id) || null;
  const workTags = S.options.machineWorkTags || [
    { key: 'daily', label: '일상 · 브라우저 · SNS' },
    { key: 'code', label: '코딩 · 문서 · 리서치' },
    { key: 'video', label: '영상 · 쇼츠 · 모션' },
    { key: '3d', label: '3D · 블렌더 · 렌더' },
    { key: 'local', label: '로컬 AI (Ollama)' },
  ];

  const ownerFor = (tagKey) => {
    const tagged = activeMachines.filter((m) => Array.isArray(m.workTags) && m.workTags.includes(tagKey));
    if (tagged.length) {
      return tagged.find((m) => !m.isThisMac && ['video', '3d', 'local'].includes(tagKey))
        || tagged.find((m) => m.isThisMac)
        || tagged[0];
    }
    if ((tagKey === '3d' || tagKey === 'video') && studio) return studio;
    return (d.settings?.mainMachine && activeMachines.find((m) => m.id === d.settings.mainMachine)) || thisMac;
  };

  const quickAddStudio = () => once('quick-add-studio', async () => {
    const created = await act('POST', '/api/ui/resources', {
      name: '맥 스튜디오 (Mac Studio)',
      kind: '기계',
      workTags: ['video', '3d', 'local'],
      note: '영상 편집 · 3D 블렌더 · 로컬 AI 전담',
      status: '확인 필요',
      autoOptimize: true,
    }, '맥 스튜디오를 추가하고 맥북 ↔ 스튜디오 역할 배분을 자동 최적화했어요');
    if (created) render();
  });

  const runOptimize = () => once('opt-machines', async () => {
    const resOpt = await act('POST', '/api/ui/resources/optimize-machines', {});
    if (resOpt?.summary) toast(resOpt.summary);
  });

  return h('section', { class: 'res-route-card', 'aria-label': '작업별 컴퓨터 자원 배분 규칙' },
    h('div', { class: 'res-route-top' },
      h('h2', { class: 'res-route-h', style: 'margin:0' }, studio
        ? `${thisMac?.name || '이 맥'} × ${studio.name} 배분`
        : '작업별 컴퓨터 배분'),
      h('div', { class: 'row', style: 'flex-wrap:wrap' },
        !studio ? h('button', { type: 'button', class: 'btn sm gold', onclick: quickAddStudio }, '+ 맥 스튜디오 추가') : null,
        h('button', { type: 'button', class: 'btn sm dark', onclick: runOptimize }, '⚡ 자동 최적화'))),
    h('div', { class: 'res-route-grid' }, workTags.map((wt) => {
      const owner = ownerFor(wt.key);
      const fb = owner?.fallbackTo ? activeMachines.find((m) => m.id === owner.fallbackTo) : null;
      const isStudio = Boolean(owner && !owner.isThisMac);
      return h('div', { class: `res-route-cell${isStudio ? ' is-studio' : ''}` },
        h('div', { class: 'res-rc-task' }, wt.label),
        h('div', { class: 'res-rc-owner' },
          h('span', { class: 'res-rc-arrow' }, '→'),
          h('b', null, owner ? owner.name : '미연결')),
        fb ? h('div', { class: 'res-rc-sub' }, `우회 → ${fb.name}`) : null);
    })));
}

function openQuickMemoryModal() {
  const dlg = document.getElementById('dlg');
  dlg.className = '';
  const factIn = h('textarea', { class: 'in', rows: 3, placeholder: '예: 유튜브 댓글은 이모지 없이 짧고 정중하게 답하기', 'aria-label': '기억할 내용' });
  const kindSel = h('select', { class: 'in sm', style: 'width:120px', 'aria-label': '분류' },
    h('option', { value: 'rule' }, '규칙 · 기준'),
    h('option', { value: 'manual' }, '일반 기억'));
  const save = () => once('add-mem', async () => {
    const val = factIn.value.trim();
    if (!val) { factIn.focus(); return; }
    dlg.close();
    await act('POST', '/api/ui/memory', { fact: val, kind: kindSel.value }, '기억에 저장했어요');
  });
  setDlg(dlg,
    h('h3', null, '자동 기억 추가'),
    h('div', { class: 'row', style: 'gap:8px;margin-bottom:8px' }, kindSel),
    factIn,
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, '취소'),
      h('button', { type: 'button', class: 'btn dark', onclick: save }, '저장')));
  dlg.showModal();
  setTimeout(() => factIn.focus(), 30);
}

function autoMemoryPanel() {
  const hr = S.harness || {};
  const mem = hr.memory || { totalEpisodes: 0, totalEntities: 0, totalLessons: 0, entities: [], recentEpisodes: [] };
  const ver = hr.verification || { total: 0, passed: 0, repaired: 0, passRate: null };
  const filter = ui.memFilter || 'all';
  const types = [['all', '전체'], ['rule', '규칙·교훈'], ['channel', '채널'], ['person', '사람'], ['project', '프로젝트']];
  const entities = (mem.entities || []).filter((e) => filter === 'all' || e.type === filter);
  const episodes = (mem.recentEpisodes || []).filter((ep) => {
    if (filter === 'all') return true;
    if (filter === 'rule') return ['rule', 'lesson', 'handoff', 'decision'].includes(ep.kind);
    return (ep.entities || []).some((x) => x.type === filter);
  });
  const consolidateNow = () => once('mem-consolidate', () => act('POST', '/api/ui/memory/consolidate', {}, '기억을 정리했어요'));
  return h('section', { class: 'sec mem-sec' },
    secHead('자동 기억', '',
      h('div', { class: 'row', style: 'gap:6px' },
        h('button', { type: 'button', class: 'btn sm', disabled: !mem.totalEpisodes, onclick: consolidateNow }, '지금 정리'),
        h('button', { type: 'button', class: 'btn sm dark', onclick: openQuickMemoryModal }, '+ 추가'))),
    h('div', { class: 'rl-bar-card' },
      h('div', { class: 'rl-kpis' },
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '자동 기록'), h('b', null, `${mem.totalEpisodes || 0}`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '정리된 대상'), h('b', { style: 'color:#8c621c' }, `${mem.totalEntities || 0}`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '규칙 · 교훈'), h('b', null, `${mem.totalLessons || 0}`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '자동 검증'), h('b', null, ver.passRate != null ? `${ver.passRate}%` : '-'))),
      (mem.totalEntities || mem.totalEpisodes) ? h('div', { class: 'picker mem-filters' }, types.map(([k, lbl]) => h('button', {
        type: 'button', class: `chip sm${filter === k ? ' on' : ''}`,
        onclick: () => { ui.memFilter = k; render(); },
      }, lbl))) : null,
      entities.length ? h('div', { class: 'flat-list mem-list' }, entities.slice(0, 12).map((ent) => h('div', { class: 'mem-row' },
        h('span', { class: `mem-kind is-${ent.type}` }, ent.typeLabel || ent.type),
        h('b', { class: 'mem-nm' }, ent.name),
        h('span', { class: 'mem-txt' }, ent.facts?.[0]?.text || ''),
        h('button', {
          type: 'button', class: 'x', 'aria-label': '삭제',
          onclick: () => act('DELETE', `/api/ui/memory/${encodeURIComponent(ent.id)}`, undefined, '기억을 지웠어요'),
        }, '×')))) : null,
      episodes.length ? h('details', { class: 'clean-fold sm', style: 'margin-top:8px' },
        h('summary', null, `일일 기록 (${episodes.length})`),
        h('div', { class: 'flat-list mem-list' }, episodes.slice(0, 12).map((ep) => h('div', { class: 'mem-row' },
          h('span', { class: 'flat-meta' }, String(ep.date || '').slice(5)),
          h('span', { class: 'mem-txt' }, `${ep.empName ? `[${ep.empName}] ` : ''}${ep.summary}`),
          h('button', {
            type: 'button', class: 'x', 'aria-label': '삭제',
            onclick: () => act('DELETE', `/api/ui/memory/${encodeURIComponent(ep.id)}`, undefined, '기억을 지웠어요'),
          }, '×'))))) : null));
}

function rlDecisionPanel() {
  const rl = S.rl || { total: 0, approved: 0, edited: 0, rejected: 0, dpoPairs: 0, avgReward: null, recent: [] };
  const downloadDpo = () => once('rl-dl', async () => {
    const res = await api('GET', '/api/ui/rl/export');
    if (!res) return;
    if (!res.jsonl) { toast('아직 누적된 의사결정 데이터가 없어요'); return; }
    const blob = new Blob([res.jsonl], { type: 'application/x-ndjson;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || 'connect-ai-dpo.jsonl';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`DPO 강화학습 데이터 ${res.rows?.length || rl.total}건을 저장했어요`);
  });
  return h('section', { class: 'sec rl-sec' },
    secHead('의사결정 학습 (RL · DPO)', '',
      h('button', { type: 'button', class: 'btn sm', disabled: !rl.total, onclick: downloadDpo }, 'DPO JSONL 내보내기')),
    h('div', { class: 'rl-bar-card' },
      h('div', { class: 'rl-kpis' },
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '누적 결재'), h('b', null, `${rl.total}건`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '그대로 승인'), h('b', null, `${rl.approved}`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '수정 선호쌍 (DPO)'), h('b', { style: 'color:#8c621c' }, `${rl.dpoPairs}`)),
        h('div', { class: 'rl-kpi' }, h('span', { class: 'small muted' }, '반려 기준'), h('b', null, `${rl.rejected}`))),
      rl.recent?.length ? h('details', { class: 'clean-fold sm', style: 'margin-top:10px' },
        h('summary', null, `최근 학습 기록 (${rl.recent.length})`),
        h('div', { class: 'rl-rec-list' }, rl.recent.map((x) => {
          const badge = x.outcome === 'edited' ? '+0.6 수정 학습' : x.outcome === 'rejected' ? '-1.0 반려' : '+1.0 승인';
          return h('div', { class: 'rl-rec-row' },
            h('span', { class: `rl-rw-pill is-${x.outcome}` }, badge),
            h('span', { class: 'rl-rec-txt' }, `${x.accountName ? `[${x.accountName}] ` : ''}${x.what}${x.reason ? ` · ${x.reason}` : ''}`));
        }))) : null));
}

function pageResources() {
  if (!ui.office) loadOffice();
  if (!ui.tools) loadTools();
  const d = S.data;
  // 구 탭 키('office', 'all') 호환 → 깔끔한 5개 집중 탭(기본: 컴퓨터 · 자원 배분)
  const rawTab = ui.resTab || 'machines';
  const tab = rawTab === 'office' || rawTab === 'all' ? 'machines' : rawTab;
  const genericKinds = S.options.resKinds.filter((k) => !['브라우저', '스마트폰', '오픈소스', '계정', '디자인'].includes(k));
  const machineCount = d.resources.filter((r) => genericKinds.includes(r.kind)).length;
  const webCount = d.resources.filter((r) => ['브라우저', '계정'].includes(r.kind)).length;
  const kbCount = (d.knowledge || []).length;
  const ragCount = (d.ragSources || []).length;
  const toolsCount = d.resources.filter((r) => ['오픈소스', '디자인'].includes(r.kind)).length;
  const mobileCount = d.resources.filter((r) => r.kind === '스마트폰').length;
  const tabs = [
    ['machines', `컴퓨터 · 자원 배분 (${machineCount})`],
    ['web', `브라우저 · 계정 (${webCount})`],
    ['knowledge', `내 지식 · RAG (${kbCount + ragCount})`],
    ['tools', `도구 · 디자인 (${toolsCount})`],
    ['mobile', `스마트폰 · 기타 (${mobileCount})`],
  ];
  const name = h('input', { class: 'in', placeholder: '새 자원 이름 (예: 맥 스튜디오, 외장 SSD, 작업 폴더)', 'data-k': 'rs-name', 'aria-label': '자원 이름' });
  const kind = h('select', { class: 'in', style: 'width:110px', 'data-k': 'rs-kind', 'aria-label': '종류' }, genericKinds.map((k) => h('option', { value: k }, k)));
  const add = () => submitInput(name, 'add-res', (v) => act('POST', '/api/ui/resources', { name: v, kind: kind.value }, '자원을 추가했어요'));
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) add(); });
  return h('div', null,
    h('div', { class: 'head' }, h('h1', null, h('b', null, '내 자원')),
      h('button', { class: 'btn sm', onclick: () => { loadOffice(); loadTools(); toast('새로고침했어요'); } }, '새로고침')),
    h('div', { class: 'picker res-main-tabs', role: 'tablist', 'aria-label': '내 자원 탭' }, tabs.map(([k, label]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false',
      class: `chip${tab === k ? ' on' : ''}`, onclick: () => { ui.resTab = k; render(); },
    }, label))),
    tab === 'machines' ? [
      ...genericKinds.map((k) => {
        const list = d.resources.filter((r) => r.kind === k);
        return list.length ? h('section', { class: 'sec' }, secHead(k === '기계' ? '컴퓨터' : k, `${list.length}개`), h('ul', { class: 'list' }, list.map(resRow))) : null;
      }),
      h('details', { class: 'clean-fold', 'data-k': 'res-route-fold', style: 'margin-top:12px' },
        h('summary', null, '컴퓨터 작업 자동 배분 규칙'),
        machinesRoutingPanel()),
      h('section', { class: 'sec' }, secHead('직접 추가'),
        h('div', { class: 'addbar slim' }, kind, name, h('button', { class: 'btn dark', onclick: add }, '추가'))),
    ] : null,
    tab === 'web' ? [browserPanel(), accountsPanel()] : null,
    tab === 'knowledge' ? [ragPanel(), knowledgePanel(), autoMemoryPanel(), rlDecisionPanel()] : null,
    tab === 'tools' ? [ossPanel(), designPanel()] : null,
    tab === 'mobile' ? [phonePanel(), healthPanel(), lanPanel(), musePanel()] : null);
}

// ───────── 1분 시작하기 (처음 켠 사람) ─────────
// 대표 이름과 회사 이름 → 이 컴퓨터에서 찾은 AI 체크 → 사무실 확인 → 자는 시간 → AI 도구 연결 (묻고 보여 주기) → 안전 규칙

const OB_STEPS = 6;

const STARTER_ROUTINES = [
  { key: 'email', title: '이메일 · 수강생 문의 체크', intervalMin: 5, instruction: '5분마다 Ego Lite 이메일 스페이스에서 새 메일과 문의를 확인해 줘. 급한 건 요약해 알리고, 답장은 초안만 임시저장해 둬.' },
  { key: 'news', title: '아침 업계 소식 3줄 요약', time: '08:30', instruction: '오늘 AI·자동화·크리에이터 업계의 핵심 소식 3가지를 골라 1줄 요약과 내 사업에 적용할 아이디어 1개씩 정리해 줘.' },
  { key: 'plan', title: '오늘 할 일 정리와 우선순위 추천', time: '09:00', instruction: '오늘 할 일 목록을 보고 대표님이 직접 해야 할 핵심 3가지와 AI가 먼저 처리할 일을 우선순위대로 정리해 줘.' },
  { key: 'wrap', title: '오늘 끝난 일 하루 마감 정리', time: '22:00', instruction: '오늘 완료된 할 일과 미완료 항목을 정리하고, 내일 아침에 바로 이어서 할 일 3가지를 제안해 줘.' },
];

function obState() {
  if (!ui.ob) {
    ui.ob = { step: 1, name: S.data.owner.name || '', company: S.data.settings.companyName || '', ais: new Set(), machines: new Set(), ssh: new Set(),
      browsers: new Set(), oss: new Set(), routines: new Set(), skippedConnect: false,
      quiet: { from: S.data.settings.quietHours?.from || '23:00', to: S.data.settings.quietHours?.to || '07:00' }, det: null, connect: null, open: {} };
    fetch('/api/onboard/detect').then((r) => r.json()).then((det) => {
      ui.ob.det = det;
      if (det.claude) ui.ob.ais.add('claudecode');
      if (det.codex) ui.ob.ais.add('codex');
      if (det.gemini) ui.ob.ais.add('geminicli');
      if (det.agy) ui.ob.ais.add('antigravity');
      if (det.opencode) ui.ob.ais.add('opencode');
      if (det.cursor) ui.ob.ais.add('cursor');
      if (det.ollama) ui.ob.ais.add('ollama'); else if (det.lmstudio) ui.ob.ais.add('lmstudio');
      for (const b of det.browsers || []) if (b.found) ui.ob.browsers.add(b.key);
      for (const o of det.openSource || []) if (o.found) ui.ob.oss.add(o.key);
      render();
    }).catch(() => { ui.ob.det = {}; render(); });
  }
  return ui.ob;
}

function obShell(step, title, sub, body, actions) {
  return h('div', { class: 'ob' },
    h('div', { class: 'ob-step' }, `${step} / ${OB_STEPS}`),
    h('h1', null, h('b', null, title)), sub ? h('p', { class: 'sub' }, sub) : null,
    h('div', { class: 'ob-body' }, body),
    h('div', { class: 'ob-actions' }, actions));
}

async function obSend(body) {
  return once('onboard', () => act('POST', '/api/ui/onboard', body));
}

function finishOnboarding() {
  return once('ob-done', async () => { await act('PATCH', '/api/ui/settings', { onboarded: true }, '본사를 열었어요'); ui.ob = null; location.hash = '#home'; });
}

function copyBlock(label, textValue) {
  return h('div', { class: 'ob-cmd' }, h('div', { class: 'row' }, h('span', { class: 'small muted' }, label), h('button', { type: 'button', class: 'btn sm', onclick: async () => { await copyText(textValue); toast('복사했어요'); } }, '복사')),
    h('pre', { class: 'mono' }, textValue));
}

function pageStart() {
  const ob = obState();
  const next = (n) => { ob.step = n; render(); window.scrollTo(0, 0); };
  const skip = h('button', { class: 'btn link', onclick: () => { if (confirm('시작하기를 건너뛰고 빈 화면으로 갈까요?')) finishOnboarding(); } }, '건너뛰기');

  if (ob.step === 1) {
    const name = h('input', { class: 'in big', value: ob.name, placeholder: '예: 민지', 'data-k': 'ob-name', 'aria-label': '대표 이름', oninput: (ev) => { ob.name = ev.target.value; } });
    const company = h('input', { class: 'in big', value: ob.company, placeholder: '예: 민지 스튜디오', 'data-k': 'ob-company', 'aria-label': '회사 이름', oninput: (ev) => { ob.company = ev.target.value; } });
    const go = () => { ob.name = name.value.trim(); ob.company = company.value.trim(); if (!ob.name) { name.focus(); return; } next(2); };
    for (const el of [name, company]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); });
    if (!ob.focused1) { ob.focused1 = true; setTimeout(() => document.querySelector('[data-k="ob-name"]')?.focus(), 0); }
    return obShell(1, '삶과 AI 일을 함께 최적화하는 본사를 차려 볼까요?', '인공지능 시대, 내 컨디션과 AI 직원 · 사무실을 한곳에서 최적화합니다. 1분이면 끝나요 — 모든 데이터는 이 컴퓨터 안에만 저장돼요.',
      h('div', { class: 'ob-fields' }, h('label', { class: 'field' }, '대표 이름', name), h('label', { class: 'field' }, '회사 이름 (나중에 정해도 돼요)', company)),
      [skip, h('button', { class: 'btn dark big', 'data-act': 'ob-next', onclick: go }, '시작하기')]);
  }

  if (ob.step === 2) {
    const det = ob.det || {};
    const found = (c) => (c.key === 'claudecode' && det.claude)
      || (c.key === 'codex' && det.codex)
      || (c.key === 'geminicli' && det.gemini)
      || (c.key === 'antigravity' && det.agy)
      || (c.key === 'opencode' && det.opencode)
      || (c.key === 'cursor' && det.cursor)
      || (c.local && det[c.local]);
    const missingLocal = (c) => c.local && ob.det && !det[c.local];
    const cat = S.options.catalog;
    const foundList = ob.det ? cat.filter(found) : [];
    const restList = ob.det ? cat.filter((c) => !found(c)) : [];
    if (!ob.defaultAi && foundList.length) ob.defaultAi = foundList[0].key;
    if (ob.defaultAi && !ob.ais.has(ob.defaultAi)) ob.ais.add(ob.defaultAi);

    const defCard = (c) => {
      const isDef = ob.defaultAi === c.key;
      return h('button', {
        type: 'button',
        class: `orca-agent-card${isDef ? ' on' : ''}`,
        'aria-pressed': isDef ? 'true' : 'false',
        onclick: () => { ob.defaultAi = c.key; ob.ais.add(c.key); render(); },
      },
      h('span', { class: 'orca-ic ag-claude', 'aria-hidden': 'true' }, '✦'),
      h('span', { class: 'orca-agent-txt' },
        h('b', null, c.name),
        h('span', { class: 'orca-agent-sub' }, c.hint)),
      isDef ? h('span', { class: 'orca-chk', 'aria-hidden': 'true' }, '✓') : null);
    };

    const card = (c) => {
      const on = ob.ais.has(c.key);
      return h('button', { type: 'button', class: `ai-card${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', 'data-ai': c.key, disabled: missingLocal(c),
        onclick: () => { if (on) { ob.ais.delete(c.key); if (ob.defaultAi === c.key) ob.defaultAi = [...ob.ais][0] || ''; } else ob.ais.add(c.key); render(); } },
      h('span', { class: 'box', 'aria-hidden': 'true' }, on ? '✓' : ''),
      h('b', null, c.name), h('span', { class: 'small muted' }, c.hint),
      ob.defaultAi === c.key ? h('span', { class: 'tag solid' }, '기본 에이전트') : found(c) ? h('span', { class: 'tag' }, '이 컴퓨터에서 찾았어요') : missingLocal(c) ? h('span', { class: 'small muted' }, '이 컴퓨터에 없어요') : null);
    };
    const sorted = ob.det ? [...foundList, ...restList] : [];
    return obShell(2, '첫 번째 기본 에이전트를 고르세요.', '이 컴퓨터에 설치된 실행 가능 AI를 먼저 찾았어요. 기본 에이전트를 1개 고르고, 함께 일할 AI 직원도 체크해 두세요.',
      ob.det ? h('div', null,
        foundList.length ? h('div', { class: 'orca-ob-box' },
          h('div', { class: 'orca-sec-meta' }, h('span', null, '기본 에이전트 (메인 AI)'), h('span', { class: 'orca-count' }, String(foundList.length))),
          h('div', { class: 'orca-grid' }, foundList.map(defCard))) : null,
        h('div', { class: 'orca-sec-meta coord-dlg-gap' }, h('span', null, '함께 일할 AI 직원 전체'), h('span', { class: 'orca-count' }, `${ob.ais.size}명 선택`)),
        h('div', { class: 'ai-grid' }, sorted.map(card)))
        : h('div', { class: 'small muted' }, '이 컴퓨터를 살펴보는 중'),
      [h('button', { class: 'btn', onclick: () => next(1) }, '이전'), h('button', { class: 'btn dark big', 'data-act': 'ob-next', disabled: !ob.ais.size,
        onclick: async () => { const r = await obSend({ name: ob.name, company: ob.company, ais: [...ob.ais], defaultAi: ob.defaultAi || undefined }); if (r) next(3); } }, ob.ais.size ? `${ob.ais.size}명 채용하고 다음` : 'AI를 골라 주세요')]);
  }

  if (ob.step === 3) {
    const det = ob.det || {};
    const M = det.thisMac || {};
    const hosts = det.sshHosts || [];
    const allBrowsers = det.browsers || [];
    const showBrowsers = allBrowsers.filter((b) => b.found || ['egolite', 'chrome'].includes(b.key));
    const foundOss = (det.openSource || []).filter((o) => o.found);
    const chips = ['Mac mini', 'Mac Studio', 'MacBook Pro', 'MacBook Air', 'Windows PC'];
    const toggle = (set, v) => { if (set.has(v)) set.delete(v); else set.add(v); render(); };
    const done = async () => { const r = await obSend({ machines: [...ob.machines], sshHosts: [...ob.ssh], browsers: [...ob.browsers], openSource: [...ob.oss] }); if (r) next(4); };
    return obShell(3, '컴퓨터와 도구를 확인해 주세요.', '이 컴퓨터는 메인 자원으로 자동 등록돼요. 웹 자동화에 쓸 브라우저와 설치된 도구를 골라 두면 바로 적용됩니다 (나중에 내 자원 탭에서 바꿀 수 있어요).',
      h('div', null,
        h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', null, '이 컴퓨터 · 본사'), h('span', { class: 'tag' }, '자동')),
          h('div', { class: 'small muted' }, [M.chip, M.memoryGB ? `메모리 ${M.memoryGB}GB` : '', M.diskFreeGB ? `여유 ${M.diskFreeGB}GB` : ''].filter(Boolean).join(' · ') || '읽는 중')),
        showBrowsers.length ? h('div', { class: 'ob-group' }, h('div', { class: 'small muted' }, '웹 확인 · 자동화에 쓸 브라우저 (Ego Lite 추천)'),
          h('div', { class: 'picker' }, showBrowsers.map((b) => h('button', { type: 'button', class: `chip${ob.browsers.has(b.key) ? ' on' : ''}`, 'aria-pressed': ob.browsers.has(b.key) ? 'true' : 'false', onclick: () => toggle(ob.browsers, b.key) },
            `${b.name}${b.found ? ' · 설치됨' : b.key === 'egolite' ? ' · 추천' : ''}`)))) : null,
        foundOss.length ? h('div', { class: 'ob-group' }, h('div', { class: 'small muted' }, '이 컴퓨터에서 찾은 오픈소스 도구 (알맞은 일에 알아서 씀)'),
          h('div', { class: 'picker' }, foundOss.map((o) => h('button', { type: 'button', class: `chip${ob.oss.has(o.key) ? ' on' : ''}`, 'aria-pressed': ob.oss.has(o.key) ? 'true' : 'false', onclick: () => toggle(ob.oss, o.key) }, o.name)))) : null,
        hosts.length ? h('div', { class: 'ob-group' }, h('div', { class: 'small muted' }, 'ssh 설정에서 찾은 컴퓨터 (이름만 읽었어요, 접속은 하지 않아요)'),
          h('div', { class: 'picker' }, hosts.map((a) => h('button', { type: 'button', class: `chip${ob.ssh.has(a) ? ' on' : ''}`, 'aria-pressed': ob.ssh.has(a) ? 'true' : 'false', onclick: () => toggle(ob.ssh, a) }, a)))) : null,
        h('div', { class: 'ob-group' }, h('div', { class: 'small muted' }, '다른 컴퓨터가 있으면 골라 주세요 (없으면 그대로 확인).'),
          h('div', { class: 'picker' }, chips.map((c) => h('button', { type: 'button', class: `chip${ob.machines.has(c) ? ' on' : ''}`, 'aria-pressed': ob.machines.has(c) ? 'true' : 'false', onclick: () => toggle(ob.machines, c) }, c))))),
      [h('button', { class: 'btn', onclick: () => next(2) }, '이전'), h('button', { class: 'btn dark big', 'data-act': 'ob-next', onclick: done }, '확인')]);
  }

  if (ob.step === 4) {
    const from = h('input', { class: 'in', type: 'time', value: ob.quiet.from, 'data-k': 'ob-q-from', 'aria-label': '자는 시간 시작', oninput: (ev) => { ob.quiet.from = ev.target.value; } });
    const to = h('input', { class: 'in', type: 'time', value: ob.quiet.to, 'data-k': 'ob-q-to', 'aria-label': '자는 시간 끝', oninput: (ev) => { ob.quiet.to = ev.target.value; } });
    const done = async () => {
      const r = await obSend({ quiet: ob.quiet });
      if (!r) return;
      ob.connect = null;
      ob.skippedConnect = false;
      next(5);
    };
    return obShell(4, '몇 시에 자나요?', '이 시간에는 AI가 대표님을 부르지 않아요. 일은 계속하고, 메시지와 확인 요청은 아침에 볼 수 있게 남겨 둬요.',
      h('div', { class: 'ob-quiet' }, h('label', { class: 'field' }, '자는 시간', from), h('span', { class: 'muted', 'aria-hidden': 'true' }, '~'), h('label', { class: 'field' }, '일어나는 시간', to)),
      [h('button', { class: 'btn', onclick: () => next(3) }, '이전'), h('button', { class: 'btn dark big', 'data-act': 'ob-next', onclick: done }, '다음')]);
  }

  if (ob.step === 5) {
    const refreshConnect = (autoSkip = false) => {
      ob.connect = { loading: true };
      render();
      fetch('/api/onboard/connect').then((r) => r.json()).then((c) => {
        ob.connect = c;
        const foundList = (c.targets || []).filter((t) => t.found);
        if (autoSkip && !foundList.length && ob.step === 5) {
          ob.skippedConnect = true;
          ob.step = 6;
        }
        render();
      }).catch(() => { ob.connect = { targets: [] }; render(); });
    };
    if (!ob.connect) {
      ob.connect = { loading: true };
      fetch('/api/onboard/connect').then((r) => r.json()).then((c) => {
        ob.connect = c;
        const foundList = (c.targets || []).filter((t) => t.found);
        if (!foundList.length && ob.step === 5) {
          ob.skippedConnect = true;
          ob.step = 6;
        }
        render();
      }).catch(() => { ob.connect = { targets: [] }; render(); });
    }
    const list = (ob.connect.targets || []).filter((t) => t.found);
    const pending = list.filter((t) => !(t.mcp.configured && (!t.skill || t.skill.installed)));
    const oneLineCmd = ob.connect.terminal || 'npx github:wonseokjung/connect-ai-autonomous-company connect --yes';
    const row = (t) => {
      const done = t.mcp.configured && (!t.skill || t.skill.installed);
      const open = ob.open[t.key];
      return h('div', { class: 'ob-conn' },
        h('div', { class: 'row' }, h('div', null, h('b', null, t.name), h('div', { class: 'small muted' }, `${t.employee}${t.skill ? ' · MCP + 스킬' : ' · MCP'}`)),
          done ? h('span', { class: 'tag solid' }, '연결됨')
            : h('button', { type: 'button', class: `btn sm${open ? '' : ' dark'}`, 'aria-expanded': open ? 'true' : 'false', onclick: () => { ob.open[t.key] = !open; render(); } }, open ? '접기' : '개별 명령')),
        open && !done ? h('div', { class: 'ob-cmds' },
          !t.mcp.configured ? (t.mcp.line ? copyBlock('MCP', t.mcp.line) : copyBlock(`MCP (${t.mcp.file})`, t.mcp.snippet)) : null,
          t.skill && !t.skill.installed ? copyBlock('스킬', t.skill.line) : null) : null);
    };
    return obShell(5, '바이브코딩 툴을 한 번에 연결할까요?', '아직 아무 설정도 바꾸지 않았어요. 아래 터미널 한 줄을 실행하면 감지된 툴 전체에 .bak 백업 후 안전하게 한 번에 연결됩니다.',
      ob.connect.loading ? h('div', { class: 'small muted' }, '이 컴퓨터를 살펴보는 중')
        : list.length ? h('div', null,
          pending.length ? copyBlock(`터미널 한 줄로 감지된 ${pending.length}개 툴 한 번에 연결`, oneLineCmd) : null,
          h('div', { class: 'row', style: 'justify-content:flex-end;margin:8px 0' },
            h('button', { type: 'button', class: 'btn sm', onclick: () => refreshConnect(false) }, '연결 다시 확인')),
          list.map(row))
          : h('div', { class: 'card small muted' }, '이 컴퓨터에서 연결할 AI 도구를 찾지 못했어요. 웹에서 쓰는 AI는 할 일에서 지시문을 복사해서 맡기면 돼요.'),
      [h('button', { class: 'btn', onclick: () => next(4) }, '이전'), h('button', { class: 'btn dark big', 'data-act': 'ob-next', onclick: () => next(6) }, '다음')]);
  }

  const finishWithRoutines = () => once('ob-done', async () => {
    const picked = STARTER_ROUTINES.filter((x) => ob.routines.has(x.key)).map(({ title, time, intervalMin, instruction }) => ({ title, time, intervalMin, instruction }));
    if (picked.length) await obSend({ routines: picked });
    await act('PATCH', '/api/ui/settings', { onboarded: true }, '본사를 열었어요');
    ui.ob = null;
    location.hash = '#home';
  });
  return obShell(6, '돈과 공개는 대표님 손으로만', '결제, 업로드, 게시, 삭제, 메시지 발송이 들어간 일은 대표님이 누를 때까지 AI가 시작하지 못해요. 원하시면 첫 자동 루틴도 하나 골라 바로 시작해 보세요.',
    h('div', null,
      h('div', { class: 'ob-assign' }, h('span', { class: 'who-chip ai' }, 'AI'), h('div', null, h('b', null, '광고비 5만원 결제'), h('div', { class: 'small muted' }, '결제가 들어간 일 → 사람')), h('span', { class: 'btn sm dark', 'aria-hidden': 'true' }, '결제 확인')),
      h('div', { class: 'ob-group' }, h('div', { class: 'small muted' }, '첫 자동 루틴 하나 담아 볼까요? (선택, 프롬프트까지 채워서 들어갑니다)'),
        h('div', { class: 'ob-routines' }, STARTER_ROUTINES.map((rt) => {
          const on = ob.routines.has(rt.key);
          const sched = rt.intervalMin ? `${rt.intervalMin}분마다` : rt.time;
          return h('button', { type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onclick: () => { if (on) ob.routines.delete(rt.key); else ob.routines.add(rt.key); render(); } }, `${sched} · ${rt.title}`);
        })))),
    [h('button', { class: 'btn', onclick: () => next(ob.skippedConnect ? 4 : 5) }, '이전'), h('button', { class: 'btn dark big', 'data-act': 'ob-finish', onclick: finishWithRoutines }, '알겠어요, 본사 열기')]);
}

// ───────── 라우팅 ─────────

function readHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [routeRaw, ...rest] = raw.split('/');
  const route = routeRaw === 'automations' ? 'daily' : routeRaw;
  const next = route || 'home';
  if (next !== ui.route) { ui.open = null; ui.picking = null; ui.rtPicking = null; ui.editingEmp = null; ui.empDraftEngine = {}; window.scrollTo(0, 0); }
  if (next === 'resources') ui.office = null;
  ui.route = next;
  ui.param = rest.join('/');
  if (next === 'home' && /^t\d+$/.test(ui.param)) ui.open = ui.param;
}

window.addEventListener('hashchange', () => {
  const dlg = document.getElementById('dlg');
  if (dlg?.open) { dlg.className = ''; dlg.close(); }
  readHash();
  render();
});
document.getElementById('dlg')?.addEventListener('close', (e) => {
  e.currentTarget.className = '';
  if (ui.pendingRender) { ui.pendingRender = false; render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const dlg = document.getElementById('dlg');
  if (dlg && dlg.open) return;
  const active = document.activeElement;
  if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) { active.blur(); return; }
  if (ui.picking || ui.rtPicking || ui.open) { ui.picking = null; ui.rtPicking = null; ui.open = null; render(); }
});
readHash();
load();

// 1초마다 실행 중인 AI 경과 타이머만 가볍게 갱신 (네트워크 요청 없음)
setInterval(() => {
  if (!S?.working?.length) return;
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-live-since]')) {
    const since = Date.parse(el.getAttribute('data-live-since') || '');
    if (!Number.isFinite(since)) continue;
    const prefix = el.getAttribute('data-live-prefix') || '';
    el.textContent = `${prefix}${fmtElapsedSec(Math.max(0, Math.floor((now - since) / 1000)))}`;
  }
}, 1000);

// 새 소식: AI가 실시간 일할 땐 2초, 배분/열림 중엔 4초, 평소엔 30초
let tick = 0;
setInterval(() => {
  tick++;
  const working = !!(S && S.working.length);
  const active = !!(S && (S.assigning.length || ui.open));
  if (document.hidden && !working && !active) return;
  if (working || (active && tick % 2 === 0) || tick % 15 === 0) {
    load({ background: true }).catch(() => {});
  }
}, 2000);
