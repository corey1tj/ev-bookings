"use client";

import { useState, useEffect } from "react";
import {
  COMMON_TIMEZONES,
  DURATION_OPTIONS,
  formatPreview,
  toUTCDate,
} from "@/lib/date-utils";

interface DriverEditBookingModalProps {
  booking: {
    id: number;
    startAt: string;
    endAt: string;
    locationTimezone?: string;
  };
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

function parseBookingDateTime(isoString: string, timezone: string) {
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    date: fmt.format(d),
    time: timeFmt.format(d),
  };
}

function computeDuration(startAt: string, endAt: string): string {
  const diff =
    (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000;
  const match = DURATION_OPTIONS.find((opt) => opt.value === String(diff));
  return match ? match.value : "60";
}

export default function DriverEditBookingModal({
  booking,
  email,
  onClose,
  onSuccess,
}: DriverEditBookingModalProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate from existing booking
  useEffect(() => {
    const tz = booking.locationTimezone || "UTC";
    setTimezone(tz);
    const parsed = parseBookingDateTime(booking.startAt, tz);
    setDate(parsed.date);
    setStartTime(parsed.time);
    setDuration(computeDuration(booking.startAt, booking.endAt));
  }, [booking]);

  // Build timezone options
  const timezoneOptions = (() => {
    const siteTz = booking.locationTimezone;
    if (siteTz && !COMMON_TIMEZONES.some((tz) => tz.value === siteTz)) {
      return [
        { value: siteTz, label: `Site (${siteTz})` },
        ...COMMON_TIMEZONES,
      ];
    }
    return COMMON_TIMEZONES;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const utcStart = toUTCDate(date, startTime, timezone);
    const utcEnd = new Date(
      utcStart.getTime() + parseInt(duration) * 60_000
    );
    const startAt = utcStart.toISOString();
    const endAt = utcEnd.toISOString();

    try {
      const res = await fetch(`/api/my-bookings/${booking.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, startAt, endAt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || "Update failed");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            Edit Booking #{booking.id}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Date & Time */}
          <fieldset className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <legend className="px-2 text-sm font-semibold text-gray-700">
              Date &amp; Time
            </legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Date
                </span>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Start time
                </span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </div>

            {/* Duration chips */}
            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Duration
              </span>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDuration(opt.value)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      duration === opt.value
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone */}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Time zone
              </span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Booking window preview */}
            {date && startTime && (
              <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <span className="font-medium">Booking window:</span>{" "}
                {formatPreview(date, startTime, parseInt(duration), timezone)}
              </div>
            )}
          </fieldset>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !date || !startTime}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
