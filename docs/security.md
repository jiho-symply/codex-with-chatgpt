# Security Model

## Trust boundaries

1. **Workspace root** is the smallest authorization boundary. One bridge serves
   exactly one workspace; every token is bound to `workspace_id`; a token for
   project A returns 403 on project B's bridge.
2. **Workspace content is untrusted.** README, comments, diffs may contain
   prompt injection. Every MCP tool description carries an explicit warning and
   tools never grant capabilities based on file content.
3. **The model never sees long-lived credentials.** Computer Use only ever
   handles the one-time pairing code. Access/refresh tokens travel only inside
   the OAuth redirect/token endpoints between ChatGPT's client and the bridge.

## Threat model → mitigations

| Threat | Mitigation |
| --- | --- |
| MCP URL leaks | URL alone is useless: every `/mcp` request requires a valid bearer token (401 without, 403 wrong workspace) |
| Pairing code brute force | 8 chars from a 31-char CSPRNG alphabet (~40 bits), 5 attempts per session, per-IP rate limit (10/min), 5-minute TTL, one-time use, session destroyed on limit |
| OAuth CSRF | `state` round-tripped verbatim; authorization requests are server-side records keyed by random ids |
| Code interception | PKCE S256 mandatory (plain rejected); authorization codes are one-time, 5-minute TTL, bound to client + redirect URI |
| Token theft | Opaque high-entropy tokens; stored only as SHA-256 hashes; access tokens live 1 h; refresh tokens rotate on every use (replay of the old one fails); revocation endpoint + `c2c unpair` |
| Workspace traversal | `realpath` canonicalization of the deepest existing ancestor; containment check against the canonical root; case-insensitive comparison on macOS/Windows; rejects `..`, absolute escapes, backslash tricks, null bytes |
| Symlink escape | Canonicalization resolves symlinks before the containment check (file and directory symlinks both covered by tests) |
| Sensitive files | Deny-by-default patterns (.env*, keys, SSH, cloud creds, keychains…) enforced at resolve time — reads, listings, and search all pass through the same gate; `git diff` adds pathspec excludes; `.env.example` allowed |
| Oversized file / diff DoS | read_file caps lines and bytes per response; git_diff paginates by byte offset with hard caps; search caps matches and file sizes |
| Tunnel exposure | Bridge binds 127.0.0.1 only (refuses 0.0.0.0); the only public surface is HTTPS via the tunnel, protected by OAuth; `/health` reveals only a salted workspace hash |
| Admin API abuse | Loopback-only + random admin token (0600 runtime file) + requests with proxy headers (`cf-connecting-ip`, `x-forwarded-for`) rejected; unauthenticated probes get 404 |
| Log credential leakage | Logger redacts token prefixes, bearer headers, token-like parameters, and pairing-code-shaped strings before writing |
| Execution output leak | Codex may nominate test/build/lint logs; a local sanitizer redacts tokens, pairing-code-shaped strings and home paths, truncates size, and refuses private-key blocks entirely. Restricted items are listed without a body. ChatGPT still cannot run commands. |
| Checkpoint / resume dump | Session checkpoints store short protocol fields only (capped), including at most a proposal id. Resume uses the existing chat or HANDOFF — no log/patch paste and no blind re-application. |
| Malicious or prompt-injected patch | ChatGPT cannot apply a patch. `submit_patch` has its own `proposal.write` scope and writes only to the 0700/0600 C2C state directory. The bridge rejects oversized, binary, traversal, symlink, sensitive/noise path, C2C/Git-control-file, rename/copy, permission-mode and submodule patches. File deletions are allowed only as approval-required proposals. |
| Time-of-check/time-of-use patch race | Every target file is fingerprinted (existence, size, SHA-256) at proposal time. `c2c proposal inspect` reports stale targets; Codex refuses stale proposals and also runs `git apply --check` before applying. |
| Patch-triggered command execution / destructive change | Approval-required targets include dependency/build manifests, CI/CD, container/task config, shell/PowerShell scripts, and file deletions. The Skill requires explicit user approval before applying them. Codex locally inspects every accepted patch before running tests/builds. |
| Proposal tampering | Patch bodies are stored owner-only outside the repository with SHA-256 + byte length in metadata; inspection fails if either changes. Proposal ids are random and task/iteration binding is checked before use. |

## Token & scope design

Scopes: `workspace.read`, `workspace.search`, `git.read`, `execution.read`,
`proposal.write`, `offline_access`. Tools enforce scopes individually
(`INSUFFICIENT_SCOPE`). `proposal.write` does **not** grant repository write
access; it only permits bounded proposals in the isolated C2C state store.
Existing connectors authorized before this scope existed may need one
re-authorization before coding-subagent mode can submit a proposal.
Access tokens: 1 hour. Refresh tokens: 30 days, rotated. All tokens bound to
`workspace_id` and `client_id`.

## Storage

State lives under the OS-convention app dir
(`~/Library/Application Support/codex-with-chatgpt` on macOS), directories 0700,
files 0600. Named-hostname preference, tunnel metadata, and patch proposals live
there too (`tunnels/<workspaceId>.json`,
`patch-proposals/<workspaceId>/...`) — never in the project. Only SHA-256 hashes of
tokens are persisted — a stolen state file does not yield usable bearer tokens.

**V1 limitation**: client registrations and token hashes are file-based rather
than OS-keychain-based. Raw tokens are never written anywhere. Keychain
integration is a V2 item.

## What ChatGPT can never do

ChatGPT cannot directly write/delete workspace files, apply a patch, run shell
commands, commit, install packages, or change git state. Those tools do not
exist on the MCP server.

With the dedicated `proposal.write` scope ChatGPT **can only submit a bounded,
validated text patch proposal** to isolated C2C state. Proposal submission is
not repository mutation. Codex remains the only component that can inspect,
approve, apply, test, reject, or commit a proposal.
