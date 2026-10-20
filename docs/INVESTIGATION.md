## Investigation log: REA, Flighty, and this environment

Each finding has one of these labels:

| Label | Meaning |
| --- | --- |
| **Observed** | I ran it or looked at it directly in this session, and the evidence is listed. |
| **Documented** | Taken from a primary source I read (REA repository, GitHub Docs). |
| **Reported** | Taken from web-search summaries of secondary or official pages that I could **not** open myself. |
| **Inferred** | My reasoning from the evidence above. Not verified. |
| **Unknown** | Not established. |

### 1. Environment (session of 2026-10-20)

| Finding | Label | Evidence |
| --- | --- | --- |
| The repo held only `README.md` (one commit, "Initial commit"). | Observed | `git log`, file listing |
| Node 22.23.3, npm 10.9.9, `google-chrome` and `chromium` are installed. There is no Xcode and no macOS. | Observed | `node -v`, `which google-chrome`, Linux runner |
| The sandbox firewall blocks `flighty.com`, `docs.expo.dev`, `exp.host`, and `example.com`. `registry.npmjs.org`, `docs.github.com`, and `raw.githubusercontent.com` are reachable. | Observed | `curl` returned code 000 / DNS failure; `web_fetch` returned "No address associated with hostname" |
| REA is not registered as an MCP server in this Copilot cloud-agent session. | Observed | No REA tools are available to the agent. `rea doctor` reported `copilot_cli` registration `state: missing` for `~/.copilot/mcp-config.json` |

### 2. REA: what it is and how it connects

| Finding | Label | Source |
| --- | --- | --- |
| REA is published on npm as `rea-agents` (version 6.7.0 at the time of checking) and in the MCP Registry as `io.github.morluto/rea`. It runs as a stdio MCP server started with `npx -y rea-agents@<version> mcp`. | Documented + Observed | `morluto/rea` `server.json`, `docs/installation.md#mcp-registry`; `npm view rea-agents version` → 6.7.0 |
| `npx rea-agents setup` registers REA with supported clients, including **GitHub Copilot CLI** (`--client copilot_cli`) and **VS Code** (`--client vscode`). It shows a preview and asks for approval before writing anything. | Documented | `docs/installation.md` → "Supported agents", "Review setup changes" |
| REA requires Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+. | Documented | REA README → "What you can analyze" |
| Website analysis needs a Chrome-family browser that **you** start with `--remote-debugging-port` on loopback. REA attaches passively through CDP. It does not launch the browser or drive the page; driving a page is a separate Playwright-based tool. | Documented | `docs/browser-observation.md` |
| Native analysis (pseudocode, symbols) needs Hopper, Ghidra, or IDA. Hopper and IDA are commercial; Hopper has a demo with vendor limits. Ghidra is free. | Documented | REA README, `docs/installation.md#hopper` |
| REA includes Apple bundle tools (`inspect-macho`, `decode-interface-builder`, `inspect-asset-catalog`, `demangle-swift`). | Observed | `npx rea --help` output (rea 6.7.0) |
| I installed `rea-agents@6.7.0` in `/tmp/rea` (outside the repo) and ran `rea doctor`. It reported 207 MCP tools and 153 CLI commands, with no agent registration. | Observed | `npx rea doctor` output |
| I used REA's CLI to list CDP targets and take screenshots of **this app's own web build**, served at `http://127.0.0.1:8081`. The result had `confidence: observed`, provider `rea-cdp-browser`. | Observed | `rea list-browser-targets http://127.0.0.1:9222`, `rea capture-web-screenshot …` |

#### Connecting REA to your GitHub Copilot setup

These configurations come from the documentation listed under each option. **I have not applied any of them.** Each one needs your approval.

**A. Copilot CLI or VS Code on your own Windows/Linux machine (recommended for REA work)**

1. Install Node.js 22.19+ (or 24.11+), plus Chrome or Chromium.
2. Run `npx rea-agents@latest setup`. Select `GitHub Copilot CLI` and/or `VS Code`, review the plan, and approve it. Then restart the client.
3. On Linux, Ghidra, JADX, and static JavaScript analysis also need a procps-compatible `ps` (see REA's `docs/installation.md`).
4. Copilot CLI only: REA documents a schema-size issue with some models. The workaround is to add `"REA_MCP_INPUT_SCHEMA_PROFILE": "compact"` to the `env` of `mcpServers.rea` in `~/.copilot/mcp-config.json` (REA `docs/client-configuration.md#github-copilot-cli`).

**B. Copilot cloud agent (this agent, running on GitHub)**

GitHub Docs ("Configure MCP servers for your repository") say that a repository admin adds JSON under **Settings → Copilot → MCP servers**. Local servers need `type`, `command`, `args`, and `tools`. Configuration based on REA's documented manual registration:

```json
{
  "mcpServers": {
    "rea": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "rea-agents@6.7.0", "mcp"],
      "tools": ["list_browser_targets", "inspect_web_page", "capture_web_screenshot", "analyze_web_bundle"]
    }
  }
}
```

Caveats:

- **Partly verified:** all four tool names in the allowlist appear as string literals in the installed `rea-agents@6.7.0` `dist/` (I searched with `grep`). REA's docs say a running server's `binary_session` tool is the authoritative list. GitHub warns that the agent uses configured tools without asking, so allowlist read-only tools.
- **Unverified:** I have not saved this configuration or tested it as a repository MCP setting.
- The cloud agent's firewall blocked `flighty.com` in this session. Even with REA configured, the agent cannot observe that site until a repository admin adds it to the Copilot firewall allowlist.
- REA's web tools need a Chrome instance already running with `--remote-debugging-port`. In the cloud agent, you would start it from `.github/workflows/copilot-setup-steps.yml`. I have not created that file.
- Cost: REA is MIT-licensed and free. Hopper and IDA are paid (optional). Ghidra is free.

### 3. Flighty: website compared with the native app

| Finding | Label | Evidence / note |
| --- | --- | --- |
| The marketing site (`flighty.com`) could not be opened from this environment. I did not inspect, screenshot, or analyze it. | Observed | Firewall/DNS block (see §1) |
| Search summaries say Flighty offers Live Activities and widgets, inbound-plane ("Where's My Plane") tracking, delay predictions, push alerts (delays, gate changes, baggage), connection assistance, Passport and lifetime statistics, calendar/TripIt/email import, friend sharing, and a Pro subscription (about $4.99/month or $59.99/year). | Reported | Web search citing flighty.com, flighty.com/help, flighty.com/pricing, and the App Store listing. These are not first-hand; the summaries contradicted each other on which features are free and which are Pro. |
| Flighty's native architecture, backend APIs, data providers, and implementation. | **Unknown** | Analyzing a website does not reveal how a native app is built. |
| Native-app analysis would need an authorized, **unencrypted** app binary (App Store IPAs are FairPlay-encrypted), a jailbroken or instrumented device, or traffic interception that defeats certificate pinning. | Inferred | Decrypting, defeating pinning, or bypassing DRM is out of scope and was **not attempted**. REA's Mach-O and Interface Builder tools only apply to artifacts you are authorized to analyze. |
| I copied no Flighty code, branding, icons, colors, screenshots, or private API usage. The app's name, palette, and layout are original. | Observed | This repository |

**How to continue legitimately:** use your own screenshots of the public App Store listing and site, plus public help-center articles, to list features at the behavior level. The app's own design comes from first principles, not from imitation.

### 4. REA used on our own artifact

REA's documented scope includes software you own. I used it this way (Observed):

1. Ran `npm run export:web`, then served `dist/` on `127.0.0.1:8081`.
2. Started `google-chrome --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/rea-browser-profile`.
3. `rea list-browser-targets http://127.0.0.1:9222` found the page target titled "Skyline (mock data)".
4. `rea capture-web-screenshot http://127.0.0.1:9222 <targetId>` captured the empty-state screen.

Separately, a throwaway CDP script in `/tmp` (not committed) ran the add-flight flow in that browser: search `ZZ 123`, save, open details, reload, run error searches `999` and `404`, and run the multi-leg search `500`. The DOM text matched the expected states.

All of this was **web only**. It is not iOS.
