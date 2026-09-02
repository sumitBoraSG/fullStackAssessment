// Shared helpers for parsing Postgres tstzrange columns and reasoning about
// "now" in the clinic's operating timezone (Asia/Kolkata / IST). Used by
// both availability and appointment handling so date/time-in-the-past rules
// stay consistent across the two.

const IST_TIMEZONE = "Asia/Kolkata";

export interface DateRangeBounds {
    start: Date;
    end: Date;
}

export interface ParsedDateTimeRange {
    date: string;
    startTime: string;
    endTime: string;
}

/**
 * Parses a raw Postgres tstzrange string, e.g.
 * ["2026-08-28 04:30:00+00","2026-08-28 08:30:00+00"), into its actual
 * start/end Date bounds.
 */
export function parseRangeBounds(rangeStr: string): DateRangeBounds | null {
    if (!rangeStr) {
        return null;
    }

    const matches = rangeStr.match(
        /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}(?::\d{2})?/g,
    );

    if (!matches || matches.length < 2) {
        return null;
    }

    const toISO = (value: string): string => {
        const normalized = value.replace(" ", "T");
        return /[+-]\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
    };

    return {
        start: new Date(toISO(matches[0])),
        end: new Date(toISO(matches[1])),
    };
}

/** Formats a Date as a `YYYY-MM-DD` calendar date in IST. */
export function formatDateIST(d: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TIMEZONE }).format(d);
}

/** Formats a Date as a 24-hour `HH:mm` wall-clock time in IST. */
export function formatTimeIST(d: Date): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: IST_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(d);

    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

    return `${hour}:${minute}`;
}

/**
 * Parses a raw Postgres tstzrange string directly into IST wall-clock
 * {date, startTime, endTime} strings, as used throughout the API responses.
 */
export function parseRangeToIST(rangeStr: string): ParsedDateTimeRange {
    const bounds = parseRangeBounds(rangeStr);

    if (!bounds) {
        return { date: "", startTime: "", endTime: "" };
    }

    return {
        date: formatDateIST(bounds.start),
        startTime: formatTimeIST(bounds.start),
        endTime: formatTimeIST(bounds.end),
    };
}

/** Today's calendar date in IST, as `YYYY-MM-DD`. */
export function getISTTodayString(now: Date = new Date()): string {
    return formatDateIST(now);
}

/** The current wall-clock time in IST, as 24-hour `HH:mm`. */
export function getISTCurrentTimeString(now: Date = new Date()): string {
    return formatTimeIST(now);
}

/**
 * True if the given IST wall-clock `date` (`YYYY-MM-DD`) and `time`
 * (`HH:mm`) is already at or before "now" in IST — i.e. it has already
 * started/passed. Shared by every "reject a past date/time" and "this must
 * have already started" check across availability and appointment handling.
 */
export function isISTDateTimeInPast(
    date: string,
    time: string,
    now: Date = new Date(),
): boolean {
    const todayString = getISTTodayString(now);
    const currentTimeString = getISTCurrentTimeString(now);

    return date < todayString || (date === todayString && time <= currentTimeString);
}

/**
 * Rounds a Date up to the next whole-minute boundary (no-op if already on
 * one). Safe to use for IST wall-clock purposes since the IST offset
 * (+05:30) is a whole number of minutes, so UTC minute boundaries and IST
 * minute boundaries coincide.
 */
export function ceilToNextMinute(d: Date): Date {
    const ms = d.getTime();
    const remainder = ms % 60000;

    if (remainder === 0) {
        return new Date(ms);
    }

    return new Date(ms + (60000 - remainder));
}

/** Builds a Postgres-parseable IST timestamp literal, e.g. `2026-08-28T09:00:00+05:30`. */
export function buildISTDateTimeString(date: string, time: string): string {
    return `${date}T${time}:00+05:30`;
}

/** Builds a Postgres `tstzrange` literal, e.g. `[2026-08-28T09:00:00+05:30,2026-08-28T09:30:00+05:30)`. */
export function buildISTRangeLiteral(
    date: string,
    startTime: string,
    endTime: string,
): string {
    return `[${buildISTDateTimeString(date, startTime)},${buildISTDateTimeString(date, endTime)})`;
}

/**
 * The IST calendar-day boundaries for `date`, as Postgres-parseable IST
 * timestamp literals: `startOfDay` is `date`'s midnight, `endOfDayExclusive`
 * is the following day's midnight (exclusive upper bound).
 */
export function getISTDayBounds(date: string): {
    startOfDay: string;
    endOfDayExclusive: string;
} {
    const [year, month, day] = date.split("-").map(Number);
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const nextDateString = nextDay.toISOString().slice(0, 10);

    return {
        startOfDay: buildISTDateTimeString(date, "00:00"),
        endOfDayExclusive: buildISTDateTimeString(nextDateString, "00:00"),
    };
}
