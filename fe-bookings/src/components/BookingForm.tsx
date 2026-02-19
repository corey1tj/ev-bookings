"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMMON_TIMEZONES, DURATION_OPTIONS, formatPreview, toUTCDate } from "@/lib/date-utils";

interface Port {
  evseId: number;
  networkId: string;
  connectorType: string;
  maxPowerKw: number;
  chargePointName: string;
  label?: string;
  physicalReference?: string;
  currentType?: string;
}

interface BookingFormProps {
  siteId: number;
  siteName: string;
  ports: Port[];
  siteTimezone: string;
}

export default function BookingForm({ siteId, siteName, ports, siteTimezone }: BookingFormProps) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState(siteTimezone);

  // Build timezone options, ensuring the site timezone is always included
  const timezoneOptions = COMMON_TIMEZONES.some((tz) => tz.value === siteTimezone)
    ? COMMON_TIMEZONES
    : [{ value: siteTimezone, label: `Site (${siteTimezone})` }, ...COMMON_TIMEZONES];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPort || !date || !startTime || !email) return;

    setLoading(true);
    setError(null);

    const utcStart = toUTCDate(date, startTime, timezone);
    const utcEnd = new Date(utcStart.getTime() + parseInt(duration) * 60_000);
    const startAt = utcStart.toISOString();
    const endAt = utcEnd.toISOString();

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: siteId,
          evseId: selectedPort,
          startAt,
          endAt,
          email,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "no_account") {
          setNoAccount(true);
          return;
        }
        throw new Error(data.message || data.error || "Booking failed");
      }

      const data = await res.json();
      router.push(`/bookings/${data.bookingRequestId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (noAccount) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{siteName}</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 text-lg font-semibold text-amber-900">
            Driver account required
          </h2>
          <p className="mb-3 text-sm text-amber-800">
            We couldn&apos;t find a driver account for <strong>{email}</strong>.
            To book a charging session, you&apos;ll need to create an account in the
            Future Energy driver app first.
          </p>
          <ol className="mb-4 list-inside list-decimal space-y-1 text-sm text-amber-800">
            <li>Download the Future Energy driver app</li>
            <li>Sign up using <strong>{email}</strong></li>
            <li>Return here to complete your booking</li>
          </ol>
          <button
            type="button"
            onClick={() => { setNoAccount(false); setError(null); }}
            className="text-sm font-medium text-amber-700 underline hover:text-amber-900"
          >
            Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-2xl font-bold">{siteName}</h1>

      {/* Port selection */}
      <fieldset>
        <legend className="mb-2 font-medium">Select a charger</legend>
        {ports.length === 0 ? (
          <p className="text-sm text-gray-500">
            No bookable chargers available at this location.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ports.map((port) => (
              <button
                key={port.evseId}
                type="button"
                onClick={() => setSelectedPort(port.evseId)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  selectedPort === port.evseId
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
                    : "hover:border-gray-400"
                }`}
              >
                <div className="font-medium">{port.chargePointName}</div>
                {port.label && (
                  <div className="text-gray-600">{port.label}</div>
                )}
                <div className="mt-1 text-gray-500">
                  {port.currentType?.toUpperCase() ?? port.connectorType} &middot;{" "}
                  {port.maxPowerKw} kW
                </div>
                {port.physicalReference && (
                  <div className="mt-1 text-xs text-gray-400">
                    ID: {port.physicalReference}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {/* Date & Time */}
      <fieldset className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <legend className="px-2 text-sm font-semibold text-gray-700">
          Date &amp; Time
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Date</span>
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
            <span className="mb-1 block text-sm font-medium text-gray-700">Start time</span>
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
          <span className="mb-2 block text-sm font-medium text-gray-700">Duration</span>
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
          <span className="mb-1 block text-sm font-medium text-gray-700">Time zone</span>
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

        {/* End time preview */}
        {date && startTime && (
          <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="font-medium">Booking window:</span>{" "}
            {formatPreview(date, startTime, parseInt(duration), timezone)}
          </div>
        )}
      </fieldset>

      {/* Driver email (must match driver app account) */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Driver app email *
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          placeholder="Email used in the Future Energy driver app"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Enter the email associated with your Future Energy driver app account
        </span>
      </label>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !selectedPort || !date || !startTime || !email}
        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Booking…" : "Confirm Booking"}
      </button>
    </form>
  );
}
