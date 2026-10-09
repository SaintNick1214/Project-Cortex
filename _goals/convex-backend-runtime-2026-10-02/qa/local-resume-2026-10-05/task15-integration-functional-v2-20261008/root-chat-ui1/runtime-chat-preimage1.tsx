"use client";
import { useChat } from "@ai-sdk/react";
import type {
  RuntimeContentJobV1,
  RuntimeObservation,
  RuntimeRun,
  RuntimeRunHandle,
} from "@cortexmemory/sdk/runtime";
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "@cortexmemory/vercel-ai-provider/remote";
import { useCallback, useEffect, useRef, useState } from "react";

export function RuntimeChatSDK({
  conversationId,
}: {
  conversationId?: string;
}) {
  const [token, setToken] = useState("");
  const tokenRef = useRef("");
  tokenRef.current = token;
  const [agentId, setAgentId] = useState(
    process.env.NEXT_PUBLIC_CORTEX_AGENT_ID ?? ""
  );
  const [agentVersion, setAgentVersion] = useState(
    Number(process.env.NEXT_PUBLIC_CORTEX_AGENT_VERSION ?? 1)
  );
  const [connection, setConnection] = useState<{
    client: CortexRuntimeClient;
    transport: CortexRemoteTransport;
  }>();
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState("");
  const [observation, setObservation] = useState<RuntimeObservation>();
  const [run, setRun] = useState<RuntimeRun>();
  const [handle, setHandle] = useState<RuntimeRunHandle>();
  const [jobs, setJobs] = useState<RuntimeContentJobV1[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [readiness, setReadiness] = useState("");
  const [recall, setRecall] = useState("");
  const fail = useCallback(
    (cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "Operation failed"),
    []
  );
  const clear = useCallback(() => {
    setObservation(undefined);
    setRun(undefined);
    setHandle(undefined);
    setJobs([]);
    setHistory([]);
    setRecall("");
    setReadiness("");
    setIdentity("");
  }, []);
  async function disconnect() {
    connection?.transport.disconnect();
    await connection?.client.close();
    setConnection(undefined);
    clear();
  }
  async function connect() {
    await disconnect();
    setError("");
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      setError("Configure NEXT_PUBLIC_CONVEX_URL with your owned backend.");
      return;
    }
    const client = new CortexRuntimeClient({
      deploymentUrl: convexUrl,
      fetchToken: async () => tokenRef.current || null,
      scope: {
        ...(process.env.NEXT_PUBLIC_CORTEX_TENANT_ID
          ? { tenantId: process.env.NEXT_PUBLIC_CORTEX_TENANT_ID }
          : {}),
        ...(process.env.NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID
          ? { memorySpaceId: process.env.NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID }
          : {}),
      },
      ...(process.env.NEXT_PUBLIC_CORTEX_HTTP_URL
        ? { assetHttpUrl: process.env.NEXT_PUBLIC_CORTEX_HTTP_URL }
        : {}),
      onAuthChange: (authenticated) => {
        if (!authenticated) {
          clear();
          setConnection(undefined);
        }
      },
    });
    try {
      const session = await client.session();
      await client.getDefinition(agentId, agentVersion);
      setIdentity(
        `${session.tenantId} / ${session.memorySpaceId} / ${session.principalId}`
      );
      const transport = new CortexRemoteTransport({
        agentId,
        agentVersion,
        client,
        conversationId,
        onObservation: setObservation,
        onRun: setHandle,
      });
      setConnection({ client, transport });
    } catch (cause) {
      await client.close();
      fail(cause);
    }
  }
  useEffect(
    () => () => {
      connection?.transport.disconnect();
      connection?.client.close().catch(fail);
    },
    [connection, fail]
  );
  useEffect(() => {
    if (!connection || !handle) {
      return;
    }
    return connection.client.watchRun(handle, setRun, fail);
  }, [connection, handle, fail]);
  useEffect(() => {
    if (!connection) {
      return;
    }
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const current = await connection.client.listContentJobs(
          handle
            ? { conversationId: handle.conversationId }
            : conversationId
              ? { conversationId }
              : {}
        );
        if (active) {
          setJobs(current);
          if (
            current.some((job) => ["pending", "running"].includes(job.state))
          ) {
            timer = setTimeout(read, 1000);
          }
        }
      } catch (cause) {
        if (active) {
          setJobs([]);
          fail(cause);
        }
      }
    };
    read().catch(fail);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connection, handle, conversationId, fail]);
  useEffect(() => {
    if (
      !connection ||
      !jobs.some((job) => ["pending", "running"].includes(job.state))
    ) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      Promise.all(jobs.map((job) => connection.client.getContentJob(job.jobId)))
        .then((values) => {
          if (active) {
            setJobs(values);
          }
        })
        .catch((cause) => {
          if (active) {
            setJobs([]);
            fail(cause);
          }
        });
    }, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connection, jobs, fail]);
  async function refresh() {
    if (!connection) {
      return;
    }
    try {
      await connection.client.refreshAuth();
      const session = await connection.client.session();
      setIdentity(
        `${session.tenantId} / ${session.memorySpaceId} / ${session.principalId}`
      );
    } catch (cause) {
      await disconnect();
      fail(cause);
    }
  }
  const busy = async (operation: () => Promise<void>) => {
    setError("");
    try {
      await operation();
    } catch (cause) {
      fail(cause);
    }
  };
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Cortex ChatSDK</h1>
        <p>
          Backend Agent chat, governed document generation, retained versions
          and memory status.
        </p>
      </header>
      <section
        aria-label="Host authentication"
        className="space-y-3 rounded-lg border p-4"
      >
        <label className="block">
          Host-issued JWT{" "}
          <input
            aria-label="Host-issued JWT"
            autoComplete="off"
            className="mx-2 w-80 rounded border p-2"
            onChange={(event) => setToken(event.target.value)}
            type="password"
            value={token}
          />
        </label>
        <label>
          Agent ID{" "}
          <input
            aria-label="Agent ID"
            className="mx-2 rounded border p-2"
            onChange={(event) => setAgentId(event.target.value)}
            value={agentId}
          />
        </label>
        <label>
          Version{" "}
          <input
            aria-label="Agent version"
            className="mx-2 w-20 rounded border p-2"
            min={1}
            onChange={(event) => setAgentVersion(Number(event.target.value))}
            type="number"
            value={agentVersion}
          />
        </label>
        <button
          className="rounded border px-3 py-2"
          onClick={() => connect().catch(fail)}
          type="button"
        >
          Connect
        </button>{" "}
        <button
          className="rounded border px-3 py-2"
          disabled={!connection}
          onClick={() => refresh().catch(fail)}
          type="button"
        >
          Refresh token
        </button>{" "}
        <button
          className="rounded border px-3 py-2"
          onClick={() => {
            setToken("");
            disconnect().catch(fail);
          }}
          type="button"
        >
          Sign out
        </button>
        <p>{identity || "Disconnected. Tokens stay only in memory."}</p>
      </section>
      {Boolean(error) && (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      )}
      {connection ? (
        <>
          <ChatPanel connection={connection} onError={fail} />
          <section aria-label="Run status">
            <h2 className="text-xl">Run status</h2>
            <p>
              {run
                ? `${run.responseStatus} · Memory ${run.memoryStatus} · Graph ${run.graphStatus}`
                : "No run"}
            </p>
            <p className="break-all">{handle?.runId}</p>
            {observation?.approvals.map((approval) => (
              <button
                className="m-1 rounded border p-2"
                key={approval.operationId}
                onClick={() =>
                  busy(() => connection.transport.approveTool(approval))
                }
                type="button"
              >
                Approve {approval.toolName}
              </button>
            ))}
            {run?.responseStatus === "waiting_approval" &&
              !observation?.approvals.length && (
                <button
                  className="rounded border p-2"
                  onClick={() =>
                    busy(() => connection.transport.approveInput())
                  }
                  type="button"
                >
                  Approve input
                </button>
              )}
          </section>
          <ContentPanel
            client={connection.client}
            conversationId={handle?.conversationId ?? conversationId}
            jobs={jobs}
            onError={fail}
            setJobs={setJobs}
          />
          <section
            aria-label="History and memory"
            className="space-y-2 rounded border p-4"
          >
            <h2 className="text-xl">History and memory</h2>
            <button
              className="rounded border p-2"
              onClick={() =>
                busy(async () => {
                  const values = await connection.client.listConversations();
                  setHistory(values.map((value) => value.conversationId));
                })
              }
              type="button"
            >
              Load conversations
            </button>
            <button
              className="rounded border p-2"
              onClick={() =>
                busy(async () => {
                  const value = await connection.client.memoryReadiness();
                  setReadiness(JSON.stringify(value));
                })
              }
              type="button"
            >
              Memory readiness
            </button>
            <button
              className="rounded border p-2"
              onClick={() =>
                busy(async () => {
                  const value = await connection.client.getDefaultProfile();
                  setReadiness(
                    `${value.profile.modelId} / ${value.profile.dimensions}`
                  );
                })
              }
              type="button"
            >
              Current profile
            </button>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const text = new FormData(event.currentTarget).get("query");
                if (typeof text === "string") {
                  busy(async () =>
                    setRecall(
                      JSON.stringify(
                        await connection.client.recall({
                          limit: 5,
                          requestId: crypto.randomUUID(),
                          text,
                        })
                      )
                    )
                  );
                }
              }}
            >
              <label>
                Recall query{" "}
                <input
                  className="rounded border p-2"
                  maxLength={4096}
                  name="query"
                  required
                />
              </label>{" "}
              <button className="rounded border p-2" type="submit">
                Recall
              </button>
            </form>
            <p className="break-all">{readiness}</p>
            <pre className="whitespace-pre-wrap">{recall}</pre>
            {history.map((id) => (
              <p key={id}>
                <a href={`/chat/${encodeURIComponent(id)}`}>{id}</a>
              </p>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
function ChatPanel({
  connection,
  onError,
}: {
  connection: { client: CortexRuntimeClient; transport: CortexRemoteTransport };
  onError: (error: unknown) => void;
}) {
  const { messages, sendMessage, status, resumeStream, setMessages } = useChat({
    onError,
    transport: connection.transport,
  });
  const [text, setText] = useState("");
  const [runId, setRunId] = useState("");
  return (
    <section aria-label="Remote chat" className="space-y-3 rounded border p-4">
      <h2 className="text-xl">Conversation</h2>
      <div aria-live="polite">
        {messages.map((message) => (
          <article key={message.id}>
            <strong>{message.role}</strong>
            <p className="whitespace-pre-wrap">
              {message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")}
            </p>
          </article>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) {
            sendMessage({ text }).catch(onError);
            setText("");
          }
        }}
      >
        <label className="block">
          Message{" "}
          <textarea
            aria-label="Message"
            className="block min-h-24 w-full rounded border p-2"
            maxLength={16_000}
            onChange={(event) => setText(event.target.value)}
            required
            value={text}
          />
        </label>
        <button
          className="rounded border p-2"
          disabled={status !== "ready"}
          type="submit"
        >
          Send
        </button>
      </form>
      <button
        className="rounded border p-2"
        onClick={() => connection.transport.disconnect()}
        type="button"
      >
        Disconnect observation
      </button>{" "}
      <button
        className="rounded border p-2"
        onClick={() => resumeStream().catch(onError)}
        type="button"
      >
        Reconnect
      </button>{" "}
      <button
        className="rounded border p-2"
        onClick={() => connection.transport.stop().catch(onError)}
        type="button"
      >
        Stop run
      </button>
      <label>
        Existing Run ID{" "}
        <input
          className="rounded border p-2"
          onChange={(event) => setRunId(event.target.value)}
          value={runId}
        />
      </label>{" "}
      <button
        className="rounded border p-2"
        onClick={() => {
          connection.client
            .attach(runId)
            .then((handle) => {
              setMessages([]);
              connection.transport.attach(handle);
              return resumeStream();
            })
            .catch(onError);
        }}
        type="button"
      >
        Attach
      </button>
    </section>
  );
}
export function ContentPanel({
  client,
  conversationId,
  jobs,
  setJobs,
  onError,
}: {
  client: Pick<
    CortexRuntimeClient,
    | "submitContentJob"
    | "getContentJob"
    | "reconcileContentJob"
    | "cancelContentJob"
    | "applyContentSuggestion"
  >;
  conversationId?: string;
  jobs: RuntimeContentJobV1[];
  setJobs: (jobs: RuntimeContentJobV1[]) => void;
  onError: (error: unknown) => void;
}) {
  const [intent, setIntent] = useState<
      "text" | "code" | "sheet" | "suggestions" | "title"
    >("text"),
    [prompt, setPrompt] = useState("");
  const [artifactId, setArtifactId] = useState(""),
    [version, setVersion] = useState(1);
  const update = (job: RuntimeContentJobV1) =>
    setJobs([job, ...jobs.filter((value) => value.jobId !== job.jobId)]);
  return (
    <section
      aria-label="Backend content jobs"
      className="space-y-3 rounded border p-4"
    >
      <h2 className="text-xl">Documents and suggestions</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          client
            .submitContentJob({
              intent,
              prompt,
              requestId: crypto.randomUUID(),
              version: 1,
              ...(conversationId ? { conversationId } : {}),
              ...(artifactId ? { artifact: { artifactId, version } } : {}),
            })
            .then(update)
            .catch(onError);
        }}
      >
        <label>
          Intent{" "}
          <select
            aria-label="Content intent"
            onChange={(event) => setIntent(event.target.value as typeof intent)}
            value={intent}
          >
            {["text", "code", "sheet", "suggestions", "title"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Instructions{" "}
          <textarea
            aria-label="Content instructions"
            className="block w-full rounded border p-2"
            maxLength={4096}
            onChange={(event) => setPrompt(event.target.value)}
            required
            value={prompt}
          />
        </label>
        <label>
          Existing Artifact ID (updates or suggestions){" "}
          <input
            aria-label="Artifact ID"
            className="rounded border p-2"
            onChange={(event) => setArtifactId(event.target.value)}
            value={artifactId}
          />
        </label>{" "}
        <label>
          Version{" "}
          <input
            aria-label="Artifact version"
            className="w-20 rounded border p-2"
            min={1}
            onChange={(event) => setVersion(Number(event.target.value))}
            type="number"
            value={version}
          />
        </label>
        <button className="rounded border p-2" type="submit">
          Generate on backend
        </button>
      </form>
      {jobs.map((job) => (
        <article className="space-y-2 border-t pt-3" key={job.jobId}>
          <h3>
            {job.title ?? job.intent} · {job.state}
          </h3>
          <p className="break-all">
            {job.jobId} {job.artifactId}{" "}
            {job.artifactVersion === undefined
              ? null
              : `version ${job.artifactVersion}`}
          </p>
          <pre className="whitespace-pre-wrap">{job.content}</pre>
          <p>{job.failureCode}</p>
          <button
            className="rounded border p-2"
            onClick={() =>
              client.getContentJob(job.jobId).then(update).catch(onError)
            }
            type="button"
          >
            Refresh
          </button>{" "}
          <button
            className="rounded border p-2"
            onClick={() =>
              client.reconcileContentJob(job.jobId).then(update).catch(onError)
            }
            type="button"
          >
            Recover saved result
          </button>{" "}
          <button
            className="rounded border p-2"
            onClick={() =>
              client.cancelContentJob(job.jobId).then(update).catch(onError)
            }
            type="button"
          >
            Cancel
          </button>
          {job.intent === "suggestions" && job.content !== undefined ? (
            <p>Suggestion applied. Request fresh suggestions for more edits.</p>
          ) : null}
          {job.suggestions?.map((suggestion) => (
            <div key={suggestion.suggestionId}>
              <p>
                {suggestion.originalText} → {suggestion.suggestedText}
              </p>
              <p>{suggestion.description}</p>
              <button
                className="rounded border p-2"
                disabled={job.content !== undefined}
                onClick={() =>
                  client
                    .applyContentSuggestion({
                      artifactVersion: job.artifactVersion!,
                      jobId: job.jobId,
                      suggestionId: suggestion.suggestionId,
                    })
                    .then(update)
                    .catch(onError)
                }
                type="button"
              >
                Apply this suggestion
              </button>
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
