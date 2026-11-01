import { gunzipSync } from "node:zlib";
import { TemplateError } from "./contract.js";

export interface PackageFile {
  bytes: Buffer;
  executable: boolean;
}
export function validatePackagePath(name: string): void {
  if (
    !name ||
    name.length > 2048 ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes(":") ||
    [...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    name.split("/").some((p) => !p || p === "." || p === "..")
  )
    throw new TemplateError("TEMPLATE_PACKAGE_PATH");
}
function string(bytes: Buffer): string {
  const end = bytes.indexOf(0),
    value = end < 0 ? bytes : bytes.subarray(0, end);
  if (end >= 0 && bytes.subarray(end).some((b) => b !== 0))
    throw new TemplateError("TEMPLATE_TAR_HEADER");
  const text = value.toString("utf8");
  if (!Buffer.from(text).equals(value))
    throw new TemplateError("TEMPLATE_TAR_ENCODING");
  return text;
}
function octal(bytes: Buffer): number {
  const text = bytes.toString("ascii").replace(/\0/g, "").trim();
  if (!/^[0-7]+$/.test(text)) throw new TemplateError("TEMPLATE_TAR_NUMBER");
  const value = parseInt(text, 8);
  if (!Number.isSafeInteger(value))
    throw new TemplateError("TEMPLATE_TAR_NUMBER");
  return value;
}
function pax(bytes: Buffer): Record<string, string> {
  const fields: Record<string, string> = Object.create(null);
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset),
      lengthText = bytes.subarray(offset, space).toString("ascii");
    if (space < offset || !/^[1-9]\d*$/.test(lengthText))
      throw new TemplateError("TEMPLATE_TAR_PAX");
    const length = Number(lengthText),
      end = offset + length;
    if (
      !Number.isSafeInteger(length) ||
      end > bytes.length ||
      end <= space + 1 ||
      bytes[end - 1] !== 10
    )
      throw new TemplateError("TEMPLATE_TAR_PAX");
    const raw = bytes.subarray(space + 1, end - 1),
      text = raw.toString("utf8"),
      equals = text.indexOf("=");
    if (!Buffer.from(text).equals(raw) || equals < 1)
      throw new TemplateError("TEMPLATE_TAR_PAX");
    const key = text.slice(0, equals);
    if (Object.hasOwn(fields, key)) throw new TemplateError("TEMPLATE_TAR_PAX");
    fields[key] = text.slice(equals + 1);
    offset = end;
  }
  return fields;
}
/** Decode, never extract: every archive path/kind/checksum is settled before writes. */
export function decodePackageArchive(
  compressed: Uint8Array,
): Map<string, PackageFile> {
  if (!compressed.length || compressed.length > 64 * 1024 * 1024)
    throw new TemplateError("TEMPLATE_TAR_BUDGET");
  let bytes: Buffer;
  try {
    bytes = gunzipSync(compressed, { maxOutputLength: 128 * 1024 * 1024 });
  } catch {
    throw new TemplateError("TEMPLATE_TAR_INVALID");
  }
  if (bytes.length % 512) throw new TemplateError("TEMPLATE_TAR_TRUNCATED");
  const files = new Map<string, PackageFile>(),
    seen = new Set<string>();
  let offset = 0,
    total = 0,
    records = 0,
    extended: Record<string, string> | undefined,
    longName: string | undefined;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((b) => b === 0)) {
      if (
        offset + 512 > bytes.length ||
        bytes.subarray(offset).some((b) => b !== 0) ||
        extended ||
        longName
      )
        throw new TemplateError("TEMPLATE_TAR_TRUNCATED");
      return files;
    }
    if (++records > 20000) throw new TemplateError("TEMPLATE_TAR_BUDGET");
    let checksum = 0;
    for (let i = 0; i < 512; i++)
      checksum += i >= 148 && i < 156 ? 32 : header[i];
    if (checksum !== octal(header.subarray(148, 156)))
      throw new TemplateError("TEMPLATE_TAR_CHECKSUM");
    const size = octal(header.subarray(124, 136)),
      mode = octal(header.subarray(100, 108));
    if (
      size > 8 * 1024 * 1024 ||
      offset + Math.ceil(size / 512) * 512 > bytes.length
    )
      throw new TemplateError("TEMPLATE_TAR_BUDGET");
    const content = bytes.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    const kind = header[156] || 48;
    if (kind === 120) {
      if (extended || longName) throw new TemplateError("TEMPLATE_TAR_PAX");
      extended = pax(content);
      continue;
    }
    if (kind === 76) {
      if (extended || longName) throw new TemplateError("TEMPLATE_TAR_HEADER");
      longName = string(content);
      continue;
    }
    if (![48, 53].includes(kind) || string(header.subarray(157, 257)))
      throw new TemplateError("TEMPLATE_TAR_KIND");
    const prefix = string(header.subarray(345, 500)),
      leaf = string(header.subarray(0, 100));
    let name =
      extended?.path ?? longName ?? (prefix ? prefix + "/" + leaf : leaf);
    if (
      extended?.linkpath !== undefined ||
      (extended?.size !== undefined && extended.size !== String(size))
    )
      throw new TemplateError("TEMPLATE_TAR_KIND");
    extended = undefined;
    longName = undefined;
    if (kind === 53 && name.endsWith("/")) name = name.slice(0, -1);
    validatePackagePath(name);
    if (name !== "package" && !name.startsWith("package/"))
      throw new TemplateError("TEMPLATE_TAR_ROOT");
    if (seen.has(name.toLowerCase()))
      throw new TemplateError("TEMPLATE_DUPLICATE_PATH");
    seen.add(name.toLowerCase());
    if (kind === 53) {
      if (size) throw new TemplateError("TEMPLATE_TAR_KIND");
      continue;
    }
    if (name === "package") throw new TemplateError("TEMPLATE_TAR_ROOT");
    total += size;
    if (total > 64 * 1024 * 1024)
      throw new TemplateError("TEMPLATE_TAR_BUDGET");
    files.set(name.slice(8), {
      bytes: Buffer.from(content),
      executable: Boolean(mode & 0o111),
    });
  }
  throw new TemplateError("TEMPLATE_TAR_TRUNCATED");
}
