import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  documents: [] as import("@/lib/types").Document[],
  onSave: undefined as
    | undefined
    | ((content: string, debounce: boolean) => void),
  mutate: vi.fn(),
  error: vi.fn(),
  setArtifact: vi.fn(),
  setMetadata: vi.fn(),
  settlement: Promise.resolve(),
  artifact: {
    title: "Owned",
    documentId: "owned",
    kind: "text",
    content: "",
    isVisible: true,
    status: "idle",
    boundingBox: { left: 0, top: 0, width: 800, height: 600 },
  },
}));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("swr", () => ({
  default: () => ({ data: state.documents, isLoading: false, mutate: vi.fn() }),
  useSWRConfig: () => ({ mutate: state.mutate }),
}));
vi.mock("usehooks-ts", () => ({
  useDebounceCallback: (callback: unknown) => callback,
  useWindowSize: () => ({ width: 500, height: 800 }),
}));
vi.mock("@/hooks/use-artifact", () => ({
  useArtifact: () => ({
    artifact: state.artifact,
    setArtifact: state.setArtifact,
    metadata: {},
    setMetadata: state.setMetadata,
  }),
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ open: false }),
}));
vi.mock("@/artifacts/text/client", () => ({
  textArtifact: {
    kind: "text",
    content: ({ onSaveContent }: { onSaveContent: typeof state.onSave }) => {
      state.onSave = onSaveContent;
      return null;
    },
  },
}));
vi.mock("@/artifacts/code/client", () => ({ codeArtifact: { kind: "code" } }));
vi.mock("@/artifacts/image/client", () => ({
  imageArtifact: { kind: "image" },
}));
vi.mock("@/artifacts/sheet/client", () => ({
  sheetArtifact: { kind: "sheet" },
}));
vi.mock("@/components/artifact-actions", () => ({
  ArtifactActions: () => null,
}));
vi.mock("@/components/artifact-close-button", () => ({
  ArtifactCloseButton: () => null,
}));
vi.mock("@/components/artifact-messages", () => ({
  ArtifactMessages: () => null,
}));
vi.mock("@/components/multimodal-input", () => ({
  MultimodalInput: () => null,
}));
vi.mock("@/components/toolbar", () => ({ Toolbar: () => null }));
vi.mock("@/components/version-footer", () => ({ VersionFooter: () => null }));

import { Artifact } from "@/components/artifact";

let root: Root;
let container: HTMLDivElement;
const documentRow = (
  content: string,
  version = 1
): import("@/lib/types").Document => ({
  id: "owned",
  title: "Owned",
  content,
  kind: "text",
  userId: "user",
  createdAt: new Date(version),
  updatedAt: new Date(version),
});
beforeEach(() => {
  vi.clearAllMocks();
  state.documents = [documentRow("")];
  state.onSave = undefined;
  state.settlement = Promise.resolve();
  state.mutate.mockImplementation((_key, update) => {
    const promise = update(state.documents).then(
      (docs: typeof state.documents) => {
        state.documents = docs;
        return docs;
      }
    );
    state.settlement = promise.then(
      () => undefined,
      () => undefined
    );
    return promise.catch(() => undefined);
  });
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function render() {
  await act(() =>
    root.render(
      createElement(Artifact, {
        addToolApprovalResponse: vi.fn(),
        chatId: "chat",
        input: "",
        setInput: vi.fn(),
        status: "ready",
        stop: vi.fn(),
        attachments: [],
        setAttachments: vi.fn(),
        messages: [],
        setMessages: vi.fn(),
        votes: [],
        sendMessage: vi.fn(),
        regenerate: vi.fn(),
        isReadonly: false,
        selectedVisibilityType: "private",
        selectedModelId: "chat-model",
      })
    )
  );
}
async function save(content: string, response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  await render();
  if (!state.onSave) {
    throw new Error("Actual artifact save callback missing");
  }
  await act(async () => {
    state.onSave?.(content, false);
    await state.settlement;
  });
  return fetchMock;
}
it("actual save callback persists new text after a valid empty document", async () => {
  const saved = documentRow("new text", 2);
  const fetchMock = await save("new text", Response.json(saved));
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/document?id=owned", {
    method: "POST",
    body: JSON.stringify({ title: "Owned", content: "new text", kind: "text" }),
  });
  expect(state.documents).toHaveLength(2);
  expect(state.documents.at(-1)?.content).toBe("new text");
  expect(state.error).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("Saving changes");
});
it("actual save callback persists a transition to empty content", async () => {
  state.documents = [documentRow("old text")];
  const fetchMock = await save("", Response.json(documentRow("", 2)));
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(state.documents).toHaveLength(2);
  expect(state.documents.at(-1)?.content).toBe("");
});
it("actual rejected save keeps its preimage and dirty state instead of claiming success", async () => {
  const before = state.documents.slice();
  const fetchMock = await save(
    "new text",
    new Response("Unavailable", { status: 503 })
  );
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(state.documents).toEqual(before);
  expect(state.error).toHaveBeenCalledExactlyOnceWith(
    "Document save did not finish. Reload before retrying."
  );
  expect(container.textContent).toContain("Saving changes");
});
it("actual missing-document callback cannot create an unowned version", async () => {
  state.documents = [];
  const fetchMock = await save(
    "new text",
    Response.json(documentRow("new text", 2))
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(state.mutate).not.toHaveBeenCalled();
  expect(state.documents).toEqual([]);
});
