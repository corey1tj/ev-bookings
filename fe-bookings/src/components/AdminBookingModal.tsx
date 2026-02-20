"use client";

import { useState, useEffect } from "react";
import {
  DURATION_OPTIONS,
  formatPreview,
  toUTCDate,
  parseBookingDateTime,
  computeDuration,
  buildTimezoneOptions,
} from "@/lib/date-utils";

interface AdminLocation {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  timezone: string;
}

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

interface AdminBookingModalProps {
  mode: "create" | "edit";
  authToken: string;
  onClose: () => void;
  onSuccess: () => void;
  booking?: {
    id: number;
    locationId: number;
    evseId: number | null;
    startAt: string;
    endAt: string;
    locationTimezone?: string;
  };
}

export default function AdminBookingModal({
  mode,
  authToken,
  onClose,
  onSuccess,
  booking,
}: AdminBookingModalProps) {
  // Location & EVSE (create mode)
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [evses, setEvses] = useState<Port[]>([]);
  const [selectedEvseId, setSelectedEvseId] = useState<number | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingEvses, setLoadingEvses] = useState(false);

  // Date & time
  const defaultTimezone = "UTC";
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [timezone, setTimezone] = useState(defaultTimezone);

  // Email (create mode)
  const [email, setEmail] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate for edit mode
  useEffect(() => {
    if (mode === "edit" && booking) {
      const tz = booking.locationTimezone || "UTC";
      setTimezone(tz);
      const parsed = parseBookingDateTime(booking.startAt, tz);
      setDate(parsed.date);
      setStartTime(parsed.time);
      setDuration(computeDuration(booking.startAt, booking.endAt));
    }
  }, [mode, booking]);

  // Fetch locations on mount (create mode)
  useEffect(() => {
    if (mode !== "create") return;
    setLoadingLocations(true);
    fetch("/api/admin/locations", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load locations");
        return res.json();
      })
      .then((data: AdminLocation[]) => setLocations(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load locations")
      )
      .finally(() => setLoadingLocations(false));
  }, [mode, authToken]);

  // Fetch EVSEs when location changes (create mode)
  useEffect(() => {
    if (mode !== "create" || !selectedLocationId) return;
    setLoadingEvses(true);
    setEvses([]);
    setSelectedEvseId(null);
    fetch(`/api/admin/locations/${selectedLocationId}/evses`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load chargers");
        return res.json();
      })
      .then((data: Port[]) => setEvses(data))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "Failed to load chargers"
        )
      )
      .finally(() => setLoadingEvses(false));

    // Set timezone to location's timezone
    const loc = locations.find((l) => l.id === selectedLocationId);
    if (loc) setTimezone(loc.timezone);
  }, [mode, selectedLocationId, authToken, locations]);

  const timezoneOptions = (() => {
    let siteTz: string | undefined;
    if (mode === "create" && selectedLocationId) {
      const loc = locations.find((l) => l.id === selectedLocationId);
      siteTz = loc?.timezone;
    } else if (mode === "edit" && booking?.locationTimezone) {
      siteTz = booking.locationTimezone;
    }
    return buildTimezoneOptions(siteTz);
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
      if (mode === "create") {
        const res = await fetch("/api/admin/bookings/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            locationId: selectedLocationId,
            evseId: selectedEvseId,
            startAt,
            endAt,
            email,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || "Booking failed");
        }

        onSuccess();
      } else if (mode === "edit" && booking) {
        const res = await fetch(`/api/admin/bookings/${booking.id}/update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ startAt, endAt }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || data.error || "Update failed");
        }

        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isCreateDisabled =
    mode === "create" &&
    (!selectedLocationId || !selectedEvseId || !date || !startTime || !email);
  const isEditDisabled = mode === "edit" && (!date || !startTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {mode === "create"
              ? "Create Booking"
              : `Edit Booking #${booking?.id}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {/* Location selection (create only) */}
          {mode === "create" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Location
              </span>
              {loadingLocations ? (
                <p className="text-sm text-gray-500">Loading locations…</p>
              ) : (
                <select
                  required
                  value={selectedLocationId ?? ""}
                  onChange={(e) =>
                    setSelectedLocationId(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select a location…</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} — {loc.city}, {loc.state}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}

          {/* EVSE selection (create only) */}
          {mode === "create" && selectedLocationId && (
            <fieldset>
              <legend className="mb-2 font-medium text-gray-700">
                Select a charger
              </legend>
              {loadingEvses ? (
                <p className="text-sm text-gray-500">Loading chargers…</p>
              ) : evses.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No bookable chargers at this location.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {evses.map((port) => (
                    <button
                      key={port.evseId}
                      type="button"
                      onClick={() => setSelectedEvseId(port.evseId)}
                      className={`rounded-lg border p-3 text-left text-sm transition ${
                        selectedEvseId === port.evseId
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600"
                          : "hover:border-gray-400"
                      }`}
                    >
                      <div className="font-medium">{port.chargePointName}</div>
                      {port.label && (
                        <div className="text-gray-600">{port.label}</div>
                      )}
                      <div className="mt-1 text-gray-500">
                        {port.currentType?.toUpperCase() ?? port.connectorType}{" "}
                        &middot; {port.maxPowerKw} kW
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
          )}

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

          {/* Driver email (create only) */}
          {mode === "create" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Driver app email *
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Email used in the Future Energy driver app"
              />
            </label>
          )}

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
              disabled={loading || isCreateDisabled || isEditDisabled}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? mode === "create"
                  ? "Creating…"
                  : "Updating…"
                : mode === "create"
                  ? "Create Booking"
                  : "Update Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
