# Distribution

How this Claude Code plugin is published and the checks that keep the
package consistent. The multi-client package (Cursor, Codex, Grok Build,
OpenClaw) lives in [glasser-ai/plugins](https://github.com/glasser-ai/plugins).

## Channels

| Channel | How it reads this repo | Status |
|---|---|---|
| Claude Code, self-hosted marketplace | `/plugin marketplace add glasser-ai/claude-plugin` | live on push |
| Anthropic plugin directory | submitted through the directory form | — |

## Release checklist

1. Edit files under `plugins/glasser/`.
2. `node scripts/bump-version.mjs <version>` — writes the version into the
   marketplace entry, the manifest and the skill frontmatter. Claude Code pins
   installs to `version`; a change without a bump reaches nobody.
3. `node scripts/check-manifests.mjs`
4. Commit and push.

## The skill and glasser.ai/SKILL.md

`plugins/glasser/skills/glasser/SKILL.md` started as a copy of
`apps/web/public/SKILL.md` in the main repository (served at
https://glasser.ai/SKILL.md) and is now its own text. The two serve
different setups:

| | glasser.ai/SKILL.md | this plugin |
|---|---|---|
| How it arrives | the agent fetches it at setup | pinned inside the installed plugin |
| What is guaranteed present | nothing — it installs the CLI | the MCP tools |
| Default transport | CLI | MCP tools; CLI for large results, scripting, CI |
| Install command | `curl … \| sh` | none; optional `npm install -g` |
| Version | follows the CLI | follows the plugin |

Everything else — the workflow, the commands table, run statuses,
troubleshooting, the rules for agents — should say the same thing in both.
When the main repository changes one of those sections, port the change here
by hand and bump the version. `check-manifests.mjs` refuses `curl | sh`
and `install.sh`, so a wholesale re-copy cannot slip through.

## The MCP config

`.mcp.json` is a URL and nothing else. The server speaks OAuth: on the first
call Claude Code discovers the authorization server from the 401 challenge,
registers itself, and opens the browser for sign-in and Workspace choice.
No variable, no header, no Key to paste. The checker refuses a `headers`
block or a `${VARIABLE}` placeholder.

## Directory listing fields and the icon

Anthropic's directory reads `icon`, `privacyPolicyUrl` and
`termsOfServiceUrl` from `plugin.json`; Claude Code ignores them at load time.
`icon` points at `assets/icon.png`, the Glasser mark at 1024x1024 with a
transparent ground and the reversed colour pair, so it survives a dark card.
Regenerate it from the monorepo's `generated/logo-panel.svg` when the mark
changes.

The directory holds a version for manual review when bundled text names an
image or font file in backticks or a code block. Only the manifest may point
at the icon; `check-manifests.mjs` fails if the plugin README or the skill
names one.

## Validator

`scripts/check-manifests.mjs` — one version everywhere, the MCP config shape,
the directory listing fields, and the `curl | sh` guard. Run
`claude plugin validate --strict .` as well; it checks the schema.
