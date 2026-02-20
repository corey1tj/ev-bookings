"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AdminBookingModal from "@/components/AdminBookingModal";
import { EnrichedBooking } from "@/lib/types";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<EnrichedBooking | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const locationOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const b of bookings) {
      if (b.location && !seen.has(b.locationId)) {
        seen.set(b.locationId, b.location.name);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter === "active") {
        if (b.status !== "accepted" && b.status !== "reserved") return false;
      } else if (statusFilter !== "all") {
        if (b.status !== statusFilter) return false;
      }

      if (locationFilter !== "all") {
        if (b.locationId !== Number(locationFilter)) return false;
      }

      if (dateFrom) {
        if (b.startAt < dateFrom) return false;
      }
      if (dateTo) {
        const dayEnd = dateTo + "T23:59:59.999Z";
        if (b.startAt > dayEnd) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(b.id).includes(q) ||
          b.location?.name?.toLowerCase().includes(q) ||
          b.location?.city?.toLowerCase().includes(q) ||
          b.evse?.chargePointName?.toLowerCase().includes(q) ||
          b.evse?.label?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [bookings, statusFilter, locationFilter, dateFrom, dateTo, searchQuery]);

  const filtersActive = statusFilter !== "all" || locationFilter !== "all" || dateFrom !== "" || dateTo !== "" || searchQuery !== "";

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
        alert(data.message || data.error || "Cancel failed");
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

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by ID, location, charger…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All statuses</option>
          <option value="active">Active (accepted + reserved)</option>
          <option value="accepted">Accepted</option>
          <option value="reserved">Reserved</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No-show</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All locations</option>
          {locationOptions.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {filtersActive && (
          <span className="text-xs text-gray-500">
            Showing {filteredBookings.length} of {bookings.length} bookings
          </span>
        )}
      </div>

      {bookings.length === 0 && !loading ? (
        <p className="text-gray-500">No bookings found.</p>
      ) : filteredBookings.length === 0 ? (
        <p className="text-gray-500">No bookings match the current filters.</p>
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
              {filteredBookings.map((b) => (
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
