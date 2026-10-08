# Glasser for Claude Code

One key, no contract, pay per call, across paid APIs bought wholesale.

The official [Glasser](https://glasser.ai) plugin for Claude Code. This
repository is a distribution package: configuration plus markdown. It ships no
executable code and no install script.

## Install

```
/plugin marketplace add glasser-ai/claude-plugin
/plugin install glasser@glasser
```

The first tool call opens your browser to sign in.

## Authentication

Nothing to create or paste. The first tool call opens your browser: sign in
to Glasser, choose the Workspace whose balance the agent may spend, and click
**Allow**. That mints a Key named `MCP · <client>` for that Workspace — it is
listed at https://app.glasser.ai/keys like any other Key, and revoking it
there disconnects the client. Disconnecting inside Claude Code does not
revoke the Key; the next sign-in reuses it.

**The optional CLI** authenticates on its own with `glasser login` (browser
device authorization). That stores a Key for the CLI only.

## What you get

**MCP tools** — `search`, `inspect`, `run`, `runs_get`, `runs_list`,
`runs_stop`, `balance`. Only `run` creates a Run and charges the Workspace
balance; the other tools read the catalog, past Runs and the Balance. Every
Run reports its own charge.

**Skill** — the workflow the agent follows: search the catalog, inspect an
Endpoint's Price and charge clauses before running, run, then report the
result and the charge. It uses the MCP tools by default and the CLI for
results too large for the context window, for scripting and for CI.

**Optional CLI** — `npm install -g @glasser-ai/cli`. Same Key, same
Workspace, same Balance. Docs: https://glasser.ai/docs/cli

## Network endpoints and credentials

For reviewers and anyone auditing what this plugin reaches.

| Endpoint | Used by | Credential |
|---|---|---|
| `https://api.glasser.ai/mcp` | the MCP server config | the OAuth access token Claude Code obtains at sign-in; the server resolves it to the `MCP · <client>` Key |
| `https://app.glasser.ai/api/auth` | Claude Code, at sign-in | OAuth authorization server: discovery, client registration, tokens |
| `https://app.glasser.ai` | sign-in and the Workspace consent page; Key management; `glasser login` approval | your browser session |
| `https://api.glasser.ai/v1` | the optional CLI | Key stored by `glasser login`, or `GLASSER_API_KEY` |
| `https://registry.npmjs.org` | the CLI's at-most-daily update check | none |

Nothing in this repository executes. The plugin sends no telemetry of its
own. The service behind these endpoints is governed by Glasser's
[terms of service](https://glasser.ai/terms-of-service) and
[privacy policy](https://glasser.ai/privacy-policy).

## Repository layout

```
.claude-plugin/marketplace.json   Claude Code marketplace (one entry)
plugins/glasser/
├── .claude-plugin/plugin.json    plugin manifest
├── .mcp.json                     MCP server
├── assets/                       directory listing icon
└── skills/glasser/SKILL.md
scripts/                          consistency check and the version bump
```

Releasing: see [DISTRIBUTION.md](DISTRIBUTION.md).

## License

MIT — see [LICENSE](LICENSE). The Glasser service has its own terms.
