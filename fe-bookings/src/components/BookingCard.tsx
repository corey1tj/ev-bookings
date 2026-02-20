import { EnrichedBooking } from "@/lib/types";

interface BookingCardProps {
  booking: EnrichedBooking;
  onEdit?: () => void;
  onCancel?: () => void;
}

export default function BookingCard({ booking, onEdit, onCancel }: BookingCardProps) {
  const isActive =
    booking.status === "accepted" || booking.status === "reserved";

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          {booking.location ? (
            <>
              <div className="font-medium">{booking.location.name}</div>
              <div className="text-sm text-gray-500">
                {booking.location.city}, {booking.location.state}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Location #{booking.locationId}
            </div>
          )}
        </div>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            isActive
              ? "bg-green-100 text-green-800"
              : booking.status === "cancelled"
                ? "bg-red-100 text-red-800"
                : booking.status === "completed"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
          }`}
        >
          {booking.status}
        </span>
      </div>

      {booking.evse && (
        <div className="mb-2 text-sm text-gray-600">
          {booking.evse.chargePointName}
          {booking.evse.label && ` — ${booking.evse.label}`}
          <span className="ml-1 text-gray-400">
            ({booking.evse.currentType?.toUpperCase()} &middot;{" "}
            {booking.evse.maxPowerKw} kW)
          </span>
        </div>
      )}

      <div className="mb-1 text-sm">
        <span className="font-medium">Start:</span>{" "}
        {new Date(booking.startAt).toLocaleString()}
      </div>
      <div className="text-sm">
        <span className="font-medium">End:</span>{" "}
        {new Date(booking.endAt).toLocaleString()}
      </div>

      {isActive && onEdit && onCancel && (
        <div className="mt-3 flex gap-3 border-t pt-3">
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={onCancel}
            className="text-sm text-red-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
