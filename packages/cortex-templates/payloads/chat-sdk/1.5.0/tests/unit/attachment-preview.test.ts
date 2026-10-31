import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewAttachment } from "@/components/preview-attachment";
const attachment = { name: "cortex-qa-upload.png", contentType: "image/png", url: "http://127.0.0.1:46604/api/storage/fixture-owned" };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => { Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(() => root.unmount()); container.remove(); Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT"); });
describe("verified attachment preview", () => {
  it("uses the direct browser URL without Next server image optimization", async () => {
    await act(() => root.render(createElement(PreviewAttachment, { attachment })));
    const image = container.querySelector("img");
    expect(image?.getAttribute("alt")).toBe(attachment.name);
    expect(image?.getAttribute("src")).toBe(attachment.url);
    expect(image?.getAttribute("src")).not.toContain("/_next/image");
  });
  it("keeps upload status and prevents removal while upload is pending", async () => {
    const onRemove = vi.fn();
    await act(() => root.render(createElement(PreviewAttachment, { attachment, isUploading: true, onRemove })));
    expect(container.querySelector('[data-testid="input-attachment-loader"]')).not.toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
  });
  it("preserves removal after a confirmed upload", async () => {
    const onRemove = vi.fn();
    await act(() => root.render(createElement(PreviewAttachment, { attachment, onRemove })));
    await act(() => container.querySelector("button")?.click());
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
