import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getJstDayBoundsUtc,
  getJstWeekBoundsUtc,
  getJstMonthBoundsUtc,
} from "./period";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getJstDayBoundsUtc", () => {
  it("returns the UTC range that covers a JST day", () => {
    // 2026-05-20 12:00 JST = 2026-05-20 03:00 UTC
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const { start, end } = getJstDayBoundsUtc();
    // JST 5/20 00:00 = UTC 5/19 15:00
    expect(start).toBe("2026-05-19T15:00:00.000Z");
    // JST 5/21 00:00 = UTC 5/20 15:00 (排他的)
    expect(end).toBe("2026-05-20T15:00:00.000Z");
  });

  it("treats JST midnight crossing correctly", () => {
    // 2026-05-19 23:30 UTC = 2026-05-20 08:30 JST
    vi.setSystemTime(new Date("2026-05-19T23:30:00Z"));
    const { start, end } = getJstDayBoundsUtc();
    // この時点では JST 5/20 なので、bounds は 5/19 15:00 UTC〜5/20 15:00 UTC
    expect(start).toBe("2026-05-19T15:00:00.000Z");
    expect(end).toBe("2026-05-20T15:00:00.000Z");
  });
});

describe("getJstWeekBoundsUtc (月曜始まり)", () => {
  it("returns Monday 00:00 JST 〜 next Monday 00:00 JST in UTC", () => {
    // 2026-05-20 (水) 12:00 JST。週の始まり (月) は 2026-05-18
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const { start, end } = getJstWeekBoundsUtc();
    // 2026-05-18 00:00 JST = 2026-05-17 15:00 UTC
    expect(start).toBe("2026-05-17T15:00:00.000Z");
    // 2026-05-25 00:00 JST = 2026-05-24 15:00 UTC
    expect(end).toBe("2026-05-24T15:00:00.000Z");
  });

  it("handles Sunday correctly (still the same week, Monday is the start)", () => {
    // 2026-05-24 (日) 12:00 JST。週の始まりは 2026-05-18 (月)
    vi.setSystemTime(new Date("2026-05-24T03:00:00Z"));
    const { start, end } = getJstWeekBoundsUtc();
    expect(start).toBe("2026-05-17T15:00:00.000Z");
    expect(end).toBe("2026-05-24T15:00:00.000Z");
  });

  it("handles Monday correctly", () => {
    // 2026-05-18 (月) 12:00 JST。週の始まりは 2026-05-18 自身
    vi.setSystemTime(new Date("2026-05-18T03:00:00Z"));
    const { start, end } = getJstWeekBoundsUtc();
    expect(start).toBe("2026-05-17T15:00:00.000Z");
    expect(end).toBe("2026-05-24T15:00:00.000Z");
  });
});

describe("getJstMonthBoundsUtc", () => {
  it("returns 1st 00:00 JST 〜 next month 1st 00:00 JST in UTC", () => {
    // 2026-05-20 12:00 JST
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    const { start, end } = getJstMonthBoundsUtc();
    // 2026-05-01 00:00 JST = 2026-04-30 15:00 UTC
    expect(start).toBe("2026-04-30T15:00:00.000Z");
    // 2026-06-01 00:00 JST = 2026-05-31 15:00 UTC
    expect(end).toBe("2026-05-31T15:00:00.000Z");
  });

  it("handles year boundary correctly", () => {
    // 2026-12-15 12:00 JST
    vi.setSystemTime(new Date("2026-12-15T03:00:00Z"));
    const { start, end } = getJstMonthBoundsUtc();
    // 2026-12-01 00:00 JST = 2026-11-30 15:00 UTC
    expect(start).toBe("2026-11-30T15:00:00.000Z");
    // 2027-01-01 00:00 JST = 2026-12-31 15:00 UTC
    expect(end).toBe("2026-12-31T15:00:00.000Z");
  });
});
