export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

export const DURATION_OPTIONS = [
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hr" },
  { value: "90", label: "1.5 hr" },
  { value: "120", label: "2 hr" },
  { value: "180", label: "3 hr" },
  { value: "240", label: "4 hr" },
  { value: "300", label: "5 hr" },
  { value: "360", label: "6 hr" },
  { value: "480", label: "8 hr" },
  { value: "600", label: "10 hr" },
  { value: "720", label: "12 hr" },
];

export function formatPreview(
  dateStr: string,
  timeStr: string,
  durationMin: number,
  timezone: string,
): string {
  const start = new Date(`${dateStr}T${timeStr}:00`);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });

  // If start and end are on the same day, show compact format
  const startDay = new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric", month: "short" }).format(start);
  const endDay = new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric", month: "short" }).format(end);

  if (startDay === endDay) {
    return `${fmt.format(start)} – ${endFmt.format(end)}`;
  }
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/**
 * Convert a local date + time in a named timezone to a UTC Date object.
 * Uses the Intl API to determine the correct UTC offset (DST-aware).
 */
export function toUTCDate(dateStr: string, timeStr: string, timezone: string): Date {
  const utcGuess = new Date(`${dateStr}T${timeStr}:00Z`);
  const utcRepr = new Date(utcGuess.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzRepr = new Date(utcGuess.toLocaleString("en-US", { timeZone: timezone }));
  const offsetMs = utcRepr.getTime() - tzRepr.getTime();
  return new Date(utcGuess.getTime() + offsetMs);
}
