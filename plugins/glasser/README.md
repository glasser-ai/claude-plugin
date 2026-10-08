# Glasser plugin

Search, inspect and run paid third-party API endpoints through one Key.
Install instructions, authentication and the list of network endpoints are in
the [repository README](https://github.com/glasser-ai/claude-plugin#readme).

| Component | File |
|---|---|
| Skill | `skills/glasser/SKILL.md` |
| MCP server | `.mcp.json` |

The MCP config points at `https://api.glasser.ai/mcp` and carries no
credentials: the server speaks OAuth, so Claude Code signs the user in on
first use. The plugin ships no executable code.

The service behind it is governed by Glasser's
[terms of service](https://glasser.ai/terms-of-service) and
[privacy policy](https://glasser.ai/privacy-policy).
