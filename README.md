# Codex with ChatGPT

[한국어](README.ko-KR.md) | **English**

> ChatGPT thinks. Codex works.  
> ChatGPT가 생각하고, Codex가 실행합니다.

> [!IMPORTANT]
> **Having trouble?** Ask Codex to **"Update Codex with ChatGPT"** and retry.  
> **문제가 있나요?** Codex에게 **"Codex with ChatGPT 업데이트"**라고 요청한 뒤 다시 시도하세요.

## The problem · 해결하려는 문제

**한국어** — ChatGPT 유료 구독의 웹 사용량은 남아 있는데 Codex/API 사용량은
계획과 리뷰에도 소비될 수 있습니다. 이 프로젝트는 고수준 추론·계획·리뷰를
ChatGPT 웹 앱에 맡기고, Codex는 코드 수정·Shell·테스트·Git 실행을 담당하도록
분리합니다. API Key나 역방향 프록시를 사용하지 않고, 공식 ChatGPT 웹 UI와
repository 읽기 전용 MCP 브리지와 격리된 patch-proposal 채널을 사용합니다.

**EN** — ChatGPT Plus/Pro web quota may sit idle while your coding agent spends
Codex/API capacity on planning and review. This project moves high-level
reasoning, planning, and review to the ChatGPT web app while Codex keeps
execution ownership. No API key or reverse proxy is required: it uses the
official ChatGPT web UI plus repository-read-only MCP access and an isolated patch-proposal channel.

## What it is · 무엇인가

**한국어** — ChatGPT 웹 앱을 Codex 세션의 **계획·코딩 proposal·리뷰 계층**으로
사용합니다. 저장소 전체를 ChatGPT에 업로드하지 않습니다. ChatGPT는 OAuth로
보호되는 MCP를 통해 필요한 파일/diff/테스트 기록을 읽고, 사용자가 coding-subagent
동작을 요청한 경우에만 repository 밖의 격리 저장소에 patch proposal을 제출할 수
있습니다. 실제 repository 수정/실행/Git은 Codex만 수행합니다.

**EN** — ChatGPT becomes the planning, coding-proposal, and review layer for a
Codex session. Repository access remains read-only to ChatGPT. When explicitly
used as a coding subagent, ChatGPT may submit a bounded patch proposal into an
isolated C2C state store; only Codex can validate/apply it, run commands, or
change git state.

## Model & reasoning selection · 모델/추론 수준 선택

The normal UX does **not** require you to know or type model names.

일반 사용자는 모델 이름을 외워서 입력할 필요가 없습니다. Codex에게 다음처럼
요청합니다.

```text
Codex with ChatGPT 모델 설정해줘.
```

Codex opens the signed-in ChatGPT web model picker and reads the choices that
are **actually available to that account**. The flow is:

```text
사용 가능한 모델 목록
        ↓
모델 선택
        ↓
선택한 모델에서 사용 가능한 reasoning/effort 목록
        ↓
effort 선택
        ↓
설정 저장
```

The available list is discovered from the live ChatGPT web UI rather than a
hard-coded plan table. If the account exposes a flattened picker instead of
separate model/effort controls, Codex presents the selectable entries that the
UI actually exposes rather than inventing unavailable combinations.

The stored preferences are applied to **new C2C chats**. If a previously saved
model or effort is no longer available, C2C stops before sending the boot
prompt and offers to reconfigure instead of silently falling back.

## Coding-subagent mode · 코드 patch 작성

Classic C2C behavior is preserved by default: ChatGPT plans/reviews and Codex
writes. When you explicitly want ChatGPT to write the implementation, say for
example:

```text
Codex with ChatGPT를 coding subagent로 사용해서 이 기능 구현해줘.
ChatGPT가 코드 patch까지 작성하게 해줘.
```

In this mode ChatGPT can call `submit_patch`. The patch is **not applied** by
MCP. It is stored outside the repository with owner-only permissions. Codex then:

1. verifies proposal id/task/iteration and SHA-256 integrity;
2. rejects stale target files using submission-time fingerprints;
3. requires explicit approval for approval-required changes such as dependency
   manifests, CI/CD configuration, Docker/task config, shell scripts, or file deletion;
4. locally inspects the patch;
5. runs `git apply --check`;
6. only then applies it with Codex's own shell;
7. tests the result and asks ChatGPT to independently review the real diff.

The proposal channel rejects sensitive/generated/C2C/Git-control paths,
traversal/symlink targets, binary patches, rename/copy, permission-only changes,
submodules, unsafe control characters, patches over 256 KiB, and proposals
touching more than 32 files. File deletion is permitted only as an
approval-required operation. Patch submission has a separate OAuth scope, `proposal.write`, **plus a
temporary local authorization for the exact active coding TASK_ID**. OAuth
permission alone cannot submit patches. The task authorization defaults to four
hours and is revoked when the task finishes or blocks. Neither permission grants
repository write, shell, or git capability.

Control-plane C2C messages may now be up to **4 KiB UTF-8**, but this extra
space is only for rationale/state/handoff. Code, diffs, logs, and patch bodies
must still travel through the data plane, never through chat control messages.

Low-level storage commands remain available for automation/debugging:

```bash
c2c prefs --json
c2c prefs set --model "GPT-5.6 Sol" --effort "High"
c2c prefs set --model default --effort default
```

## One-paste install · 한 번에 설치

### 한국어

아래 내용을 Codex에 그대로 붙여넣을 수 있습니다.

```text
Codex with ChatGPT를 완전히 설치하고 설정해줘. 가능한 작업은 전부 자동으로 처리해.

1. git, Node.js >= 20, cloudflared가 있는지 확인하고 없으면 설치해.
   macOS는 Homebrew, Windows는 winget을 사용해.
2. https://github.com/jiho-symply/codex-with-chatgpt 를
   ~/codex-with-chatgpt 에 clone해. 이미 있으면 git pull로 업데이트해.
3. 해당 디렉터리에서 corepack pnpm install && corepack pnpm build 를 실행해.
4. skill/SKILL.md를 ~/.codex/skills/codex-with-chatgpt/SKILL.md 로 복사하고,
   "The codex-with-chatgpt checkout lives at:" 경로를 실제 clone 경로로 바꿔.
5. SKILL.md의 first-time setup 절차에 따라 c2c setup을 실행하고,
   ChatGPT 설정은 내장 브라우저에서 진행해.
6. 로그인, CAPTCHA, 2단계 인증 또는 명시적 사용자 승인이 필요할 때만 나에게 요청해.
7. 완료 후 프로젝트 인식, Bridge, 보안 연결, ChatGPT 연결, 파일 읽기 테스트 상태를 확인해.
```

### English

```text
Please install and configure "Codex with ChatGPT" fully automatically.

1. Check git, Node.js >= 20, and cloudflared. Install anything missing
   (macOS: Homebrew, Windows: winget).
2. Clone https://github.com/jiho-symply/codex-with-chatgpt into
   ~/codex-with-chatgpt, or git pull if it already exists.
3. Run corepack pnpm install && corepack pnpm build.
4. Copy skill/SKILL.md to ~/.codex/skills/codex-with-chatgpt/SKILL.md and
   replace "The codex-with-chatgpt checkout lives at:" with the actual path.
5. Follow the SKILL.md first-time setup workflow and use the built-in browser
   for ChatGPT configuration.
6. Interrupt me only for login, CAPTCHA, 2FA, or explicit consent.
7. Confirm project detection, Bridge, secure connection, ChatGPT connection,
   and the file-read test.
```

## Install → Setup → Use

1. Copy `skill/` to `~/.codex/skills/codex-with-chatgpt/`.
2. Tell Codex: **"Codex with ChatGPT 최초 설정해줘."**
3. 원하는 경우 Codex에게 **"Codex with ChatGPT 모델 설정해줘."**라고 요청해
   계정에서 실제 사용 가능한 모델과 effort를 목록에서 선택합니다.
4. Use it normally:
   **"Codex with ChatGPT를 사용해서 XXX를 구현해줘."**

A new workspace normally uses one ChatGPT Project per workspace. A new Codex
conversation opens a new ChatGPT chat inside that Project; the same Codex
conversation reuses its existing ChatGPT chat.

## How it works

```text
             ┌───────────────────────────┐
             │       ChatGPT Web         │
             │ Reason / Plan / Patch / Review │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ Browser control
            Data Plane  │          │ Control Plane
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │
             │ repo RO + proposal MCP │
             │ OAuth + Pairing     │
             │  Tunnel Manager     │
             └──────────┬──────────┘
                        │ read-only
                        ▼
             ┌─────────────────────┐          ┌─────────────────────┐
             │   Local Workspace   │◀─────────│    Codex Harness    │
             └─────────────────────┘ edit/git │ shell / tests / fix │
                                              └─────────────────────┘
```

- **Control plane**: bounded (<4 KiB) structured `[C2C]` state/rationale
  messages. No file/diff/log/patch body is transported here.
- **Data plane**: nine read tools plus `submit_patch`. The latter stores only
  an isolated proposal and cannot change repository files.
- **Independent execution/review**: Codex validates/applies/tests; ChatGPT then
  inspects the actual Git diff and test records independently.

## Security model

- **Repository read-only by construction**: ChatGPT has no workspace write,
  delete, shell, patch-apply, commit, or package-install tool. `submit_patch`
  writes only to isolated C2C state under its own OAuth scope.
- **Workspace isolation**: tokens and path containment are bound to one
  workspace.
- **Sensitive-file policy**: `.env*`, keys, SSH credentials, and similar
  files are denied by default; `.c2cignore` can add exclusions.
- **OAuth-protected endpoint**: the public MCP endpoint uses OAuth 2.1 with
  PKCE and rotating refresh tokens.
- **Short-lived pairing**: the browser only receives a one-time pairing code;
  long-lived credentials are not typed into the model.

See [docs/security.md](docs/security.md) for the threat model.

## Developer commands

```bash
pnpm install
pnpm build
pnpm test

c2c setup
c2c prefs --json
c2c prefs set --model "GPT-5.6 Sol" --effort "High"
c2c prefs set --model default --effort default
c2c sandbox-allow
c2c status
c2c doctor
c2c pair
c2c unpair
c2c logs
c2c stop
```

Requirements: Node.js >= 20, git, and `cloudflared` for the public connection.

Docs: [architecture](docs/architecture.md) · [protocol](docs/protocol.md) ·
[security](docs/security.md) · [troubleshooting](docs/troubleshooting.md)

## Project layout

```text
src/
  bridge/     loopback HTTP server, port recovery, admin API
  mcp/        9 read tools + isolated submit_patch, stateless Streamable HTTP
  proposal/   bounded patch validation, integrity/staleness/risk metadata
  auth/       OAuth 2.1, PKCE, registration, token rotation/revocation
  pairing/    one-time pairing codes
  workspace/  path containment, sensitive-file policy, search, git
  tunnel/     Cloudflare Quick/Named Tunnel support
  execution/  execution records for the review loop
  process/    daemon lifecycle
  cli/        c2c CLI
skill/        Codex Skill
tests/        unit + integration tests
docs/         architecture / protocol / security / troubleshooting
```

## Status and disclaimer

This is an unofficial community project and is not affiliated with or endorsed
by OpenAI. This repository is a fork of
[XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt).

## License

[MIT](LICENSE)
