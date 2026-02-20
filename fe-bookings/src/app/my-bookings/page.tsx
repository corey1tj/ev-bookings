"use client";

import { useState, useEffect, useCallback } from "react";
import DriverEditBookingModal from "@/components/DriverEditBookingModal";
import BookingCard from "@/components/BookingCard";
import { EnrichedBooking } from "@/lib/types";

const STORAGE_KEY = "my-bookings-email";

export default function MyBookingsPage() {
  const [email, setEmail] = useState("");
  const [lookupDone, setLookupDone] = useState(false);
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [editingBooking, setEditingBooking] = useState<EnrichedBooking | null>(null);

  // Load saved email from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setEmail(saved);
  }, []);

  const fetchBookings = useCallback(
    async (lookupEmail: string) => {
      setLoading(true);
      setError(null);
      setNoAccount(false);

      try {
        const res = await fetch(
          `/api/my-bookings?email=${encodeURIComponent(lookupEmail)}`
        );

        if (res.status === 404) {
          const data = await res.json();
          if (data.error === "no_account") {
            setNoAccount(true);
            return;
          }
        }

        if (!res.ok) throw new Error("Failed to load bookings");

        const data: EnrichedBooking[] = await res.json();
        setBookings(data);
        setLookupDone(true);
        localStorage.setItem(STORAGE_KEY, lookupEmail);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    fetchBookings(email);
  }

  function handleChangeEmail() {
    setLookupDone(false);
    setBookings([]);
    setError(null);
    setNoAccount(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  async function handleCancel(bookingId: number) {
    if (!confirm("Cancel this booking? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/my-bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || data.error || "Cancel failed");
        return;
      }

      fetchBookings(email);
    } catch {
      alert("Cancel failed");
    }
  }

  // Email lookup form
  if (!lookupDone) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">My Bookings</h1>
        <p className="mb-6 text-sm text-gray-600">
          Enter the email address you used to make your booking.
        </p>

        <form onSubmit={handleLookup} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Email address
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="you@example.com"
              required
            />
          </label>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {noAccount && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-amber-900">
                No account found for this email
              </p>
              <p className="mt-1 text-sm text-amber-800">
                You need an account in the Future Energy driver app before you
                can make or view bookings. Download the app and create an
                account, then come back here.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Looking up…" : "Look up bookings"}
          </button>
        </form>
      </div>
    );
  }

  // Bookings list
  const activeBookings = bookings.filter(
    (b) => b.status === "accepted" || b.status === "reserved"
  );
  const pastBookings = bookings.filter(
    (b) => b.status !== "accepted" && b.status !== "reserved"
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">{email}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchBookings(email)}
            disabled={loading}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            onClick={handleChangeEmail}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            Use a different email
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-gray-500">No bookings found for this email.</p>
          <a
            href="/sites"
            className="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            Browse locations to book a charger
          </a>
        </div>
      ) : (
        <>
          {/* Active bookings */}
          {activeBookings.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {activeBookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onEdit={() => setEditingBooking(b)}
                    onCancel={() => handleCancel(b.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past / cancelled bookings */}
          {pastBookings.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Past</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {pastBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {editingBooking && (
        <DriverEditBookingModal
          booking={{
            id: editingBooking.id,
            startAt: editingBooking.startAt,
            endAt: editingBooking.endAt,
            locationTimezone: editingBooking.location?.timezone,
          }}
          email={email}
          onClose={() => setEditingBooking(null)}
          onSuccess={() => {
            setEditingBooking(null);
            fetchBookings(email);
          }}
        />
      )}
    </div>
  );
}
