import type { UIMessage } from "ai";

/** Opt-in display diagnostics. The caller invokes committed after React's DOM commit. */
export function createChatLatencyTrace(
  enabled: boolean,
  ports: {
    now: () => number;
    emit: (event: {
      type: "cortex-browser-latency";
      phase: string;
      elapsedMs: number;
      runId?: string;
      visibility?: string;
    }) => void;
    afterPaint: (callback: () => void) => () => void;
    visibility: () => string;
  }
) {
  let started: number | undefined,
    firstMessage = 0,
    generation = 0,
    firstText = false;
  let responseDone = false,
    transportDone = false,
    answerDone = false,
    runId: string | undefined,
    cancelPaint = () => {
      /* No paint callback is pending yet. */
    };
  const emit = (phase: string, painted = false) => {
    if (!enabled || started === undefined) {
      return;
    }
    try {
      ports.emit({
        elapsedMs: Math.max(0, ports.now() - started),
        phase,
        type: "cortex-browser-latency",
        ...(runId ? { runId } : {}),
        ...(painted ? { visibility: ports.visibility() } : {}),
      });
    } catch {
      /* Diagnostics cannot affect chat. */
    }
  };
  return {
    begin(messageCount: number) {
      if (!enabled) {
        return;
      }
      cancelPaint();
      generation++;
      started = ports.now();
      firstMessage = messageCount;
      firstText = false;
      responseDone = false;
      transportDone = false;
      answerDone = false;
      runId = undefined;
      emit("submit");
    },
    bind(id: string) {
      if (!enabled || started === undefined) {
        return;
      }
      if (/^run:[a-f0-9]{64}$/.test(id)) {
        runId = id;
      }
      emit("admission.delivered");
    },
    committed(messages: readonly UIMessage[]) {
      if (!enabled || started === undefined) {
        return;
      }
      const answers = messages
        .slice(firstMessage)
        .filter(
          (message) =>
            message.role === "assistant" &&
            message.parts.some(
              (part) => part.type === "text" && part.text.trim().length > 0
            )
        );
      if (!firstText && answers.length) {
        firstText = true;
        emit("first-text.dom-commit");
        const current = generation;
        try {
          cancelPaint = ports.afterPaint(() => {
            if (current === generation) {
              emit("first-text.after-paint", true);
            }
          });
        } catch {
          /* Keep normal delivery if diagnostics are unavailable. */
        }
      }
      if (
        !answerDone &&
        transportDone &&
        runId &&
        answers.some((message) => message.id === `cortex:${runId}:assistant`)
      ) {
        answerDone = true;
        emit("answer.complete.dom-commit");
      }
    },
    dispose() {
      generation++;
      cancelPaint();
      started = undefined;
    },
    failed() {
      emit("response.failed");
    },
    responseStatusComplete(id: string) {
      if (!responseDone && started !== undefined && runId && id === runId) {
        responseDone = true;
        emit("response.status.dom-commit");
      }
    },
    transportComplete(messageId: string) {
      if (
        !transportDone &&
        started !== undefined &&
        runId &&
        messageId === `cortex:${runId}:assistant`
      ) {
        transportDone = true;
        emit("transport.complete");
      }
    },
  };
}
