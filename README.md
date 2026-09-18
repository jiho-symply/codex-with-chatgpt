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
읽기 전용 MCP 브리지를 사용합니다.

**EN** — ChatGPT Plus/Pro web quota may sit idle while your coding agent spends
Codex/API capacity on planning and review. This project moves high-level
reasoning, planning, and review to the ChatGPT web app while Codex keeps
execution ownership. No API key or reverse proxy is required: it uses the
official ChatGPT web UI plus a read-only MCP bridge.

## What it is · 무엇인가

**한국어** — ChatGPT 웹 앱을 Codex 세션의 **계획·리뷰 계층**으로 사용합니다.
저장소 전체를 ChatGPT에 업로드하지 않습니다. ChatGPT는 OAuth로 보호되는 읽기
전용 MCP 연결을 통해 현재 workspace에서 필요한 파일, 검색 결과, diff, 테스트
기록만 요청해서 읽습니다.

**EN** — ChatGPT becomes the planning and review layer for a Codex coding
session. The repository is not uploaded to ChatGPT. ChatGPT pulls only the
workspace data it needs through an OAuth-protected, read-only MCP connection.

## Model selection · ChatGPT 모델 선택

This fork adds a machine-wide preferred ChatGPT model setting.

이 포크에서는 **새 ChatGPT 대화를 만들 때 사용할 모델을 지정**할 수 있습니다.

```bash
c2c prefs set --model "GPT-5.6 Sol"
c2c prefs --json
```

The value is the **visible model label in the ChatGPT web model picker**. On
each newly created C2C conversation, Codex selects that exact model before the
boot prompt.

모델 이름은 ChatGPT 웹의 모델 선택기에 표시되는 이름과 정확히 일치해야 합니다.
해당 계정에서 모델을 사용할 수 없으면 다른 모델로 자동 대체하지 않고 중단하여
사용자에게 알립니다.

To return to ChatGPT's normal/default model behavior:

```bash
c2c prefs set --model default
```

The preference is applied only when creating a **new** ChatGPT conversation.
Existing C2C conversations keep their current model unless the user explicitly
requests a change.

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
3. Optionally choose a model:
   `c2c prefs set --model "<visible ChatGPT model label>"`
4. Use it normally:
   **"Codex with ChatGPT를 사용해서 XXX를 구현해줘."**

A new workspace normally uses one ChatGPT Project per workspace. A new Codex
conversation opens a new ChatGPT chat inside that Project; the same Codex
conversation reuses its existing ChatGPT chat.

## How it works

```text
             ┌───────────────────────────┐
             │       ChatGPT Web         │
             │  Reason / Plan / Review   │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ Browser control
            Data Plane  │          │ Control Plane
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │
             │    read-only MCP    │
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

- **Control plane**: Codex and ChatGPT exchange small structured `[C2C]`
  messages: `INIT → PLAN → EXECUTED → REVIEW → DONE`.
- **Data plane**: ChatGPT reads workspace data through nine read-only MCP tools:
  `workspace_info`, `list_directory`, `read_file`, `search_workspace`,
  `git_status`, `git_diff`, `test_status`, `execution_summary`, and
  `execution_output`.
- **Independent review**: ChatGPT can inspect the actual Git diff and test
  records after Codex executes the plan.

## Security model

- **Read-only by construction**: the bridge exposes no write, delete, shell, or
  commit tool.
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
c2c prefs set --model "GPT-5.6 Sol"
c2c prefs set --model default
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
  mcp/        9 read-only tools, stateless Streamable HTTP
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
