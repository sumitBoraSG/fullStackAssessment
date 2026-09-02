// Shared helpers for reasoning about "now" in the clinic's operating
// timezone (Asia/Kolkata / IST). The backend anchors every past-date/
// past-time decision to IST (see backend/src/util/dateTimeRange.ts) — these
// mirror that exactly so the frontend never disagrees with the server about
// what "today" or "already passed" means for a patient/doctor browsing from
// a different timezone.

const IST_TIMEZONE = "Asia/Kolkata";

/** Today's calendar date in IST, as `YYYY-MM-DD`. */
export function getISTTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST_TIMEZONE }).format(now);
}

/** The current wall-clock time in IST, as 24-hour `HH:mm`. */
export function getISTCurrentTimeString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

/**
 * True if the given IST wall-clock `date` (`YYYY-MM-DD`) and `time`
 * (`HH:mm`) is already at or before "now" in IST — i.e. it has already
 * started/passed.
 */
export function isISTDateTimeInPast(date: string, time: string, now: Date = new Date()): boolean {
  const todayString = getISTTodayString(now);
  const currentTimeString = getISTCurrentTimeString(now);

  return date < todayString || (date === todayString && time <= currentTimeString);
}
