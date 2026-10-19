#!/usr/bin/env node
// Consistency checks for the Claude Code package: one version per plugin,
// manifest pointers, the MCP config shape, and a guard against a
// pipe-to-shell install sneaking back into a skill.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const fail = (message) => errors.push(message);
const rel = (p) => path.relative(root, p);
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (error) {
    fail(`${rel(p)}: ${error.message}`);
    return null;
  }
};

// Each plugin in the marketplace. The utm pair only tells the server the install
// came from that plugin; `toolset` picks the tool set (Glasser ADR-0031). OAuth
// takes its resource from the server's metadata, which has no query string.
const PLUGINS = [
  {
    name: "glasser",
    server: "glasser",
    url: "https://api.glasser.ai/mcp?utm_source=claude-code-plugin&utm_medium=plugin",
    // The marketplace's own metadata.version follows this plugin.
    marketplaceVersion: true,
  },
  {
    name: "glasser-research",
    server: "glasser-research",
    url: "https://api.glasser.ai/mcp?toolset=directory&utm_source=glasser-research&utm_medium=plugin",
    marketplaceVersion: false,
  },
];

const claudeMp = readJson(path.join(root, ".claude-plugin/marketplace.json"));
const summary = [];

for (const spec of PLUGINS) {
  const plugin = path.join(root, "plugins", spec.name);
  const label = `plugins/${spec.name}`;
  const entry = claudeMp?.plugins?.find((p) => p.name === spec.name);
  if (!entry) {
    fail(`claude marketplace has no entry named "${spec.name}"`);
    continue;
  }
  const claudePl = readJson(path.join(plugin, ".claude-plugin/plugin.json"));
  const skillRel = `skills/${spec.name}/SKILL.md`;
  const skillPath = path.join(plugin, skillRel);
  if (!existsSync(skillPath)) {
    fail(`${label}/${skillRel} is missing`);
    continue;
  }
  const skill = readFileSync(skillPath, "utf8");
  const frontmatter = skill.split("\n---\n")[0];
  // Agent Skills has no top-level version field; ours lives under metadata.
  const frontmatterVersion = frontmatter.match(/^metadata:\n(?:[ \t]+.*\n)*?[ \t]+version:\s*"?([^"\s]+)"?/m)?.[1];
  if (/^version:/m.test(frontmatter)) fail(`${label}/${skillRel}: version must live under metadata, not at the top level`);
  if (frontmatter.match(/^name:\s*(\S+)/m)?.[1] !== spec.name) fail(`${label}/${skillRel}: name must be ${spec.name}`);

  // 1. One version per plugin. Clients pin installs to it.
  const versions = {
    [`marketplace entry ${spec.name}`]: entry.version,
    [`${label}/.claude-plugin/plugin.json`]: claudePl?.version,
    [`${label}/${skillRel} metadata.version`]: frontmatterVersion,
  };
  if (spec.marketplaceVersion) versions[".claude-plugin/marketplace.json metadata.version"] = claudeMp?.metadata?.version;
  const distinct = new Set(Object.values(versions));
  if (distinct.size !== 1 || distinct.has(undefined)) {
    const lines = Object.entries(versions).map(([k, v]) => `    ${v ?? "(missing)"}  ${k}`);
    fail(`${spec.name}: versions disagree:\n${lines.join("\n")}`);
  }

  // 2. The catalog entry and the manifest name the same plugin.
  if (claudePl?.name !== spec.name) fail(`${label}/.claude-plugin/plugin.json: name is ${JSON.stringify(claudePl?.name)}, expected "${spec.name}"`);

  // 3. The MCP config: valid JSON and nothing but a URL. The server speaks
  //    OAuth — the client signs the user in on first use — so a headers block
  //    or a ${VARIABLE} placeholder here is a regression to the paste-a-Key setup.
  const mcpRaw = readFileSync(path.join(plugin, ".mcp.json"), "utf8");
  let mcp = null;
  try {
    mcp = JSON.parse(mcpRaw);
  } catch (error) {
    fail(`${label}/.mcp.json is not valid JSON: ${error.message}`);
  }
  const server = mcp?.mcpServers?.[spec.server];
  if (!server) fail(`${label}/.mcp.json must declare mcpServers.${spec.server}`);
  if (server && server.url !== spec.url) fail(`${label}/.mcp.json url must be ${spec.url}, got ${JSON.stringify(server?.url)}`);
  if (server && "headers" in server) fail(`${label}/.mcp.json must not carry headers — the server signs the user in with OAuth`);
  if (/\$\{/.test(mcpRaw)) fail(`${label}/.mcp.json must not reference a \${VARIABLE} — there is no Key to fill in`);
  // The directory requires every remote MCP server to name its transport.
  if (server && !["http", "sse", "ws"].includes(server.type)) fail(`${label}/.mcp.json ${spec.server}.type must be http, sse or ws, got ${JSON.stringify(server.type)}`);

  // 4. Claude Code loads skills/ and .mcp.json from their default locations, and
  //    a manifest key for either only adds to that, so neither is declared.
  for (const key of ["skills", "mcpServers"]) {
    if (claudePl && key in claudePl) fail(`${label}/.claude-plugin/plugin.json must not declare ${key} — the default location already loads`);
  }
  if (typeof entry.source !== "string" || path.resolve(root, entry.source) !== plugin) {
    fail(`marketplace entry ${spec.name}: source must be ./plugins/${spec.name}, got ${JSON.stringify(entry.source)}`);
  }

  // 4a. claude.ai refuses an upload whose description is over 500 characters.
  for (const [where, description] of [
    [`${label}/.claude-plugin/plugin.json`, claudePl?.description],
    [`marketplace entry ${spec.name}`, entry.description],
  ]) {
    if (typeof description !== "string" || description.length > 500) {
      fail(`${where}: description must be at most 500 characters, got ${description?.length}`);
    }
  }

  // 4b. Anthropic's directory reads its listing fields from plugin.json.
  for (const field of ["privacyPolicyUrl", "termsOfServiceUrl"]) {
    if (!claudePl?.[field]?.startsWith("https://")) fail(`${label}/.claude-plugin/plugin.json must declare ${field} as an https:// URL`);
  }
  if (typeof claudePl?.icon !== "string" || !existsSync(path.join(plugin, claudePl.icon))) {
    fail(`${label}/.claude-plugin/plugin.json icon must point at an existing file, got ${JSON.stringify(claudePl?.icon)}`);
  }

  // 4c. Anthropic's directory holds a version for manual review when bundled text
  //     names an image or font file.
  for (const textRel of ["README.md", skillRel]) {
    if (/\.(png|svg|jpe?g|gif|webp|ico|woff2?|ttf|otf)\b/i.test(readFileSync(path.join(plugin, textRel), "utf8"))) {
      fail(`${label}/${textRel} names an image or font file`);
    }
  }

  // 5. A skill must never carry a pipe-to-shell install.
  if (/curl[^\n]*\|\s*(ba|z)?sh\b/.test(skill) || /install\.sh/.test(skill)) {
    fail(`${label}/${skillRel} contains a curl | sh install — use npm install -g instead`);
  }

  summary.push(`${spec.name} ${[...distinct][0]}`);
}

// The marketplace lists exactly the plugins checked here.
const listed = (claudeMp?.plugins ?? []).map((p) => p.name).sort();
const known = PLUGINS.map((p) => p.name).sort();
if (JSON.stringify(listed) !== JSON.stringify(known)) {
  fail(`marketplace lists ${JSON.stringify(listed)}, but this checker knows ${JSON.stringify(known)}`);
}

if (errors.length > 0) {
  console.error("check-manifests failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`check-manifests passed (${summary.join(", ")}).`);
