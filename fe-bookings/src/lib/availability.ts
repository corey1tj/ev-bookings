import { EvseAvailability } from "@/lib/ampeco";

interface AvailabilityResult {
  available: boolean;
  message?: string;
}

/**
 * Check whether a requested time slot is available.
 *
 * When `evseId` is provided, checks that specific EVSE.
 * Otherwise, checks if any EVSE at the location has the slot.
 */
export function validateSlotAvailable(
  availabilityData: EvseAvailability[],
  startAt: string,
  endAt: string,
  evseId?: number,
): AvailabilityResult {
  const requestedStart = new Date(startAt).getTime();
  const requestedEnd = new Date(endAt).getTime();

  function evseHasSlot(evse: EvseAvailability): boolean {
    if (!evse.availableSlots || !Array.isArray(evse.availableSlots)) {
      return false;
    }
    return evse.availableSlots.some((slot) => {
      const slotStart = new Date(slot.startAt).getTime();
      const slotEnd = new Date(slot.endAt).getTime();
      return slotStart <= requestedStart && slotEnd >= requestedEnd;
    });
  }

  if (evseId) {
    const evseData = availabilityData.find((e) => e.evseId === evseId);
    if (!evseData || !evseHasSlot(evseData)) {
      return {
        available: false,
        message:
          "The selected charger is not available for the requested time. Please choose a different time or charger.",
      };
    }
  } else {
    const anyAvailable = availabilityData.some(evseHasSlot);
    if (!anyAvailable) {
      return {
        available: false,
        message:
          "No chargers are available for the requested time. Please choose a different time.",
      };
    }
  }

  return { available: true };
}
