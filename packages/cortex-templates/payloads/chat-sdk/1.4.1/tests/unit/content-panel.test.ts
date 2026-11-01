import type { RuntimeContentJobV1 } from "@cortexmemory/sdk/runtime";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ContentPanel } from "@/components/runtime-chat";

it("applies one selected suggestion with its original version, then requests fresh suggestions for further edits", async () => {
  const original: RuntimeContentJobV1 = {
    artifactId: "document",
    artifactVersion: 2,
    createdAt: 1,
    intent: "suggestions",
    jobId: "suggestions",
    revision: 1,
    state: "ready",
    suggestions: [
      {
        description: "Clarity",
        originalText: "Old",
        suggestedText: "New",
        suggestionId: "selected",
      },
    ],
    updatedAt: 1,
    version: 1,
  };
  const client = {
    applyContentSuggestion: vi
      .fn()
      .mockResolvedValue({ ...original, artifactVersion: 3, content: "New" }),
    cancelContentJob: vi.fn(),
    getContentJob: vi.fn(),
    reconcileContentJob: vi.fn(),
    submitContentJob: vi.fn(),
  };
  function Harness() {
    const [jobs, setJobs] = useState([original]);
    return createElement(ContentPanel, {
      client,
      jobs,
      onError: vi.fn(),
      setJobs,
    });
  }
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(createElement(Harness)));
    const apply = [...element.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply this suggestion"
    )!;
    expect(apply.disabled).toBe(false);
    await act(async () => apply.click());
    expect(client.applyContentSuggestion).toHaveBeenCalledExactlyOnceWith({
      artifactVersion: 2,
      jobId: "suggestions",
      suggestionId: "selected",
    });
    expect(apply.disabled).toBe(true);
    expect(element.textContent).toContain(
      "Request fresh suggestions for more edits"
    );
    await act(async () => apply.click());
    expect(client.applyContentSuggestion).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    element.remove();
  }
});
