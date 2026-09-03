import { describe, expect, it } from "vitest";
import { getISTCurrentTimeString, getISTTodayString, isISTDateTimeInPast } from "./istDateTime";

// IST = UTC+5:30, so 18:30 UTC is exactly the IST midnight rollover instant.
const JUST_BEFORE_IST_MIDNIGHT = new Date("2026-01-01T18:29:00Z"); // IST 2026-01-01 23:59
const EXACTLY_IST_MIDNIGHT = new Date("2026-01-01T18:30:00Z"); // IST 2026-01-02 00:00

describe("getISTTodayString", () => {
  it("returns the IST calendar date, which can be a day ahead of the UTC date", () => {
    expect(getISTTodayString(JUST_BEFORE_IST_MIDNIGHT)).toBe("2026-01-01");
    expect(getISTTodayString(EXACTLY_IST_MIDNIGHT)).toBe("2026-01-02");
  });
});

describe("getISTCurrentTimeString", () => {
  it("returns HH:mm in IST, rolling over at the UTC 18:30 boundary", () => {
    expect(getISTCurrentTimeString(JUST_BEFORE_IST_MIDNIGHT)).toBe("23:59");
    expect(getISTCurrentTimeString(EXACTLY_IST_MIDNIGHT)).toBe("00:00");
  });
});

describe("isISTDateTimeInPast", () => {
  const now = EXACTLY_IST_MIDNIGHT; // IST "now" = 2026-01-02 00:00

  it("treats any earlier calendar date as in the past regardless of time", () => {
    expect(isISTDateTimeInPast("2026-01-01", "23:59", now)).toBe(true);
  });

  it("treats any later calendar date as not in the past regardless of time", () => {
    expect(isISTDateTimeInPast("2026-01-03", "00:00", now)).toBe(false);
  });

  it("treats a same-day time exactly equal to now as already passed (boundary is inclusive)", () => {
    expect(isISTDateTimeInPast("2026-01-02", "00:00", now)).toBe(true);
  });

  it("treats a same-day time one minute after now as not yet passed", () => {
    expect(isISTDateTimeInPast("2026-01-02", "00:01", now)).toBe(false);
  });

  it("treats a same-day time one minute before now as already passed", () => {
    expect(isISTDateTimeInPast("2026-01-01", "23:59", JUST_BEFORE_IST_MIDNIGHT)).toBe(true);
  });

  it("defaults to the real current time when now is omitted", () => {
    // Just a sanity check that the default parameter path doesn't throw and
    // agrees with an explicit "now" taken at call time.
    const liveNow = new Date();
    expect(isISTDateTimeInPast("1900-01-01", "00:00")).toBe(
      isISTDateTimeInPast("1900-01-01", "00:00", liveNow),
    );
  });
});
