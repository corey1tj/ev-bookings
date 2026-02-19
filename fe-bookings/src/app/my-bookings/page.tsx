"use client";

import { useState } from "react";

interface Booking {
  id: number;
  status: string;
  locationId: number;
  evseId: number;
  startAt: string;
  endAt: string;
}

export default function MyBookingsPage() {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [noAccount, setNoAccount] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNoAccount(false);
    setBookings(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/my-bookings?email=${encodeURIComponent(email)}`
      );
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "no_account") {
          setNoAccount(true);
        } else {
          setError(data.message || data.error || "Failed to load bookings");
        }
        return;
      }

      setBookings(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const statusColor: Record<string, string> = {
    accepted: "bg-green-100 text-green-800",
    reserved: "bg-blue-100 text-blue-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
    "no-show": "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">My Bookings</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Driver app email
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Look Up"}
          </button>
        </div>
      </form>

      {noAccount && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          No account found for this email. Please sign up in the Future Energy
          driver app first.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {bookings !== null && !noAccount && (
        <>
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-500">
              No bookings found for this account.
            </p>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Booking #{b.id}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Location {b.locationId} &middot; EVSE {b.evseId}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusColor[b.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium text-gray-700">Start:</span>{" "}
                      {formatDateTime(b.startAt)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">End:</span>{" "}
                      {formatDateTime(b.endAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
