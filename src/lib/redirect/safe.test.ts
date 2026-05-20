import { describe, it, expect } from "vitest";
import { isSafeInternalPath, pickSafeInternalPath } from "./safe";

describe("isSafeInternalPath", () => {
  it("allows normal internal paths", () => {
    expect(isSafeInternalPath("/")).toBe(true);
    expect(isSafeInternalPath("/flows/morning")).toBe(true);
    expect(isSafeInternalPath("/history?type=morning")).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false);
    expect(isSafeInternalPath("//evil.com/path")).toBe(false);
  });

  it("rejects backslash-prefixed paths", () => {
    expect(isSafeInternalPath("/\\evil.com")).toBe(false);
  });

  it("rejects absolute URLs", () => {
    expect(isSafeInternalPath("https://evil.com")).toBe(false);
    expect(isSafeInternalPath("http://evil.com")).toBe(false);
  });

  it("rejects paths without leading slash", () => {
    expect(isSafeInternalPath("history")).toBe(false);
    expect(isSafeInternalPath("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isSafeInternalPath(undefined)).toBe(false);
    expect(isSafeInternalPath(null)).toBe(false);
    expect(isSafeInternalPath(123)).toBe(false);
  });
});

describe("pickSafeInternalPath", () => {
  it("returns the value when safe", () => {
    expect(pickSafeInternalPath("/history")).toBe("/history");
  });

  it("returns the fallback when unsafe", () => {
    expect(pickSafeInternalPath("//evil.com")).toBe("/");
    expect(pickSafeInternalPath("https://evil.com", "/login")).toBe("/login");
    expect(pickSafeInternalPath(undefined)).toBe("/");
  });
});
