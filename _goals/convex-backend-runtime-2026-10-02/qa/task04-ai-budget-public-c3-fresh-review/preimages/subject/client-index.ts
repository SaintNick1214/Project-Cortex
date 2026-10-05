import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { generateText, type LanguageModel, wrapLanguageModel } from "ai";
import {
  type Expand,
  type FunctionReference,
  httpActionGeneric,
  type HttpRouter,
} from "convex/server";
import { ConvexError, type GenericId } from "convex/values";
import type { api } from "../component/_generated/api.js";
import { DASHBOARD_HTML } from "./dashboard.js";

// ---------- types ----------

// Map branded document Ids to plain strings across the component boundary.
// Note: only GenericId, not `string` — widening every string (and string-literal
// union like "hard"|"soft") to `string` breaks structural matching of returns.
type OpaqueIds<T> = T extends GenericId<infer _T> ? string
  : T extends (infer U)[] ? OpaqueIds<U>[]
  : T extends ArrayBuffer ? ArrayBuffer
  : T extends object ? { [K in keyof T]: OpaqueIds<T[K]>; }
  : T;

type UseApi<API> = Expand<
  {
    [mod in keyof API]: API[mod] extends FunctionReference<
      infer FType,
      "public",
      infer FArgs,
      infer FReturnType,
      infer FComponentPath
    > ? FunctionReference<
        FType,
        "internal",
        OpaqueIds<FArgs>,
        OpaqueIds<FReturnType>,
        FComponentPath
      >
      : UseApi<API[mod]>;
  }
>;

export type AIBudgetApi = UseApi<typeof api>;
/** @deprecated use AIBudgetApi */
export type AIGatewayApi = AIBudgetApi;

/**
 * One attribution tag: a (dimension, value) pair, e.g. {dimension:"customer",
 * value:"acme"}. `user` and `action` are built-in dimensions (set via
 * userId/action); use tags for anything else — team, project, tenant, env, ….
 * Any tagged bucket can carry its own budget (see `ai.tag(dimension)`).
 */
export type Tag = { dimension: string; value: string; };

/** Common shape for budget-event callbacks. */
export type BudgetEventInfo = {
  userId: string;
  action?: string;
  tags?: Tag[];
  requestId?: string;
  /** soft-cap warnings (onSoftLimit) or approaching-cap notices (onThreshold). */
  messages: string[];
  /** rejection code/reason (onLimitReached only). */
  code?: string;
  reason?: string;
};
/** @deprecated use BudgetEventInfo */
export type SoftLimitInfo = BudgetEventInfo & { warnings: string[]; };
export type AIBudgetOptions = {
  defaultModel?: string;
  /** Legacy single-issuer deployments may opt into subject while migrating. */
  identityKey?: "tokenIdentifier" | "subject";
  /** Default model for `decisions()` (the Decisions/"Jev" endpoint). */
  defaultEvalModel?: string;
  /**
   * A *soft* limit was exceeded (request still allowed). Lets you surface budget
   * warnings even on the languageModel/Agent path where they can't be returned.
   * Errors thrown in any of these callbacks are swallowed.
   */
  onSoftLimit?: (info: SoftLimitInfo) => void | Promise<void>;
  /** Usage crossed a bucket's warnAtPct threshold (approaching a cap). */
  onThreshold?: (info: BudgetEventInfo) => void | Promise<void>;
  /** A *hard* limit blocked the request (fires just before chat/model throws). */
  onLimitReached?: (info: BudgetEventInfo) => void | Promise<void>;
};

type RunQueryCtx = {
  runQuery: <Query extends FunctionReference<"query", "internal">>(
    query: Query,
    args: Query["_args"],
  ) => Promise<Query["_returnType"]>;
};
type RunMutationCtx = RunQueryCtx & {
  runMutation: <M extends FunctionReference<"mutation", "internal">>(
    mutation: M,
    args: M["_args"],
  ) => Promise<M["_returnType"]>;
  meta?: { getFunctionMetadata(): Promise<{ name: string; }>; };
  auth?: {
    getUserIdentity(): Promise<
      { subject?: string; issuer?: string; tokenIdentifier?: string; } | null
    >;
  };
};

// The calling Convex action's name (e.g. "ai:sendMessage"), unless overridden.
async function resolveActionName(
  ctx: RunMutationCtx,
  explicit?: string,
): Promise<string | undefined> {
  if (explicit !== undefined) return explicit;
  try {
    return (await ctx.meta?.getFunctionMetadata())?.name;
  } catch {
    return undefined;
  }
}

// The user this call is billed to. If not passed explicitly, it's the
// authenticated caller (ctx.auth.getUserIdentity().tokenIdentifier) — so budgets are
// server-derived by default and can't be spoofed by a client-supplied id.
async function resolveUserAttribution(
  ctx: RunMutationCtx,
  explicit?: string,
  identityKey: "tokenIdentifier" | "subject" = "tokenIdentifier",
): Promise<{ userId: string; legacyUserId?: string; }> {
  if (explicit !== undefined) return { userId: explicit };
  const identity = await ctx.auth?.getUserIdentity?.();
  if (identityKey === "subject" && identity?.subject) return { userId: identity.subject };
  const userId = identity?.tokenIdentifier
    ?? (identity?.issuer && identity.subject
      ? `${identity.issuer}|${identity.subject}`
      : undefined);
  if (userId) {
    return {
      userId,
      ...(identity?.subject && identity.subject !== userId
        ? { legacyUserId: identity.subject }
        : {}),
    };
  }
  throw new Error(
    "ai-budget: no `userId` was passed and there is no authenticated user "
      + "(ctx.auth.getUserIdentity() returned null). Either authenticate the "
      + "request or pass an explicit `userId`.",
  );
}

export type Message = { role: string; content: string; };

export type ChatResult = {
  text: string;
  requestId: string;
  costNanos: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cachedWriteTokens: number;
  cachedWrite1hTokens: number;
  /** Soft-limit warnings raised at admission (empty unless a soft cap was hit). */
  warnings: string[];
  /** Approaching-cap notices (empty unless a warnAtPct threshold was crossed). */
  notices: string[];
};

/** The tracked result of a `decisions()` call: budgeting metadata plus the
 * structured answers from the Decisions ("Jev") endpoint. */
export type DecisionResult = Omit<ChatResult, "text"> & {
  /** Structured answers keyed by your question names (shape depends on each
   * question type: `choice`, `score`, or `boolean`). */
  answers: Record<string, any>;
  /** The raw gateway response, including provider-specific fields (e.g.
   * `confidence`) under `response.body`. */
  response?: any;
};

// ---------- helpers ----------

// Token counts across AI SDK versions come as plain numbers or, in v7, as a
// structured breakdown like { reasoning, text, total }. Coerce either to a number.
function toTokenCount(x: any): number {
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (x && typeof x === "object") return toTokenCount(x.total ?? x.text ?? 0);
  return 0;
}

function extractUsage(usage: any): {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cachedWriteTokens: number;
  cachedWrite1hTokens: number;
} {
  return {
    // Cover AI SDK camelCase (v5/v7), raw OpenAI-compatible snake_case, AND raw
    // Anthropic (`input_tokens`/`output_tokens`), so a `meter` caller passing any
    // provider's raw `usage` object still gets counts.
    promptTokens: usage?.input_tokens !== undefined
      ? toTokenCount(usage.input_tokens) + toTokenCount(usage.cache_read_input_tokens)
        + toTokenCount(usage.cache_creation_input_tokens)
      : toTokenCount(
        usage?.inputTokens
          ?? usage?.promptTokens
          ?? usage?.prompt_tokens
          ?? usage?.input_tokens,
      ),
    completionTokens: toTokenCount(
      usage?.outputTokens
        ?? usage?.completionTokens
        ?? usage?.completion_tokens
        ?? usage?.output_tokens,
    ),
    cachedWrite1hTokens: toTokenCount(
      usage?.cache_creation?.ephemeral_1h_input_tokens
        ?? usage?.raw?.cache_creation?.ephemeral_1h_input_tokens,
    ),
    cachedWriteTokens: toTokenCount(
      usage?.cache_creation_input_tokens ?? usage?.inputTokenDetails?.cacheWriteTokens
        ?? usage?.inputTokens?.cacheWrite,
    ),
    // cached prompt tokens. The Convex gateway reports these at
    // `usage.inputTokenDetails.cacheReadTokens`; the other paths cover AI SDK v5
    // (`cachedInputTokens`) and raw OpenAI-compatible shapes.
    cachedTokens: toTokenCount(
      usage?.inputTokenDetails?.cacheReadTokens
        ?? usage?.inputTokens?.cacheRead
        ?? usage?.input_tokens_details?.cached_tokens
        ?? usage?.cachedInputTokens
        ?? usage?.promptTokensDetails?.cachedTokens
        ?? usage?.prompt_tokens_details?.cached_tokens
        ?? usage?.cached_tokens
        ?? usage?.cache_read_input_tokens,
    ),
  };
}

// The AI Gateway reports the authoritative dollar cost of each request.
// @convex-dev/ai-sdk-provider surfaces it at
// `providerMetadata.convexGateway.cost` (USD); convert to nanodollars and pass
// it through as authoritative (finishRequest prefers it over the token-based
// estimate). No-op on older provider versions that don't surface it.
function extractGatewayCostNanos(result: any): number | undefined {
  const meta = result?.providerMetadata?.convexGateway;
  const costUsd = meta?.cost;
  if (typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd >= 0) {
    return Math.round(costUsd * NANOS_PER_DOLLAR);
  }
  // Back-compat: honor an explicitly nano-denominated field if ever present.
  const costNanos = meta?.costNanos ?? result?.usage?.costNanos;
  if (typeof costNanos === "number" && Number.isFinite(costNanos) && costNanos >= 0) {
    return Math.round(costNanos);
  }
  return undefined;
}

const NANOS_PER_DOLLAR = 1e9;

// Cap stored prompt/response content so one row can't approach Convex's 1 MiB
// document limit (which would fail the call) or bloat the reconciler's scans.
const MAX_STORED_CONTENT = 32 * 1024;
const capContent = (s: string) =>
  s.length > MAX_STORED_CONTENT ? s.slice(0, MAX_STORED_CONTENT) + "…[truncated]" : s;

// Flatten an AI SDK prompt (roles + content parts) into simple storable messages.
function simplifyPrompt(prompt: any): Message[] {
  if (!Array.isArray(prompt)) return [];
  return prompt.map((m: any) => {
    let content: string;
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      content = m.content
        .map((part: any) => {
          if (part?.type === "text") return part.text ?? "";
          // NEVER inline a base64 image/file part — a data URL or Uint8Array here
          // becomes megabytes, pushing the stored row past the 1 MiB doc limit
          // (failing the call) and turning a 200 KB image into a ~50k-token
          // estimate. Store a compact placeholder.
          const bytes = part?.data?.length ?? part?.image?.length ?? part?.data?.byteLength;
          return `[${part?.type ?? "part"}${typeof bytes === "number" ? ` ${bytes}b` : ""}]`;
        })
        .join("");
    } else {
      content = JSON.stringify(m.content);
    }
    return { role: String(m.role), content };
  });
}

function extractText(result: any): string {
  if (typeof result?.text === "string") return result.text;
  if (Array.isArray(result?.content)) {
    return result.content
      .filter((p: any) => p?.type === "text")
      .map((p: any) => p.text)
      .join("");
  }
  return "";
}

// ---------- client ----------

// Length-independent-branch string compare, so the dashboard token check
// doesn't leak the token via response timing. (Length itself is not secret.)
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Limits/controls settable on any budget bucket (user, action, or tag). */
export type BucketLimits = {
  /** Token-bucket refill per minute and burst capacity; 0 blocks all requests. */
  requestsPerMinute?: number | null;
  maxConcurrent?: number | null;
  dailySpendLimitNanos?: number | null;
  monthlySpendLimitNanos?: number | null;
  lifetimeSpendLimitNanos?: number | null;
  dailyTokenLimit?: number | null;
  monthlyTokenLimit?: number | null;
  lifetimeTokenLimit?: number | null;
  /** Fire an approaching-limit alert at this fraction of a cap (e.g. 0.8). */
  warnAtPct?: number | null;
  enforcement?: "hard" | "soft" | null;
  blocked?: boolean | null;
};
/** One-time bump amounts, added on top of a standing cap. */
export type BumpArgs = {
  dailyNanos?: number;
  monthlyNanos?: number;
  lifetimeNanos?: number;
};

/** Explicit conservative bounds. The app must include input, output and tool
 * charges in costNanos/tokens; maxOutputTokens is also enforced at the provider. */
export type StrictReservation = { costNanos: number; tokens: number; maxOutputTokens: number; };
function validateReservation(reservation: StrictReservation) {
  for (const [key, value] of Object.entries(reservation)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${key} must be a nonnegative safe integer`);
    }
  }
  if (reservation.maxOutputTokens < 1 || reservation.maxOutputTokens > reservation.tokens) {
    throw new Error("maxOutputTokens must be positive and fit within the token reservation");
  }
}

export class AIBudget {
  public defaultModel: string;
  public defaultEvalModel: string;
  private identityKey: "tokenIdentifier" | "subject";
  private onSoftLimit?: AIBudgetOptions["onSoftLimit"];
  private onThreshold?: AIBudgetOptions["onThreshold"];
  private onLimitReached?: AIBudgetOptions["onLimitReached"];
  constructor(
    public component: AIBudgetApi,
    options?: AIBudgetOptions,
  ) {
    this.identityKey = options?.identityKey ?? "tokenIdentifier";
    this.defaultModel = options?.defaultModel ?? "openai/gpt-4o-mini";
    this.defaultEvalModel = options?.defaultEvalModel ?? "typesafe/jev-1.13";
    this.onSoftLimit = options?.onSoftLimit;
    this.onThreshold = options?.onThreshold;
    this.onLimitReached = options?.onLimitReached;
  }

  // Fire the soft-limit + threshold callbacks from a startRequest result.
  private async fireBudgetEvents(
    base: Omit<BudgetEventInfo, "messages">,
    warnings: string[],
    notices: string[],
  ) {
    if (warnings.length > 0 && this.onSoftLimit) {
      try {
        await this.onSoftLimit({ ...base, messages: warnings, warnings });
      } catch {
        /* never let a callback error break a request */
      }
    }
    if (notices.length > 0 && this.onThreshold) {
      try {
        await this.onThreshold({ ...base, messages: notices });
      } catch {
        /* swallow */
      }
    }
  }

  private async fireLimitReached(info: BudgetEventInfo) {
    if (!this.onLimitReached) return;
    try {
      await this.onLimitReached(info);
    } catch {
      /* swallow */
    }
  }

  /**
   * Reserve budget for a call WITHOUT running it — the async half of the
   * lifecycle. Use for long-running jobs (video generation) where the result
   * arrives minutes later via a poll or webhook: `begin` here, then `settle`
   * from that later context with the request's `requestId`. Returns the
   * admission result (does NOT throw over a cap — check `allowed`). Set
   * `reserveTtlMs` to the job's max duration so the hold isn't reaped mid-flight.
   */
  async begin(
    ctx: RunMutationCtx,
    opts: {
      model: string;
      messages?: Message[];
      userId?: string;
      action?: string;
      tags?: Tag[];
      /** Reserve this exact amount (nanodollars) when the cost is known up front. */
      estimatedCostNanos?: number;
      estimatedTokens?: number;
      /** Hold the reservation up to this long (ms) for long async jobs. */
      reserveTtlMs?: number;
      rerunOf?: string;
      idempotencyKey?: string;
    },
  ): Promise<
    | { allowed: true; requestId: string; reused?: boolean; warnings: string[]; notices: string[]; }
    | { allowed: false; code: string; reason: string; }
  > {
    const { userId, legacyUserId } = await resolveUserAttribution(
      ctx,
      opts.userId,
      this.identityKey,
    );
    const actionName = await resolveActionName(ctx, opts.action);
    const started = await ctx.runMutation(this.component.lib.startRequest, {
      userId,
      legacyUserId,
      actionName,
      tags: opts.tags,
      model: opts.model,
      messages: opts.messages ?? [],
      estimatedCostNanos: opts.estimatedCostNanos,
      estimatedTokens: opts.estimatedTokens,
      reserveTtlMs: opts.reserveTtlMs,
      idempotencyKey: opts.idempotencyKey,
      rerunOf: opts.rerunOf as any,
    });
    if (started.allowed) {
      await this.fireBudgetEvents(
        { userId, action: actionName, tags: opts.tags, requestId: started.requestId },
        started.warnings,
        started.notices,
      );
    } else {
      await this.fireLimitReached({
        userId,
        action: actionName,
        tags: opts.tags,
        messages: [started.reason],
        code: started.code,
        reason: started.reason,
      });
    }
    return started;
  }

  /**
   * Record the actual usage/cost of a `begin`-reserved request and release its
   * reservation. Idempotent (exactly-once server-side). Pass a raw provider
   * `usage` (auto-normalized) or explicit token counts, plus optional
   * `serverToolUses` and an authoritative `costNanos`.
   */
  async settle(
    ctx: RunMutationCtx,
    args: {
      requestId: string;
      responseText?: string;
      error?: string;
      usage?: any;
      promptTokens?: number;
      completionTokens?: number;
      cachedTokens?: number;
      cachedWriteTokens?: number;
      cachedWrite1hTokens?: number;
      serverToolUses?: Record<string, number>;
      costNanos?: number;
      latencyMs?: number;
    },
  ): Promise<{ costNanos: number; }> {
    const {
      requestId,
      usage,
      promptTokens,
      completionTokens,
      cachedTokens,
      cachedWriteTokens,
      cachedWrite1hTokens,
      ...rest
    } = args;
    const tokens = promptTokens !== undefined
        || completionTokens !== undefined
        || cachedTokens !== undefined
        || cachedWriteTokens !== undefined
        || cachedWrite1hTokens !== undefined
      ? {
        promptTokens: promptTokens ?? 0,
        completionTokens: completionTokens ?? 0,
        cachedTokens: cachedTokens ?? 0,
        cachedWriteTokens: cachedWriteTokens ?? 0,
        cachedWrite1hTokens: cachedWrite1hTokens ?? 0,
      }
      : usage !== undefined
      ? extractUsage(usage)
      : {};
    return ctx.runMutation(this.component.lib.finishRequest, {
      requestId: requestId as any,
      ...tokens,
      ...rest,
    });
  }

  /**
   * Meter ANY synchronous LLM call — gateway, a provider SDK, a raw fetch — with
   * the same budgets, audit log, and cost tracking. Reserves before your `run`
   * (throwing a ConvexError over a hard cap), runs it, then records the actual
   * usage/cost. The provider-agnostic core; `chat` is sugar over it. (For async
   * jobs that settle later, use `begin`/`settle` instead.)
   *
   * `run` returns what happened. Pass a raw provider `usage` object (auto-
   * normalized) OR explicit `promptTokens`/`completionTokens`/`cachedTokens`,
   * plus optional `serverToolUses` (e.g. `{ web_search: 3 }`) and an
   * authoritative `costNanos` (used verbatim if present).
   */
  async meter(
    ctx: RunMutationCtx,
    opts: {
      model: string;
      messages: Message[];
      userId?: string;
      action?: string;
      tags?: Tag[];
      rerunOf?: string;
      /** Reserve this exact amount (nanodollars) instead of the token estimate. */
      estimatedCostNanos?: number;
      estimatedTokens?: number;
      idempotencyKey?: string;
    },
    run: (tracking: { requestId: string; idempotencyKey?: string; }) => Promise<{
      text?: string;
      usage?: any;
      promptTokens?: number;
      completionTokens?: number;
      cachedTokens?: number;
      cachedWriteTokens?: number;
      cachedWrite1hTokens?: number;
      serverToolUses?: Record<string, number>;
      costNanos?: number;
    }>,
  ): Promise<ChatResult> {
    const started = await this.begin(ctx, opts);
    if (!started.allowed) {
      throw new ConvexError({
        kind: "AIBudgetLimit",
        code: started.code,
        reason: started.reason,
      });
    }
    if (started.reused) {
      throw new ConvexError({ kind: "AIBudgetDuplicate", requestId: started.requestId });
    }
    const { requestId, warnings, notices } = started;
    const start = Date.now();
    // Run the provider call. ONLY a failure of the call itself settles as an
    // error (no charge expected).
    let out: Awaited<ReturnType<typeof run>>;
    try {
      out = await run({ requestId, idempotencyKey: opts.idempotencyKey });
    } catch (e) {
      await this.settle(ctx, { requestId, error: String(e), latencyMs: Date.now() - start });
      throw e;
    }
    // The call SUCCEEDED (the provider may have charged). Settle the real usage.
    // If settlement itself fails here, do NOT fall into an error-settle that
    // records zero — that would erase a real charge. Rethrow and leave the
    // reservation for the reconciler; billing stays "unknown", never a false zero.
    const { costNanos } = await this.settle(ctx, {
      requestId,
      responseText: out.text,
      usage: out.usage,
      promptTokens: out.promptTokens,
      completionTokens: out.completionTokens,
      cachedTokens: out.cachedTokens,
      cachedWriteTokens: out.cachedWriteTokens,
      cachedWrite1hTokens: out.cachedWrite1hTokens,
      serverToolUses: out.serverToolUses,
      costNanos: out.costNanos,
      latencyMs: Date.now() - start,
    });
    // Re-derive the recorded usage for the return value.
    const usage = out.promptTokens !== undefined
        || out.completionTokens !== undefined
        || out.cachedTokens !== undefined
        || out.cachedWriteTokens !== undefined
        || out.cachedWrite1hTokens !== undefined
      ? {
        promptTokens: out.promptTokens ?? 0,
        completionTokens: out.completionTokens ?? 0,
        cachedTokens: out.cachedTokens ?? 0,
        cachedWriteTokens: out.cachedWriteTokens ?? 0,
        cachedWrite1hTokens: out.cachedWrite1hTokens ?? 0,
      }
      : extractUsage(out.usage);
    return { text: out.text ?? "", requestId, costNanos, warnings, notices, ...usage };
  }

  /**
   * One-shot chat through the AI Gateway with tracking + limits — sugar over
   * `meter`. Call from an action. `userId` defaults to the authenticated caller.
   */
  async chat(
    ctx: RunMutationCtx,
    args: {
      /** Whom to bill. Defaults to the authenticated user (ctx.auth). */
      userId?: string;
      prompt?: string;
      messages?: Message[];
      model?: string;
      reservation?: StrictReservation;
      idempotencyKey?: string;
      rerunOf?: string;
      /** Attribute spend to this action name. Defaults to the calling Convex action. */
      action?: string;
      /** Extra attribution dimensions to bill/limit (team, customer, env, …). */
      tags?: Tag[];
    } = {},
  ): Promise<ChatResult> {
    if (args.reservation) validateReservation(args.reservation);
    const model = args.model ?? this.defaultModel;
    const messages: Message[] = args.messages ?? [{ role: "user", content: args.prompt ?? "" }];
    return this.meter(
      ctx,
      {
        model,
        messages,
        estimatedCostNanos: args.reservation?.costNanos,
        estimatedTokens: args.reservation?.tokens,
        idempotencyKey: args.idempotencyKey,
        userId: args.userId,
        action: args.action,
        tags: args.tags,
        rerunOf: args.rerunOf,
      },
      async () => {
        // The full chain (incl. system) is stored for audit/replay, but the AI
        // SDK wants system prompts in the `system` option, not messages.
        const system = messages
          .filter((m) => m.role === "system")
          .map((m) => m.content)
          .join("\n\n") || undefined;
        const convo = messages.filter((m) => m.role !== "system");
        const result = await generateText({
          model: convexGateway(model),
          ...(args.reservation ? { maxOutputTokens: args.reservation.maxOutputTokens } : {}),
          ...(system ? { system } : {}),
          messages: convo as any,
        });
        return {
          text: result.text,
          usage: result.usage,
          costNanos: extractGatewayCostNanos(result),
        };
      },
    );
  }

  /**
   * Budget a structured decision through the AI Gateway's Decisions ("Jev")
   * endpoint — sugar over `meter`. Evaluates typed `questions` (choice / score /
   * boolean) about the `state` you provide, with the same reserve→settle
   * limits, audit log, cost tracking, and per-tag attribution as `chat`. Call
   * from an action. `userId` defaults to the authenticated caller.
   *
   * Requires `@convex-dev/ai-sdk-provider` >= 0.2.1 and an `ai` version that
   * exposes `experimental_evaluate` (AI SDK 7's evaluation interface); both are
   * imported lazily, so consumers who never call `decisions()` are unaffected.
   *
   *   const { answers } = await ai.decisions(ctx, {
   *     state: { ticket: "Customer cannot sign in" },
   *     questions: {
   *       priority: { type: "choice", instructions: "...", criteria: { urgent: "...", normal: "..." } },
   *       needsReview: { type: "boolean", instructions: "..." },
   *     },
   *   });
   *   answers.priority.choice; // "urgent" | "normal"
   */
  async decisions(
    ctx: RunMutationCtx,
    args: {
      /** The evaluation model. Defaults to `defaultEvalModel` ("typesafe/jev-1.13"). */
      model?: string;
      /** Context the questions are evaluated against (a string or an object). */
      state: unknown;
      /** Typed questions (choice / score / boolean) keyed by name. */
      questions: Record<string, unknown>;
      /** Whom to bill. Defaults to the authenticated user (ctx.auth). */
      userId?: string;
      /** Attribute spend to this action name. Defaults to the calling action. */
      action?: string;
      /** Extra attribution dimensions to bill/limit (team, customer, env, …). */
      tags?: Tag[];
      /** Reserve this exact amount (nanodollars) up front — the decision cost
       * isn't known before the call, so a hard cap is only exact with this. */
      estimatedCostNanos?: number;
      estimatedTokens?: number;
      rerunOf?: string;
      /** Cancel the underlying request. */
      abortSignal?: AbortSignal;
    },
  ): Promise<DecisionResult> {
    const model = args.model ?? this.defaultEvalModel;
    // `evaluate` is an experimental, version-gated export; import it lazily and
    // untyped so consumers on an older `ai` (who never call this) aren't broken.
    const evaluate = ((await import("ai")) as any).experimental_evaluate;
    if (typeof evaluate !== "function") {
      throw new Error(
        "ai-budget: decisions() needs `experimental_evaluate` from the `ai` "
          + "package (AI SDK 7's evaluation interface). Upgrade `ai` to a "
          + "version that exports it.",
      );
    }
    // Likewise, `evaluationModel` exists on @convex-dev/ai-sdk-provider >= 0.2.1.
    const evaluationModel = (convexGateway as any).evaluationModel;
    if (typeof evaluationModel !== "function") {
      throw new Error(
        "ai-budget: decisions() needs `convexGateway.evaluationModel` from "
          + "@convex-dev/ai-sdk-provider >= 0.2.1. Upgrade the provider.",
      );
    }
    let decision: any;
    const result = await this.meter(
      ctx,
      {
        model,
        // Store the structured request for audit/replay.
        messages: [
          {
            role: "user",
            content: JSON.stringify({ state: args.state, questions: args.questions }),
          },
        ],
        userId: args.userId,
        action: args.action,
        tags: args.tags,
        estimatedCostNanos: args.estimatedCostNanos,
        estimatedTokens: args.estimatedTokens,
        rerunOf: args.rerunOf,
      },
      async () => {
        decision = await evaluate({
          model: evaluationModel(model),
          state: args.state,
          questions: args.questions,
          ...(args.abortSignal ? { abortSignal: args.abortSignal } : {}),
        });
        return {
          usage: decision?.usage,
          costNanos: extractGatewayCostNanos(decision),
        };
      },
    );
    const { text: _text, ...tracking } = result;
    return { ...tracking, answers: decision?.answers ?? {}, response: decision?.response };
  }

  /**
   * An AI SDK LanguageModel that enforces limits and records usage/cost for
   * `userId` on every call. Drop it into `generateText`, `streamText`, or the
   * Convex Agent component (`new Agent(components.agent, { languageModel })`).
   * `userId` defaults to the authenticated caller (ctx.auth).
   */
  languageModel(
    ctx: RunMutationCtx,
    opts: {
      userId?: string;
      model?: string;
      reservation?: StrictReservation;
      action?: string;
      /** Extra attribution dimensions to bill/limit (team, customer, env, …). */
      tags?: Tag[];
    } = {},
  ): LanguageModel {
    if (opts.reservation) validateReservation(opts.reservation);
    const modelId = opts.model ?? this.defaultModel;
    const component = this.component;
    const fireBudgetEvents = this.fireBudgetEvents.bind(this);
    const fireLimitReached = this.fireLimitReached.bind(this);

    const begin = async (params: any) => {
      const { userId, legacyUserId } = await resolveUserAttribution(
        ctx,
        opts.userId,
        this.identityKey,
      );
      const actionName = await resolveActionName(ctx, opts.action);
      const base = { userId, action: actionName, tags: opts.tags };
      const started = await ctx.runMutation(component.lib.startRequest, {
        userId,
        legacyUserId,
        actionName,
        tags: opts.tags,
        model: modelId,
        estimatedCostNanos: opts.reservation?.costNanos,
        estimatedTokens: opts.reservation?.tokens,
        messages: simplifyPrompt(params.prompt),
      });
      if (!started.allowed) {
        await fireLimitReached({
          ...base,
          messages: [started.reason],
          code: started.code,
          reason: started.reason,
        });
        throw new ConvexError({
          kind: "AIBudgetLimit",
          code: started.code,
          reason: started.reason,
        });
      }
      await fireBudgetEvents(
        { ...base, requestId: started.requestId },
        started.warnings,
        started.notices,
      );
      return started.requestId;
    };
    const finish = async (
      requestId: any,
      fields: {
        responseText?: string;
        error?: string;
        promptTokens?: number;
        completionTokens?: number;
        cachedTokens?: number;
        cachedWriteTokens?: number;
        cachedWrite1hTokens?: number;
        costNanos?: number;
        latencyMs?: number;
      },
    ) => ctx.runMutation(component.lib.finishRequest, { requestId, ...fields });

    return wrapLanguageModel({
      model: convexGateway(modelId) as any,
      middleware: {
        transformParams: async ({ params }: any) =>
          opts.reservation
            ? {
              ...params,
              maxOutputTokens: Math.min(
                params.maxOutputTokens ?? opts.reservation.maxOutputTokens,
                opts.reservation.maxOutputTokens,
              ),
            }
            : params,
        wrapGenerate: async ({ doGenerate, params }: any) => {
          const requestId = await begin(params);
          const start = Date.now();
          // Only a failure of the generation itself settles as an error.
          let result: any;
          try {
            result = await doGenerate();
          } catch (e) {
            await finish(requestId, {
              error: String(e),
              latencyMs: Date.now() - start,
            });
            throw e;
          }
          // Generation succeeded (provider may have charged). Settle the real
          // usage; a failure here rethrows rather than recording a false zero.
          await finish(requestId, {
            responseText: extractText(result),
            ...extractUsage(result.usage),
            costNanos: extractGatewayCostNanos(result),
            latencyMs: Date.now() - start,
          });
          return result;
        },
        wrapStream: async ({ doStream, params }: any) => {
          const requestId = await begin(params);
          const start = Date.now();
          let text = "";
          let usage: any = undefined;
          let providerMetadata: any = undefined;
          try {
            const result = await doStream();
            // Own the reader lifecycle so cancellation and source errors settle
            // in every supported runtime, without optional TransformStream hooks.
            let settlement: Promise<{ costNanos: number; }> | undefined;
            let streamError: string | undefined;
            const settle = (error?: string) => (settlement ??= finish(requestId, {
              responseText: text,
              error: error ?? streamError,
              ...extractUsage(usage),
              costNanos: extractGatewayCostNanos({ providerMetadata }),
              latencyMs: Date.now() - start,
            }));
            const reader = result.stream.getReader();
            const tapped = new ReadableStream({
              async pull(controller) {
                try {
                  const { done, value: chunk } = await reader.read();
                  if (done) {
                    await settle();
                    controller.close();
                    reader.releaseLock();
                    return;
                  }
                  if (chunk?.type === "text-delta") {
                    text = capContent(text + (chunk.delta ?? chunk.textDelta ?? ""));
                  }
                  if (chunk?.type === "finish") {
                    usage = chunk.usage;
                    providerMetadata = chunk.providerMetadata ?? providerMetadata;
                  }
                  if (chunk?.type === "error") streamError = String(chunk.error);
                  controller.enqueue(chunk);
                  if (chunk?.type === "finish") await settle();
                } catch (error) {
                  try {
                    await settle(String(error));
                  } catch (settlementError) {
                    controller.error(settlementError);
                    return;
                  }
                  controller.error(error);
                }
              },
              async cancel(reason) {
                try {
                  await reader.cancel(reason);
                } finally {
                  await settle(`cancelled: ${String(reason)}`);
                }
              },
            });
            return { ...result, stream: tapped };
          } catch (e) {
            await finish(requestId, {
              error: String(e),
              latencyMs: Date.now() - start,
            });
            throw e;
          }
        },
      } as any,
    }) as LanguageModel;
  }

  private async rerunImpl(
    ctx: RunMutationCtx,
    args: { requestId: string; messages?: Message[]; model?: string; },
  ): Promise<ChatResult> {
    const original = await ctx.runQuery(this.component.lib.getRequest, {
      requestId: args.requestId as any,
    });
    if (!original) throw new Error("Unknown request");
    return this.chat(ctx, {
      userId: original.userId,
      model: args.model ?? original.model,
      messages: args.messages ?? original.messages,
      rerunOf: args.requestId,
      action: original.actionName,
      tags: original.tags,
    });
  }

  private async adminMutation<M extends FunctionReference<"mutation", "internal">>(
    ctx: RunMutationCtx,
    mutation: M,
    args: M["_args"],
  ): Promise<M["_returnType"]> {
    const identity = await ctx.auth?.getUserIdentity();
    const actorId = identity?.tokenIdentifier
      ?? (identity?.issuer && identity.subject ? `${identity.issuer}|${identity.subject}` : "host");
    return ctx.runMutation(mutation, { ...args, actorId });
  }

  // ---------- namespaced admin API ----------

  /** The request audit log, replay, and re-run lineage. */
  get requests() {
    const c = this.component;
    return {
      /** Filter by userId, or by any {dimension, value} (incl. custom tags). */
      list: (
        ctx: RunQueryCtx,
        args: {
          userId?: string;
          dimension?: string;
          value?: string;
          limit?: number;
        } = {},
      ) => ctx.runQuery(c.lib.listRequests, args),
      /** One request, including its stored prompt and response. */
      get: (ctx: RunQueryCtx, args: { requestId: string; }) =>
        ctx.runQuery(c.lib.getRequest, { requestId: args.requestId as any }),
      billing: (ctx: RunQueryCtx, args: { requestId: string; }) =>
        ctx.runQuery(c.lib.getBillingEvent, { requestId: args.requestId as any }),
      /** Ancestors up to the original, plus direct re-runs. */
      lineage: (ctx: RunQueryCtx, args: { requestId: string; }) =>
        ctx.runQuery(c.lib.lineage, { requestId: args.requestId as any }),
      /** Replay a stored request, optionally with edited messages/model. */
      rerun: (
        ctx: RunMutationCtx,
        args: { requestId: string; messages?: Message[]; model?: string; },
      ) => this.rerunImpl(ctx, args),
    };
  }

  /**
   * Budgets and controls for an arbitrary attribution dimension — the
   * generalization of `users`/`actions`. Give it any dimension name (team,
   * project, tenant, customer, env, feature, …) and set caps per value:
   *
   *   ai.tag("customer").setLimits(ctx, { value: "acme", monthlySpendLimitNanos });
   *   ai.tag("customer").history(ctx, { value: "acme", period: "day" });
   *
   * Attribute a call to it by passing `tags` to `chat`/`languageModel`.
   */
  tag(dimension: string) {
    return this.dimensionApi(dimension, (a: { value: string; }) => a.value);
  }

  // Shared implementation behind tag()/users/actions. `key` maps the namespace's
  // id field (value/userId/name) to the bucket value.
  private dimensionApi<A extends Record<string, any>>(
    dimension: string,
    key: (a: A) => string,
  ) {
    const c = this.component;
    return {
      /** All buckets in this dimension. */
      list: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.listBuckets, { dimension }),
      paginate: (ctx: RunQueryCtx, args: { cursor?: string | null; limit?: number; } = {}) =>
        ctx.runQuery(c.lib.paginateBuckets, {
          dimension,
          paginationOpts: { cursor: args.cursor ?? null, numItems: args.limit ?? 50 },
        }),
      /** One bucket's limits + spend (null if it has none yet). */
      get: (ctx: RunQueryCtx, args: A) =>
        ctx.runQuery(c.lib.getBucket, { dimension, value: key(args) }),
      setLimits: (ctx: RunMutationCtx, args: A & BucketLimits) => {
        const { value, userId, name, ...limits } = args as any;
        return this.adminMutation(ctx, c.lib.setBucketLimits, {
          dimension,
          value: key(args),
          ...limits,
        });
      },
      /** One-time "approve another $X" bump (daily/monthly reset with the window). */
      bump: (ctx: RunMutationCtx, args: A & BumpArgs) =>
        this.adminMutation(ctx, c.lib.bumpBucket, {
          dimension,
          value: key(args),
          dailyNanos: args.dailyNanos,
          monthlyNanos: args.monthlyNanos,
          lifetimeNanos: args.lifetimeNanos,
        }),
      /** Manually credit (negative) or debit (positive) this bucket. */
      adjust: (
        ctx: RunMutationCtx,
        args: A & { deltaNanos: number; tokens?: number; reason?: string; },
      ) =>
        this.adminMutation(ctx, c.lib.adjustBucket, {
          dimension,
          value: key(args),
          deltaNanos: args.deltaNanos,
          tokens: args.tokens,
          reason: args.reason,
        }),
      /** Durable spend history for this bucket (per day or per month). */
      history: (
        ctx: RunQueryCtx,
        args: A & { period?: "day" | "month"; limit?: number; },
      ) =>
        ctx.runQuery(c.lib.usageHistory, {
          dimension,
          value: key(args),
          period: args.period ?? "day",
          limit: args.limit,
        }),
      /** Manual-adjustment audit log for this bucket. */
      adjustments: (ctx: RunQueryCtx, args: A & { limit?: number; }) =>
        ctx.runQuery(c.lib.listAdjustments, {
          dimension,
          value: key(args),
          limit: args.limit,
        }),
      /**
       * Delete this budget bucket: its limits, usage history, credits, and admin
       * audit trail are removed (the audit trail of the deletion itself is kept).
       *
       * Erasure semantics differ by dimension:
       * - **`user`**: also erases that user's request rows — prompts/responses are
       *   purged and the rows tombstoned. This is the per-person data-erasure
       *   primitive (e.g. for a GDPR/DSR request).
       * - **any other dimension** (`action`, or a custom tag like `customer`):
       *   this is **budget closure only**. Request content is NOT erased — those
       *   requests are owned by a `userId` and shared across dimensions, so their
       *   prompts/responses remain until normal content retention expires. To
       *   erase a person's content, delete the `user` bucket. (Deleting an
       *   `action`/tag does not mass-purge every user's shared content by design.)
       */
      delete: (ctx: RunMutationCtx, args: A) =>
        this.adminMutation(ctx, c.lib.deleteBucket, { dimension, value: key(args) }),
    };
  }

  /** Per-user budgets and controls — sugar over the "user" dimension. */
  get users() {
    return this.dimensionApi<{ userId: string; }>("user", (a) => a.userId);
  }

  /** Per-action (per-feature) budgets — sugar over the "action" dimension. */
  get actions() {
    return this.dimensionApi<{ name: string; }>("action", (a) => a.name);
  }

  /** The deployment-wide budget, alerts, and retention config. */
  get global() {
    const c = this.component;
    return {
      /** Limits + spend today/total. */
      status: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.getGlobalStatus, {}),
      health: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.getHealth, {}),
      audit: (ctx: RunQueryCtx, args: { cursor?: string | null; limit?: number; } = {}) =>
        ctx.runQuery(c.lib.paginateAdminEvents, {
          paginationOpts: { cursor: args.cursor ?? null, numItems: args.limit ?? 50 },
        }),
      /**
       * A killswitch spend cap across all users/actions. `"approximate"`
       * (default) and `"hard"` both BLOCK — identically — once the deployment
       * total crosses the cap; the total is read out-of-band, so blocking is
       * best-effort with bounded lag, not to-the-dollar (use a per-bucket cap for
       * that). `"soft"` warns only. Pass `null` to clear a field.
       */
      setLimits: (
        ctx: RunMutationCtx,
        args: {
          dailySpendLimitNanos?: number | null;
          lifetimeSpendLimitNanos?: number | null;
          enforcement?: "approximate" | "hard" | "soft" | null;
        },
      ) => this.adminMutation(ctx, c.lib.setGlobalLimits, args),
      bump: (
        ctx: RunMutationCtx,
        args: { dailyNanos?: number; lifetimeNanos?: number; },
      ) => this.adminMutation(ctx, c.lib.bumpGlobal, args),
      /** Default approaching-limit alert threshold (fraction of a cap, e.g. 0.8). */
      setAlertDefaults: (ctx: RunMutationCtx, args: { warnAtPct?: number | null; }) =>
        this.adminMutation(ctx, c.lib.setAlertDefaults, args),
      /** Request-row retention window in ms (default 1h; 0 disables). */
      setRetention: (ctx: RunMutationCtx, args: { retentionMs: number; }) =>
        this.adminMutation(ctx, c.lib.setRetention, args),
      /**
       * Deployment-wide data/pricing policy (only the fields you pass change):
       * - `allowUnpricedModels: false` rejects models with no configured price
       *   under hard enforcement (default true — charge the conservative fallback).
       * - `storeContent: false` stops persisting prompt/response content on
       *   request rows (default true).
       */
      setPolicy: (
        ctx: RunMutationCtx,
        args: {
          allowUnpricedModels?: boolean;
          storeContent?: boolean;
          storeRawErrors?: boolean;
          requireExplicitReservations?: boolean;
        },
      ) => this.adminMutation(ctx, c.lib.setDeploymentPolicy, args),
    };
  }

  /** Model allow/deny policy. */
  get models() {
    const c = this.component;
    return {
      getPolicy: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.getModelPolicy, {}),
      /** mode: "open" | "allowlist" (only these) | "denylist" (all but these). */
      setPolicy: (
        ctx: RunMutationCtx,
        args: { mode: "open" | "allowlist" | "denylist"; models: string[]; },
      ) => this.adminMutation(ctx, c.lib.setModelPolicy, args),
    };
  }

  /** Per-model prices (nanodollars per million tokens) + server-tool fees. */
  get prices() {
    const c = this.component;
    return {
      list: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.listPrices, {}),
      set: (
        ctx: RunMutationCtx,
        args: {
          model: string;
          inputNanosPerMTok: number;
          outputNanosPerMTok: number;
          /** Cache-read rate; defaults to a discount off input if omitted. */
          cachedNanosPerMTok?: number;
          cacheWriteNanosPerMTok?: number;
          cacheWrite1hNanosPerMTok?: number;
        },
      ) => this.adminMutation(ctx, c.lib.setPrice, args),
      /** Per-call fees for provider server tools (web search, etc.). */
      listServerTools: (ctx: RunQueryCtx) => ctx.runQuery(c.lib.listServerToolPrices, {}),
      /** Set a server-tool's per-call price, e.g. { tool: "web_search", nanosPerCall }. */
      setServerTool: (
        ctx: RunMutationCtx,
        args: { tool: string; nanosPerCall: number; },
      ) => this.adminMutation(ctx, c.lib.setServerToolPrice, args),
    };
  }

  /**
   * Mount the built-in admin dashboard on your app's HTTP router with one call.
   * Serves a self-contained HTML dashboard (buckets, requests, usage history,
   * settings) plus a small JSON API, all backed by the component — no extra
   * queries to write.
   *
   *   // convex/http.ts
   *   import { httpRouter } from "convex/server";
   *   const http = httpRouter();
   *   ai.registerRoutes(http, { authorize: async (ctx) =>
   *     (await ctx.auth.getUserIdentity())?.role === "admin" });
   *   export default http;
   *
   * It then lives at `https://<deployment>.convex.site/aibudget`.
   *
   * SECURITY: the endpoint is public on the internet. You MUST gate it — either
   * pass `authorize` (recommended: check the caller is a deployment admin) or
   * set the `AI_BUDGET_DASHBOARD_TOKEN` env var (a bearer token / `?token=`).
   * With neither, every route returns 401.
   */
  registerRoutes(
    http: HttpRouter,
    opts: {
      /** Mount path (default "/aibudget"). */
      path?: string;
      /** Return true to allow the request. Runs on the HTML page and every API call. */
      authorize?: (ctx: any, request: Request) => boolean | Promise<boolean>;
    } = {},
  ) {
    const prefix = (opts.path ?? "/aibudget").replace(/\/+$/, "");
    const c = this.component.lib;
    const authorize = opts.authorize;

    const guard = async (
      ctx: any,
      request: Request,
    ): Promise<{ ok: boolean; token: string; }> => {
      if (authorize) return { ok: await authorize(ctx, request), token: "" };
      const token = (globalThis as any).process?.env?.AI_BUDGET_DASHBOARD_TOKEN;
      if (!token) return { ok: false, token: "" };
      const url = new URL(request.url);
      const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      // `?token=` is accepted ONLY for the initial page navigation (a browser GET
      // can't set headers); the page strips it from the URL on load and calls the
      // JSON API with the bearer header. Restrict it to that GET page route so a
      // token can't be smuggled in a query string on API/mutation calls (where it
      // would also land in access logs). Compared in constant time.
      const sub = url.pathname.slice(prefix.length) || "/";
      const isPageNav = request.method === "GET" && !sub.startsWith("/api");
      const provided = bearer || (isPageNav ? url.searchParams.get("token") ?? "" : "");
      return { ok: timingSafeEqual(provided, token), token };
    };
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data ?? null), {
        status,
        // Never let a shared cache/proxy retain budget data or the token-bearing
        // page — these responses are per-viewer and sensitive.
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    // JSON.stringify does NOT escape `<`, so a value containing `</script>`
    // would close the inline <script> and break out. Escape `<` (and the JS line
    // separators) before embedding in HTML.
    const jsonForScript = (x: unknown) =>
      JSON.stringify(x).replace(
        /[<\u2028\u2029]/g,
        (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"),
      );

    const handle = async (ctx: any, request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const sub = url.pathname.slice(prefix.length) || "/";
      const { ok, token } = await guard(ctx, request);
      if (!ok) {
        return new Response(
          "Unauthorized. Pass `authorize` to registerRoutes or set AI_BUDGET_DASHBOARD_TOKEN.",
          { status: 401 },
        );
      }

      if (request.method === "POST" && authorize) {
        const origin = request.headers.get("origin");
        if (origin !== url.origin) return json({ error: "same-origin request required" }, 403);
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
          return json({ error: "application/json required" }, 415);
        }
      }
      if (sub.startsWith("/api/")) {
        const route = request.method + " " + sub.slice(4); // strip "/api"
        const p: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          p[k] = v;
        });
        const body = request.method === "POST"
          ? await request.json().catch(() => ({}))
          : {};
        if (request.method === "POST") {
          if (!body || typeof body !== "object" || Array.isArray(body)) {
            return json({ error: "JSON object required" }, 400);
          }
          const identity = await ctx.auth?.getUserIdentity();
          body.actorId = identity?.tokenIdentifier ?? "dashboard";
        }
        switch (route) {
          case "GET /buckets":
            return json(await ctx.runQuery(c.listBuckets, { dimension: p.dimension || undefined }));
          case "GET /requests":
            return json(
              await ctx.runQuery(c.listRequests, {
                userId: p.userId || undefined,
                dimension: p.dimension || undefined,
                value: p.value || undefined,
                limit: 100,
              }),
            );
          case "GET /usage":
            return json(
              await ctx.runQuery(c.usageHistory, {
                dimension: p.dimension,
                value: p.value,
                period: p.period === "month" ? "month" : "day",
              }),
            );
          case "GET /global":
            return json(await ctx.runQuery(c.getGlobalStatus, {}));
          case "GET /prices":
            return json(await ctx.runQuery(c.listPrices, {}));
          case "POST /setLimits":
            return json(await ctx.runMutation(c.setBucketLimits, body));
          case "POST /bump":
            return json(await ctx.runMutation(c.bumpBucket, body));
          case "POST /adjust":
            return json(await ctx.runMutation(c.adjustBucket, body));
          case "POST /delete":
            return json(await ctx.runMutation(c.deleteBucket, body));
          case "POST /global/setLimits":
            return json(await ctx.runMutation(c.setGlobalLimits, body));
          case "POST /global/setAlertDefaults":
            return json(await ctx.runMutation(c.setAlertDefaults, body));
          case "POST /global/setRetention":
            return json(await ctx.runMutation(c.setRetention, body));
          case "POST /setPrice":
            return json(await ctx.runMutation(c.setPrice, body));
          default:
            return json({ error: "not found" }, 404);
        }
      }

      // Inject as script-safe JSON literals (function replacers so `$` in the
      // value isn't treated as a replacement pattern; `jsonForScript` escapes
      // `<` so a token containing `</script>` can't break out of the inline JS).
      const html = DASHBOARD_HTML.replace(
        /__API_BASE__/g,
        () => jsonForScript(`${prefix}/api`),
      ).replace(/__TOKEN__/g, () => jsonForScript(token));
      // The page embeds the bearer token — never let a shared cache retain it.
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
          "content-security-policy": "frame-ancestors 'none'; base-uri 'none'",
        },
      });
    };

    const handler = httpActionGeneric(handle);
    http.route({ path: prefix, method: "GET", handler });
    http.route({ pathPrefix: `${prefix}/`, method: "GET", handler });
    http.route({ pathPrefix: `${prefix}/`, method: "POST", handler });
  }

  /**
   * Mount a POST webhook that settles a `begin`-reserved request from a
   * provider's completion callback (async image/video jobs). You supply
   * `resolve` — verify the payload's signature and map the provider's job id to
   * your stored `requestId` + final usage/cost; the helper calls `settle`.
   * Return `null` to ignore an unrecognized/duplicate callback (HTTP 202).
   *
   *   ai.registerWebhook(http, {
   *     path: "/aibudget/video-done",
   *     resolve: async (ctx, request, body) => {
   *       if (!verifySignature(request, body)) return null;
   *       const job = await lookupJob(ctx, body.id);   // your table: { requestId }
   *       return { requestId: job.requestId, serverToolUses: { video_seconds: body.seconds } };
   *     },
   *   });
   */
  registerWebhook(
    http: HttpRouter,
    opts: {
      path?: string;
      resolve: (
        ctx: any,
        request: Request,
        body: any,
      ) => Promise<
        | ({ requestId: string; } & {
          responseText?: string;
          error?: string;
          usage?: any;
          promptTokens?: number;
          completionTokens?: number;
          cachedTokens?: number;
          cachedWriteTokens?: number;
          cachedWrite1hTokens?: number;
          serverToolUses?: Record<string, number>;
          costNanos?: number;
        })
        | null
      >;
    },
  ) {
    const path = opts.path ?? "/aibudget/webhook";
    const self = this;
    http.route({
      path,
      method: "POST",
      handler: httpActionGeneric(async (ctx: any, request: Request) => {
        const body = await request.clone().json().catch(() => ({}));
        const settle = await opts.resolve(ctx, request, body);
        if (!settle) return new Response("ignored", { status: 202 });
        await self.settle(ctx, settle);
        return new Response("ok");
      }),
    });
  }
}

/** @deprecated Renamed to `AIBudget`. */
export const WorryFreeAI = AIBudget;
