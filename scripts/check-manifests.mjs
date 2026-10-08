#!/usr/bin/env node
// Consistency checks for the Claude Code package: one version everywhere,
// manifest pointers, the MCP config shape, and a guard against a
// pipe-to-shell install sneaking back into the skill.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const plugin = path.join(root, "plugins", "glasser");
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

const claudeMp = readJson(path.join(root, ".claude-plugin/marketplace.json"));
const claudePl = readJson(path.join(plugin, ".claude-plugin/plugin.json"));
const skillPath = path.join(plugin, "skills/glasser/SKILL.md");
const skill = readFileSync(skillPath, "utf8");
const frontmatter = skill.split("\n---\n")[0];
// Agent Skills has no top-level version field; ours lives under metadata.
const frontmatterVersion = frontmatter.match(/^metadata:\n(?:[ \t]+.*\n)*?[ \t]+version:\s*"?([^"\s]+)"?/m)?.[1];
if (/^version:/m.test(frontmatter)) fail("SKILL.md: version must live under metadata, not at the top level");

// 1. One version everywhere. Clients pin installs to it.
const versions = {
  ".claude-plugin/marketplace.json metadata.version": claudeMp?.metadata?.version,
  ".claude-plugin/marketplace.json plugins[0].version": claudeMp?.plugins?.[0]?.version,
  "plugins/glasser/.claude-plugin/plugin.json": claudePl?.version,
  "plugins/glasser/skills/glasser/SKILL.md metadata.version": frontmatterVersion,
};
const distinct = new Set(Object.values(versions));
if (distinct.size !== 1 || distinct.has(undefined)) {
  const lines = Object.entries(versions).map(([k, v]) => `    ${v ?? "(missing)"}  ${k}`);
  fail(`versions disagree:\n${lines.join("\n")}`);
}

// 2. The catalog entry and the manifest name the same plugin.
for (const [label, name] of [
  ["claude marketplace entry", claudeMp?.plugins?.[0]?.name],
  [".claude-plugin/plugin.json", claudePl?.name],
]) {
  if (name !== "glasser") fail(`${label}: name is ${JSON.stringify(name)}, expected "glasser"`);
}

// 3. The MCP config: valid JSON and nothing but a URL. The server speaks
//    OAuth — the client signs the user in on first use — so a headers block
//    or a ${VARIABLE} placeholder here is a regression to the paste-a-Key setup.
const mcpRaw = readFileSync(path.join(plugin, ".mcp.json"), "utf8");
let mcp = null;
try {
  mcp = JSON.parse(mcpRaw);
} catch (error) {
  fail(`.mcp.json is not valid JSON: ${error.message}`);
}
const server = mcp?.mcpServers?.glasser;
if (!server) fail(".mcp.json must declare mcpServers.glasser");
if (server && server.url !== "https://api.glasser.ai/mcp") fail(`.mcp.json url must be https://api.glasser.ai/mcp, got ${JSON.stringify(server?.url)}`);
if (server && "headers" in server) fail(".mcp.json must not carry headers — the server signs the user in with OAuth");
if (/\$\{/.test(mcpRaw)) fail(".mcp.json must not reference a ${VARIABLE} — there is no Key to fill in");

// 4. Claude Code loads skills/ and .mcp.json from their default locations, and
//    a manifest key for either only adds to that, so neither is declared.
for (const key of ["skills", "mcpServers"]) {
  if (claudePl && key in claudePl) fail(`.claude-plugin/plugin.json must not declare ${key} — the default location already loads`);
}
const source = claudeMp?.plugins?.[0]?.source;
if (typeof source !== "string" || !existsSync(path.join(root, source))) {
  fail(`marketplace source does not resolve: ${JSON.stringify(source)}`);
}

// 4a. claude.ai refuses an upload whose description is over 500 characters.
for (const [label, description] of [
  [".claude-plugin/plugin.json", claudePl?.description],
  ["claude marketplace entry", claudeMp?.plugins?.[0]?.description],
]) {
  if (typeof description !== "string" || description.length > 500) {
    fail(`${label}: description must be at most 500 characters, got ${description?.length}`);
  }
}

// 4b. Anthropic's directory reads its listing fields from plugin.json.
for (const field of ["privacyPolicyUrl", "termsOfServiceUrl"]) {
  if (!claudePl?.[field]?.startsWith("https://")) fail(`.claude-plugin/plugin.json must declare ${field} as an https:// URL`);
}
if (typeof claudePl?.icon !== "string" || !existsSync(path.join(plugin, claudePl.icon))) {
  fail(`.claude-plugin/plugin.json icon must point at an existing file, got ${JSON.stringify(claudePl?.icon)}`);
}
// The directory requires every remote MCP server to name its transport.
if (server && !["http", "sse", "ws"].includes(server.type)) fail(`.mcp.json glasser.type must be http, sse or ws, got ${JSON.stringify(server.type)}`);

// 4c. Anthropic's directory holds a version for manual review when bundled text
//     names an image or font file.
for (const textRel of ["README.md", "skills/glasser/SKILL.md"]) {
  if (/\.(png|svg|jpe?g|gif|webp|ico|woff2?|ttf|otf)\b/i.test(readFileSync(path.join(plugin, textRel), "utf8"))) {
    fail(`plugins/glasser/${textRel} names an image or font file`);
  }
}

// 5. The skill must never carry a pipe-to-shell install.
if (/curl[^\n]*\|\s*(ba|z)?sh\b/.test(skill) || /install\.sh/.test(skill)) {
  fail("SKILL.md contains a curl | sh install — use npm install -g instead");
}

if (errors.length > 0) {
  console.error("check-manifests failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`check-manifests passed (version ${[...distinct][0]}).`);
