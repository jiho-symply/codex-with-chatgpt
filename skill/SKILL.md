---
name: codex-with-chatgpt
description: >
  Use ChatGPT (web) as the planning and review brain for Codex coding sessions,
  while Codex keeps full execution ownership. Use when the user says
  "Codex with ChatGPT 사용" / "Set up Codex with ChatGPT" / "ChatGPT로 계획해줘",
  when they ask to connect ChatGPT to the current workspace, disconnect it,
  configure/reconfigure the ChatGPT model or reasoning effort, or run a task
  through the ChatGPT planning loop.
---

# Codex with ChatGPT

ChatGPT thinks. Codex works.

You (Codex) own execution: editing, shell, git, tests, recovery.
ChatGPT owns high-level reasoning: understanding, planning, review, debug strategy,
and—only when requested—isolated code-patch proposals.
The C2C Bridge keeps the repository read-only to ChatGPT. Patch proposals are
stored outside the repository and only Codex may validate/apply them.
Control messages stay bounded (< 4 KiB) and never carry file/diff/log/patch bodies.

**Golden rules**

1. NEVER paste file contents, diffs, logs, or patch bodies into ChatGPT. ChatGPT reads
   workspace data through MCP and submits code only through `submit_patch`.
2. NEVER show the user technical internals (MCP, OAuth, PKCE, tunnel, ports, localhost).
   Speak in terms of "ChatGPT 연결 / 보안 연결 / 페어링". The only exception is the
   **guided manual ChatGPT setup** below: expose only the exact settings
   field labels/values the user must enter, without explaining internals.
3. The pairing code is the ONLY credential you may ever type into a browser.
   Never touch OAuth tokens, cookies, or session storage.
4. If something fails, run `c2c doctor` and repair silently. Only involve the user
   for logins, CAPTCHA, 2FA, explicit consent screens, or **guided manual
   ChatGPT setup** below — and then give them ONE action.
   Before the first ChatGPT connection on this machine, `c2c prefs --json`:
   - `setupMode` missing: tell the user exactly `setupChoicePrompt`, wait for
     「1」or「2」, then `c2c prefs set --setup-mode auto|manual --json`.
     Do not start ChatGPT configuration until they answer. Do not guess.
   - `setupMode` is `manual`: skip automatic ChatGPT settings. Use guided
     manual from the start (chosen, not a failure).
   - `setupMode` is `auto`: automatic browser setup. Two explicit failures of
     the same configuration step after repair then enter guided manual.
     A browser/js timeout, a page still loading/generating, or waiting for
     user login/2FA does NOT count as a failure. Do not change the saved
     `setupMode` when falling back.
   `developerModeEnabled: true` means skip `#settings/Security` until a
   connector create fails because developer mode is required. Then open
   that page, enable it, and `c2c prefs set --developer-mode --json`.
   These prefs are for this machine, not per workspace. Do not ask again
   on reconnect or a second repo. A new computer (empty prefs) asks/checks
   once.
5. ALWAYS use the built-in in-app browser (iab) for every ChatGPT step.
   Follow **In-app browser (ChatGPT)** below. NEVER Computer Use (no
   screenshot-click). NEVER launch or control a third-party/external browser
   (Chrome, Safari, Edge…), and never use `open <url>` to hand off to one.
   - The ONLY exception: the user explicitly says the Cloudflare login must use
     their own browser session — that single Cloudflare login step may go through
     their browser; everything else stays in the built-in browser.
   - If the user asks to run ChatGPT in their own browser, explain:
     "Codex가 ChatGPT를 지속적으로 호출하고 연결 설정을 조작하므로 일반 브라우저 사용에
     영향을 줄 수 있습니다. 기본적으로 내장 브라우저를 사용합니다." Only if the user replies
     with an explicit acknowledgement that they accept the interference may you proceed in their browser; otherwise
     keep ChatGPT in the built-in browser, every time they ask.
6. Conversation reuse depends on `c2c session --json` → `conversation.mode`
   (see Conversation management). Do not invent a second mode.
   - **long-chat** (legacy session file, or the user opted out): ONE ChatGPT
     conversation per workspace. Never silently start a new chat.
   - **project** (new workspaces, or an existing workspace that opted in):
     ONE ChatGPT Project (collection) per workspace. Same Codex conversation
     reuses the ChatGPT chat URL saved in THIS thread. A new Codex
     conversation opens a new chat from the Project collection page — never
     `goto` `https://chatgpt.com/` to create it, and never reuse another
     Codex conversation's chat URL just because `session.url` exists.
   Each workspace also has exactly ONE ChatGPT connector. Do not create a
   second connector for the same workspace. Other workspaces may have their
   own connectors — never edit those.
7. **Preferred ChatGPT model + effort.** Read `c2c prefs --json` before opening
   a NEW ChatGPT conversation.
   - `chatgptModel` stores the chosen model-family label and
     `chatgptEffort` stores the chosen reasoning/effort label.
   - Apply them only to NEW conversations. Never switch model/effort mid-task in
     an existing conversation unless the user explicitly asks.
   - Use the ChatGPT web picker through the same IAB tab. Prefer DOM/text/ARIA
     selectors; never use screenshot-coordinate clicking.
   - If ChatGPT exposes model and effort as separate controls, select model
     first and effort second. If the UI exposes a flattened picker, select the
     visible option whose accessible metadata corresponds to the saved pair.
   - Verify the selected state before sending the boot prompt. If either saved
     choice is no longer available, STOP and offer the **Model configuration**
     workflow. Never silently fall back.
   - If `chatgptModel` is null, keep ChatGPT's default selection.
   Direct `c2c prefs set --model/--effort` commands are storage primitives;
   normal users should use **Model configuration** so they never need to know
   model names in advance.
8. After first-time setup, never ask the user to approve writing C2C's local
   settings directory. Run `c2c sandbox-allow --json` (idempotent). If it fails
   with EPERM / Operation not permitted, request elevated permissions and retry
   ONCE. After `{ "alreadyAllowed": true }` or `{ "added": true }`, stay silent.
9. ChatGPT pages: only the URLs in **In-app browser (ChatGPT)**. Never start
   from chatgpt.com and click through menus.
10. **Doctor gate.** After `c2c doctor --json`, do not `goto` ChatGPT and do not
   send `[C2C]` until local is green — except the reconnect settings pages when
   `chatgptRepair.needed` is true. Not green:
   - `report.bridge.ok` is not true
   - `report.mcp.ok` is not true (unauthenticated local `/mcp` must be 401)
   - sandbox / state-dir write failed (EPERM)
   - this workspace used to have a public URL and the tunnel is down
   - `chatgptRepair.needed` is true (fix the connector first, then doctor again)
   - `namedRepair.needed` is true (user must log in to Cloudflare, then doctor again.
     Do not Delete the ChatGPT connector — the address did not change)
   - `report.bridge` says 状态无法确认: the local bridge may still be running.
     Do not `c2c start`, do not Delete the connector, do not treat it as
     `chatgptRepair`. Wait and run doctor again.
   If doctor is already green and `chatgptRepair.needed` is false, do not
   `c2c restart`, do not start a second tunnel, and do not Delete the
   connector. ChatGPT/IAB-only errors are not permission to churn the
   public address.
   A ChatGPT-side 401 after a sent message is different: repair then, do not
   treat it as permission to skip this gate next time.

## In-app browser (ChatGPT)

Official skill: `control-in-app-browser`. These C2C rules override defaults
that close the tab, hide the window, or stall on the settings page.

1. **Surface.** Once per Codex session: `setupBrowserRuntime()`, then
   `const iab = await agent.browsers.get("iab")`. Reuse `iab`. Do not re-read
   `documentation()` if it is already bound. Never `getDefault()`, `getForUrl()`,
   or Computer Use.

2. **One tab.** Create the ChatGPT tab once (`tabs.new()`). After that, only
   `tab.goto(...)` to switch URLs. If the tab still exists, claim it — never
   open a second ChatGPT tab. Do not `goto` the URL you are already on.

3. **Foreground + keep (standby).** Right after opening or claiming the tab:
   - `await (await iab.capabilities.get("visibility")).set(true)` — first-time
     setup and ChatGPT chatting stay in front of the user so they can watch.
   - `await tab.markHandoff()` immediately, then again at the start and end of
     every turn. After setup succeeds or the C2C chat is open, also
     `await tab.markDeliverable()`.
   Never close this tab. Finished, waiting for the user, or timed out: leave it
   marked (standby). Do not let default turn cleanup close it.

4. **URLs only** (same tab, `goto` — never hunt menus):
   - 开发人员模式: `https://chatgpt.com/#settings/Security`
     (skip when `c2c prefs --json` has `developerModeEnabled: true`)
   - 插件总管: `https://chatgpt.com/plugins`
   - 加插件: `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`
   - 新对话 (long-chat only, and only if no saved chat): `https://chatgpt.com/`
   - Saved C2C chat: `conversation.chatUrl` / `session.url` (long-chat, or
     the chat already bound in THIS Codex conversation)
   - Saved Project collection: `conversation.projectUrl`
     (`https://chatgpt.com/g/g-p-…/project`)
   Never click Reconnect / Refresh on an existing connector. The old address is
   dead and that page hangs on "This site cannot be reached". When the address
   changed: Delete THIS workspace's `connectorName` only, then create it again
   via the 加插件 URL (same name, new Server URL). Do not put that public
   address into Project instructions — write the connector **name** only.

5. **Do not wait for a specific tool count** on the settings page. "Connected" /
   authorize success / pairing accepted is enough. Confirm tools in the conversation with
   `workspace_info`.

6. **Batch.** Fill a known form in one Playwright / `js` script when you can.
   After an action, one cheap DOM check. Do not screenshot-poll.

7. **One conversation, Chat mode + model/effort selection.** The first ChatGPT
   chat is the C2C conversation. Chat and Work are separate: a Work conversation
   cannot become Chat. On every NEW conversation, if a Chat/Work switcher is
   visible (often top-left), confirm **Chat** is selected before the boot prompt.
   Then read `c2c prefs --json`. If `chatgptModel` is non-null, apply the saved
   model and, when non-null, `chatgptEffort`. Use the same detection/selection
   logic as **Model configuration** and verify the resulting UI state. If either
   choice is unavailable, stop before the boot prompt and offer to reconfigure.
   If it is Work, do not continue there — switch to a new Chat conversation
   (HANDOFF). If no switcher is visible, do not hunt menus; continue.
   Send the boot prompt and the workspace_info check in that Chat conversation.
   Confirm the reply names the current workspace **before** saving or replacing
   the session URL. If validation fails, keep the old saved URL. Do not open a
   throwaway verify chat and later another C2C chat.

   A collection or chat page that shows only `Retry` / `重试` is a navigation
   error, not generation and not a pairing failure. Reuse the same iab tab.
   Try Retry once. If it stays Retry-only, `goto` the last working chat URL
   from this thread (or `session.url` if that is the only saved chat), then
   click the on-page `Open … project` / `打开“… ”项目` link — that same-site
   hop is allowed. Do not treat the URLs-only rule as forbidding this link.
   On the collection, require the project chat list and new-chat composer
   before continuing. Keep the old saved URL/checkpoint until the replacement
   chat passes workspace_info. Do not `session clear`. Do not use Computer Use.

8. **Wait for a ChatGPT reply (do not hold one long browser wait).** After you
   send INIT, EXECUTED, boot, or the workspace_info check: `markHandoff`, keep
   the tab foreground, and stay in this same task. Do not `waitFor` 5 minutes
   and do not screenshot-poll. Every 20–30 seconds, one cheap DOM check:
   - still generating → wait again (do not type, do not resend);
   - `STATE: PLAN` / `PATCH` / `DONE` / `BLOCKED` / the verify workspace name → read it
     and continue the existing protocol;
   - visible error → repair; do not start a new chat.
   A browser/js timeout is not failure. Claim the same tab, read the page, keep
   standby. If ChatGPT is still thinking, keep polling. Never open a second
   tab and never resend INIT/EXECUTED just because a wait timed out.

## Locations

- The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`
  (installer/update MUST replace this line in the installed Skill with the user's actual checkout path.)
- CLI: let `<checkout>` mean the path on the previous line; run
  `node "<checkout>/bin/c2c.js" <command>` (or `c2c <command>` if globally linked).
  All commands support `--json` for parsing.
- If the checkout has no `node_modules` or no `dist/`, first run
  `corepack pnpm install && corepack pnpm build` inside it.
- For commands that act on the user's project (`setup`, `doctor`, `session`,
  `restart`, `start`, `stop`, `status`, `pair`, `unpair`, `logs`, `workspace`,
  `record`, `tunnel status`, `tunnel choose`), pass `-w <workspace root>`
  (the project the user is working on, NOT the c2c repo).
- Do not add `-w` to machine-wide commands: `update-check`, `sandbox-allow`,
  `prefs`, `tunnel login`. They still accept and ignore `-w`, so a leftover
  flag must not fail the command.

## Daily update check

At the START of every workflow below (before anything else), run these two
commands (both are cheap / cached; never mention them unless an update exists):

1. `c2c update-check --json` (do not pass `-w`)
2. `c2c sandbox-allow --json` (do not pass `-w`) — writes the C2C state directory into Codex's
   sandbox `writable_roots` (macOS: `~/Library/Application Support/codex-with-chatgpt`;
   Windows: `%LOCALAPPDATA%\codex-with-chatgpt`; config file is
   `~/.codex/config.toml` on both, or `%USERPROFILE%\.codex\config.toml` on Windows).
   If already allowlisted, this is a no-op and does not trigger elevation.

- `{ "updateAvailable": false }` → continue silently. Never mention the check.
- `{ "updateAvailable": true }` → tell the user one line:
  "检测到 Codex with ChatGPT 有新版本，我先更新一下（约 1 分钟），随后继续你的任务。"
  Then run the update workflow below, and CONTINUE the original task afterwards.

## Workflow: update（"更新 Codex with ChatGPT"，or triggered by the daily check）

Inside the checkout directory (see Locations):

1. `git pull --ff-only` (if it fails due to local edits: `git stash && git pull --ff-only`).
2. `corepack pnpm install && corepack pnpm build`.
3. Re-install the Skill: copy `skill/SKILL.md` to
   `~/.codex/skills/codex-with-chatgpt/SKILL.md`, then fix the "checkout lives at:"
   line in the copy to the actual checkout path.
4. `c2c sandbox-allow --json` (so existing installs pick up the sandbox allowlist),
   then `c2c restart -w <workspace>` so the bridge runs the new code, then
   `c2c update-check --force --json` to refresh the cache (should now report up to date).
5. Tell the user "✓ 已更新到最新版本" — then resume whatever task triggered this.
   (The updated SKILL.md takes effect from the next Codex session; that's expected.)

## Connection choice (once per workspace)

Ask this **before** the public address exists (`c2c setup` / first `doctor --fix`
that starts a tunnel). Do not mention tunnels, wrangler, DNS, or hostnames.
Speak only of 临时地址 / 固定域名 / 登录 Cloudflare.

1. `c2c tunnel status -w <workspace> --json`
2. If `needsChoice` is false: do not ask again.
3. If `needsChoice` is true: tell the user exactly `userPrompt` and wait.
   - 没有账号 / 没有域名 / 临时 / 不用 →
     `c2c tunnel choose -w <ws> --mode quick --json`
   - 有域名（例如 example.com）→ first tell them `loginPrompt`, then
     `c2c tunnel choose -w <ws> --mode named --zone <domain> --json`.
     This may open the user's own browser (the Cloudflare exception in
     Golden rule 5). Wait until the command finishes.
     If they said they have an account but gave no domain: ask once for the
     domain. If the command returns `need: "zone"`, ask once and retry.
     If `fallback` is true: tell them `userMessage` and continue on the
     temporary address. Do not retry named unless they ask.
4. Never put connection credentials in the project. The CLI stores them in
   the C2C state directory.

## Workflow: model configuration ("모델 설정" / "모델 재설정" / "ChatGPT 모델 바꿔줘")

This is the user-facing way to choose a model. Never ask the user to type a
model name from memory and never send them to MCP/connector settings.

1. Run `c2c prefs --json` and remember the current `chatgptModel` and
   `chatgptEffort`.
2. Reuse the one IAB ChatGPT tab, foreground + `markHandoff`. Open an **unsent
   new Chat** surface only for inspecting selectors; do not send a message and
   do not save it as the C2C session. This inspection page is an explicit
   exception to the normal conversation-reuse rule.
3. Open the ChatGPT model picker and inspect the live DOM/ARIA structure.
   The signed-in web UI is the source of truth for availability:
   - collect enabled, actually visible selectable entries;
   - do not use a hard-coded plan/model list as the authority;
   - ignore disabled/upgrade-only entries unless they are clearly selectable;
   - use accessible labels/descriptions/submenus to distinguish **model family**
     from **reasoning/effort**.
   If the UI is flattened (for example effort-first entries), group entries by
   the underlying model label only when the DOM/accessibility text makes that
   mapping explicit. If it does not, do not invent a model-family mapping:
   present the raw available choices instead and explain that this account's
   picker is flattened.
4. Show the user a numbered **available model list** in Codex, including the
   current saved model when applicable. Also include "ChatGPT 기본값 사용".
   Example shape only (never hard-code these as the real options):

   ```
   사용 가능한 ChatGPT 모델
   1. GPT-5.6 Sol
   2. GPT-5.6 Sol Pro
   3. GPT-6 Pro
   0. ChatGPT 기본값 사용

   현재 설정: GPT-5.6 Sol / High
   번호를 선택하세요.
   ```

   Wait for the user's choice. Accept the number or exact displayed name.
5. If the user selects the default, run
   `c2c prefs set --model default --effort default --json`, confirm that future
   new chats will use ChatGPT's default, and finish.
6. For a selected model, use the picker DOM to enumerate the **effort/reasoning
   choices that are actually available for that model on this account**.
   Temporarily selecting the model on the unsent page is allowed when necessary
   to reveal its effort controls.
   - Never assume Instant/Medium/High/Extra High/Pro availability from the plan.
   - Do not show an effort that is disabled or absent.
   - If there is no separate effort control for that model, say so and store the
     model with effort cleared.
7. Show the numbered effort list, for example:

   ```
   GPT-5.6 Sol에서 사용 가능한 effort
   1. Instant
   2. Medium
   3. High
   4. Extra High

   번호를 선택하세요.
   ```

   Wait for the user's choice.
8. Save the **exact discovered labels**, not the numeric indices:
   `c2c prefs set --model "<model label>" --effort "<effort label>" --json`.
   If there is no separate effort, use
   `c2c prefs set --model "<model label>" --effort default --json`.
9. Read `c2c prefs --json` once to verify persistence, then tell the user the
   final model/effort in one line and note that it applies to **new C2C chats**.
   Leave the IAB tab in standby. Do not create a ChatGPT history item merely for
   configuration.

## Workflow: first-time setup（"使用 Codex with ChatGPT 完成首次配置"）

1. Detect prerequisites yourself: `node --version` (>= 20), and check `cloudflared`.
   - If cloudflared is missing on macOS run `brew install cloudflared`; on Windows use
     `winget install Cloudflare.cloudflared`. Do this yourself; don't ask.
2. If the c2c repo has no `node_modules`, run `pnpm install && pnpm build` in it.
3. Run `c2c sandbox-allow --json`, then **Connection choice**, then
   `c2c setup -w <workspace> --json`.
   `sandbox-allow` edits Codex `config.toml` only — it adds C2C's state directory
   to `[sandbox_workspace_write].writable_roots` so later chats can write logs
   without elevation. If the write is denied, request approval and retry once.
   → returns `{ mcpUrl, pairingCode, workspaceName, connectorName, ... }`.
   `connectorName` is this workspace's plugin title (legacy installs stay
   `Codex with ChatGPT`; additional workspaces get `Codex with ChatGPT · <name>`).
   Pairing codes expire in ~5 minutes. Do not mint one until the ChatGPT
   Authorize / pairing form is on screen: run `c2c pair --json` then type
   that code immediately. Doctor does not pre-mint a code.
4. `c2c prefs --json` (this machine, not this workspace).
   - `chatgptModel` and `chatgptEffort` are optional preferences for newly
     created chats. If set, step 6 applies both before the boot prompt.
   - Do not ask for a raw model name during setup. If the user wants to choose
     or change them, run **Model configuration**, which discovers the live
     account-specific choices from ChatGPT's web UI.
   - If `setupMode` is null: tell the user exactly `setupChoicePrompt`. Wait
     for「1」or「2」. Then `c2c prefs set --setup-mode auto` or `--setup-mode manual`.
     Do not open ChatGPT settings and do not start automatic configuration
     until they answer. Do not default to auto.
   - If they later ask to switch: same `c2c prefs set --setup-mode` command.
     Do not re-ask on a later workspace or on reconnect.
   - `setupMode: "manual"`: skip step 5's automatic ChatGPT settings. Go to
     **Guided manual ChatGPT setup** (chosen). Opening line:
     `接下来用手动教学配置。一次只需要做一个操作。`
     Do not say 自动配置没有成功.
   - `setupMode: "auto"`: continue with step 5. Keep the two-failure fallback.
5. Open ChatGPT on the ONE iab tab (see **In-app browser**). Foreground +
   markHandoff immediately. Same tab, `goto` only:
   - 开发人员模式: skip `https://chatgpt.com/#settings/Security` when
     `developerModeEnabled` is true. Otherwise open it, enable 开发人员模式
     ("Developer mode") if it is off, then `c2c prefs set --developer-mode`.
     Never record it as off. If creating the connector later says developer
     mode is required, open this page, enable it, save `--developer-mode`,
     and retry create — do not skip that recovery.
   - 已有该 `connectorName`: `https://chatgpt.com/plugins` — Delete it (never
     Reconnect). Then `goto` the 加插件 URL below.
   - 还没有 / 刚删掉: `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`
     Operate ONLY on `connectorName` from step 3:
      - If that exact name exists: Delete it, then create it again. Never
        Reconnect, never edit-in-place, never open the old Server URL.
      - If it does not exist: create one with that exact name.
      - Never rename, delete, or edit a connector that belongs to another workspace.
      - Description: `Securely connect ChatGPT to the current Codex workspace for planning and review.`
      - Server URL: the `mcpUrl` from step 3
      - Authentication: OAuth
     Fill the known form in one script when you can. Then Connect / Authorize.
     Only then run `c2c pair --json` and type that code. As soon as it shows
     Connected / authorized / pairing accepted, continue — do NOT wait for 8
     tools on this page.
6. Same tab: open the first C2C chat per **Conversation management**
   (Project collection for a new workspace; `https://chatgpt.com/` only
   in long-chat). Confirm Chat mode and apply the preferred model/effort per
   **In-app browser** §7. If either configured choice is unavailable, do not
   send the boot prompt; offer **Model configuration**. Send the boot prompt from
   `docs/protocol.md` §Boot Prompt, then (same chat) send:
   `Use the "<connectorName>" connector: call workspace_info and read hello-style top-level file. Reply with the workspace name.`
   Confirm the reply matches `workspaceName` (wait per **In-app browser** §8).
   Only then save the chat URL with `c2c session set` (see Conversation
   management). If the name does not match, do not save. markDeliverable.
7. Report to the user exactly in this shape (no internals):

```
Codex with ChatGPT

✓ 当前项目已识别
✓ Workspace Bridge 已启动
✓ 安全连接已建立
✓ ChatGPT 已连接
✓ 文件读取测试通过

Ready.
```

If a login wall appears (ChatGPT, Cloudflare): stop, tell the user the ONE thing
to do ("请登录 ChatGPT，完成后告诉我'好了'"), then continue.

### Guided manual ChatGPT setup

Enter this path when `setupMode` is `manual` (chosen at the start), or when
automatic ChatGPT browser configuration fails twice at the same explicit
setup/reconnect step after `c2c doctor` / repair. Do NOT enter the failure
path for a browser/js timeout without a visible error, a page that is
still loading/generating, or while waiting for login / 2FA / CAPTCHA.
A chosen manual path does not wait for those two failures.

Stop automating ChatGPT settings. Keep the current local C2C state and the
current `mcpUrl`, `pairingCode`, `workspaceName`, and `connectorName`. Do not
silently fall back to Codex-only execution and do not permanently disable C2C.
Do not change the saved `setupMode` when this is a failure fallback.

Opening line:

- Chosen (`setupMode: "manual"`): `接下来用手动教学配置。一次只需要做一个操作。`
- Failure fallback: `自动配置没有成功，我来带你手动完成。一次只需要做一个操作。`

Then guide ONE action at a time, waiting for the user to say「好了」before the
next action:

1. If `developerModeEnabled` is not true: ask them to open
   `https://chatgpt.com/#settings/Security` and enable 开发人员模式. After they
   say「好了」, `c2c prefs set --developer-mode`. If it is already remembered,
   skip this step.
2. Ask them to open `https://chatgpt.com/plugins`. If the exact `connectorName`
   exists, delete only that connector. Never ask them to touch another workspace's connector.
3. Ask them to open
   `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`
   and create the exact `connectorName` with:
   - Description: `Securely connect ChatGPT to the current Codex workspace for planning and review.`
   - Server URL: the current `mcpUrl`
   - Authentication: OAuth
4. Ask them to Connect / Authorize. Then run `c2c pair --json` and give them
   only that pairing code. If it expires before they finish, run pair again.
5. When they report Connected / authorized / pairing accepted, resume the normal
   setup/reconnect flow at its ChatGPT verification step. If automatic browser
   verification then hits the same explicit failure twice, stop and report the
   exact failed step; do not loop indefinitely and do not continue without C2C.

## Conversation management

`c2c session -w <ws> --json` → `{ session, conversation }`.
`conversation.mode` is the only switch. Missing / legacy files with a chat URL
and no Project stay **long-chat**. Do not ask those users to migrate. If they
later say they want a Project, run **Bind Project**. A brand-new workspace
(no session file) is **project**.

Never match a Project or a chat by display name. Never upload the repo to
Project sources. Never click 分享 / Share. Do not rename ChatGPT chats.

### long-chat (do not rewrite this path)

ONE ChatGPT conversation per workspace. Same as before.

- **Find it**: if `conversation.reuseSavedChat` and `conversation.chatUrl`,
  `goto` that URL (foreground + markHandoff) and continue there.
- **Save it**: after boot + workspace_info, and the reply names this workspace,
  `c2c session set -w <ws> --mode long-chat --url <url> --title "C2C <workspace name>"`.
  If the name does not match, do not overwrite a previously saved URL.
- **Update it**: after each EXECUTED/DONE,
  `c2c session set -w <ws> --task <id> --iteration <n> --state <STATE>`
  plus checkpoint flags from the coding workflow (`--protocol-state`,
  `--waiting-for`, `--goal`, `--next-step`, `--known-issues`, or
  `--clear-checkpoint` on DONE). Do not put logs or diffs in those fields.
- **Switch it** ONLY when (a) the user asks for a new chat, (b) the current
  chat visibly lags, or (c) this conversation is Work. Then:
  1. Same iab tab: `goto` `https://chatgpt.com/`, confirm Chat mode
     (**In-app browser** §7), then send the boot prompt.
  2. Send a HANDOFF (`docs/protocol.md`) — goal, progress, state, issues,
     next step. Never paste files.
  3. workspace_info check; only then `c2c session set --url`. On failure,
     leave the old saved URL unchanged.
- Saved chat 404s: treat as a switch. Reconstruct HANDOFF from
  `session.checkpoint` (goal, progress, issues, next step). If there is no
  checkpoint, use `task` / `iteration` / `lastState` and `execution_summary`
  metadata only. Never paste logs or output bodies.

### project (new workspaces)

One ChatGPT Project per workspace. Mapping:

1. Same Codex conversation (this thread still has context) → same ChatGPT
   chat URL. `goto` that URL directly. Do not open the collection first.
2. Same workspace, a **new** Codex conversation → new ChatGPT chat from the
   collection page (`conversation.projectUrl`). Ignore `session.url` unless
   you already saved it earlier in THIS Codex thread.
3. Different workspace → different Project and different connector.

**Open a chat in this Codex thread**

- If you already saved a ChatGPT chat URL earlier in THIS Codex conversation:
  `goto` that URL. Continue. No new chat. No HANDOFF.
- Else if `conversation.projectReady`: `goto` `conversation.projectUrl`.
  On that page, use the on-page composer (「{项目名}中的新聊天」 / "New chat
  in …"). Do not use the sidebar and do not `goto` `https://chatgpt.com/`.
  Confirm Chat mode (**In-app browser** §7). Boot prompt, then workspace_info
  with the **exact** `connectorName`. After the reply names this workspace,
  `c2c session set -w <ws> --mode project --project-url <collection> --url <chat> --connector-name "<connectorName>" --title "C2C <workspace name>"`.
  If this Codex thread is continuing a previous C2C task, send HANDOFF right
  after the boot prompt.
- Else: **Bind Project** first.

**Update it**: same `c2c session set --task / --iteration / --state` as long-chat.

**Wrong collection**: do not guess another Project. Tell the user the expected
workspace name, ask them to open the right collection, then say「已找到」.
Also offer「继续用长对话」. If they pick long-chat:
`c2c session set -w <ws> --mode long-chat` and use the long-chat path.
If the collection 404s or the new chat is not inside the Project, same choice.

**Saved chat 404s** (this thread): `goto` the collection, open a new chat
there, boot + HANDOFF from `session.checkpoint` (no logs) + workspace_info,
then save the new chat URL. Keep `--project-url`.

### Bind Project (user creates the collection once)

Do this for a new workspace, or when an existing user asks to switch to
Project. Do **not** click the ChatGPT sidebar to create the Project
(Computer Use is forbidden; IAB must not hunt that menu).

1. Tell the user exactly this (fill in the workspace name):

```
请在 ChatGPT 里新建一个项目，名字用「<workspaceName>」，记忆请选「仅限项目记忆」。

如果侧栏里看不到「项目」：把鼠标放在「聊天」上，点右边出现的三个点，选择「按项目整理」。

建好后会打开合集页面。看到页面后跟我说「好了」。
```

2. Wait for「好了」/ the collection page. Same iab tab: read the address bar.
   It must look like `https://chatgpt.com/g/g-p-…/project`. If it does not,
   ask them to open that project until it does. Then:
   `c2c session set -w <ws> --mode project --project-url <url> --connector-name "<connectorName>"`.

3. On that same collection page only, open 右上角 **… → 项目设置**.
   Do not click 分享. Do not add 来源 / files.
   - 记忆: 仅限项目记忆 (project-only). Leave 库访问权限 disabled.
   - 指令: paste **Project instructions** below (fill `{{…}}` from
     `workspace_info` / setup). Use the exact `connectorName` from setup.
     Never write the public / temporary address into 指令.
   Save and close settings.

4. Still on the collection page, create the first chat with the on-page
   composer, then boot + workspace_info as in setup step 5. Save the chat URL.

### Project instructions (paste into 项目设置 → 指令)

```
You are the planning, coding-proposal, and review layer for one local workspace.
Codex exclusively executes and mutates the repository.

This Project is bound only to:
- Workspace name: {{workspace_name}}
- Kind: {{project_type}} ({{languages}} / {{frameworks}})
- Connector (use this one only): {{connector_name}}

When you call tools, use ONLY that connector. Do not use any other
Codex with ChatGPT connector. If workspace_info names a different
workspace, stop. Do not plan. Do not use this Project's memory.

Read code, git, diffs, and any released command output through that
connector. Never ask anyone to paste file bodies, diffs, logs, or patch bodies.
When the current C2C task explicitly uses code/auto mode, you may call
`submit_patch`. It stores a bounded proposal outside the repository and never
applies it; Codex remains the only repository writer. After EXECUTED, call execution_output (list, then read) when a readable item
exists; if status is restricted, review from git instead. Never upload
the repo into this Project's files or sources.

When facts conflict, trust this order:
1. Current code from the connector
2. A HANDOFF in this chat (this task's goal, progress, next step)
3. These instructions
4. This Project's memory (durable architecture only; stale memory loses)

This Project's memory is only for this workspace. On HANDOFF, trust the
brief, re-read code through the connector, and resume at NEXT_EXPECTED_STEP.

Be substantive: why, which file, what to test. No empty one-liners and
no 40-step epics. Use C2C control messages.
```

## Workflow: coding task ("Codex with ChatGPT로 XXX" / coding subagent)

C2C has two implementation paths:

- **plan path**: ChatGPT plans/reviews; Codex writes code (classic behavior).
- **patch path**: ChatGPT writes a bounded patch proposal; Codex alone validates,
  applies, tests, and owns git.

Repository mutation, shell, tests, package installation, and git remain Codex-only.

Protocol messages: `INIT → (PLAN | PATCH) → EXECUTING → EXECUTED → REVIEW → ...`.
PATCH may be rejected locally: `PATCH → PATCH_REJECTED → PATCH | PLAN | BLOCKED`.
Local checkpoint states:
`INIT`, `PLAN_RECEIVED`, `PATCH_RECEIVED`, `EXECUTING`,
`EXECUTED_LOCAL`, `EXECUTED_SENT`, `DONE`, `BLOCKED`.
Never invent `STATE: RESUME`. All control messages start with `[C2C]`, stay
below **4 KiB UTF-8**, and contain no file/diff/log/patch bodies.

### Choose task mode

Choose once from the user's wording; do not ask if the intent is clear.

- `plan`: explicit planning/architecture request, or ordinary C2C usage that
  does not ask ChatGPT to write code. This preserves upstream behavior.
- `code`: user asks ChatGPT/C2C to act as a coding subagent, write code, create
  a patch, or implement the code itself.
- `review`: review-only request.
- `auto`: only when the user explicitly asks C2C to choose between planning
  and patching autonomously.

### 0. Health + one-time proposal authorization

1. Run `c2c tunnel status -w <workspace> --json`; resolve the one-time
   connection choice when needed.
2. Run `c2c doctor -w <workspace> --json`. Respect the normal Doctor gate.
3. For `code` or `auto`, inspect
   `capabilities.proposalWriteAuthorized`.
   - true → continue.
   - false with an existing working connector → coding-subagent mode needs one
     one-time authorization upgrade. Tell the user, in plain language, that
     ChatGPT will gain permission only to **submit isolated patch proposals**;
     repository write/shell/git remain Codex-only.
   - Recreate this workspace's exact `connectorName` at the current working
     `mcpUrl` using the normal connector-create flow and a fresh pairing code.
     Do not touch another workspace's connector.
   - Run doctor again and require
     `capabilities.proposalWriteAuthorized=true`. If it remains false, do not
     weaken the scope check; fall back to `plan` mode and explain that patch
     submission was not authorized.
4. Generate task id `c2c_` + 4 random hex chars unless an active checkpoint
   already has one.

### 1. Open/resume the C2C conversation

Run `c2c session -w <workspace> --json` and open ChatGPT per Conversation
management. On a new chat apply the configured model/effort, boot prompt, and
workspace_info check before saving the URL.

**Resume from checkpoint before sending INIT:**

- `EXECUTED_SENT` + `GPT_REVIEW`: wait for the existing review.
- `EXECUTED_LOCAL`: send only EXECUTED; do not rerun work.
- `PATCH_RECEIVED`: use its `proposalId` and continue **Secure proposal
  handling** below. Never ask ChatGPT to submit a duplicate patch.
- `EXECUTING` with a proposal id:
  - inspect that proposal.
  - if status is `applied`, continue tests/recording.
  - if status is `pending` and targets are unchanged, resume normal proposal
    validation/application.
  - if status is `pending` but targets are stale, run
    `git apply --reverse --check "<patchPath>"`. If it succeeds, the patch is
    already present; mark it applied and continue. If it does not, stop rather
    than guessing, mark failed, and surface the ambiguity.
- `EXECUTING` without a proposal id: continue the current PLAN if available;
  otherwise HANDOFF and ask ChatGPT to restate the PLAN.
- `PLAN_RECEIVED`: execute that PLAN.
- `INIT` + `GPT_PLAN`/`GPT_ACTION`: claim the same chat and wait; never
  resend INIT because of a browser timeout.
- `DONE`: summarize/clear checkpoint.
- `BLOCKED`: surface the reason.

Never re-pair/recreate a connector merely to resume an ordinary task.

### 2. Send INIT

Send a bounded INIT with the chosen mode:

```
[C2C]
STATE: INIT
TASK_ID: c2c_f81a
ITERATION: 0
MODE: code

GOAL:
<user's goal, one concise paragraph>

INSTRUCTION:
Inspect the connected workspace through MCP.
For code mode, if a bounded code change is appropriate, implement it with
submit_patch and reply STATE: PATCH with only proposal metadata.
Never paste a patch into chat. If patching is unsafe/inappropriate, reply PLAN
or BLOCKED instead.
```

After the message is visibly sent:

- `plan` → checkpoint `INIT --waiting-for GPT_PLAN`.
- `code`/`auto`/`review` → checkpoint `INIT --waiting-for GPT_ACTION`.

### 3A. PLAN path

For `STATE: PLAN`, read rationale/actions/tests/success criteria. Require
concrete per-file natural-language guidance when implementation is requested.
Checkpoint `PLAN_RECEIVED`, then `EXECUTING`, and execute with Codex's own
tools. ChatGPT never micro-manages Codex tool calls.

### 3B. PATCH path — Secure proposal handling

A PATCH control message may contain only metadata such as:

```
[C2C]
STATE: PATCH
TASK_ID: c2c_f81a
ITERATION: 1
PROPOSAL_ID: p_0123456789abcdef
FILES: 3
RISK: normal
SUMMARY:
...
```

**Never accept a diff pasted into the chat as a substitute for `submit_patch`.**

On PATCH:

1. Require the same `TASK_ID`; checkpoint immediately:
   `c2c session set -w <ws> --iteration <n> --state PATCH --protocol-state PATCH_RECEIVED --waiting-for none --proposal-id "<id>" --next-step "validate patch proposal"`.
2. Run `c2c proposal inspect -w <ws> <id> --json`.
3. Require all of:
   - proposal id matches;
   - `meta.taskId` equals current task id;
   - `meta.iteration` equals the PATCH iteration;
   - `meta.status == "pending"`;
   - integrity inspection succeeded;
   - `stale == false`.
   Never apply a proposal that fails any check.
4. Review `meta.paths`, `meta.risk`, and `meta.riskReasons`.
   - `normal`: continue.
   - `execution-sensitive`: show the affected paths + risk reasons and obtain
     **explicit user approval** before applying. If declined, mark rejected and
     send PATCH_REJECTED.
5. Read the proposal patch locally using Codex's own local file capability at
   `patchPath`. Inspect the actual changes against the user's goal. This local
   review must not be pasted back into ChatGPT. Reject unrelated, suspicious,
   credential-bearing, destructive, or scope-expanding changes.
6. Run `git apply --check "<patchPath>"` from the workspace. Never pass
   `--unsafe-paths`. If it fails, mark failed and send PATCH_REJECTED; do not
   hand-edit around a failed proposal.
7. Checkpoint `EXECUTING` with the proposal id, then run
   `git apply "<patchPath>"`. This is a Codex shell action, not an MCP action.
8. Immediately run
   `c2c proposal mark -w <ws> <id> --status applied --json`.
   If application failed, mark `failed`.
9. Run `git diff --check` and inspect the resulting workspace diff before
   executing tests/builds. Do not blindly execute a newly introduced command
   just because the patch proposed it.

**Rejection message** (under 4 KiB, no patch body):

```
[C2C]
STATE: PATCH_REJECTED
TASK_ID: c2c_f81a
ITERATION: 1
PROPOSAL_ID: p_0123456789abcdef

REASON:
<short local validation/staleness/user-decision reason>

INSTRUCTION:
Re-read current files through MCP and submit a fresh proposal, or reply PLAN/BLOCKED.
```

After sending PATCH_REJECTED, checkpoint `INIT --waiting-for GPT_ACTION` with
the same task id/iteration and wait. Never apply the rejected id later.

### 4. Test and record

After Codex-authored PLAN changes or an accepted PATCH:

1. Run appropriate tests/typecheck/lint/build using Codex's normal judgment.
   For execution-sensitive proposals, user approval from step 3B is required
   before any new/changed execution configuration is used.
2. Record metadata:
   `c2c record -w <ws> --task <id> --iteration <n> --changed-files "<files>" --tests "<summary>" --exit-status ok`.
3. For test/build/lint/typecheck output, use the existing opt-in
   `--command --output-file --exit-code` path; never paste logs into ChatGPT.
4. Checkpoint `EXECUTED_LOCAL`.

### 5. Send EXECUTED and review

Send metadata only:

```
[C2C]
STATE: EXECUTED
TASK_ID: c2c_f81a
ITERATION: 1

RESULT:
Execution finished.

PROPOSAL_ID:
p_0123456789abcdef

CHANGED_FILES:
3

TESTS:
27 passed

Please independently inspect the workspace and git diff through MCP.
Use execution_output only when a readable item exists.
```

Omit PROPOSAL_ID for Codex-authored PLAN execution. Then checkpoint
`EXECUTED_SENT --waiting-for GPT_REVIEW`.

ChatGPT reviews via MCP and may reply:

- `DONE` → summarize and clear checkpoint;
- `PLAN` → follow 3A;
- `PATCH` → follow 3B (a review fix may be a new proposal);
- `BLOCKED` → checkpoint BLOCKED / USER and surface the decision.

Loop up to `maxIterations` (default 12). At the limit, ask the user whether to
continue. A proposal submission does not bypass the iteration limit.

## Workflow: disconnect（"断开 ChatGPT"）

1. `c2c unpair -w <workspace>` (revokes all tokens immediately).
2. Optionally remove the connector on the same iab tab via
   `https://chatgpt.com/plugins` (foreground + markHandoff). Only touch
   this workspace's `connectorName`.
3. Tell the user: "已断开 ChatGPT 对该项目的访问。"

## Workflow: reconnect after address reclaim（全关掉以后地址失效）

This is the normal case when the user quit Codex / the terminal / the machine:
the previous public address is gone. Doctor already started a new one.
`connectorAction: "update"` means Delete + create again — not Reconnect.

`c2c doctor --json` will look like:
`{ "chatgptRepair": { "needed": true, "connectorAction": "update", "connectorName": "...", "userMessage": "...", "mcpUrl": "...", "pages": { ... } } }`

1. Tell the user exactly `chatgptRepair.userMessage`. Then you repair. Do not
   ask them to click around ChatGPT unless a login wall appears. Do not open
   the C2C chat and do not send `[C2C]` until this repair finishes and a
   follow-up doctor is green. Never "try a message first to see if it works".
   Reuse `c2c prefs --json`. Do not re-ask setup mode. If `setupMode` is
   `manual`, use **Guided manual ChatGPT setup** (chosen) instead of automating.
2. Same one iab tab as setup (foreground + markHandoff). Settings URLs only
   until Connected — never hunt menus:
   - 开发人员模式: skip `https://chatgpt.com/#settings/Security` when
     `developerModeEnabled` is true. If create/delete then says developer
     mode is required, open it, enable, `c2c prefs set --developer-mode`.
   - 插件总管（只用来 Delete）: `https://chatgpt.com/plugins`
   - 加插件（Delete 之后必走）: `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`
3. Operate ONLY on `chatgptRepair.connectorName`. Never touch another
   workspace's connector.
   - If that exact name exists on the plugins hub: **Delete** it. Confirm the
     delete if ChatGPT asks. **Never click Reconnect, Refresh, Connect, or
     Edit** on the old card — the old Server URL is dead and the page will
     hang on "This site cannot be reached".
   - Then `goto` the 加插件 URL and create that **same** `connectorName`
     (do not invent a second name):
      - Description: `Securely connect ChatGPT to the current Codex workspace for planning and review.`
      - Server URL: `chatgptRepair.mcpUrl`
      - Authentication: OAuth
     Then Connect / Authorize. Only then run `c2c pair --json` and type that
     code. Continue as soon as it is Connected — do not wait for 8 tools on
     the settings page.
   - If the name is already gone, skip Delete and only create.
4. `c2c doctor --json` again. Same tab: only after the Doctor gate is green,
   reopen the chat this Codex thread was already using (`session.url` /
   the URL you saved earlier in THIS thread). Do not rewrite Project
   instructions — they store the connector **name**, which did not change.
   In that same chat, send the workspace_info check from setup step 6
   (exact `connectorName`). Doctor green is not enough: the old conversation
   may still be bound to the deleted connector.
   - If the reply names this workspace: continue there. Save the URL if needed.
   - If workspace_info fails, times out, or cannot read the name: do **not**
     keep retrying that old URL. project → collection page, new chat in this
     Project, boot + HANDOFF from `session.checkpoint` (no logs) +
     workspace_info, then `c2c session set --url` only after the name matches.
     long-chat → Conversation management switch, same checks. Keep the old
     saved URL until the new chat passes.
5. If the ChatGPT conversation was lost: same as the failure path in step 4.
   No file re-uploading (the workspace lives in MCP). If tools point at
   the wrong connector, open 项目设置 and confirm 指令 still names
   `connectorName` (never paste the new public address).

## Workflow: repair（anything looks broken）

1. `c2c doctor -w <workspace> --json`. Doctor gate: do not open ChatGPT / send
   `[C2C]` until local is green, except reconnect settings pages.
2. If `namedRepair.needed`, tell the user `namedRepair.userMessage`, run
   `c2c tunnel login --json`, then doctor again. Do not Delete the connector.
3. If `chatgptRepair.needed`, follow **reconnect after address reclaim**, then
   doctor again.
4. Otherwise apply the recovery map. Only involve the user for login / 2FA /
   CAPTCHA — one action.

## Recovery map

| Symptom | Action |
| --- | --- |
| Bridge not running | `c2c start` (doctor does this automatically) |
| Tunnel dead / URL unreachable / 全关掉后连接失效 | `c2c doctor` → if `namedRepair.needed`, login to Cloudflare and doctor again (do not Delete). If `chatgptRepair.needed`, tell the user the message, then **Delete** THIS workspace's connector only (`connectorName`) and create it again. Never Reconnect. After recreate, re-check `workspace_info` in the saved chat; if it still fails, new chat in the same Project (or long-chat switch) + HANDOFF. |
| Collection page shows only Retry | Same iab tab: Retry once, then open the last working chat and click its Project link. Do not write INIT/EXECUTED waiting checkpoints until the message is visible. |
| ChatGPT says tool call failed / 401 | token expired or revoked → re-pair (new pairing code + authorize) |
| Pairing code rejected/expired | `c2c pair --json` for a fresh code |
| Same explicit ChatGPT setup/reconnect browser configuration step fails twice after repair | Stop automating ChatGPT settings and use **Guided manual ChatGPT setup fallback**. Do not count browser/js timeout, loading/generating, or login/2FA waiting as failures. |
| Port conflict | handled automatically; never surface to the user |
| Every new chat “repairs” / cannot write the log or settings directory | `c2c sandbox-allow --json` (once). Do not ask the user. |
| cloudflared missing | install it yourself (brew/winget), then retry |
| Sidebar has no「项目」 | Ask the user to hover「聊天」, click the …, choose「按项目整理」 |
| Collection page is the wrong Project | Ask the user to open the named collection and say「已找到」, or accept long-chat |