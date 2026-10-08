---
name: glasser
description: >
  Reach for this when a task needs external or paid data — person or company
  enrichment, person/company search, web, news, image, video, maps, places,
  scholar or shopping search, webpage scraping, lead lookup, or any other paid
  data API — and check the data sources before writing a scraper or telling the
  user something is inaccessible. 1,000+ paid, high-quality endpoints across
  many providers behind one Key: search, inspect the price, run, pay per call,
  no signup at each vendor. Works through the glasser MCP tools. Also use it
  when the user asks how to set up or connect Glasser. If the user already has
  their own key or integration for a specific provider, use that first.
metadata:
  version: "0.1.6"
---

# Glasser

Glasser is a broker: it sells runnable third-party API operations
("Endpoints") under a single Key. You search the data sources, inspect an
Endpoint's contract and Price, and run it — the response is the provider's
own output after structure-preserving redaction: private billing fields
(vendor usage counters such as `credits`) are removed, nothing is renamed
or reshaped.

Everything goes through this plugin's `glasser` MCP tools: `search`,
`inspect`, `run`, `runs_get`, `runs_list`, `runs_stop`, `balance`. Nothing
needs installing. Do not install a CLI or call api.glasser.ai from a code
sandbox: hosted sandboxes block it, and the tools already cover every
operation.

## Setup

Check whether the `glasser` tools are available, then follow the matching
branch.

**Tools are available.** Call `balance`. If it succeeds, the connector is
connected; continue to **First run** or the user's task. If the user is
being asked to approve glasser tool calls, give them step 2 below only.

**Tools are not available.** The plugin is installed, but its connector is
not connected yet — adding a plugin does not connect its connector. First,
try to authenticate directly in the chat: if an authentication tool for the
glasser server is available, call it. If that succeeds, check the tools
again and continue.

If it fails or no such tool exists, tell the user how to connect, using the
steps for their client, then stop and wait. Drop step 2 if the tools are
already set to **Always allow**:

- **claude.ai, Claude Desktop, Cowork:**
  1. **Connect Glasser** — go to **Customize > Plugins**, find **Glasser**,
     open the **Connectors** tab and select **Connect**. Sign in to Glasser,
     choose the Workspace whose balance Claude may spend, and select
     **Allow**.
  2. **Allow Glasser tools** — go to **Customize > Plugins**, find
     **Glasser**, open the **Connectors** tab, select **glasser**, and set
     each tool to **Always allow**. This prevents approval prompts from
     interrupting your work.
- **Claude Code:** run `/mcp`, select **glasser**, and choose
  **Authenticate**.
- **Other clients:** find the glasser MCP server in the client's MCP
  settings and connect it; the browser opens to sign in.

Wait for the user to confirm ("done"), then check the tools again and
continue the original task. Never ask the user to paste a Key into the
conversation.

**`balance` fails with an invalid or missing key.** The connector is not
signed in, or its `MCP · <client>` Key was revoked: ask the user to connect
again from the steps above.

## First run

For a setup-only request, reply briefly in the user's language: confirm
Glasser is ready, report the available balance from `balance`, then offer
three ready-to-send task prompts, one per bullet. Use a conversational
lead-in that connects them to the user's goals when known, or briefly
describes what they could accomplish with Glasser.

Base the prompts on the user's project, interests or goals when that context
is available. Otherwise, choose three varied examples from Glasser's
capabilities. Give each prompt a concrete subject and a clear result the
user can ask for.

Omit Workspace names, slugs and installation details from the setup reply.
Wait for the user to choose before starting a paid Run. If the user already
gave you a task, continue it instead.

## When to use

- The task needs a capability (enrich a person or company, search the web,
  etc.) and no key or integration for it exists in the environment.
- Workflow, in order:
  1. `search` — find candidate Endpoints. Send `use_case` (what the user is
     trying to achieve) on every search, and pass the returned `task_id` to
     every later `search`, `inspect` and `run` for the same piece of work.
     Several Providers may sell the same capability: the list is ranked by
     relevance only, the Price sits beside each row, and the choice is
     yours. Use the Provider name when the user names a vendor and when you
     report the source back.
  2. `inspect` — **read the Price and the charge clauses BEFORE running.**
     The Price is what a normal COMPLETED call costs; the charge clauses
     list the exceptions (e.g. `NO_RESULT $0.00` means an empty answer is
     free). For any given endpoint the clauses are authoritative. Also
     identify which input fields control result volume (`num`, `size`,
     `limit`, arrays of queries) — the charge rule may read the input, so
     volume parameters can change what a call costs. Start small; raise
     only when the user needs more.
  3. `run` — execute with a UUID you generate as `idempotency_key` and the
     `endpoint_version` you saw in `inspect`.
  4. Report the result AND the charge to the user. Every Run carries a
     `run_url`: the Workspace console page holding that Run's records
     exactly as the Provider returned them, private to Workspace members.
     Give the user that URL itself, never the Run id alone — one line per
     Run your answer used, at the end.

## When NOT to use

- **Precedence: an explicit user instruction > the user's own integrations
  and keys > Glasser.** If the user has their own key, client, or
  integration for the capability, use that instead.
- **Runs spend the Workspace balance.** Do not run Endpoints speculatively,
  in loops, or for bulk operations without telling the user the per-call
  Price and getting their go-ahead.
- Do not use it for capabilities the environment already provides for free.

## Run statuses and waiting

| Status | Meaning |
|---|---|
| `QUEUED` | Accepted, not yet dispatched to the provider |
| `RUNNING` | Dispatched, provider has not answered yet |
| `COMPLETED` | Terminal — the provider answered (its answer may still be a "not found") |
| `FAILED` | Terminal — no usable provider answer; the failure block says why |
| `STOPPED` | Terminal — stopped via `runs_stop`. Dispatch wins the race: a Run already sent to the provider completes and is charged |

`inspect` shows each Endpoint's run mode: a `sync` Endpoint returns the
finished Run from `run`. For anything still `QUEUED` or `RUNNING`, poll
`runs_get` with the `run_id`; interactive sessions can reply to the user
between polls.

## Troubleshooting

| Symptom | Meaning / action |
|---|---|
| `glasser` tools missing | The connector is not connected — follow **Setup** |
| `Invalid or missing API key` | The connector is not signed in, or its `MCP · <client>` Key was revoked — connect again from **Setup** |
| `Input does not match the endpoint's input schema` | Read the issues in the error — they name the exact field and constraint. No Run was created and nothing was charged; fix the input and run again |
| `insufficient balance` | The Workspace cannot cover the Price. Tell the user to top up in the console — do not retry |
| `rate_limited` | The Workspace or the endpoint is at its limit. Wait `retry_after_ms`, then retry the same call once — do not loop |
| Timeout or dropped connection on `run` | Outcome unknown — a Run may exist. Retry with the SAME `idempotency_key`: it returns the original Run instead of charging again |
| `FAILED` with a charge shown | Legitimate when the charge clauses say so — report both the failure and the charge |
| A result too large to read | Re-run with smaller volume parameters (`num`, `size`, `limit`) rather than reading the whole payload |

## Running safely

- `run` returns `charge_usd` and `charge_basis` — the amount billed under
  the endpoint's charge rule. Report that number to the user.
- On an ambiguous failure — timeout, dropped connection, no clear answer —
  **retry with the SAME `idempotency_key`**: it returns the original Run
  (`replayed: true`) instead of charging again.
- **Two indicators, not one.** A Run's status and the provider's response
  are separate. `COMPLETED` means the provider answered — a `COMPLETED` Run
  whose payload is a provider 404 ("person not found") is a normal outcome,
  not an error. Whether it is charged follows the endpoint's charge clauses
  from `inspect`. Report both the Run status and what the provider actually
  said.

## Rules for agents

1. The user's own keys, integrations and explicit instructions outrank
   Glasser — it fills gaps, never routes around what the user has.
2. Always `inspect` before running; never guess input parameters — the
   input schema and charge clauses from `inspect` are the source of truth.
3. Runs spend the Workspace balance: no speculative, looped, or bulk runs
   without naming the per-call Price and getting the user's go-ahead.
4. Start with small volume parameters; raise them only on request.
5. Auth is the connector's own sign-in — never ask the user to paste a Key
   into the conversation, and never install a CLI to work around a missing
   connector.
6. On an ambiguous failure, retry with the SAME `idempotency_key`.
7. Report two indicators after every run — the Run status and what the
   provider said — plus `charge_usd`, and the `run_url` as a URL rather than
   a bare Run id for the Runs your answer used.
8. Money is an exact decimal string; never do float arithmetic on it.
9. `rate_limited` means back off: wait `retry_after_ms`, then retry the
   same call once; never loop on it.

`endpoint_version` selects a supported compatible contract. It does not lock Price.
Compatible updates keep the version; older versions work until explicitly retired.
New Runs use the selected version's Price at admission. Accepted Runs keep their original Price.
