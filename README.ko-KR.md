# Codex with ChatGPT

[English](README.md) | **한국어**

> ChatGPT가 생각하고, Codex가 실행합니다.

## 해결하려는 문제

ChatGPT 유료 구독의 웹 사용량은 남아 있는데 Codex/API 사용량은 계획과 리뷰에도
소비될 수 있습니다. 이 프로젝트는 **고수준 추론·계획·리뷰는 ChatGPT 웹 앱**에,
**코드 수정·Shell·테스트·Git 실행은 Codex**에 맡기도록 역할을 분리합니다.

API Key나 역방향 프록시를 사용하지 않고, 공식 ChatGPT 웹 UI와 repository
읽기 전용 MCP + 격리된 patch-proposal 채널을 사용합니다.

## 무엇인가

ChatGPT 웹 앱을 Codex 코딩 세션의 계획·코딩 proposal·리뷰 계층으로 사용합니다.
저장소 전체를 업로드하지 않습니다. ChatGPT의 repository 접근은 읽기 전용이며,
coding-subagent로 명시적으로 요청한 경우에만 repository 밖의 격리 저장소에
patch proposal을 제출할 수 있습니다. 실제 파일 수정, Shell, 테스트, Git은
Codex만 수행합니다.

## ChatGPT 모델 및 reasoning effort 선택

일반 사용자는 모델 이름을 직접 입력할 필요가 없습니다. Codex에게 다음과 같이
요청하면 됩니다.

```text
Codex with ChatGPT 모델 설정해줘.
```

설정/재설정 흐름은 다음과 같습니다.

```text
현재 ChatGPT 계정에서 사용 가능한 모델 목록 표시
        ↓
모델 선택
        ↓
그 모델에서 실제 사용 가능한 reasoning/effort 목록 표시
        ↓
effort 선택
        ↓
설정 저장
```

목록은 요금제 이름을 보고 하드코딩하지 않고, 로그인된 **ChatGPT 웹 UI의 실제
선택지**를 읽어서 만듭니다. 따라서 계정/워크스페이스별로 노출되는 선택지가
다르면 그 차이가 그대로 반영됩니다.

ChatGPT가 모델과 effort를 별도 UI로 제공하면 순서대로 선택하고, 하나의 평면
picker로 제공하면 실제 picker에서 확인 가능한 선택지만 보여줍니다. 존재하지
않는 모델/effort 조합을 임의로 만들지 않습니다.

저장한 모델 또는 effort가 나중에 사라지면 다른 설정으로 조용히 fallback하지
않고, 새 C2C Chat을 시작하기 전에 재설정을 요청합니다.

내부 자동화/디버깅용 명령은 남아 있습니다.

```bash
c2c prefs --json
c2c prefs set --model "GPT-5.6 Sol" --effort "High"
c2c prefs set --model default --effort default
```

설정은 **새 C2C 대화부터 적용**됩니다.

## Coding subagent로 코드 patch 작성

기본 동작은 기존과 같습니다. ChatGPT가 계획/리뷰를 맡고 Codex가 코드를 작성합니다.
ChatGPT에게 실제 코드 변경안까지 맡기고 싶으면 다음처럼 요청합니다.

```text
Codex with ChatGPT를 coding subagent로 사용해서 이 기능 구현해줘.
ChatGPT가 코드 patch까지 작성하게 해줘.
```

이 모드에서 ChatGPT는 `submit_patch`로 patch **proposal**을 제출할 수 있습니다.
하지만 MCP가 repository에 patch를 적용하지는 않습니다.

Codex는 적용 전에 다음 절차를 강제합니다.

1. proposal의 task/iteration/id와 SHA-256 무결성 확인
2. 제출 시점 대상 파일 fingerprint와 현재 파일을 비교해 stale 여부 확인
3. dependency manifest, CI/CD, Docker/task 설정, Shell/PowerShell script 등
   실행 민감 파일이면 사용자에게 명시적 승인 요청
4. Codex가 patch 내용을 로컬에서 직접 검토
5. `git apply --check` 통과 확인
6. Codex의 Shell로만 실제 적용
7. 테스트 후 ChatGPT가 실제 Git diff를 다시 독립 리뷰

proposal 채널은 다음을 차단합니다.

- `.env`, key/credential, `.c2cignore`, `.c2c.json`, `.git/*`
- workspace 밖 경로, traversal, symlink 경유
- binary patch
- rename/copy 및 permission-only 변경
- submodule patch
- 위험한 terminal control character
- 256 KiB 초과 patch
- 32개 초과 파일 변경

patch 제출은 별도의 OAuth 권한 `proposal.write`를 사용합니다. 이 권한은
**repository write/Shell/Git 권한을 주지 않습니다.**

C2C 제어 메시지 제한은 **4 KiB UTF-8**로 늘렸습니다. 이 공간은 plan/rationale/
handoff를 더 충실하게 전달하기 위한 것이며, 코드·diff·로그·patch 본문을 Chat에
넣는 용도로 사용할 수 없습니다.

## 한 번에 설치

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

## 설치 → 설정 → 사용

1. `skill/`을 `~/.codex/skills/codex-with-chatgpt/`에 설치합니다.
2. Codex에게 **"Codex with ChatGPT 최초 설정해줘."**라고 요청합니다.
3. 원하는 경우 **"Codex with ChatGPT 모델 설정해줘."**라고 요청해 표시되는
   모델 목록과 effort 목록에서 선택합니다.
4. 이후 **"Codex with ChatGPT를 사용해서 XXX를 구현해줘."**라고 사용합니다.

새 workspace는 기본적으로 workspace당 하나의 ChatGPT Project를 사용합니다.
같은 Codex 대화에서는 기존 ChatGPT chat을 재사용하고, 새 Codex 대화에서는 같은
Project 안에 새 ChatGPT chat을 만듭니다.

## 동작 구조

```text
             ┌───────────────────────────┐
             │       ChatGPT Web         │
             │  추론 / 계획 / 리뷰       │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ 브라우저 제어
             데이터 면  │          │ 제어 면
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │
             │ repo RO + proposal MCP │
             │  OAuth + Pairing    │
             │   Tunnel Manager    │
             └──────────┬──────────┘
                        │ 읽기 전용
                        ▼
             ┌─────────────────────┐          ┌─────────────────────┐
             │   Local Workspace   │◀─────────│    Codex Harness    │
             └─────────────────────┘ edit/git │ shell / tests / fix │
                                              └─────────────────────┘
```

- **제어 면**: 4 KiB 미만의 `[C2C]` 상태/근거 메시지만 주고받으며 코드·diff·
  로그·patch 본문은 전달하지 않습니다.
- **데이터 면**: 9개의 읽기 도구와 격리 proposal 전용 `submit_patch`를 사용합니다.
- **실행/리뷰 분리**: Codex만 실제 적용·Shell·테스트를 수행하고, ChatGPT는
  결과 Git diff를 다시 독립적으로 검토합니다.

## 보안 모델

- ChatGPT에는 repository 쓰기/삭제/Shell/patch apply/commit 도구가 없습니다.
  `submit_patch`는 별도 상태 디렉터리에 proposal만 저장합니다.
- 각 토큰은 하나의 workspace 경계에 묶입니다.
- `.env*`, SSH key, credential 등 민감한 파일은 기본 차단됩니다.
- MCP endpoint는 OAuth 2.1 + PKCE를 사용합니다.
- 브라우저에는 일회용 pairing code만 입력합니다.

자세한 내용은 [docs/security.md](docs/security.md)를 참고하세요.

## 개발 명령

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

요구 사항: Node.js >= 20, git, 그리고 공개 연결을 위한 `cloudflared`.

문서: [architecture](docs/architecture.md) · [protocol](docs/protocol.md) ·
[security](docs/security.md) · [troubleshooting](docs/troubleshooting.md)

## 상태 및 고지

비공식 커뮤니티 프로젝트이며 OpenAI와 공식 제휴 또는 보증 관계가 없습니다.
원본 저장소는 [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt)입니다.

## 라이선스

[MIT](LICENSE)
