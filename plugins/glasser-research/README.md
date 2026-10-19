# Glasser Research plugin

Company, web and market data for Claude: company and prospect details, search rankings and keywords, websites and reviews, social profiles, local places, news and property records.

| Component | File |
|---|---|
| Skill | `skills/glasser-research/SKILL.md` |
| MCP server | `.mcp.json` |

The MCP config points at `https://api.glasser.ai/mcp?toolset=directory` and carries no credentials: the server speaks OAuth, so the client signs the user in on first use. The plugin ships no executable code.

Install it from this marketplace:

```
/plugin marketplace add glasser-ai/claude-plugin
/plugin install glasser-research@glasser
```

The service behind it is governed by Glasser's [terms of service](https://glasser.ai/terms-of-service) and [privacy policy](https://glasser.ai/privacy-policy).
