# Codex with ChatGPT

[English](README.md) | **한국어**

> ChatGPT가 생각하고, Codex가 실행합니다.

## 해결하려는 문제

ChatGPT 유료 구독의 웹 사용량은 남아 있는데 Codex/API 사용량은 계획과 리뷰에도
소비될 수 있습니다. 이 프로젝트는 **고수준 추론·계획·리뷰는 ChatGPT 웹 앱**에,
**코드 수정·Shell·테스트·Git 실행은 Codex**에 맡기도록 역할을 분리합니다.

API Key나 역방향 프록시를 사용하지 않고, 공식 ChatGPT 웹 UI와 읽기 전용 MCP
브리지를 사용합니다.

## 무엇인가

ChatGPT 웹 앱을 Codex 코딩 세션의 계획·리뷰 계층으로 사용합니다. 저장소 전체를
업로드하지 않습니다. ChatGPT는 OAuth로 보호된 읽기 전용 MCP 연결을 통해 필요한
파일, 검색 결과, Git diff, 테스트 기록만 요청해서 읽습니다.

## ChatGPT 모델 선택

이 포크에서는 새 ChatGPT 대화를 만들 때 사용할 모델을 지정할 수 있습니다.

```bash
c2c prefs set --model "GPT-5.6 Sol"
c2c prefs --json
```

모델 이름은 **ChatGPT 웹 모델 선택기에 보이는 이름과 정확히 일치**해야 합니다.
새 C2C 대화를 만들 때 Codex가 boot prompt를 보내기 전에 해당 모델을 선택합니다.

계정에서 그 모델을 사용할 수 없으면 다른 모델로 조용히 대체하지 않고 중단하여
사용자에게 알려줍니다.

기본 동작으로 되돌리려면:

```bash
c2c prefs set --model default
```

모델 설정은 **새 대화에만 적용**됩니다. 이미 진행 중인 C2C 대화의 모델은 사용자가
명시적으로 요청하지 않는 한 바꾸지 않습니다.

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
3. 원하는 경우 모델을 설정합니다.
   `c2c prefs set --model "<ChatGPT 웹에 표시되는 모델 이름>"`
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
             │    읽기 전용 MCP    │
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

- **제어 면**: Codex와 ChatGPT는 작은 `[C2C]` 상태 메시지만 주고받습니다.
  `INIT → PLAN → EXECUTED → REVIEW → DONE`
- **데이터 면**: ChatGPT는 9개의 읽기 전용 MCP 도구를 통해 필요한 정보만 읽습니다.
- **독립 리뷰**: Codex가 실행을 끝내면 ChatGPT가 실제 Git diff와 테스트 기록을
  직접 확인할 수 있습니다.

## 보안 모델

- 서버에 쓰기/삭제/Shell/commit 도구 자체가 없습니다.
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

요구 사항: Node.js >= 20, git, 그리고 공개 연결을 위한 `cloudflared`.

문서: [architecture](docs/architecture.md) · [protocol](docs/protocol.md) ·
[security](docs/security.md) · [troubleshooting](docs/troubleshooting.md)

## 상태 및 고지

비공식 커뮤니티 프로젝트이며 OpenAI와 공식 제휴 또는 보증 관계가 없습니다.
원본 저장소는 [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt)입니다.

## 라이선스

[MIT](LICENSE)
