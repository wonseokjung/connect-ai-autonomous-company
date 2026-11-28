<div align="center">

<a href="https://github.com/wonseokjung/connect-ai-autonomous-company">
  <img src="docs/hero-banner.svg" alt="CONNECT AI HQ v2 — CONNECT AI LAB" width="100%" />
</a>

<br />
<br />

<p>
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/VERSION-v2.0.0-D4A359?style=flat-square&labelColor=0A0A0C" alt="Version v2.0.0" /></a>
  <img src="https://img.shields.io/badge/NODE-%3E%3D20-18181B?style=flat-square&labelColor=0A0A0C" alt="Node >=20" />
  <img src="https://img.shields.io/badge/NPM_DEPS-0-18181B?style=flat-square&labelColor=0A0A0C" alt="Zero npm dependencies" />
  <img src="https://img.shields.io/badge/TESTS-57%2F57_PASS-10B981?style=flat-square&labelColor=0A0A0C" alt="57/57 Tests Passing" />
  <a href="https://www.youtube.com/@CONNECT-AI-LAB"><img src="https://img.shields.io/badge/YOUTUBE-%40CONNECT--AI--LAB_127K%2B-D4A359?style=flat-square&labelColor=0A0A0C" alt="YouTube @CONNECT-AI-LAB" /></a>
  <a href="https://www.instagram.com/aimentorjay"><img src="https://img.shields.io/badge/INSTAGRAM-%40aimentorjay_268K%2B-D4A359?style=flat-square&labelColor=0A0A0C" alt="Instagram @aimentorjay" /></a>
</p>

<p>
  <a href="README.md">한국어</a> &nbsp;·&nbsp;
  <strong><a href="README.en.md">English</a></strong> &nbsp;·&nbsp;
  <a href="#-quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#-product-tour">Product Tour</a> &nbsp;·&nbsp;
  <a href="#-key-capabilities">Capabilities</a> &nbsp;·&nbsp;
  <a href="#-safety--security">Safety</a> &nbsp;·&nbsp;
  <a href="#-connect-ai-lab--ai-mentor-jay">Brand</a> &nbsp;·&nbsp;
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p>
  <strong>CONNECT AI HQ v2</strong> is a zero-dependency, local-first personal AI company OS by <b>CONNECT AI LAB</b>.<br />
  Unify <b>your founder condition (life &amp; health)</b>, <b>your AI staff &amp; GitHub skills</b>, <b>scheduled automations &amp; runs</b>, and <b>AI offices (Macs, browsers, smartphones)</b> inside one gallery-grade OS.
</p>

<sub>Note: The web UI is currently in Korean, with English documentation, CLI, and safety gate support.</sub>

</div>

---

## ⚡ Quick Start

Zero npm dependencies. Zero mandatory API keys. Requires Node 20+.

```bash
# 1. Launch CONNECT AI HQ locally (opens http://127.0.0.1:8790)
npx github:wonseokjung/connect-ai-autonomous-company

# 2. Preview or connect all installed vibe-coding tools in one command (.bak backups)
npx github:wonseokjung/connect-ai-autonomous-company connect --dry-run
npx github:wonseokjung/connect-ai-autonomous-company connect --yes

# 3. Cleanly disconnect aihq only (preserves 100% of your other MCP servers)
npx github:wonseokjung/connect-ai-autonomous-company disconnect --yes
```

> **Auto-detected tools (9)**: `Claude Code` · `Codex` · `Antigravity (agy)` · `Gemini CLI` · `OpenCode` · `Cursor` · `Windsurf` · `Claude Desktop` · `LM Studio` + shared agent skills (`~/.agents/skills/aihq-employee`).

Try with isolated sample data:

```bash
AIHQ_SEED=example AIHQ_DATA_DIR=./example-data npx github:wonseokjung/connect-ai-autonomous-company
```

---

## 🖼 Product Tour

### Today Tasks × Matte Black `LIVE CREW` Hero (`#home`)
Press Enter to auto-delegate (`✦ 자동 배분`) to connected runnable AI employees with automatic GitHub skill injection (`Remotion`, `Playwright`, `Reverse Business`, etc.) and optimal machine routing.

<img src="docs/home.png" alt="CONNECT AI HQ v2 Home and LIVE CREW Hero" width="100%" />

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/automations.png" alt="2-Tab Automations and Runs" width="100%" />
      <br />
      <sub><b>Automations &amp; Runs (<code>#automations</code>)</b> — Clean 2-tab layout, live search &amp; filters, 1-click <code>Run Now</code>, 5 founder/creator templates, <code>+ New Automation</code> modal, and live sidebar 5h quota bar</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/dashboard.png" alt="Live Company Dashboard" width="100%" />
      <br />
      <sub><b>Live Dashboard (<code>#dashboard</code>)</b> — Interactive 3-column SVG AI Company Topology, Founder Condition health rings, and live 85% RAM safety cap telemetry</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/staff.png" alt="AI Staff and GitHub Skills" width="100%" />
      <br />
      <sub><b>AI Staff &amp; GitHub Skills (<code>#staff</code>)</b> — Manage local CLI, cloud, and on-device AI staff, attach GitHub repos as skills, monitor 5h quotas, and configure automatic fallback chains</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/new-bot.png" alt="New AI Teammate Creator" width="100%" />
      <br />
      <sub><b>New AI Teammate Creator</b> — Pick from 21 K-Heritage pixel/3D crew avatars, team, computer, Provider/Model/Thinking effort (<code>Default·Low·Med·High</code>), and 1-click open-source skills</sub>
    </td>
  </tr>
</table>

---

## ✨ Key Capabilities

- **Default Agent, Main Computer & Auto-Delegation**: Pick your primary AI and main computer via card UI; press Enter to route work exclusively to connected runnable agents while triggering native macOS alarms for personal reminders.
- **2-Tab Automations (`Automations | Runs`)**: Schedule daily or interval jobs (`5m–1h`), trigger immediate runs (`Run Now`), start from 5 built-in founder/creator templates, inspect global execution logs, and share privacy-scrubbed **Blueprints**.
- **Per-Employee GitHub Skills**: Attach any GitHub repo or catalog tool (`Remotion`, `Hyperframes`, `Blender`, `Playwright`, `Firecrawl`, `Reverse Business`) to specific AI employees for automatic task routing, prompt injection, and MCP discovery.
- **Live 5-Hour Quota Bar & Auto-Failover**: Bounded-tail local JSONL usage scans for Claude & Codex, live sidebar quota pills, automatic 429 cooldowns, backup AI handoff, 180s `hang-watchdog`, macOS `caffeinate`, and 85% RAM backpressure protection.
- **Founder Condition (Local-Only Health)**: Private ingestion (`POST /api/health/ingest` + token auth) from Apple Health / Android Health Connect with zero external transmission and strict exclusion from prompts, reports, and blueprints.
- **16-bit K-Heritage Pixel Crew (21 Characters)**: Ships by default with 20 Korean historical pixel teammates + Jay's Samoyed mascot **Somi** (`20×20` animated pixel SVGs with live working/idle states), plus custom nicknames and `Cmd+V` image/GIF uploads.

<div align="center">
<table>
  <tr>
    <td align="center" width="12.5%"><img src="docs/pixel/som.svg" width="76" alt="Somi" /><br /><sub><b>Somi</b><br />Mascot</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/sejong.svg" width="76" alt="King Sejong" /><br /><sub><b>Sejong</b><br />Executive</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/jangyeongsil.svg" width="76" alt="Jang Yeong-sil" /><br /><sub><b>Yeong-sil</b><br />Engineering</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/seonbi.svg" width="76" alt="Seonbi" /><br /><sub><b>Seonbi</b><br />Planning</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/saimdang.svg" width="76" alt="Shin Saimdang" /><br /><sub><b>Saimdang</b><br />Design</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/bobusang.svg" width="76" alt="Bobusang" /><br /><sub><b>Bobusang</b><br />Marketing</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/damo.svg" width="76" alt="Damo" /><br /><sub><b>Damo</b><br />Research · QA</sub></td>
    <td align="center" width="12.5%"><img src="docs/pixel/heojun.svg" width="76" alt="Heo Jun" /><br /><sub><b>Heo Jun</b><br />Health</sub></td>
  </tr>
</table>
</div>

---

## 🔒 Safety & Security

- **Localhost-only by default (`127.0.0.1`)**: Optional Wi-Fi Pocket View (`#pocket`) requires an explicit toggle and a single-use 6-digit pairing code.
- **Hard Server-Side Approval Gates**: Payments, uploads, publishing, deletions, and outgoing messages always pause until human approval in the UI. AI agents (CLI & MCP) have zero approval or roster-mutation tools.
- **Zero Permission-Bypass Flags**: Native headless runners (`claude`, `codex`, `agy`, `gemini`, `opencode`) never use permission-skipping flags and scope allowed tools strictly.
- **Automated Verification (`npm test`)**: **57 / 57 automated tests** covering 9-tool E2E connect/disconnect, 47 safety gates, routing, RAM 85% & token failover, hang-watchdog & caffeinate, 5h token scanning, health privacy isolation, avatar XSS defense, and blueprint scrubbing.

---

## 🏆 CONNECT AI LAB × AI Mentor Jay

<div align="center">

<a href="https://www.youtube.com/@CONNECT-AI-LAB">
  <img src="docs/brand-card.svg" alt="CONNECT AI LAB — AI Mentor Jay (Wonseok Jung)" width="100%" />
</a>

<br />
<br />

<p>
  <a href="https://www.youtube.com/@CONNECT-AI-LAB"><img src="https://img.shields.io/badge/YouTube-CONNECT_AI_LAB_(127K%2B)-0A0A0C?style=for-the-badge&logo=youtube&logoColor=D4A359" alt="YouTube @CONNECT-AI-LAB" /></a>
  &nbsp;
  <a href="https://www.instagram.com/aimentorjay"><img src="https://img.shields.io/badge/Instagram-%40aimentorjay_(268K%2B)-0A0A0C?style=for-the-badge&logo=instagram&logoColor=D4A359" alt="Instagram @aimentorjay" /></a>
  &nbsp;
  <a href="https://github.com/wonseokjung"><img src="https://img.shields.io/badge/GitHub-%40wonseokjung-0A0A0C?style=for-the-badge&logo=github&logoColor=D4A359" alt="GitHub @wonseokjung" /></a>
</p>

</div>

Founded by **Wonseok Jung (AI Mentor Jay)**, **CONNECT AI LAB** builds open-source AI company infrastructure and hands-on education for a community of **400K+ creators, founders, and builders** across YouTube and Instagram.

---

<!-- team:start -->
## CONNECT AI LAB's 14 AI employees · ELDO Browser

I build AI employees in the open, one by one. Grab the one you need, or browse and hire all 14 with [ELDO Browser](https://eldobrowser.com) and [`wonseokjung/eldo`](https://github.com/wonseokjung/eldo) (`npx github:wonseokjung/eldo`).

<table>
<tr><td width="34%" valign="top"><b>ELDO Browser · Open-Source Hub</b><br><a href="https://eldobrowser.com"><code>eldobrowser.com</code></a> · <a href="https://github.com/wonseokjung/eldo"><code>eldo</code></a></td><td valign="top">The free Browser for AI Agents (Apple Notarized macOS &amp; Windows). Sign in once; AI employees work in isolated gold spaces and hand off auth and payments to you.</td></tr>
<tr><td width="34%" valign="top"><b>AI autonomous company HQ</b> · <b>this one</b><br><a href="https://github.com/wonseokjung/connect-ai-autonomous-company"><code>connect-ai-autonomous-company</code></a></td><td valign="top">Local AI company OS connecting your life, AI employees, automations, and ELDO browser.</td></tr>
<tr><td width="34%" valign="top"><b>AI developer</b><br><a href="https://github.com/wonseokjung/connect-ai-developer"><code>connect-ai-developer</code></a></td><td valign="top">One sentence in, a service with sign-up, database, test payments, GitHub and deploy plans out.</td></tr>
<tr><td width="34%" valign="top"><b>AI accountant</b><br><a href="https://github.com/wonseokjung/connect-ai-accountant"><code>connect-ai-accountant</code></a></td><td valign="top">Receipts, 홈택스, card and bank in. A monthly sheet and a package for your tax accountant out.</td></tr>
<tr><td width="34%" valign="top"><b>AI marketing team</b><br><a href="https://github.com/wonseokjung/connect-ai-marketer"><code>connect-ai-marketer</code></a></td><td valign="top">8 AI teammates handling replies, social listening and YouTube uploads 24/7 in your browser.</td></tr>
<tr><td width="34%" valign="top"><b>AI writer</b><br><a href="https://github.com/wonseokjung/connect-ai-writer"><code>connect-ai-writer</code></a></td><td valign="top">Give it one video or topic; it researches and writes platform posts in your voice, with pictures.</td></tr>
<tr><td width="34%" valign="top"><b>AI business analyst</b><br><a href="https://github.com/wonseokjung/reversebusiness"><code>reversebusiness</code></a></td><td valign="top">Give it a website URL, and it breaks down how that business makes money and designs your version.</td></tr>
<tr><td width="34%" valign="top"><b>AI image director</b><br><a href="https://github.com/wonseokjung/connect-ai-image"><code>connect-ai-image</code></a></td><td valign="top">Free-first local ComfyUI + FLUX or logged-in browser image series for every platform.</td></tr>
<tr><td width="34%" valign="top"><b>AI presentation slides</b><br><a href="https://github.com/wonseokjung/connect-ai-slides-web"><code>connect-ai-slides-web</code></a></td><td valign="top">Turn a few lines or an old PPT into a motion-first 3D web deck and a real PowerPoint (.pptx) file.</td></tr>
<tr><td width="34%" valign="top"><b>AI 3D web studio</b><br><a href="https://github.com/wonseokjung/connect-ai-three"><code>connect-ai-three</code></a></td><td valign="top">Say it, get an interactive Three.js 3D web page and a frame-exact film from one spec.</td></tr>
<tr><td width="34%" valign="top"><b>AI motion designer</b><br><a href="https://github.com/wonseokjung/connect-ai-motion"><code>connect-ai-motion</code></a></td><td valign="top">Give it a few lines of text, and it makes a 16:9 and 9:16 motion graphics video. No footage needed.</td></tr>
<tr><td width="34%" valign="top"><b>AI video editor</b><br><a href="https://github.com/wonseokjung/connect-ai-video-motion"><code>connect-ai-video-motion</code></a></td><td valign="top">Give it your video, and it puts 80 body-aware motion graphics in the empty space around you.</td></tr>
<tr><td width="34%" valign="top"><b>AI XR developer</b><br><a href="https://github.com/wonseokjung/connect-ai-xr"><code>connect-ai-xr</code></a></td><td valign="top">Give it one sentence, and it makes a WebXR app for Meta Quest passthrough AR, VR, and desktop.</td></tr>
<tr><td width="34%" valign="top"><b>AI product photographer</b><br><a href="https://github.com/wonseokjung/connect-ai-product-photo"><code>connect-ai-product-photo</code></a></td><td valign="top">Drop phone product photos in a folder and get platform-ready studio shots keeping real sharp labels.</td></tr>
<tr><td width="34%" valign="top"><b>AI global localizer</b><br><a href="https://github.com/wonseokjung/connect-ai-localizer"><code>connect-ai-localizer</code></a></td><td valign="top">Rewrite your Korean post or subtitles natively for English, Japanese and Spanish in your own voice.</td></tr>
</table>
<!-- team:end -->

---

## 📄 License

Free · Source Available (Fair-Code). Individuals and organizations with fewer than 5 people may use and modify it internally at no cost. Organizations with 5 or more people, resale, hosted services, and paid courses built with it require permission from **CONNECT AI LAB**. See [LICENSE.md](LICENSE.md) (Korean: [LICENSE.ko.md](LICENSE.ko.md)).

<div align="center">
  <br />
  <sub><strong>CONNECT AI LAB</strong> · Designed &amp; Engineered by <b>Wonseok Jung (AI Mentor Jay)</b> · Life × AI Operating System</sub>
</div>
