import { getLocation, getChargePointEVSEs } from "@/lib/ampeco";
import BookingForm from "@/components/BookingForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: { siteId: string };
}

export default async function SiteDetailPage({ params }: Props) {
  const siteId = parseInt(params.siteId);
  if (isNaN(siteId)) notFound();

  let location;
  try {
    const res = await getLocation(siteId);
    location = res.data;
  } catch {
    notFound();
  }

  // TODO: Ampeco API may require fetching charge points for this location first,
  // then iterating to get EVSEs. Adjust once exact API shape is confirmed.
  // For now, this assumes we can derive bookable EVSEs from the location.
  const ports: { evseId: number; networkId: string; connectorType: string; maxPowerKw: number }[] = [];

  // Placeholder: replace with actual charge point → EVSE fetch chain
  // const chargePoints = await getChargePointsForLocation(siteId);
  // for (const cp of chargePoints) {
  //   const evses = await getChargePointEVSEs(cp.id);
  //   for (const evse of evses.data) {
  //     if (evse.bookingEnabled) {
  //       ports.push({
  //         evseId: evse.id,
  //         networkId: evse.networkId,
  //         connectorType: evse.connectorType,
  //         maxPowerKw: evse.maxPowerKw,
  //       });
  //     }
  //   }
  // }

  return (
    <div>
      <a href="/sites" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Back to sites
      </a>
      <div className="mb-2 text-sm text-gray-500">
        {location.address}, {location.city}, {location.state}
      </div>
      <BookingForm siteId={siteId} siteName={location.name} ports={ports} />
    </div>
  );
}
