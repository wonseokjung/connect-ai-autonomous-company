// 브라우저(Ego Lite, Aside 등)와 내가 설치한 오픈소스 도구/스킬 자동 감지 및 매칭.
// 읽기만 한다. 설정 파일이나 스킬을 임의로 고치거나 설치하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { findBin } from './agents.mjs';

export const BROWSER_CATALOG = [
  { key: 'eldo', name: 'ELDO', hint: 'AI 직원 전용 브라우저 · 1회 로그인 · 금색 작업 공간 (eldobrowser.com)', bin: 'eldo', altBin: 'cab', appPath: '/Applications/ELDO.app', altAppPath: path.join(os.homedir(), 'Applications', 'ELDO.app'), envVar: 'AIHQ_ELDO_BIN', command: 'eldo nodejs', guide: 'eldo-browser skill (https://eldobrowser.com)' },
  { key: 'ego-lite', name: 'Ego Lite', hint: '로그인한 사이트를 AI와 함께 보기 · 스페이스 지원', bin: 'ego-browser', appPath: '/Applications/Ego Lite.app', envVar: 'AIHQ_EGO_BIN', command: 'ego-browser nodejs', guide: 'ego-browser skill' },
  { key: 'aside', name: 'Aside', hint: 'AI가 따로 띄워 웹 확인 · 자동화', bin: 'aside', appPath: '/Applications/Aside.app', envVar: 'AIHQ_ASIDE_BIN', command: 'aside', guide: 'aside' },
  { key: 'chrome', name: 'Chrome', hint: '평소 쓰는 크롬 · Chrome DevTools MCP 연동', bin: 'google-chrome', appPath: '/Applications/Google Chrome.app', envVar: null, command: '', guide: 'Chrome DevTools MCP 또는 브라우저 창' },
  { key: 'dia', name: 'Dia', hint: 'AI 내장 브라우저 · 웹 리서치', bin: null, appPath: '/Applications/Dia.app', envVar: null, command: '', guide: 'Dia 브라우저 창' },
  { key: 'comet', name: 'Comet', hint: 'Perplexity AI 브라우저 · 검색·자동화', bin: null, appPath: '/Applications/Comet.app', envVar: null, command: '', guide: 'Comet 브라우저 창' },
  { key: 'arc', name: 'Arc', hint: '스페이스 기반 웹 브라우저', bin: null, appPath: '/Applications/Arc.app', envVar: null, command: '', guide: 'Arc 브라우저 스페이스' },
  { key: 'safari', name: 'Safari', hint: 'macOS 기본 웹 브라우저', bin: null, appPath: '/System/Volumes/Preboot/Cryptexes/App/System/Applications/Safari.app', altAppPath: '/Applications/Safari.app', envVar: null, command: '', guide: 'Safari 창' },
];

export const PHONE_MODES = [
  { key: 'iphone-mirror', name: '아이폰 미러링 (Computer Use)', short: '아이폰 미러링', hint: '맥의 iPhone Mirroring 창을 Computer Use로 조작' },
  { key: 'android-adb', name: '안드로이드 (adb · scrcpy)', short: '안드로이드', hint: 'USB·와이파이 연결된 안드로이드를 adb/scrcpy로 조작' },
  { key: 'mobile-ai', name: '모바일 AI (피클 등)', short: '모바일 AI', hint: '이동 중 스마트폰 전용 AI 직원에게 전달' },
];

// 자주 쓰는 오픈소스 도구/스킬의 쉬운 한국어 설명, GitHub 주소, 설치/점검(doctor) 명령, 입출력, 세부 스킬, 자동 매칭 키워드
export const OSS_CATALOG = [
  {
    key: 'connect-ai-writer',
    name: 'connect-ai-writer',
    roleLabel: 'AI 글쓰기 직원',
    team: 'marketing',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 집현전 글쓰기 학사',
    hint: '영상·자막·주제 하나로 트렌드·리서치·블로그·쓰레드·X·인스타·뉴스레터·동화까지 내 말투로 작성',
    when: '블로그 글 써 줘, 쓰레드 글, X 글, 뉴스레터, 리서치해서 글, 트렌드 찾아 줘, 팩트체크, AI 티 안 나게, 동화 써 줘, connect-ai-writer, AI 글쓰기 직원, 글쓰기 직원',
    command: 'npx github:wonseokjung/connect-ai-writer',
    installCmd: 'npx github:wonseokjung/connect-ai-writer install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-writer doctor',
    doctorExpect: 'ok',
    inputSpec: '영상·자막(.srt)·메모·주제 1줄',
    outputSpec: '네이버 블로그·쓰레드·X·인스타 초안 + 그림',
    computeHint: 'HQ (ELDO · Ego Lite 임시저장)',
    repo: 'https://github.com/wonseokjung/connect-ai-writer',
    skill: 'connect-ai-writer',
    subSkills: [
      { name: '트렌드 · 리서치', note: '구글 트렌드·출처 기반 팩트 시트 작성', when: '트렌드, 리서치, 팩트체크' },
      { name: '멀티채널 글쓰기', note: '내 말투표 기반 네이버 블로그·쓰레드·X·인스타·뉴스레터 초안', when: '블로그, 쓰레드, 뉴스레터' },
      { name: 'AI 티 제거 · 동화', note: '번역투 제거·숫자 검증·코드 일러스트 동화책 PDF', when: 'AI 티, 동화, 그림책' },
    ],
  },
  {
    key: 'connect-ai-xr',
    name: 'connect-ai-xr',
    roleLabel: 'AI XR 직원',
    team: 'design',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · Meta Quest WebXR',
    hint: '한 줄 설치로 내 가게·공간을 걸어 들어가는 Meta Quest WebXR 앱 자동 제작',
    when: 'XR 앱, WebXR, 메타 퀘스트, Meta Quest, 가상 공간, 공간 앱, 내 가게를 걸어 들어가는 공간, connect-ai-xr, XR 직원',
    command: 'npx github:wonseokjung/connect-ai-xr',
    installCmd: 'npx github:wonseokjung/connect-ai-xr install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-xr doctor',
    doctorExpect: 'Ready',
    inputSpec: '공간 콘셉트 · 가게 소개 · 3D 에셋',
    outputSpec: 'Meta Quest 실행 가능한 WebXR 공간 앱',
    computeHint: 'HQ (WebXR 빌드)',
    repo: 'https://github.com/wonseokjung/connect-ai-xr',
    skill: 'connect-ai-xr',
    subSkills: [
      { name: 'WebXR 공간 씬 제작', note: 'Meta Quest 브라우저에서 바로 걷는 인터랙티브 공간 구성', when: 'WebXR, 메타 퀘스트, 공간' },
      { name: '공간 쇼룸 · 인터랙션', note: '제품 배치·이동·클릭 안내가 포함된 XR 쇼룸 빌드', when: '쇼룸, 인터랙션' },
    ],
  },
  {
    key: 'connect-ai-video-motion',
    name: 'connect-ai-video-motion',
    roleLabel: 'AI 영상 편집 직원 · 2강',
    team: 'design',
    connectAiPack: true,
    published: true,
    publishNote: 'npm 0.3.0 · GitHub 공개',
    hint: '내 얼굴 나오는 영상에 몸 인식 모션그래픽·컷 편집·9:16 화면비 자동 편집',
    when: '이 영상에 모션그래픽 넣어줘, 컷 편집해줘, 숏츠로 만들어 줘, connect-ai-video-motion, 모션그래픽, 컷 편집, 토킹헤드, facecam, 9:16',
    command: 'npx connect-ai-video-motion',
    installCmd: 'npx connect-ai-video-motion install-skill',
    doctorCmd: 'npx connect-ai-video-motion doctor',
    doctorExpect: 'Ready',
    inputSpec: '내 얼굴 나오는 영상(mp4/mov)',
    outputSpec: '편집된 영상 + 9:16',
    computeHint: '렌더는 Office 1(맥 스튜디오), 가벼운 건 HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-video-motion',
    skill: 'connect-ai-video-motion',
    subSkills: [
      { name: '몸 인식 모션그래픽', note: '얼굴, 몸, 손을 피해서 빈자리에 제품 이름, 로고', when: '몸 인식, 모션그래픽, 제품 이름, 로고' },
      { name: '컷 편집', note: '말을 글로 바꿔서 필요 없는 부분 자르기', when: '컷 편집, 컷편집, 필요 없는 부분 자르기' },
      { name: '화면비', note: '세로 9:16, 정사각형 1:1', when: '화면비, 9:16, 1:1, 숏츠, 정사각형' },
    ],
  },
  {
    key: 'connect-ai-motion',
    name: 'connect-ai-motion',
    roleLabel: 'AI 모션그래픽 직원 · 3강',
    team: 'design',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 83종 씬 카탈로그',
    hint: '촬영 영상 없이 대본 몇 줄로 16:9 · 9:16 모션그래픽 영상 자동 제작',
    when: '글 몇 줄 모션그래픽, 이 대본으로 모션그래픽 영상, 영상 없이 모션그래픽, connect-ai-motion, 텍스트 모션그래픽, 타이포 영상 만들어 줘',
    command: 'npx github:wonseokjung/connect-ai-motion',
    installCmd: 'npx github:wonseokjung/connect-ai-motion install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-motion doctor',
    doctorExpect: 'Ready',
    inputSpec: '글 몇 줄(대본 · 핵심 문구 · 음성)',
    outputSpec: '16:9 · 9:16 모션그래픽 영상(mp4)',
    computeHint: '렌더는 Office 1(맥 스튜디오), 가벼운 건 HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-motion',
    skill: 'connect-ai-motion',
    subSkills: [
      { name: '텍스트 → 모션그래픽', note: '글 몇 줄을 83종 씬 카탈로그로 모션 영상 자동 생성', when: '텍스트 모션, 타이포' },
      { name: '인트로 · 홍보 영상', note: '채널·가게·강의 홍보용 16:9 및 9:16 숏폼 렌더', when: '인트로, 홍보 영상, 자막 카드' },
    ],
  },
  {
    key: 'connect-ai-marketer',
    name: 'connect-ai-marketer',
    roleLabel: 'AI 마케터 직원',
    team: 'marketing',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 24시간 마케팅팀',
    hint: 'ELDO · Ego Lite 기반 댓글 답글 · X/스레드 리스닝 · 유튜브 벤치마크 · 업로드 마무리',
    when: '댓글 답글, 리스닝, 벤치마크, 업로드 마무리, 크로스포스팅, 마케팅팀, 홍보팀, connect-ai-marketer',
    command: 'npx github:wonseokjung/connect-ai-marketer',
    installCmd: 'npx github:wonseokjung/connect-ai-marketer setup',
    doctorCmd: 'npx github:wonseokjung/connect-ai-marketer doctor',
    doctorExpect: 'Ready',
    inputSpec: '유튜브 · 인스타 · X 링크 또는 채널 키워드',
    outputSpec: '댓글 답글 초안 · 벤치마크 리포트 · 전 채널 업로드 마무리',
    computeHint: 'ELDO · Ego Lite 연결된 HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-marketer',
    skill: 'connect-ai-marketer',
    subSkills: [
      { name: '댓글 답글', note: '인스타그램·유튜브 댓글 톤에 맞춰 답글 초안 작성', when: '인스타 댓글, 댓글 답글' },
      { name: '리스닝', note: 'X(트위터)·스레드 반응 및 키워드 모니터링', when: '리스닝, X 반응, 스레드' },
      { name: '벤치마크', note: '업로드 전 경쟁 유튜브 채널·조회수·훅 구조 분석', when: '벤치마크, 유튜브 분석' },
      { name: '업로드 마무리', note: '유튜브 제목·설명란·재생목록·태그 정리 및 크로스포스팅', when: '업로드 마무리, 크로스포스팅' },
    ],
  },
  {
    key: 'reversebusiness',
    name: 'reversebusiness',
    roleLabel: 'AI 사업 분석 직원',
    team: 'research',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 6칸 사업 해부',
    hint: '사이트 주소 하나를 받아 6칸 수익모델·사업 구조 해부 및 내 버전 비교',
    when: '이 사업 해부해 줘, 이 서비스 분석해 줘, 이 사업 어떻게 돈 버는지 읽어 줘, 역공학으로 비즈니스 읽기, 사업 해부, reversebusiness, rebiz',
    command: 'npx github:wonseokjung/reversebusiness <주소> --agent claude',
    installCmd: 'npx github:wonseokjung/reversebusiness --help',
    doctorCmd: 'npx github:wonseokjung/reversebusiness --version',
    doctorExpect: 'reversebusiness',
    inputSpec: '사업 웹사이트 주소(URL) 1개',
    outputSpec: '6칸 수익모델 해부(report.json) + 비교 화면 + 9:16 영상',
    computeHint: 'HQ (브라우저 해부)',
    repo: 'https://github.com/wonseokjung/reversebusiness',
    skill: 'reversebusiness',
    subSkills: [
      { name: '사업 구조 해부', note: '6칸 수익모델·가격·유입 구조 분석(report.json)', when: '사업 구조, 수익모델, 가격 분석' },
      { name: '내 버전 비교 · 겹침 검사', note: '원본 뼈대와 내 기획안 비교 및 겹침 검증', when: '겹침 검사, 내 버전 비교' },
      { name: '9:16 해부 영상 저장', note: '브라우저 해부 화면을 세로 9:16 영상으로 저장', when: '해부 영상, 9:16' },
    ],
  },
  {
    key: 'connect-ai-product-photo',
    name: 'connect-ai-product-photo',
    roleLabel: 'AI 상품 사진 직원',
    team: 'design',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 원본 라벨 유지 스튜디오 컷',
    hint: '폰 상품 사진 폴더를 원본 라벨 픽셀을 살린 쿠팡·스마트스토어·인스타 상품컷으로 완성',
    when: '상품 사진, 제품 촬영 컷, 상세페이지 사진, connect-ai-product-photo, AI 상품 사진 직원',
    command: 'npx github:wonseokjung/connect-ai-product-photo',
    installCmd: 'npx github:wonseokjung/connect-ai-product-photo install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-product-photo doctor',
    doctorExpect: 'Ready',
    inputSpec: '제품 원본 폰 사진 폴더 + 플랫폼 선택',
    outputSpec: '플랫폼별 스튜디오 연출 컷 · 업로드 리스트',
    computeHint: 'HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-product-photo',
    skill: 'connect-ai-product-photo',
    subSkills: [
      { name: '스튜디오 연출 컷', note: '원본 라벨 픽셀을 유지한 플랫폼별 상품 이미지 생성' },
    ],
  },
  {
    key: 'connect-ai-slides-web',
    name: 'connect-ai-slides-web',
    roleLabel: 'AI 발표 자료 직원 · 5강',
    team: 'plan',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 0.6.0 모션 웹 + PPTX',
    hint: '발표 메모나 기존 PPT를 3D 모션 웹 슬라이드와 실제 파워포인트(.pptx) 파일로 자동 제작',
    when: '웹 슬라이드, 발표 자료 제작, PPT 만들어 줘, connect-ai-slides-web, AI 발표 자료 직원',
    command: 'npx github:wonseokjung/connect-ai-slides-web',
    installCmd: 'npx github:wonseokjung/connect-ai-slides-web install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-slides-web doctor',
    doctorExpect: 'Ready',
    inputSpec: '발표 주제 · 개요(md/텍스트) 또는 기존 PPTX',
    outputSpec: '3D 모션 웹 프레젠테이션 · 편집 가능한 .pptx',
    computeHint: 'HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-slides-web',
    skill: 'connect-ai-slides-web',
    subSkills: [
      { name: '모션 웹 · PPTX 슬라이드', note: '개요를 그림·모션 중심 웹 덱과 파워포인트 파일로 변환' },
    ],
  },
  {
    key: 'connect-ai-three',
    name: 'connect-ai-three',
    roleLabel: 'AI 3D 웹 직원 · 4강',
    team: 'dev',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · Three.js 3D 웹 + 영상',
    hint: '말 한마디로 인터랙티브 Three.js 3D 웹 장면과 프레임 정확 영상을 동시 제작',
    when: 'three.js, 3d 웹 씬, connect-ai-three, AI 3D 웹 직원',
    command: 'npx github:wonseokjung/connect-ai-three',
    installCmd: 'npx github:wonseokjung/connect-ai-three',
    doctorCmd: 'npx github:wonseokjung/connect-ai-three doctor',
    doctorExpect: 'Ready',
    inputSpec: '3D 제품 · 인터랙션 콘셉트',
    outputSpec: '인터랙티브 Three.js 3D 웹 씬 + 영상',
    computeHint: '렌더는 Office 1(맥 스튜디오), 가벼운 건 HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-three',
    skill: 'connect-ai-three',
    subSkills: [
      { name: '3D 인터랙티브 씬', note: '브라우저에서 조작 가능한 3D 웹 장면과 턴테이블 영상 제작' },
    ],
  },
  {
    key: 'connect-ai-localizer',
    name: 'connect-ai-localizer',
    roleLabel: 'AI 번역 직원',
    team: 'marketing',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · EN · JP · ES 네이티브 현지화',
    hint: '한국어 글과 영상 자막을 내 말투 시트로 영어·일본어·스페인어 네이티브 게시글로 현지화',
    when: '해외 번역, 영어 버전, 일본어, 스페인어, 다국어 자막, 현지화, connect-ai-localizer, AI 번역 직원, 번역 직원',
    command: 'npx github:wonseokjung/connect-ai-localizer',
    installCmd: 'npx github:wonseokjung/connect-ai-localizer install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-localizer doctor',
    doctorExpect: 'Ready',
    inputSpec: '한국어 원고 · 자막(.srt)',
    outputSpec: '영어 · 일본어 · 스페인어 네이티브 게시글',
    computeHint: 'HQ',
    repo: 'https://github.com/wonseokjung/connect-ai-localizer',
    skill: 'connect-ai-localizer',
    subSkills: [
      { name: '글로벌 SNS · 블로그 현지화', note: '원문 숫자·톤을 유지한 영어·일본어·스페인어 네이티브 변환' },
    ],
  },
  {
    key: 'connect-ai-developer',
    name: 'connect-ai-developer',
    roleLabel: 'AI 개발 직원',
    team: 'dev',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 결제 · DB · 배포 풀스택',
    hint: '결제(토스·스트라이프·패들·폴라)·DB·GitHub·배포·주간 점검까지 연결하는 풀스택 AI 개발 직원',
    when: '웹서비스 만들어 줘, 결제 붙여 줘, 배포해 줘, connect-ai-developer, AI 개발 직원',
    command: 'npx github:wonseokjung/connect-ai-developer',
    installCmd: 'npx github:wonseokjung/connect-ai-developer install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-developer doctor',
    doctorExpect: 'ok',
    inputSpec: '서비스 기획 1줄 · 선택한 결제/DB/호스트',
    outputSpec: '로그인·DB·테스트 결제가 붙은 풀스택 서비스 + 배포 계획',
    computeHint: 'HQ (ELDO · gh CLI 연동)',
    repo: 'https://github.com/wonseokjung/connect-ai-developer',
    skill: 'connect-ai-developer',
    subSkills: [
      { name: '결제 · DB · 배포 연결', note: '카드 비교 선택 → 테스트 결제·웹훅 검증·안전 배포 계획' },
    ],
  },
  {
    key: 'connect-ai-accountant',
    name: 'connect-ai-accountant',
    roleLabel: 'AI 세무회계 직원',
    team: 'ops',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 홈택스 · 영수증 월마감',
    hint: 'ELDO 브라우저에서 홈택스·카드·이메일 영수증을 안전하게 모아 월 비용표와 세무사 제출 폴더 작성',
    when: '지난달 마감해 줘, 세무 직원, 세무회계 직원, 영수증 모아 줘, 홈택스 자료, connect-ai-accountant',
    command: 'npx github:wonseokjung/connect-ai-accountant',
    installCmd: 'npx github:wonseokjung/connect-ai-accountant install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-accountant doctor',
    doctorExpect: 'ok',
    inputSpec: '월/분기 기간 · 홈택스·카드·메일 영수증',
    outputSpec: '사업체별 월 비용표(.xlsx) · 대시보드 · 세무사 제출 패키지(.zip)',
    computeHint: 'HQ (ELDO 로그인 핸드오프)',
    repo: 'https://github.com/wonseokjung/connect-ai-accountant',
    skill: 'connect-ai-accountant',
    subSkills: [
      { name: '월마감 · 영수증 매칭', note: '개인·법인 사업체별 지출 매칭 및 빠진 증빙 자동 체크' },
    ],
  },
  {
    key: 'connect-ai-image',
    name: 'connect-ai-image',
    roleLabel: 'AI 이미지 직원',
    team: 'design',
    connectAiPack: true,
    published: true,
    publishNote: 'GitHub 공개 · 로컬 FLUX 무료 우선',
    hint: '로컬 ComfyUI + FLUX 무료 우선 또는 ELDO 브라우저 Gemini/ChatGPT로 플랫폼별 이미지 시리즈 제작',
    when: '썸네일 그려 줘, 이미지 만들어 줘, 카드뉴스 그림, connect-ai-image, AI 이미지 직원',
    command: 'npx github:wonseokjung/connect-ai-image',
    installCmd: 'npx github:wonseokjung/connect-ai-image install-skill',
    doctorCmd: 'npx github:wonseokjung/connect-ai-image doctor',
    doctorExpect: 'ok',
    inputSpec: '이미지 주제 1줄 · 플랫폼 비율 선택',
    outputSpec: '블로그·인스타·X·유튜브 썸네일 시리즈 + 컨택트 시트',
    computeHint: '로컬 ComfyUI 또는 ELDO 브라우저',
    repo: 'https://github.com/wonseokjung/connect-ai-image',
    skill: 'connect-ai-image',
    subSkills: [
      { name: '플랫폼별 브랜드 시리즈', note: 'ComfyUI FLUX 오프라인 무료 또는 ELDO 브라우저 생성' },
    ],
  },
  {
    key: 'connect-ai-blender',
    name: 'connect-ai-blender',
    roleLabel: 'AI 블렌더 직원',
    team: 'design',
    connectAiPack: true,
    published: false,
    publishNote: '비공개 · 공개 예정',
    hint: 'Blender 3D 모델링·조명·카메라·턴테이블 렌더링 자동화 (공개 예정)',
    when: '블렌더 자동화, connect-ai-blender, 3d 렌더 파이프라인',
    command: 'npx connect-ai-blender',
    installCmd: 'npx connect-ai-blender install-skill',
    doctorCmd: 'npx connect-ai-blender doctor',
    doctorExpect: 'Ready',
    inputSpec: '3D 장면 · 에셋 지시서',
    outputSpec: '블렌더 3D 렌더 영상 · 시안',
    computeHint: '렌더는 Office 1(맥 스튜디오)',
    skill: 'connect-ai-blender',
    subSkills: [
      { name: '3D 턴테이블 렌더', note: '블렌더 조명·카메라 자동화 및 고화질 렌더' },
    ],
  },
  {
    key: 'eldo',
    name: 'ELDO Hub (14 AI Employees)',
    team: 'ops',
    published: true,
    hint: 'ELDO 브라우저(eldobrowser.com) 및 14명 오픈소스 AI 직원 통합 설치 CLI · Control Plane SDK',
    when: 'eldo, 엘도, ai 직원 채용, 전체 팀 설치, 브라우저 연결',
    command: 'npx github:wonseokjung/eldo',
    repo: 'https://github.com/wonseokjung/eldo',
    skill: 'eldo-browser',
    subSkills: ['14명 AI 직원 원클릭 채용', 'ELDO 로컬 Control Plane SDK'],
  },
  { key: 'remotion', name: 'Remotion', team: 'design', published: true, hint: 'React 코드로 모션그래픽·쇼츠 영상 자동 생성', when: '리모션, remotion, 모션그래픽, 모션 그래픽, 영상편집, 영상 편집, 코드 영상, 쇼츠, 인트로, 영상 렌더링', command: 'npx remotion', repo: 'https://github.com/remotion-dev/remotion', subSkills: ['쇼츠 9:16 렌더링', '키네틱 타이포 인트로', '데이터 차트 씬'] },
  { key: 'hyperframes', name: 'Hyperframes', team: 'design', published: true, hint: 'HTML/코드 기반 모션그래픽·자막 영상 제작', when: '모션그래픽, 모션 그래픽, 하이퍼프레임, hyperframes, 인트로, 자막 모션, 영상 템플릿, 영상편집', command: 'npx hyperframes', repo: 'https://github.com/heygen-com/hyperframes', subSkills: ['미니멀 자막 카드', '슬라이드 모션 인트로'] },
  { key: 'ffmpeg', name: 'ffmpeg', team: 'design', published: true, hint: '영상·소리 자르기, 합치기, 인코딩 변환', when: '영상편집, 영상 편집, 영상 변환, 자르기, 클립, ffmpeg, 인코딩, 소리 추출, 컷편집', bin: 'ffmpeg', command: 'ffmpeg', repo: 'https://github.com/FFmpeg/FFmpeg', subSkills: ['무음 컷편집', '오디오 추출·정규화', '쇼츠 비율 변환'] },
  { key: 'blender', name: 'Blender', team: 'design', published: true, hint: '3D 모델·모션·영상 렌더링', when: '3d, 블렌더, blender, 렌더, 모델링, 애니메이션', bin: 'blender', command: 'blender', repo: 'https://github.com/blender/blender', subSkills: ['3D 제품 턴테이블', '장면 조명·카메라 렌더'] },
  { key: 'yt-dlp', name: 'yt-dlp', team: 'marketing', published: true, hint: '유튜브·SNS 영상 및 자막 내려받기', when: '자막, 영상 다운, yt-dlp, 유튜브 다운, 벤치마크 영상', bin: 'yt-dlp', command: 'yt-dlp', repo: 'https://github.com/yt-dlp/yt-dlp', subSkills: ['유튜브 자막 추출', '벤치마크 영상 다운로드'] },
  { key: 'whisper', name: 'Whisper', team: 'plan', published: true, hint: '음성·영상을 텍스트·자막(SRT)으로 받아쓰기', when: '받아쓰기, 녹취, 음성 텍스트, whisper, 자막 생성, 대본 추출', bin: 'whisper', command: 'whisper', repo: 'https://github.com/openai/whisper', subSkills: ['한국어 SRT 자막 생성', '강의 녹취록 정리'] },
  { key: 'orca-computer', name: 'Orca Computer Use', team: 'ops', published: true, hint: '로컬 맥 앱 · 아이폰 미러링 창 접근성 트리 조작', when: '컴퓨터 유즈, 화면 조작, 아이폰 미러링, 데스크탑 앱, orca computer', bin: 'orca', command: 'orca computer', repo: 'https://github.com/stablyai/orca', subSkills: ['맥 앱 UI 자동 조작', '아이폰 미러링 제어'] },
  { key: 'playwright', name: 'Playwright', team: 'dev', published: true, hint: '브라우저 자동화 · 웹 E2E 테스트 · 스크린샷', when: '브라우저 자동화, 웹 테스트, e2e, playwright, 플레이라이트, 크롤링', command: 'npx playwright', repo: 'https://github.com/microsoft/playwright', subSkills: ['웹 E2E 자동 검증', '화면 캡처 · 회귀 확인'] },
  { key: 'firecrawl', name: 'Firecrawl', team: 'research', published: true, hint: '웹페이지를 AI가 읽기 좋은 마크다운으로 수집', when: '웹 수집, 크롤링, 스크래핑, firecrawl, 문서 수집, 리서치', command: 'npx firecrawl', repo: 'https://github.com/mendableai/firecrawl', subSkills: ['사이트 전체 마크다운 수집', '구조화 데이터 추출'] },
  { key: 'reverse-engineer-anything', name: 'REA (구조 분석)', team: 'research', published: true, hint: '앱·웹·프로그램 내부 구조 분석', when: '역공학, 구조 분석, 앱 분석, 디컴파일, rea', skill: 'reverse-engineer-anything', subSkills: ['웹 번들 · API 구조 분석', '데스크탑 UI 트리 관찰'] },
];

export const CONNECT_AI_SKILL_KEYS = OSS_CATALOG.filter((c) => c.connectAiPack).map((c) => c.key);

export const DESIGN_PRESETS = [
  {
    key: 'connect-minimal',
    name: 'CONNECT AI 흑백 미니멀',
    rules: '흰 배경(#fff), 검정 글자(#111), 넓은 여백, 불필요한 그라데이션·이모지 남발 금지, 한눈에 읽히는 표와 카드 중심.',
    assetPath: '',
    refUrl: '',
  },
  {
    key: 'youtube-thumb',
    name: '유튜브 썸네일 · 고대비',
    rules: '핵심 키워드 3~5단어 큰 글씨, 인물/캐릭터 1명 클로즈업, 배경 단순화, 모바일 작은 화면에서도 즉시 읽히는 고대비 배색.',
    assetPath: '',
    refUrl: '',
  },
  {
    key: 'shorts-vertical',
    name: '9:16 숏폼 · 자막 중심',
    rules: '세로 1080x1920, 첫 2초 후크 문구 상단 고정, 하단 안전영역 위 굵은 자막, 네이버 클립·쇼츠·릴스 공통 규격.',
    assetPath: '',
    refUrl: '',
  },
];

// 안전한 스킬/저장소 URL 검증 (https:// 만 허용, javascript:/file:/data: 차단)
export function sanitizeSkillRepoUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s)) return `https://github.com/${s}`;
  if (/^github:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/i.test(s)) return `https://github.com/${s.slice(7)}`;
  if (!/^https:\/\/\S+$/i.test(s)) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return '';
    return u.href.replace(/\.git$/i, '').slice(0, 400);
  } catch {
    return '';
  }
}

// GitHub 주소(모노레포 하위 폴더 포함), owner/repo, 또는 npx 명령 1줄에서 이름·저장소·실행 명령 자동 추출
export function parseOpenSourceInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return { name: '', repo: '', command: '' };
  const ghUrl = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(\/.*)?$/i.exec(s);
  if (ghUrl) {
    const owner = ghUrl[1];
    const repoName = ghUrl[2];
    const subpath = (ghUrl[3] || '').replace(/\/+$/, '');
    const subParts = subpath.split('/').filter(Boolean);
    // 모노레포 하위 스킬 폴더(예: /tree/main/skills/video-edit)가 있으면 폴더 이름을 스킬 이름으로 추천하고 원본 링크 유지
    const subLeaf = subParts.length >= 3 && (subParts[0] === 'tree' || subParts[0] === 'blob')
      ? subParts[subParts.length - 1].replace(/\.(md|mjs|js|ts|py)$/i, '')
      : '';
    const keepSub = subParts.length >= 3 && (subParts[0] === 'tree' || subParts[0] === 'blob');
    return {
      name: subLeaf && subLeaf.toLowerCase() !== 'skill' ? subLeaf : repoName,
      repo: keepSub ? `https://github.com/${owner}/${repoName}${subpath}` : `https://github.com/${owner}/${repoName}`,
      command: `npx github:${owner}/${repoName}`,
    };
  }
  const ghShort = /^(?:npx\s+(?:-y\s+)?)?github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i.exec(s);
  if (ghShort) {
    return {
      name: ghShort[2],
      repo: `https://github.com/${ghShort[1]}/${ghShort[2]}`,
      command: s.startsWith('npx') ? s : `npx ${s}`,
    };
  }
  const ownerRepo = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s);
  if (ownerRepo && !s.startsWith('@')) {
    return {
      name: ownerRepo[2],
      repo: `https://github.com/${ownerRepo[1]}/${ownerRepo[2]}`,
      command: `npx github:${ownerRepo[1]}/${ownerRepo[2]}`,
    };
  }
  const npxCmd = /^npx\s+(?:-y\s+)?(@?[A-Za-z0-9_./@-]+)/i.exec(s);
  if (npxCmd) {
    const pkg = npxCmd[1].split('/').pop().replace(/@[^@]+$/, '');
    return { name: pkg || s, repo: '', command: s };
  }
  if (/^https:\/\/\S+$/i.test(s)) {
    const clean = sanitizeSkillRepoUrl(s);
    const tail = clean ? new URL(clean).pathname.split('/').filter(Boolean).pop() || '' : '';
    return { name: tail || s.slice(0, 60), repo: clean, command: '' };
  }
  return { name: s, repo: '', command: '' };
}

export function normalizeSubSkills(raw) {
  if (!raw) return [];
  let arr;
  if (typeof raw === 'string') {
    // 줄바꿈이 있으면 줄 단위(이름: 설명 안에 쉼표 허용), 한 줄이면 쉼표 단위
    arr = raw.includes('\n')
      ? raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : raw.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    arr = Array.isArray(raw) ? raw : [];
  }
  const out = [];
  const seen = new Set();
  for (let i = 0; i < arr.length && out.length < 24; i++) {
    const item = arr[i];
    let obj;
    if (typeof item === 'string') {
      const cleaned = item.replace(/^\s*\d+[.)]\s*/, '').trim();
      // "이름: 설명" 구분 시 "9:16", "1:1" 같은 숫자 비율 콜론은 절대 자르지 않는다
      const sepMatch = /^(.{2,44}?)(?<!\d):\s+(.+)$/.exec(cleaned);
      if (sepMatch) {
        obj = { name: sepMatch[1].trim(), note: sepMatch[2].trim() };
      } else {
        obj = { name: cleaned };
      }
    } else {
      obj = item && typeof item === 'object' ? item : null;
    }
    if (!obj) continue;
    const name = String(obj.name || '').trim().slice(0, 80);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(obj.id || `sub_${i + 1}_${key.replace(/[^a-z0-9가-힣]+/g, '').slice(0, 10) || 's'}`).slice(0, 40),
      name,
      when: String(obj.when || '').trim().slice(0, 180),
      command: String(obj.command || '').trim().slice(0, 180),
      note: String(obj.note || obj.desc || '').trim().slice(0, 240),
    });
  }
  return out;
}

export function normalizeEmployeeSkill(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw.sourceInput || raw.repo ? parseOpenSourceInput(raw.sourceInput || raw.repo) : { name: '', repo: '', command: '' };
  const presetObj = raw.preset ? OSS_CATALOG.find((c) => c.key === raw.preset) : null;
  const name = String(raw.name || parsed.name || presetObj?.name || '').trim().slice(0, 80);
  if (!name) return null;
  const repo = sanitizeSkillRepoUrl(raw.repo || parsed.repo || presetObj?.repo || '');
  const command = String(raw.command ?? parsed.command ?? presetObj?.command ?? '').trim().slice(0, 240);
  const roleLabel = String(raw.roleLabel ?? presetObj?.roleLabel ?? '').trim().slice(0, 80);
  const installCmd = String(raw.installCmd ?? presetObj?.installCmd ?? '').trim().slice(0, 240);
  const doctorCmd = String(raw.doctorCmd ?? presetObj?.doctorCmd ?? '').trim().slice(0, 240);
  const doctorExpect = String(raw.doctorExpect ?? presetObj?.doctorExpect ?? 'Ready').trim().slice(0, 60);
  const inputSpec = String(raw.inputSpec ?? presetObj?.inputSpec ?? '').trim().slice(0, 180);
  const outputSpec = String(raw.outputSpec ?? presetObj?.outputSpec ?? '').trim().slice(0, 180);
  const computeHint = String(raw.computeHint ?? presetObj?.computeHint ?? '').trim().slice(0, 180);
  const published = raw.published !== undefined
    ? Boolean(raw.published)
    : (raw.doctorStatus === 'upcoming' || raw.status === 'upcoming' ? false : (presetObj?.published !== undefined ? Boolean(presetObj.published) : true));
  const publishNote = String(raw.publishNote ?? presetObj?.publishNote ?? (published ? '' : '공개 전 · 준비 중')).trim().slice(0, 120);
  const rawDoc = String(raw.doctorStatus || '').trim();
  const doctorStatus = !published
    ? 'upcoming'
    : (['ready', 'missing', 'unchecked'].includes(rawDoc) ? rawDoc : 'unchecked');
  const doctorCheckedAt = raw.doctorCheckedAt ? String(raw.doctorCheckedAt).slice(0, 40) : null;
  const doctorOutput = String(raw.doctorOutput || '').trim().slice(0, 240);
  const installedAt = raw.installedAt ? String(raw.installedAt).slice(0, 40) : null;
  const when = String(raw.when ?? presetObj?.when ?? '').trim().slice(0, 360);
  const note = String(raw.note ?? presetObj?.hint ?? '').trim().slice(0, 260);
  const skillPath = String(raw.skillPath || '').trim().slice(0, 300);
  const primary = raw.primary !== undefined ? Boolean(raw.primary) : Boolean(presetObj?.connectAiPack);
  const subSkills = normalizeSubSkills(raw.subSkills !== undefined ? raw.subSkills : presetObj?.subSkills);
  const addedBy = raw.addedBy === 'ai' ? 'ai' : 'jay';
  const id = String(raw.id || `sk_${idx + 1}_${name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '').slice(0, 12) || 'item'}`).slice(0, 48);
  return {
    id, name, preset: String(raw.preset || presetObj?.key || '').slice(0, 60),
    roleLabel, repo, command, installCmd, doctorCmd, doctorExpect,
    inputSpec, outputSpec, computeHint, published, publishNote,
    doctorStatus, doctorCheckedAt, doctorOutput, installedAt,
    when, note, skillPath, primary, subSkills, addedBy,
  };
}

// 안전한 읽기 전용 doctor 점검 (셸 실행 없음, 공개 전 스킬은 즉시 upcoming 반환)
const UNSAFE_ARG_RE = /[;&|$`><\r\n]/;
export function runSkillDoctor(skill, { home = os.homedir(), cwd = process.cwd(), timeoutMs = 12000 } = {}) {
  const checkedAt = new Date().toISOString();
  if (!skill || skill.published === false || skill.doctorStatus === 'upcoming') {
    return Promise.resolve({
      status: 'upcoming',
      ready: false,
      checkedAt,
      output: skill?.publishNote || '아직 공개 전(준비 중) 스킬입니다. 공개 후 점검할 수 있어요.',
    });
  }
  const localSkills = scanLocalSkills({ home, cwd });
  const keyLow = String(skill.preset || skill.name || '').toLowerCase();
  const localHit = localSkills.find((s) => s.key === keyLow || s.name.toLowerCase() === keyLow);

  const docCmd = String(skill.doctorCmd || '').trim();
  const expectRe = new RegExp(String(skill.doctorExpect || 'Ready').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  if (process.env.AIHQ_NO_DOCTOR_EXEC === '1' || !docCmd || UNSAFE_ARG_RE.test(docCmd)) {
    if (localHit) {
      return Promise.resolve({
        status: 'ready',
        ready: true,
        checkedAt,
        output: `Ready · 로컬 스킬 설치 확인 (${localHit.name})`,
      });
    }
    return Promise.resolve({
      status: 'missing',
      ready: false,
      checkedAt,
      output: docCmd ? '자동 점검 생략됨 · 터미널에서 점검 명령을 실행해 주세요' : '점검 명령이 설정되지 않았습니다',
    });
  }

  const parts = docCmd.split(/\s+/).filter(Boolean);
  const head = parts[0];
  if (head !== 'npx' && !['ffmpeg', 'blender', 'yt-dlp', 'whisper', 'orca'].includes(head)) {
    return Promise.resolve({
      status: localHit ? 'ready' : 'missing',
      ready: Boolean(localHit),
      checkedAt,
      output: localHit ? `Ready · 로컬 스킬 확인 (${localHit.name})` : `지원하지 않는 점검 명령(${head})`,
    });
  }

  const binPath = findBin(head);
  if (!binPath) {
    return Promise.resolve({
      status: localHit ? 'ready' : 'missing',
      ready: Boolean(localHit),
      checkedAt,
      output: localHit ? `Ready · 로컬 스킬 확인 (${localHit.name})` : `${head} 실행 파일을 찾지 못했습니다`,
    });
  }

  const args = head === 'npx' ? ['--no-install', ...parts.slice(1)] : parts.slice(1);
  return new Promise((resolve) => {
    execFile(binPath, args, { timeout: timeoutMs, maxBuffer: 128 * 1024 }, (err, stdout, stderr) => {
      const combined = `${String(stdout || '')}\n${String(stderr || '')}`.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
      const firstLine = combined.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' · ').slice(0, 200);
      if (!err && (expectRe.test(combined) || combined.length > 0)) {
        resolve({
          status: 'ready',
          ready: true,
          checkedAt: new Date().toISOString(),
          output: expectRe.test(combined) ? (firstLine || 'Ready · 사용 가능') : `Ready · ${firstLine}`,
        });
        return;
      }
      if (localHit) {
        resolve({
          status: 'ready',
          ready: true,
          checkedAt: new Date().toISOString(),
          output: `Ready · 로컬 스킬 설치 확인 (${localHit.name})`,
        });
        return;
      }
      resolve({
        status: 'missing',
        ready: false,
        checkedAt: new Date().toISOString(),
        output: firstLine || (skill.installCmd ? `설치 필요: ${skill.installCmd}` : '점검 실패 · 설치 후 다시 확인해 주세요'),
      });
    });
  });
}

export function matchEmployeeSkills(text, emp, tokenize) {
  const skills = Array.isArray(emp?.skills) ? emp.skills : [];
  if (!skills.length) return [];
  const low = String(text || '').toLowerCase();
  const tt = tokenize ? tokenize(low) : low.split(/\s+/).filter((w) => w.length >= 2);
  const scored = [];
  for (const sk of skills) {
    // 규칙: 공개 안 된(준비 중) 스킬은 자동 배분에서 완전히 제외한다
    if (sk.published === false || sk.doctorStatus === 'upcoming') continue;
    let score = 0;
    const nm = String(sk.name || '').toLowerCase().trim();
    const preset = String(sk.preset || '').toLowerCase().trim();
    const cmd = String(sk.command || '').toLowerCase().trim();
    const repoLeaf = sk.repo ? sk.repo.split('/').filter(Boolean).pop().toLowerCase() : '';
    if (nm.length >= 2 && low.includes(nm)) score += 6;
    if (preset.length >= 2 && low.includes(preset)) score += 6;
    if (cmd.length >= 4 && low.includes(cmd)) score += 6;
    if (repoLeaf.length >= 3 && low.includes(repoLeaf)) score += 5;
    const phrases = String(sk.when || '').toLowerCase().split(/[,·/|]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
    for (const p of phrases) {
      if (low.includes(p)) { score += 4; continue; }
      const pt = tokenize ? tokenize(p) : p.split(/\s+/).filter((w) => w.length >= 2);
      if (pt.length && pt.every((w) => tt.some((x) => x === w || (w.length >= 2 && x.includes(w))))) score += 2;
    }
    // 세부 스킬(subSkills) 매칭
    const matchedSubs = [];
    for (const sub of (sk.subSkills || [])) {
      let subHit = false;
      const sn = String(sub.name || '').toLowerCase().trim();
      if (sn.length >= 2 && low.includes(sn)) { score += 5; subHit = true; }
      const subPhrases = `${sub.name || ''},${sub.when || ''}`.toLowerCase().split(/[,·/|]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
      for (const sp of subPhrases) {
        if (low.includes(sp)) { score += 3; subHit = true; break; }
        const spt = tokenize ? tokenize(sp) : sp.split(/\s+/).filter((w) => w.length >= 2);
        if (spt.length && spt.some((w) => w.length >= 2 && tt.some((x) => x === w || x.includes(w)))) {
          score += 2; subHit = true; break;
        }
      }
      if (subHit) matchedSubs.push(sub.name);
    }
    if (score > 0) {
      if (sk.primary) score += 2;
      if (sk.doctorStatus === 'ready') score += 2;
      scored.push({ sk: matchedSubs.length ? { ...sk, matchedSubSkills: matchedSubs } : sk, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.sk);
}

// SKILL.md 앞쪽 frontmatter 에서 name 과 description 한 줄만 가볍게 읽는다
function readSkillMeta(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8').slice(0, 2000); } catch { return null; }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!fm) return null;
  const pick = (k) => {
    const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm[1]);
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '').slice(0, 160) : '';
  };
  const name = pick('name');
  const description = pick('description');
  return name ? { name, description } : null;
}

const SKIP_SKILLS = new Set(['aihq-employee', 'ego-browser', 'swarm', 'swarm_monitor', 'hide', 'hide-issue', 'hide-mission']);

export function scanLocalSkills({ home = os.homedir(), cwd = process.cwd() } = {}) {
  const roots = [
    path.join(cwd, '.agents', 'skills'),
    path.join(home, '.agents', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.gemini', 'config', 'skills'),
  ];
  const seen = new Map();
  for (const dir of roots) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const skillFile = path.join(dir, ent.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      const meta = readSkillMeta(skillFile);
      const key = (meta?.name || ent.name).toLowerCase();
      if (SKIP_SKILLS.has(key) || seen.has(key)) continue;
      seen.set(key, { key, name: meta?.name || ent.name, description: meta?.description || '', skillPath: skillFile });
    }
  }
  return [...seen.values()];
}

function hasAppPath(p) {
  if (!p) return false;
  try { return fs.existsSync(p); } catch { return false; }
}

export function detectBrowsers() {
  const eldoHome = process.env.ELDO_HOME || process.env.CAB_HOME || path.join(os.homedir(), '.connect-ai', 'browser');
  return BROWSER_CATALOG.map((b) => {
    const cliFound = Boolean((b.bin && findBin(b.bin, b.envVar)) || (b.altBin && findBin(b.altBin, null)));
    const appFound = process.platform === 'darwin' && (hasAppPath(b.appPath) || hasAppPath(b.altAppPath));
    const runtimeFound = b.key === 'eldo' && hasAppPath(path.join(eldoHome, 'run.json'));
    return {
      ...b,
      cliFound,
      found: cliFound || appFound || runtimeFound,
    };
  });
}

// ELDO 브라우저 실시간 로컬 상태 확인 (읽기 전용: ~/.connect-ai/browser/run.json + /api/health)
export async function probeEldo({ home, timeoutMs = 2000 } = {}) {
  const dir = home || process.env.ELDO_HOME || process.env.CAB_HOME || path.join(os.homedir(), '.connect-ai', 'browser');
  const checkedAt = new Date().toISOString();
  const appFound = process.platform === 'darwin' && (hasAppPath('/Applications/ELDO.app') || hasAppPath(path.join(os.homedir(), 'Applications', 'ELDO.app')));
  const installed = Boolean(appFound || hasAppPath(dir) || findBin('eldo', 'AIHQ_ELDO_BIN') || findBin('cab', null));
  let run = null;
  try { run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8')); } catch {}
  const alive = (() => { if (!run?.daemonPid) return false; try { process.kill(run.daemonPid, 0); return true; } catch { return false; } })();
  if (!alive || !run?.proxyPort) {
    return {
      installed,
      connected: false,
      spaces: 0,
      checkedAt,
      downloadUrl: 'https://eldobrowser.com',
      reason: installed ? 'ELDO가 설치됨 · 현재 브라우저가 꺼져 있습니다' : 'ELDO가 설치되어 있지 않습니다 (https://eldobrowser.com)',
    };
  }
  try {
    const token = fs.readFileSync(path.join(dir, 'token'), 'utf8').trim();
    const res = await fetch(`http://127.0.0.1:${run.proxyPort}/api/health`, {
      headers: { 'x-cab-token': token, accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const data = await res.json();
      const sp = Number(data?.counts?.spaces) || 0;
      return {
        installed: true,
        connected: true,
        port: run.proxyPort,
        mode: data.mode || run.mode || 'ext',
        version: data.version || '',
        spaces: sp,
        crewReady: Number(data?.counts?.crewReady) || 0,
        crewTotal: Number(data?.counts?.crewTotal) || 14,
        checkedAt: new Date().toISOString(),
        reason: `ELDO 실시간 연결됨 (스페이스 ${sp}개)`,
      };
    }
  } catch {}
  return {
    installed: true,
    connected: false,
    port: run.proxyPort,
    spaces: 0,
    checkedAt: new Date().toISOString(),
    reason: 'ELDO 응답 대기 중입니다',
  };
}

// Ego Lite 실시간 IPC 접속 확인 (읽기 전용: 탭·창을 절대 열지 않고 listTaskSpaces만 확인)
let egoProbeCache = null;
let egoProbeAt = 0;
let egoProbeInflight = null;

export function clearEgoProbeCache() {
  egoProbeCache = null;
  egoProbeAt = 0;
}

export function probeEgoLite({ timeoutMs = 3500 } = {}) {
  const bin = findBin('ego-browser', 'AIHQ_EGO_BIN');
  const appFound = process.platform === 'darwin' && hasAppPath('/Applications/Ego Lite.app');
  const installed = Boolean(bin || appFound);
  const checkedAt = new Date().toISOString();
  if (!bin) {
    return Promise.resolve({
      installed,
      connected: false,
      bin: '',
      spaces: 0,
      checkedAt,
      reason: appFound ? 'Ego Lite 앱은 있으나 ego-browser CLI를 찾지 못했습니다' : 'Ego Lite가 설치되어 있지 않습니다',
    });
  }
  if (process.env.AIHQ_NO_BROWSER_PROBE === '1') {
    return Promise.resolve({ installed: true, connected: false, bin, spaces: 0, checkedAt, skipped: true, reason: '시험 모드(프로브 생략)' });
  }
  return new Promise((resolve) => {
    const script = 'const s = await listTaskSpaces(); console.log(JSON.stringify({ ok: true, spaces: Array.isArray(s) ? s.length : 0 }));';
    execFile(bin, ['nodejs', '-e', script], { timeout: timeoutMs, maxBuffer: 64 * 1024 }, (err, stdout, stderr) => {
      if (!err) {
        // ego-browser CLI는 console.log 출력을 stderr 또는 stdout 어느 쪽으로도 보낼 수 있어 둘 다 확인한다
        const lines = `${String(stdout || '')}\n${String(stderr || '')}`
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .reverse();
        for (const line of lines) {
          if (!line.startsWith('{')) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed && parsed.ok) {
              resolve({
                installed: true,
                connected: true,
                bin,
                spaces: Number(parsed.spaces) || 0,
                checkedAt: new Date().toISOString(),
                reason: `Ego Lite 실시간 연결됨 (스페이스 ${Number(parsed.spaces) || 0}개)`,
              });
              return;
            }
          } catch { /* next line */ }
        }
      }
      const errMsg = String(stderr || err?.message || '').trim().split('\n')[0].slice(0, 120);
      resolve({
        installed: true,
        connected: false,
        bin,
        spaces: 0,
        checkedAt: new Date().toISOString(),
        reason: /not running|connect|ECONNREFUSED|ENOENT|timed out|killed/i.test(errMsg) || err?.killed
          ? 'Ego Lite가 설치됨 · 현재 앱이 꺼져 있거나 응답 대기 중입니다'
          : (errMsg || 'Ego Lite 응답 없음'),
      });
    });
  });
}

export async function probeEgoLiteCached({ ttlMs = 15000, fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && egoProbeCache && now - egoProbeAt < ttlMs) return egoProbeCache;
  if (egoProbeInflight) return egoProbeInflight;
  egoProbeInflight = probeEgoLite().then((res) => {
    egoProbeCache = res;
    egoProbeAt = Date.now();
    return res;
  }).finally(() => { egoProbeInflight = null; });
  return egoProbeInflight;
}

// 컴퓨터 유즈 · 스마트폰 브리지 자동 감지 (읽기 전용 확인)
export function detectDesktopBridges() {
  return {
    orca: Boolean(findBin('orca', 'AIHQ_ORCA_BIN')),
    adb: Boolean(findBin('adb', 'AIHQ_ADB_BIN')),
    scrcpy: Boolean(findBin('scrcpy', 'AIHQ_SCRCPY_BIN')),
    iphoneMirroringApp: process.platform === 'darwin' && (
      hasAppPath('/System/Applications/iPhone Mirroring.app') ||
      hasAppPath('/Applications/iPhone Mirroring.app')
    ),
  };
}

export function detectOpenSource({ home = os.homedir(), cwd = process.cwd() } = {}) {
  const skills = scanLocalSkills({ home, cwd });
  const byKey = new Map(skills.map((s) => [s.key, s]));
  const out = [];
  const used = new Set();

  for (const c of OSS_CATALOG) {
    const sk = c.skill ? byKey.get(c.skill) : null;
    const hasBin = c.bin ? Boolean(findBin(c.bin, `AIHQ_${c.key.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_BIN`)) : false;
    const found = Boolean(sk || hasBin);
    used.add(c.key);
    out.push({
      key: c.key,
      name: c.name,
      hint: c.hint,
      when: c.when,
      command: c.command || '',
      repo: c.repo || '',
      skillPath: sk ? sk.skillPath : '',
      found,
    });
  }

  // 사용자가 직접 깔아 둔 그 밖의 오픈소스 스킬도 그대로 후보에 올린다
  for (const s of skills) {
    if (used.has(s.key)) continue;
    const shortDesc = s.description.split(/[.(]/)[0].trim().slice(0, 60) || '이 컴퓨터에 설치된 스킬';
    out.push({
      key: s.key,
      name: s.name,
      hint: shortDesc,
      when: `${s.name}, ${shortDesc}`,
      command: '',
      skillPath: s.skillPath,
      found: true,
    });
  }
  return out.slice(0, 20);
}

// 웹 확인·자동화·검색·로그인 사이트 작업인지 판단
export const WEB_WORDS = /(웹|사이트|페이지|브라우저|이메일|메일|gmail|hotmail|유튜브|스튜디오|스마트\s*스토어|쿠팡|인스타|블로그|네이버\s*클립|틱톡|tiktok|스레드|링크드인|카카오\s*채널|뉴스레터|브런치|검색|조사|리서치|확인|크롤링|\bqa\b|로그인|경쟁사|서비스\s*분석|홈페이지|쇼핑몰|댓글|답글|매출\s*확인|홈택스|eldo|엘도|ego|에고|aside|어사이드|chrome|크롬|dia|디아|comet|코멧|arc|아크|safari|사파리)/i;

// 스마트폰 · 아이폰 미러링 · 모바일 앱 작업인지 판단
export const PHONE_WORDS = /(스마트폰|아이폰|iphone|미러링|안드로이드|android|갤럭시|휴대폰|핸드폰|폰\s*앱|모바일\s*앱|인스타\s*앱|카톡\s*앱|카카오톡\s*앱|당근|문자|sms|피클)/i;

export function pickBrowser(text, resources, preferredId = null) {
  const browsers = (resources || []).filter((r) => r.kind === '브라우저' && r.status !== '꺼짐');
  if (!browsers.length) return null;
  const low = String(text || '').toLowerCase();
  // 할 일에 브라우저 이름이 직접 나오면 그 브라우저 우선
  const named = browsers.find((b) => {
    const n = String(b.name || '').toLowerCase();
    if (n && low.includes(n)) return true;
    if (b.preset === 'eldo' && /\beldo\b|엘도|\bcab\b/.test(low)) return true;
    if (b.preset === 'ego-lite' && /ego|에고/.test(low)) return true;
    if (b.preset === 'aside' && /aside|어사이드/.test(low)) return true;
    if (b.preset === 'chrome' && /chrome|크롬/.test(low)) return true;
    if (b.preset === 'dia' && /\bdia\b|디아/.test(low)) return true;
    if (b.preset === 'comet' && /comet|코멧/.test(low)) return true;
    if (b.preset === 'arc' && /\barc\b|아크/.test(low)) return true;
    if (b.preset === 'safari' && /safari|사파리/.test(low)) return true;
    return false;
  });
  if (named) return named;
  // 연결 계정에 지정된 브라우저가 있으면 그 브라우저를 우선 사용
  if (preferredId) {
    const pref = browsers.find((b) => b.id === preferredId);
    if (pref) return pref;
  }
  if (!WEB_WORDS.test(low)) return null;
  return browsers.find((b) => b.isDefault) || browsers[0];
}

export function pickPhone(text, resources) {
  const phones = (resources || []).filter((r) => r.kind === '스마트폰' && r.status !== '꺼짐');
  if (!phones.length) return null;
  const low = String(text || '').toLowerCase();
  const named = phones.find((p) => {
    const n = String(p.name || '').toLowerCase();
    if (n.length >= 2 && low.includes(n)) return true;
    if (p.phoneMode === 'iphone-mirror' && /아이폰|iphone|미러링/.test(low)) return true;
    if (p.phoneMode === 'android-adb' && /안드로이드|android|갤럭시|adb|scrcpy/.test(low)) return true;
    if (p.phoneMode === 'mobile-ai' && /피클/.test(low)) return true;
    return false;
  });
  if (named) return named;
  if (!PHONE_WORDS.test(low)) return null;
  return phones[0];
}

export function phonePromptBlock(phone, resources = [], bridges = null) {
  if (!phone) return '';
  const host = phone.hostMachine ? resources.find((r) => r.id === phone.hostMachine) : null;
  const hostName = host ? host.name : '이 맥';
  const mode = phone.phoneMode || 'iphone-mirror';
  const lines = [`연결 스마트폰: ${phone.name}`];
  if (mode === 'iphone-mirror') {
    const cuHint = bridges?.orca ? 'orca computer CLI 또는 Computer Use 화면 조작' : 'Computer Use 화면 조작';
    lines.push(`- 접속 방식: ${hostName}의 iPhone Mirroring 앱 창을 ${cuHint}으로 열어 확인·조작합니다.`);
  } else if (mode === 'android-adb') {
    lines.push(`- 접속 방식: ${hostName}에 연결된 안드로이드 기기를 adb 또는 scrcpy 창으로 확인·조작합니다.`);
  } else {
    lines.push('- 접속 방식: 모바일 전용 AI 직원(피클 등)으로 전달해 처리합니다.');
  }
  lines.push('- 스마트폰 고정 안전선: 잠금 해제·Touch ID·비밀번호 입력·결제·송금·문자/카톡 실제 전송은 금지이며, 필요하면 초안만 준비하고 대표 승인을 요청합니다.');
  return lines.join('\n');
}

export function pickTools(text, resources, tokenize) {
  const oss = (resources || []).filter((r) => r.kind === '오픈소스' && r.status !== '꺼짐');
  if (!oss.length) return [];
  const low = String(text || '').toLowerCase();
  const tt = tokenize ? tokenize(low) : low.split(/\s+/).filter((w) => w.length >= 2);
  const scored = [];
  for (const r of oss) {
    let score = 0;
    const nm = String(r.name || '').toLowerCase();
    const preset = String(r.preset || '').toLowerCase();
    if (nm.length >= 2 && low.includes(nm)) score += 5;
    if (preset.length >= 2 && low.includes(preset)) score += 5;
    const phrases = String(r.when || '').toLowerCase().split(/[,·/|]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
    for (const p of phrases) {
      if (low.includes(p)) { score += 3; continue; }
      const pt = tokenize ? tokenize(p) : p.split(/\s+/).filter((w) => w.length >= 2);
      if (pt.length && pt.every((w) => tt.some((x) => x === w || (w.length >= 2 && x.includes(w))))) score += 2;
    }
    if (score > 0) scored.push({ r, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.r);
}

const DESIGN_INTENT = /(스타일|디자인|컨셉|톤|느낌|테마|썸네일|모션|영상\s*편집|카드\s*뉴스|배너|포스터|숏폼|화면|브랜드|\bui\b|\bux\b)/i;

// 프롬프트에 디자인 스타일 이름이나 핵심 키워드가 들어 있으면 자동 연결한다
export function pickDesigns(text, resources, tokenize) {
  const designs = (resources || []).filter((r) => r.kind === '디자인' && r.status !== '꺼짐');
  if (!designs.length) return [];
  const low = String(text || '').toLowerCase();
  const tt = tokenize ? tokenize(low) : low.split(/\s+/).filter((w) => w.length >= 2);
  const hasIntent = DESIGN_INTENT.test(low);
  const scored = [];
  for (const r of designs) {
    let score = 0;
    let hits = 0;
    const nm = String(r.name || '').toLowerCase().trim();
    if (nm.length >= 2 && low.includes(nm)) {
      score += 8;
      hits += 2;
    } else {
      const parts = nm.split(/[\s·,/()-]+/).filter((w) => w.length >= 2 && !/^(ai|스타일|디자인|기본|브랜드|중심)$/.test(w));
      for (const p of parts) {
        const hit = /^[a-z0-9]+$/.test(p) ? new RegExp(`\\b${p}\\b`, 'i').test(low) : low.includes(p);
        if (hit) { score += 3; hits++; }
        else if (tt.some((x) => x === p)) { score += 2; hits++; }
      }
    }
    // 스타일 전체 이름이거나 2단어 이상 일치, 또는 디자인 의도가 함께 있을 때만 자동 연결 (유튜브 통계 조회 등 오탐 방지)
    if (score >= 6 || (hits >= 1 && hasIntent && score >= 3)) scored.push({ r, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.r);
}
