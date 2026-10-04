# ☂️ @convex-dev/ai-budget

**Track, attribute, and cap every user's AI spend.** A metered, budget-governed
layer over the [Convex AI Gateway](https://docs.convex.dev/ai-gateway/overview).
Point your LLM calls through it and every request is tracked, priced, attributed,
and held to a budget — with atomic admission that accounts for concurrent load.

> ⚠️ **Best-effort, not a guarantee.** This component *reduces and bounds* AI
> spend; it does **not** guarantee against all overspend. Per-bucket caps admit on
> an **estimate**, so a call can settle above its cap by the estimate-vs-actual
> delta; the **global** cap is **approximate** (best-effort, bounded lag — not
> to-the-dollar). Treat it as one layer of defense: **also set hard spend limits
> at your AI provider / billing account** as the real backstop, and monitor spend.
> Provided **"AS IS"**, without warranty of any kind, under Apache-2.0.

```ts
// userId defaults to the signed-in user — this is the whole integration:
const { text, costNanos } = await ai.chat(ctx, { prompt });
```

That one call is authenticated to the gateway with a short-lived deployment
token (no API keys to manage), attributed to the authenticated user, checked
against their limits, billed to the right user and feature, and written to a
full audit log you can replay later.

**Not just the gateway.** Need a provider it doesn't serve — fal, Replicate,
image/audio generation, a raw `fetch`? [`ai.meter`](#aimeter--budget-any-provider-call)
wraps *any* call, made with *your own key*, under the same budgets, caps, and
audit log. The gateway is the zero-config default, never the only option.

![Chat with a live request log — every call tracked, priced, and attributed](docs/hero.png)

## Contents

- [Features](#features)
- [Setup](#setup)
- [Quickstart](#quickstart)
- [Concepts](#concepts) — dimensions, nanodollars, reserve→settle
- [Generating text](#generating-text) — `chat`, `languageModel`, `meter`, `decisions`, replay
- [Budgets & limits](#budgets--limits) — set caps, bumps, credits, alerts
- [Monitoring](#monitoring) — totals, spend history, the request log
- [Deployment-wide controls](#deployment-wide-controls) — global cap, model policy, pricing, retention
- [Admin dashboard](#admin-dashboard)
- [How spend caps stay correct](#how-spend-caps-stay-correct) — the design
- [Security](#security-before-you-ship) — auth, dashboard gating, `no-ungoverned-ai` lint rule
- [Example app](#example-app)
- [Development](#development)

---

## Features

| | |
|---|---|
| **Usage & cost tracking** | Every request stored with messages, response, tokens, latency, and per-request cost. |
| **Any provider, not just the gateway** | `ai.meter` budgets *any* call — fal, Replicate, image/audio gen, a raw `fetch` — made with your own key, under the same caps and audit log. `chat`/`languageModel` use the gateway; `meter` doesn't require it. |
| **Attribution** | Each call is attributed to a `userId` **and** the Convex action that made it — auto-detected via `ctx.meta`, no manual tagging. |
| **Tagged budgets** | `user` and `action` are just built-in *dimensions* — add your own (team, project, customer, env…) via `tags`, and cap any of them. One request can be billed to several buckets at once. |
| **Spend & token limits** | Per-bucket **daily / monthly / lifetime** spend and token budgets, plus requests-per-minute, a max-concurrent cap, and a block switch. |
| **Concurrency-safe admission** | A reserve-then-settle design makes admission atomic against estimated usage, so concurrent requests can't all spend the same remaining budget. Final usage can exceed its reservation; the actual amount is recorded at settlement. |
| **Hard or soft** | Each limit either **blocks** (`hard`) or **allows-with-a-warning** (`soft`). |
| **Approaching-limit alerts** | Set `warnAtPct` (e.g. 0.8) and get an `onThreshold` callback before a cap is hit; `onLimitReached` fires when one blocks. |
| **Spend history** | Durable per-bucket **daily & monthly** rollups that survive request retention — real spend-over-time, per user / action / tag. |
| **Manual credits/debits** | Comp a user or correct an overcharge with a signed adjustment, recorded to the live windows, the history, and an audit log. |
| **One-time bumps** | "Approve another $X" without changing the standing cap — bucket daily/monthly bumps and global daily bumps reset with their windows; lifetime bumps persist. |
| **Global killswitch** | A deployment-wide spend cap across everything (sharded for throughput; enforced approximately). |
| **Authoritative cost** | Records the gateway's **real** per-request dollar cost when available; otherwise cache-aware token pricing. Unknown models **fail closed** (charged a conservative max, never $0). |
| **Model policy** | Allow/deny lists for models. |
| **Replay** | Re-run any stored request with edited messages or a different model; re-runs are linked to their original (lineage). |
| **Agent-ready** | `ai.languageModel(ctx, { userId })` is a standard AI SDK model — drop it into [`@convex-dev/agent`](https://www.npmjs.com/package/@convex-dev/agent) and every generation is budgeted. |
| **Built-in dashboard** | `ai.registerRoutes(http)` mounts a self-contained admin dashboard at a URL — one line, no UI to build. |

---

## Setup

Requires `convex@^1.45`, the AI SDK, and a Convex team on a paid plan (the
gateway is a paid feature). Runs in Convex's **default runtime** — no
`"use node"` (the component is pure V8; `ai.chat` / `ai.languageModel` are
`fetch`-based).

**1. Install**

```sh
npm install @convex-dev/ai-budget @convex-dev/ai-sdk-provider ai
```

**2. Register the component**

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import aiBudget from "@convex-dev/ai-budget/convex.config";

const app = defineApp();
app.use(aiBudget);
export default app;
```

**3. Create a client**

```ts
// convex/ai.ts
import { AIBudget } from "@convex-dev/ai-budget";
import { components } from "./_generated/api";

export const ai = new AIBudget(components.aiBudget, {
  defaultModel: "openai/gpt-4o-mini",
  onSoftLimit: ({ userId, messages }) => console.warn(userId, messages),
});
```

`ai.chat` and `ai.languageModel` are top-level; everything else is namespaced —
`ai.users.*`, `ai.actions.*`, `ai.tag(d).*`, `ai.global.*`, `ai.models.*`,
`ai.prices.*`, `ai.requests.*`.

---

## Quickstart

```ts
// convex/ai.ts
import { v } from "convex/values";
import { action } from "./_generated/server";

export const sendMessage = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }) => {
    // userId defaults to the authenticated caller (ctx.auth). Limit-checked,
    // tracked, priced. Throws a ConvexError if over a hard cap.
    const { text, costNanos, warnings } = await ai.chat(ctx, { prompt });
    return { text, costNanos, warnings };
  },
});
```

Give someone a budget:

```ts
await ai.users.setLimits(ctx, {
  userId: "alice",
  dailySpendLimitNanos: 1_000_000_000, // $1.00 / day
  dailyTokenLimit: 500_000,
  requestsPerMinute: 20,
});
```

When a request would exceed a **hard** cap, `chat` throws a `ConvexError`
carrying `{ kind: "AIBudgetLimit", code, reason }`; the attempt is still recorded
(`status: "blocked"`) so you can see who's hitting limits.

---

## Concepts

Three ideas make the rest of the API obvious.

**Dimensions & buckets.** Spend is attributed along *dimensions*. `user` and
`action` are built in (from `userId` and the calling Convex action); you can add
any others — `team`, `customer`, `env`, `feature` — by passing `tags`. Each
`(dimension, value)` pair is a **bucket** with its own totals and optional caps.
`ai.users`, `ai.actions`, and `ai.tag("customer")` are the *same* API over
different dimensions.

**Nanodollars.** All money is integer **nanodollars** (`1 USD = 1e9 nano`) —
costs, limits, prices. Integers avoid the rounding drift floating-point cents
accumulate and keep cap comparisons exact (to ~$9M per value). `$1 = 1_000_000_000`.

**Reserve → settle.** Each request is admitted by an atomic check-and-reserve
of estimated usage against every capped bucket it touches, then settled to its
real cost when it finishes. That's what prevents concurrent requests from all
spending the same remaining budget — see
[How spend caps stay correct](#how-spend-caps-stay-correct).

> All methods are called from a Convex **action** (they run the gateway call),
> or a **query** for the read-only ones. `ctx` is the Convex context.

---

## Generating text

### `ai.chat` — one-shot completion

```ts
ai.chat(ctx, {
  userId?,     // defaults to the authenticated caller (ctx.auth)
  prompt?,     // or:
  messages?,   // [{ role, content }]
  model?,      // defaults to defaultModel
  action?,     // attribution name; defaults to the calling Convex action
  tags?,       // extra dimensions: [{ dimension: "customer", value: "acme" }, …]
}): Promise<{ text, requestId, costNanos, promptTokens, completionTokens, cachedTokens, warnings, notices }>
```

`warnings` is non-empty only when a **soft** limit was exceeded; `notices` when a
[threshold](#alerts) was crossed. If no `userId` is passed and there's no
authenticated user, `chat` throws — budgets are never silently un-attributed.

### `ai.languageModel` — an AI SDK model (Agent, generateText, streamText)

```ts
ai.languageModel(ctx, { userId?, model?, action?, tags? }): LanguageModel
```

A standard AI SDK `LanguageModel` that enforces the budget and records usage/cost
on every call, including streaming. Drop it into the Convex Agent:

```ts
import { Agent } from "@convex-dev/agent";

const agent = new Agent(components.agent, {
  name: "assistant",
  languageModel: ai.languageModel(ctx, { userId }),
});
const { threadId } = await agent.createThread(ctx, { userId });
const result = await agent.generateText(ctx, { threadId }, { prompt });
```

Every generation is now tracked and budgeted, attributed to `userId` and the
calling action. See `example/convex/agentDemo.ts`.

### `ai.meter` — budget *any* provider call

`chat`/`languageModel` go through the gateway. When you need something the
gateway can't serve (Anthropic web search, computer-use, **fal / Replicate /
any other provider**, a raw `fetch`), `meter` brings that call under the *same*
caps, audit log, and cost tracking. It reserves before your `run` (throwing over
a hard cap), runs it, and records the actual usage.

The call inside `run` is **yours** — it uses *your* provider credentials (an
`OPENAI_API_KEY`, a `FAL_KEY`, whatever) and **does not route through the Convex
AI Gateway**. The gateway is only the default for `chat`/`languageModel`; `meter`
just needs the resulting cost (token usage, `serverToolUses`, or an authoritative
`costNanos`). So you can budget any provider the gateway doesn't offer:

```ts
await ai.meter(ctx, { userId, model: "anthropic/claude-…", messages }, async () => {
  const res = await anthropic.messages.create({
    messages,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  });
  return {
    text: extractText(res),
    usage: res.usage, // includes fresh input, cache reads, and cache writes
    serverToolUses: { web_search: res.usage.server_tool_use?.web_search_requests ?? 0 },
    // costNanos? — pass an authoritative total to skip token/tool pricing
  };
});
```

`chat` is sugar over `meter`. Return either a raw provider `usage` (auto-
normalized) or explicit `promptTokens`/`completionTokens`/`cachedTokens`, plus
optional `serverToolUses` (see [pricing](#pricing--cost)) and `costNanos`.

**Cost known up front (image gen, per-call APIs).** When you know the price
before the call — image generation (`n` × per-image), audio, anything per-call —
pass `estimatedCostNanos` so the *reservation* holds the real amount and a hard
cap is exact (the token estimate is meaningless for these). Price the units with
`serverToolUses` + [`setServerTool`](#pricing--cost):

```ts
// fal.ai image generation, budgeted per buyer — called directly with YOUR fal
// key; the gateway is not involved. Just tell the budget the cost.
import { fal } from "@fal-ai/client"; // fal.config({ credentials: process.env.FAL_KEY })
const IMG = 50_000_000; // $0.05/image → setServerTool({ tool: "image", nanosPerCall: IMG })
await ai.meter(ctx,
  { userId, model: "fal-ai/flux-pro/v1.1", messages: [{ role: "user", content: prompt }],
    tags: [{ dimension: "buyer", value: buyerId }], // cap spend per buyer
    estimatedCostNanos: IMG * n },
  async () => {
    const res = await fal.subscribe("fal-ai/flux-pro/v1.1", { input: { prompt, num_images: n } });
    return { serverToolUses: { image: n } };   // priced via setServerTool({ tool: "image", … })
  });
```

`model` here is just an attribution/pricing label — it can name any provider's
model, gateway or not. Over a hard per-buyer cap, `meter` throws before the fal
call runs, so a buyer can't blow past their picture budget.

**Image editing** is the same shape — `ai.meter` doesn't care what the callback
does. Bring the provider's edit call and report the units; give edits their own
server-tool key if they're priced differently from generations:

```ts
const IMG_EDIT = 160_000_000; // $0.16/edit, via setServerTool({ tool: "image_edit", … })
await ai.meter(ctx,
  { userId, model: "openai/gpt-image-1", messages: [{ role: "user", content: prompt }],
    estimatedCostNanos: IMG_EDIT * n },
  async () => {
    const res = await openrouter.images.edit({ model: "openai/gpt-image-1", image, prompt, n });
    return { serverToolUses: { image_edit: n } };
  });
```

The same pattern meters audio, transcription, TTS, embeddings — anything with a
known per-call price: reserve with `estimatedCostNanos`, report `serverToolUses`,
price the units with `setServerTool`. There is no image-specific method; `ai.meter`
is the entrypoint for every per-call modality.

### `ai.decisions` — structured decisions (Jev)

> **Note** — the Decisions endpoint is generally available on the gateway. The
> client sugar calls the AI SDK's `experimental_evaluate` export, which is itself
> version-gated; pin your `ai` version if you depend on it.

Budget the gateway's Decisions endpoint ([Jev](https://docs.typesafe.ai)) — typed
`choice` / `score` / `boolean` questions evaluated against a `state` — with the
same limits, audit log, cost tracking, and tags as `ai.chat`:

```ts
const { answers, costNanos } = await ai.decisions(ctx, {
  state: { ticket: "Customer cannot sign in" },
  questions: {
    priority: {
      type: "choice",
      instructions: "Choose the response priority",
      criteria: { urgent: "Respond now", normal: "Respond today" },
    },
    needsReview: { type: "boolean", instructions: "Does a human need to review this?" },
  },
  tags: [{ dimension: "team", value: "support" }],
});
answers.priority.choice;        // "urgent" | "normal"
answers.needsReview.probability;
```

Sugar over `ai.meter`, so cost is the gateway's authoritative amount. Model
defaults to `defaultEvalModel` (`"typesafe/jev-1.13"`). Requires
`@convex-dev/ai-sdk-provider` ≥ 0.2.1 and an `ai` version with
`experimental_evaluate` — both imported lazily, so callers who don't use
`decisions` are unaffected.

### `ai.begin` / `ai.settle` — long async jobs (video) · **experimental**

> **Experimental** — video generation depends on alpha gateway features; the
> async surface (`reserveTtlMs`, `registerWebhook`) may change without a major bump.

A video job is submit → wait minutes → poll/webhook → done, spanning multiple
Convex functions, so the synchronous `meter` bracket doesn't fit. Reserve with
`begin` at submit, `settle` from the later context. Set `reserveTtlMs` to the
job's max duration so the reconciler doesn't reap the hold mid-flight:

```ts
// submit (action): reserve, then kick off the job
const started = await ai.begin(ctx, {
  userId, model: "openai/sora",
  estimatedCostNanos: perSecond * seconds,
  reserveTtlMs: 20 * 60 * 1000,          // hold up to 20 min
});
if (!started.allowed) throw new ConvexError(started.reason);
const job = await sora.videos.create({ … });
await ctx.db.insert("videoJobs", { requestId: started.requestId, jobId: job.id });

// later — settle from a poll, or a provider webhook:
ai.registerWebhook(http, {
  path: "/aibudget/video-done",
  resolve: async (ctx, request, body) => {
    if (!verifySignature(request, body)) return null;             // 202, ignored
    const job = await lookupJob(ctx, body.id);                    // → { requestId }
    return { requestId: job.requestId, serverToolUses: { video_seconds: body.seconds } };
  },
});
```

`begin` returns the admission result (it doesn't throw — check `allowed`).
`settle` is idempotent (exactly-once server-side), so a retried webhook is safe.
The webhook resolver receives the original, unread `Request`, allowing signature
verification over the exact raw body; the parsed JSON comes from a clone.

### Replay

```ts
ai.requests.rerun(ctx, { requestId, messages?, model? }): Promise<ChatResult>
ai.requests.lineage(ctx, { requestId }): Promise<{ ancestors, reruns }>
```

`rerun` re-runs a stored request (optionally with edited messages/model), linked
to the original and billed to its **original** user. `lineage` walks the re-run
chain in both directions.

---

## Budgets & limits

`ai.users`, `ai.actions`, and `ai.tag(dimension)` are the same namespace over
different dimensions. Each exposes:

| Method | |
|---|---|
| `list(ctx)` | every bucket in the dimension, with spend + caps |
| `get(ctx, { … })` | one bucket (null if it has none yet) |
| `setLimits(ctx, { …, ...limits })` | set/clear caps & controls |
| `bump(ctx, { …, dailyNanos?, monthlyNanos?, lifetimeNanos? })` | one-time headroom |
| `adjust(ctx, { …, deltaNanos, reason? })` | manual credit / debit |
| `history(ctx, { …, period })` | durable day/month spend history |
| `adjustments(ctx, { … })` | the manual-adjustment audit log |
| `delete(ctx, { … })` | remove the bucket — **`user`** also erases that user's request content (the erasure primitive); other dimensions are **budget closure only** (shared request content is kept, see [Security](#security-before-you-ship)) |

The identifier field is `userId` for `ai.users`, `name` for `ai.actions`, and
`value` for `ai.tag(d)`. For example: `ai.tag("customer").setLimits(ctx, { value: "acme", … })`.

### Request rate limits

`requestsPerMinute` uses `@convex-dev/rate-limiter` 0.4.0 with a transactional
**token bucket** for each user, action, or custom tag. A limit of 60 allows an
initial burst of 60 requests and then refills at one request per second, up to
60. Zero blocks all requests. Only admitted requests consume capacity: a budget,
concurrency, or another bucket's rate rejection consumes none.

This replaces the previous rolling 60-second request-log count. On upgrading,
rate balances start full; historical requests are not imported. Budget balances,
reservations, and spend history are preserved. Deploy the component update to
mount its nested Rate Limiter component; applications do not register it separately.
Changing a rate keeps its existing balance (clamped to the new capacity when
checked); deleting and recreating a bucket starts a fresh balance.

Rate limits remain transactional. Rate Limiter's asynchronous mode is not enabled
here because simultaneous admissions must respect every configured bucket.
Global spend accounting continues to use the existing sharded counter.

### Setting caps

```ts
ai.users.setLimits(ctx, {
  userId,                    // or `name` / `value` for actions / tags
  requestsPerMinute?,
  maxConcurrent?,            // max in-flight requests at once
  dailySpendLimitNanos?,
  monthlySpendLimitNanos?,   // calendar-month budget (UTC)
  lifetimeSpendLimitNanos?,
  dailyTokenLimit?,
  monthlyTokenLimit?,
  lifetimeTokenLimit?,
  warnAtPct?,                // e.g. 0.8 → alert at 80% of a cap
  enforcement?,              // "hard" (block, default) | "soft" (warn but allow)
  blocked?,                  // hard block on/off
})
```

Pass a field as `undefined` to clear that limit (unlimited). A request is
admitted only if its estimate fits **every** bucket it touches — the same atomic
reserve-then-settle admission check runs per bucket. Uncapped buckets never serialize, so
adding tags you don't cap is free at admission; their totals still accrue for
reporting.

> **Choosing what to cap.** A cap makes its bucket's admissions atomic by
> reserving on that bucket's single row, so capping a dimension that *all* traffic
> shares (one `env`/`action` every request carries) serializes those admissions on
> one document under load. Prefer capping **naturally-sharded** dimensions — per
> `user`, per `customer` — and use the [global cap](#global-cap) for a
> deployment-wide ceiling. Uncapped high-traffic tags are always free.

### Tags — budgeting by any dimension

```ts
// Bill this call to a user, an action (implicit), AND a customer + env.
await ai.chat(ctx, {
  prompt,
  tags: [
    { dimension: "customer", value: "acme" },
    { dimension: "env", value: "prod" },
  ],
});

// Cap the customer "acme" to $50/day — independent of any per-user cap.
await ai.tag("customer").setLimits(ctx, {
  value: "acme",
  dailySpendLimitNanos: 50 * 1_000_000_000,
});
```

### One-time bumps

```ts
ai.users.bump(ctx, { userId, dailyNanos?, monthlyNanos?, lifetimeNanos? })
```

Adds headroom on top of the standing cap without changing it. Daily/monthly
bumps apply to the current window; lifetime bumps are permanent.

### Manual credits & debits

```ts
await ai.users.adjust(ctx, { userId, deltaNanos: -5 * 1_000_000_000, reason: "goodwill" });
await ai.users.adjustments(ctx, { userId });   // the audit log
```

Positive = an extra charge (adds to **gross** spend). Negative = a credit/refund,
which accrues in a **separate** credits balance and never reduces gross spend — so
gross spend and durable history stay consistent. Caps enforce on **net = gross −
credits**, so a credit gives the bucket real headroom. Both are written to the
audit log.

### Alerts

Get a callback *before* a cap is hit, and when a hard cap blocks:

```ts
await ai.global.setAlertDefaults(ctx, { warnAtPct: 0.8 });   // 80%, all buckets
await ai.users.setLimits(ctx, { userId, warnAtPct: 0.9 });   // per-bucket override

new AIBudget(components.aiBudget, {
  onThreshold:    ({ userId, messages }) => notify(userId, messages),  // approaching
  onSoftLimit:    ({ userId, messages }) => notify(userId, messages),  // soft cap exceeded
  onLimitReached: ({ userId, reason })   => notify(userId, reason),    // hard cap blocked
});
```

`chat()` also returns `notices` (approaching) alongside `warnings` (soft-exceeded).

---

## Monitoring

### Lists & totals

```ts
ai.users.list(ctx)             // per-user spend today / month / total / limits
ai.actions.list(ctx)           // per-action spend & totals
ai.tag("customer").list(ctx)   // spend & caps for any custom dimension
```

### Spend history (survives retention)

Request rows are retained only briefly (see [retention](#retention)), but
**durable per-bucket day/month rollups are not** — so charts and "what did we
spend last month" keep working:

```ts
await ai.users.history(ctx, { userId, period: "month" });  // [{ stamp, spendNanos, tokens, requests }]
await ai.tag("customer").history(ctx, { value: "acme", period: "day", limit: 30 });
```

### The request log

```ts
ai.requests.list(ctx, { userId?, limit? })                        // audit log (blocked included)
ai.requests.list(ctx, { dimension: "customer", value: "acme" })   // filter by any tag
ai.requests.get(ctx, { requestId })                               // one request (full prompt + response)
```

---

## Deployment-wide controls

### Global cap

```ts
// enforcement: "approximate" (default) | "hard" | "soft". "approximate" and
// "hard" both BLOCK (identically — best-effort, see below); "soft" warns only.
// Pass null to clear a field; only the fields you pass change.
ai.global.setLimits(ctx, { dailySpendLimitNanos?, lifetimeSpendLimitNanos?, enforcement? })
ai.global.status(ctx)   // { dailySpendLimitNanos, lifetimeSpendLimitNanos, enforcement, spentTodayNanos, spentTotalNanos, … }
ai.global.bump(ctx, { dailyNanos?, lifetimeNanos? })
ai.global.setPolicy(ctx, { allowUnpricedModels?, storeContent?, storeRawErrors?, requireExplicitReservations? })  // deployment data/pricing policy
```

A best-effort killswitch across everything. Backed by a sharded counter for
throughput, so it's enforced **approximately** — under burst it can overshoot the
cap while it excludes in-flight spend and waits for reconciliation. There is no
finite monetary overshoot bound without limits on traffic, duration, and per-call
cost. Use a per-bucket cap for atomic admission against reservations; a true
spending ceiling additionally requires conservative provider cost bounds and
provider-enforced generation or job limits.

`"hard"` is accepted as the intuitive name for the blocking mode and behaves
exactly like `"approximate"` — the global total is read out-of-band, so even
`"hard"` is best-effort with bounded lag, *not* to-the-dollar. (Accepting `"hard"`
also lets a settings doc from the 0.0.1 line, which stored `"hard"`, deploy on 1.x
without a schema error.) For a precise ceiling, use a per-bucket cap.

### Model policy

```ts
ai.models.setPolicy(ctx, { mode, models })   // mode: "open" | "allowlist" | "denylist"
ai.models.getPolicy(ctx)
```

### Pricing & cost

The component records the gateway's **real per-request dollar cost** when the
provider surfaces it (`@convex-dev/ai-sdk-provider ≥ 0.2.0-alpha.1`, via
`providerMetadata.convexGateway.cost`) — cached and reasoning tokens included, so
recorded spend equals the actual bill. Without it, cost is computed from token
counts, discounting the cached slice (the gateway's real `cacheReadTokens`) at
`cachedNanosPerMTok` (default 10% of input). Either way, an **unknown model is
charged a conservative max, never $0** (so a cap can't be dodged by naming an
unlisted model) and its rows are flagged `unpricedModel: true`.

Prices are **nanodollars per million tokens**; sensible defaults ship for common
models. Override or add any model:

```ts
ai.prices.set(ctx, { model, inputNanosPerMTok, outputNanosPerMTok, cachedNanosPerMTok? })  // ≥ 0
ai.prices.list(ctx)
```

**Server tools.** Provider server-side tools bill a per-call fee on top of
tokens (e.g. Anthropic web search). Report them from `meter` as
`serverToolUses: { web_search: 3 }` and they're priced per call (default
$0.01/`web_search`) — unless you pass an authoritative `costNanos`, which already
includes them. Override the rate:

```ts
ai.prices.setServerTool(ctx, { tool: "web_search", nanosPerCall: 12_000_000 })
ai.prices.listServerTools(ctx)
```

The gateway's `provider/model` ids match OpenRouter's, whose public models
endpoint returns per-token pricing — so you can keep prices current from your own
action (see `example/convex/ai.ts` → `syncPrices`):

```ts
const { data } = await (await fetch("https://openrouter.ai/api/v1/models")).json();
const p = data.find((m) => m.id === "openai/gpt-4o-mini").pricing;
await ai.prices.set(ctx, {
  model: "openai/gpt-4o-mini",
  inputNanosPerMTok: Math.round(Number(p.prompt) * 1e15),      // $/token → nano/Mtok
  outputNanosPerMTok: Math.round(Number(p.completion) * 1e15),
});
```

### Retention

```ts
ai.global.setRetention(ctx, { retentionMs })   // default 1h; 0 disables
```

Full request rows (prompts + responses) are swept after the window to bound the
audit table. **Spend history survives** — it lives in separate durable rollups.

> **Prompt/response content is stored** on the request row until the window sweeps
> it (default 1h), so it's visible in the request log and to admin reads until
> then. If your prompts carry PII you don't want retained, shorten `retentionMs`
> (or use `ai.global.setPolicy({ storeContent: false })`). Spend rollups never
> contain content, so trimming retention doesn't cost you history.
>
> Stored content is **capped** (~16 KB of prompt + ~16 KB of response, most-recent
> messages kept) so one large prompt can't approach Convex's 1 MiB document limit
> or bloat the reconciler's scans — a very large prompt is truncated in the audit
> copy (billing still uses the full estimate/actual cost). Requests are also
> capped at 16 attribution tags.

---

## Admin dashboard

The component ships a self-contained admin dashboard — buckets & limits, the
request log, spend-over-time charts, and settings. Mount it with **one call**:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { AIBudget } from "@convex-dev/ai-budget";

const ai = new AIBudget(components.aiBudget);
const http = httpRouter();

// Recommended: token mode. Set AI_BUDGET_DASHBOARD_TOKEN in the deployment env;
// open the dashboard with ?token=<it> once and the page keeps using it.
ai.registerRoutes(http);

export default http;
```

It lives at `https://<deployment>.convex.site/aibudget` (override with `path`).
**It is a public internet endpoint, so you must gate it**, one of two ways:

- **Token (recommended, works end-to-end):** set the `AI_BUDGET_DASHBOARD_TOKEN`
  env var. Open `…/aibudget?token=<token>` once; the page strips it from the URL
  and sends it as a bearer on every API call. `?token=` is accepted only on the
  page navigation, and the compare is constant-time.
- **`authorize(ctx, request)` callback:** must authenticate from something the
  **browser sends on a top-level navigation** — a cookie or a header *you*
  control — because a page load carries no `Authorization` bearer. `ctx.auth`
  (deployment JWT) is `null` for the HTML page, so `authorize: (ctx) => (await
  ctx.auth.getUserIdentity())?.role === "admin"` will 401 the page. Use it only
  when you have your own session cookie to check.

With neither configured, every route returns 401. Everything the page shows is
backed by the component's own functions — nothing else to wire up.

---

## How spend caps stay correct

A naive tracker checks the running total, makes the call, then records the cost.
Under concurrency that leaks badly: dozens of in-flight requests all read the same
pre-spend total and all pass, so spend blows past the cap (measured at ~40× before
this design). `ai-budget` instead **reserves then settles**:

1. **Reserve.** `startRequest` estimates the request's cost/tokens and, *in the
   same transaction as the limit check*, reserves them against each capped bucket.
   Under Convex's serializable isolation this is a true atomic check-and-reserve —
   concurrent requests see each other's holds.
2. **Settle.** `finishRequest` writes only the request's own (uncontended) row and
   schedules a fold of the real cost into the totals, releasing the reservation —
   so a request is never orphaned mid-flight.
3. **Reconcile.** A once-a-minute cron folds any stragglers and releases
   expired reservations using indexed deadlines. Expiry releases the hold but
   leaves billing open: a late completion records its final charge once without
   releasing the hold again. After content retention, unresolved requests retain
   a small billing record with prompts and responses removed.

Requests record the exact bucket IDs and calendar windows they reserve.
Settlement cannot release another request's hold, including across midnight or
month boundaries. Admission reads separate policy documents; only capped buckets
require reads of accounting state. Reporting updates still share bucket totals,
but do not write the policy documents used by uncapped admission.

**One admission rule, all scopes.** Every per-bucket cap — user, action, or any
tag — runs through the *same* admission check: a request is admitted only when
`committed + reserved + estimate ≤ cap` (bumps included) for **every** bucket it
touches. Each per-bucket cap reserves on a single document, making concurrent
admission atomic. The **global** killswitch is backed by a sharded counter for
throughput. Its sum is transactional but excludes unfinished and not-yet-folded
requests and has no cross-request reservation, so global admissions can overshoot.
Global usage is recorded even when limits are disabled. Historical usage omitted
by older versions is not automatically reconstructed by this upgrade.

Reservations are estimates, not provider-side maximum charges. If a response uses
more tokens or costs more than estimated, settlement records the real amount and
the final total can exceed a hard cap by that request's estimation delta. The next
admission sees the settled total and blocks until there is headroom again.

**Throughput characteristics.** Reconciliation runs as small,
independently-rescheduling phases, so folding, rollup, expiry, and retention
can't stall each other and each drains its own backlog. The settle path is kept
off shared hot rows:
- **Admission never reads the sharded global counter.** A reconciler phase
  compares the total to the cap out-of-band and flags `settings`; admission reads
  one already-loaded doc. The killswitch trips within ~one reconcile interval
  (that's what "approximate" means) instead of contending with every fold.
- **Settlement doesn't write shared bucket rows.** A capped bucket's row is
  updated live (it's per-user / low-concurrency, and enforcement needs it); every
  other attributed bucket — the shared `action`/tag rows — gets only an
  append-only delta, which the reconciler drains into totals + history as a single
  writer. So a hot single-dimension settle rate no longer serializes on one row.
  The trade: uncapped totals and spend history are eventually consistent. A healthy reconciler normally catches up on its next
  interval, but backlog and failures can extend that lag. Capped buckets retain
  their reservations until the final charge folds; enabling enforcement pauses
  admission until existing spend and in-flight work have been reconciled.

The `error.md` file documents the adversarial audits this design survived, with
live repros.

---

## Security: before you ship

The component is deliberately **identity-agnostic** — like
`@convex-dev/rate-limiter`, it trusts the `userId` and admin calls your app hands
it. **Your app owns auth.** The `example/` app skips auth on purpose to keep the
demo frictionless (a persona dropdown, public admin functions); do not copy its
endpoints verbatim. In production:

1. **Let `userId` default to the authenticated caller** (the built-in behavior —
   `ai.chat(ctx, { prompt })` uses the caller’s globally unique `tokenIdentifier`). Only pass an
   explicit `userId` from a trusted server context; never forward a client-supplied
   id, or a caller can spend under someone else's budget or dodge their own limits
   by rotating ids.
2. **Gate every admin call** — `setLimits`, `bump`, `adjust`, `setModelPolicy`,
   `setPrice`, `delete` — behind an admin check. A limit-management surface must
   not be operable by the party being limited.
3. **Scope reads and replay to the owner.** `requests.list` returns metadata; `requests.get` and
   `lineage` can return prompts, responses, and spend, and `rerun` re-runs a
   request billed to its **original** user. An unchecked client `requestId` is an
   IDOR — verify `request.userId === caller`, or treat those as admin-only.
4. **Gate the dashboard.** `registerRoutes` is a public endpoint; always pass a
   real `authorize` (or a token). See [Admin dashboard](#admin-dashboard).
5. **Know what `delete` erases.** Deleting a **`user`** bucket erases that user's
   request content (prompts/responses) — it's the per-person erasure primitive for
   a DSR. Deleting any **other** dimension (`action`, a `customer` tag, …) is
   **budget closure only**: it removes that bucket's limits/usage/credits but
   leaves the underlying request content, which belongs to a `userId` and is
   shared across dimensions, until normal [retention](#retention) expires. For a
   person's right-to-erasure, delete the **user**, or shorten `retentionMs`.
   Admin audit events survive deletion (accountability), including a record of the
   deletion itself.

### Enforce it with ESLint · `no-ungoverned-ai`

The budget only tracks spend that flows through it. To catch calls that bypass it —
a stray `import OpenAI from "openai"`, a direct `generateText` from the AI SDK, or
direct AI Gateway access — the package ships a flat-config ESLint plugin at
`@convex-dev/ai-budget/eslint`. It's an **import boundary**: provider SDKs are
allowed only in your budget wrapper module (where the real call lives inside a
budget callback), and flagged everywhere else.

```js
// eslint.config.js
import aiBudget from "@convex-dev/ai-budget/eslint";

export default [
  aiBudget.configs.recommended, // warns on ungoverned AI imports
  // your wrapper module is allowed to touch the raw SDKs:
  { files: ["convex/ai.ts"],
    rules: { "@convex-dev/ai-budget/no-ungoverned-ai": "off" } },
];
```

By default it flags `ai`, `@ai-sdk/*`, `openai`, `@anthropic-ai/*`, `@openrouter/*`,
`@convex-dev/ai-sdk-provider` (direct gateway access), and other provider SDKs, at
**`warn`** severity — set it to `"error"` in CI to truly block. Options:
`allow` (globs for wrapper files, an alternative to a `files` override),
`extraProviders` (add packages to flag), and `providers` (replace the list).
`eslint` is an optional peer dependency — nothing is pulled in unless you use it.

The rule matches on import sources, so it works with any parser. Convex code is
TypeScript, so lint it with [typescript-eslint](https://typescript-eslint.io) in
your config (as any TS project would); the rule then applies to your `.ts` files
alongside everything else.

---

## Example app

`example/` is a full working demo: chat as different personas on the left; a live
admin panel on the right — the request audit log (inspect → edit → re-run, with
lineage), a users table (limits, soft toggle, block, bump), per-action budgets,
and a **⚡ Burst** tab that fires N real concurrent AI requests against one
tightly-capped budget: watch reservations appear live, some requests get
admitted (with real settled costs), and the rest get atomically rejected by the
cap — the reserve-then-settle admission design, visible.

![Users & Limits admin table](docs/users.png)
![Actions & Budgets admin table](docs/actions.png)

```sh
cd example
npm install         # also links the repo-root node_modules the demo's
                    # ../../src component imports resolve through (postinstall)
npx convex dev      # terminal 1 — provisions a dev deployment
npm run dev         # terminal 2 — Vite app
```

### What's in the component vs. the demo

The published AI Budget component (`src/`) is **only** the metering/budget
primitive — it knows nothing about agents or evaluation. The example composes
three isolated pieces:

- The **Agent component** owns agent threads, messages, tools, and generation.
- The local **Evaluation component** (`example/convex/evaluations/`) owns immutable
  case snapshots, run lifecycle, and results. It does not call Agent or AI Budget.
- App-level adapters in `example/convex/ai.ts` compose the siblings: they obtain
  source traffic, run candidate/judge model calls through AI Budget, attach an
  `evalRun` budget tag, and persist outcomes into Evaluation.
- The **eval playground** (🧪 Experiment tab) exposes **Matrix** (one prompt across a
  system-prompt × model grid, ranked by an LLM judge on *your* criteria),
  **Backtest** (replay a candidate prompt against an action's real historical
  requests and judge each), and **Evolve** (an LLM iteratively improves a prompt
  toward a goal on real traffic, **stopping when it hits a spend budget**).

The demo currently snapshots AI Budget audit traffic as its corpus. An Agent-based
product should instead make the app adapter snapshot cases through Agent's public
API; Evaluation must never inspect Agent's private tables. The same Evaluation
component works with either source because its inputs are explicit snapshots.

This local component is a proof of the reusable boundary, not part of the
`@convex-dev/ai-budget` package. If productized, it should ship independently
(for example, `@convex-dev/evals`) and accept application adapters/function
handles rather than taking a dependency on either sibling component.

---


## Accounting upgrade notes

Existing tables gain only optional fields. New tables hold durable billing
records, admin audit events, admission keys, and deletion markers. Older settled
traffic is not backfilled into the billing ledger; existing aggregates remain.
Old reservations without ownership metadata retain the compatibility fallback;
exact historical hold ownership cannot be reconstructed if policies changed
before the upgrade.

**Identity migration:** automatic attribution uses issuer-scoped `tokenIdentifier`.
Admission checks the caller's old `subject` key atomically: if a legacy user bucket
or deletion marker exists, it returns `identity_migration_required` before creating
any new bucket. Upgrades therefore cannot silently reset an existing budget or
bypass a deleted user. Existing applications with subject-keyed budgets and one
trusted issuer can preserve their keys with
`new AIBudget(component, { identityKey: "subject" })`, or continue passing trusted
app-owned user IDs explicitly. For multiple issuers, pause admission, drain pending
work and deltas, migrate policies, balances, history, and attribution to stable
issuer-scoped keys, and verify the resulting limits before resuming. The component
does not automatically merge identity records. The guard remains active while old
subject buckets or deletion markers exist; remove them only as part of a verified
migration. Never combine equal subjects from distinct issuers.

**Policy transitions:** enabling spend/token/concurrency enforcement on a used
uncapped bucket temporarily returns `bucket_reconciling`. Bounded reconciliation
drains prior deltas and adopts existing in-flight holds before admission resumes.
The cron retries interrupted transitions and deletion work. Existing requests use
the price and tool-price snapshot taken at admission; legacy requests without a
snapshot continue to use the settlement-time price.

**Deletion:** `users.delete` blocks new admission, erases that user’s prompt logs,
user-bucket history, adjustments, and target-keyed admin records in bounded
batches. Pending or expired requests become sanitized billing tombstones so late
charges still reach shared buckets and the deployment total exactly once. A
minimal deletion marker retains the bucket key to prevent accidental recreation;
explicit admin `setLimits` can create a new bucket generation after deletion
finishes. Shared tag/action history, opaque billing events, and operator identities
in unrelated audit events remain. This is a documented retention policy, not a
claim of complete legal erasure. Your app must separately erase identifying
custom tags or operator records when required. Tombstones retain the existing
seven-day late-settlement horizon measured from expiry or privacy erasure; final usage after that horizon cannot be
recovered from a deleted request.

**Numeric limits:** accounting writes reject nonfinite values and unsafe integer
arithmetic instead of silently losing precision. If a bucket approaches
`Number.MAX_SAFE_INTEGER` nanodollars (about $9 million), migrate its accounting
to a larger representation before continuing. A failed fold keeps its request
available for recovery; monitor reconciliation health. Deployment-wide sharded
counters remain numeric approximate reporting counters.

### Explicit reservations and provider limits

Reject heuristic reservations deployment-wide when your app can supply
conservative bounds:

```ts
await ai.global.setPolicy(ctx, { requireExplicitReservations: true });
const result = await ai.chat(ctx, {
  prompt,
  reservation: { costNanos: 50_000_000, tokens: 4000, maxOutputTokens: 1000 },
});
```

`chat` and `languageModel` reserve the provided spend/token amounts and enforce
`maxOutputTokens` through the provider SDK. The app must include input, output,
reasoning, multimodal and tool charges in those bounds; the component cannot
prove that an arbitrary provider will honor a dollar ceiling. For non-text or
async jobs, pass `estimatedCostNanos` and `estimatedTokens` to `meter`/`begin` and
configure the provider’s own job limits. An underestimated final charge is still
recorded in full.

### Retries, operational visibility, and clearing limits

Pass a stable `idempotencyKey` to `begin` or `meter`. Repeated `begin` calls with
the same user/key and arguments reuse the request and return `reused: true`;
changed arguments are rejected. The `meter` callback receives
`{ requestId, idempotencyKey }`; forward the key to providers that support it.
`meter` throws `AIBudgetDuplicate` on reused admission instead of repeating the
provider call. After an ambiguous provider failure, use its job lookup and
`settle` to record the actual result. Keys remain reserved after request retention;
a reused key whose request was removed returns `idempotency_expired`. The host
owns key lifecycle and provider-side deduplication; this is not an exactly-once
external execution guarantee.

- `ai.users.paginate`, `ai.actions.paginate`, and `ai.tag(d).paginate` accept
  `{ cursor, limit }` and return `{ page, continueCursor, isDone }`. Legacy `list`
  APIs remain bounded previews; they are not complete inventories.
- `ai.global.health(ctx)` reports sampled fold/delta backlog, whether counts are
  truncated, and the last global-cap check. Reporting window stamps update
  reactively on the minute cron, including for otherwise idle buckets.
- `ai.requests.billing(ctx, { requestId })` reads the durable billing event even
  after its prompt log is retained then removed. `costSource` distinguishes
  authoritative charges, token estimates, and reservation estimates. New events
  are inserted atomically with folding and contain no prompt text or user keys.
- `ai.global.audit(ctx, { cursor, limit })` pages admin changes. Client wrappers
  derive actors from authentication; trusted host calls without identity record
  `host`, and shared dashboard-token calls record `dashboard`. Gate this API as
  an admin read. Direct component calls trust the host-provided actor.
- Omit a bucket/global limit to leave it unchanged; pass `null` to clear it.
  The dashboard sends `null` for empty controls and rejects invalid numbers.
- Raw Anthropic usage includes cache reads and cache writes in prompt totals.
  Configure `cacheWriteNanosPerMTok` and `cacheWrite1hNanosPerMTok` for exact
  fallback pricing; defaults are 1.25× and 2× input respectively. Authoritative
  provider cost always takes precedence.
- More than sixteen unique extra attribution tags is rejected, never silently
  truncated. Storage limits count UTF-8 bytes.
- Cookie-authorized dashboard mutations require same-origin JSON requests;
  bearer-token mode remains available for server automation. The HTML response
  disables referrers and framing. Streaming completion, cancellation, and source
  errors all attempt settlement; absent authoritative usage remains estimated.

## Stability (v1)

**Stable (frozen for 1.0)** — these keep backward compatibility within the 1.x line:
`ai.chat`, `ai.meter`, `ai.decisions`, `ai.languageModel`, and the admin
namespaces `ai.users` / `ai.actions` / `ai.tag` / `ai.global` / `ai.models` /
`ai.prices` / `ai.requests`, plus `ai.registerRoutes`. The stored schema is frozen;
new fields on existing tables will only be added as optional. The identity
default change below requires an explicit migration decision for existing apps. `ai.decisions` is backed by the
gateway's generally-available Decisions (Jev) endpoint; the only moving part is the
AI SDK's `experimental_evaluate` export it calls, so pin your `ai` version.

**Experimental (may change without a major bump):** video generation
(`ai.begin`/`ai.settle` with `reserveTtlMs` + `registerWebhook`), which depends on
gateway features that are still alpha.

**Semantics worth knowing:**
- **Spend caps** admit on an *estimate*, so a token-priced cap can be exceeded by
  the aggregate estimate-versus-actual delta of admitted requests; pass `estimatedCostNanos` for an exact
  reservation. The **global cap** is a best-effort killswitch (`enforcement:
  "approximate"` | `"soft"`), not a to-the-dollar ceiling.
- **Credits** (`ai.tag(d).adjust` / negative `deltaNanos`) accrue in a separate
  balance and never reduce gross spend; caps enforce on **net = gross − credits**,
  so a credit grants real headroom while spend history stays consistent.
- **Deployment policy** (`ai.global.setPolicy`): `allowUnpricedModels: false`
  rejects models with no configured price under hard enforcement (default charges
  the conservative fallback); `storeContent: false` persists metadata but no
  prompt/response content and sanitizes provider errors. Raw provider errors are sanitized by default; retaining them requires
  explicit `storeRawErrors: true` together with content storage. Changing these policies
  applies to subsequent writes; it does not erase all pre-existing records.

## Development

```sh
npm test            # vitest + convex-test: reserve/settle, exactly-once, monthly
                    # caps, cache pricing, tag budgets, alerts, adjustments, …
npm run build       # emit dist/ (client + component) for publishing
```

**Layout**

- `src/component/` — **the component** (published): tables (`buckets`, `requests`,
  `usage`, `requestTags`, `adjustments`, `prices`, `settings`), the reserve/settle
  mutations (`startRequest` / `finishRequest`), the idempotent `foldTotals`, the
  `reconcile` cron, and the admin functions. Mounts `@convex-dev/sharded-counter`
  for the global total.
- `src/client/` — **the client** (published): the `AIBudget` class — `chat`,
  `languageModel`, `registerRoutes`, and the namespaced admin API.
- `example/` — **the demo app** (not published): real features, the eval
  playground, and the UI. `example/convex/evaluations/` is a separate local
  component for datasets, runs, and results; `example/convex/ai.ts` is the
  composition layer.

## License

Apache-2.0
