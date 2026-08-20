# dsh-agent-browser

An out-of-tree function plugin that exposes Vercel's [`agent-browser`](https://github.com/vercel-labs/agent-browser) CLI as model-facing browser automation tools for DeepSeek Harness.

## Install

Install the CLI first, then verify it is available on `PATH`:

```sh
pnpm add -g agent-browser
agent-browser --version
```

Install this plugin into a harness profile from the GitHub repository:

```sh
dsh plugin --profile headless add github:Lin-A1/dsh-agent-browser
```

The harness CLI forwards plugin management to pnpm in the profile directory. A GitHub install fetches sources, so pnpm runs the package's `prepare` script to build `lib/`; pnpm ≥10 blocks that until you allow it — copy the exact package key pnpm prints into the profile's `pnpm-workspace.yaml` under `allowBuilds` (e.g. `allowBuilds: { dsh-agent-browser: true }`), then re-run the command. For trusted installs, pin a commit: `github:Lin-A1/dsh-agent-browser#<sha>`.

Local development still works by adding the working tree directly:

```sh
dsh plugin --profile headless add ./path/to/dsh-agent-browser
```

## Tools

`browser_open`, `browser_snapshot`, `browser_read`, `browser_click`, `browser_fill`, `browser_type`, `browser_press`, `browser_screenshot`, `browser_eval`, `browser_get`, `browser_wait`, and `browser_close` are registered. Each result contains `ok`, the executed command, bounded stdout/stderr, and parsed JSON when the CLI emitted JSON. A non-zero exit or timeout is returned as `ok: false` with diagnostics.

The optional `session` argument is prefixed with `sessionPrefix` and passed to agent-browser's `--session`; when omitted, `sessionPrefix` is used as the session name. This preserves the daemon across calls while preventing accidental collisions between harness profiles. Screenshots can be directed to `screenshotDir`.

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `executablePath` | `agent-browser` | CLI executable or absolute path |
| `timeoutMs` | `60000` | Child-process timeout |
| `maxOutputChars` | `32000` | Per-stream result cap |
| `sessionPrefix` | `dsh` | Prefix used for isolated CLI sessions |
| `screenshotDir` | unset | Passed as `--screenshot-dir` |

`browser_eval` executes JavaScript in the active page and `browser_open` can reach arbitrary URLs. These are open-world capabilities: use profile permissions, network policy, and the agent-browser `--allowed-domains`, `--confirm-actions`, or `--action-policy` options where the deployment handles untrusted instructions or sensitive browser state. Do not expose credentials through tool arguments or eval expressions.

## Events

This plugin emits no harness events and consumes no harness events. It registers tools through the scoped `tools` service; disposal removes those registrations.

## Upstream Tracker

CLI behavior follows the [agent-browser command reference](https://agent-browser.dev/commands). Report CLI issues to [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser/issues); report adapter issues to this repository.

## 适用版本

- deepseek-harness `0.1.0-rc.7`, commit `99f6f02`
- Node.js `>=22`
- `@deepseek-ai/dsh-tools ^0.1.0-rc.7`
- Tested CLI: verify the installed version with `agent-browser --version`; the adapter relies on the documented JSON-capable core commands and global `--session` option.
