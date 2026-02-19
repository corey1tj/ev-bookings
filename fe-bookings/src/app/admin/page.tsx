"use client";

import { useState, useEffect, useCallback } from "react";
import AdminBookingModal from "@/components/AdminBookingModal";

interface BookingLocation {
  name: string;
  city: string;
  state: string;
  timezone: string;
}

interface BookingEvse {
  chargePointName: string;
  label?: string;
  physicalReference?: string;
  connectorType: string;
  maxPowerKw: number;
  currentType: string;
}

interface Booking {
  id: number;
  locationId: number;
  evseId: number | null;
  userId: number;
  startAt: string;
  endAt: string;
  status: string;
  location: BookingLocation | null;
  evse: BookingEvse | null;
  [key: string]: unknown;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.status === 401) {
        setAuthenticated(false);
        setError("Invalid password");
        return;
      }
      if (!res.ok) throw new Error("Failed to load bookings");
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [password]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthenticated(true);
  }

  useEffect(() => {
    if (authenticated) fetchBookings();
  }, [authenticated, fetchBookings]);

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-6 text-2xl font-bold">Admin Console</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2"
              required
            />
          </label>
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  async function handleCancel(bookingId: number) {
    if (!confirm("Cancel this booking?")) return;

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${password}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Cancel failed");
        return;
      }
      fetchBookings();
    } catch {
      alert("Cancel failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Console</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create Booking
          </button>
          <button
            onClick={fetchBookings}
            disabled={loading}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {bookings.length === 0 && !loading ? (
        <p className="text-gray-500">No bookings found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Booking ID</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Charger</th>
                <th className="px-4 py-3">EVSE ID</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                  <td className="px-4 py-3">
                    {b.location ? (
                      <div>
                        <div className="font-medium">{b.location.name}</div>
                        <div className="text-xs text-gray-500">
                          {b.location.city}, {b.location.state}
                        </div>
                      </div>
                    ) : (
                      b.locationId
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.evse ? (
                      <div>
                        <div className="font-medium">{b.evse.chargePointName}</div>
                        {b.evse.label && (
                          <div className="text-xs text-gray-600">{b.evse.label}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs italic text-gray-400">Auto-Assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {b.evse?.physicalReference ?? (b.evseId ? b.evseId : <span className="font-sans italic text-gray-400">Auto-Assigned</span>)}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(b.startAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(b.endAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.status === "accepted" || b.status === "reserved"
                          ? "bg-green-100 text-green-800"
                          : b.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(b.status === "accepted" || b.status === "reserved") && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingBooking(b)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleCancel(b.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <AdminBookingModal
          mode="create"
          authToken={password}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchBookings();
          }}
        />
      )}

      {editingBooking && (
        <AdminBookingModal
          mode="edit"
          authToken={password}
          booking={{
            id: editingBooking.id,
            locationId: editingBooking.locationId,
            evseId: editingBooking.evseId,
            startAt: editingBooking.startAt,
            endAt: editingBooking.endAt,
            locationTimezone: editingBooking.location?.timezone,
          }}
          onClose={() => setEditingBooking(null)}
          onSuccess={() => {
            setEditingBooking(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}
