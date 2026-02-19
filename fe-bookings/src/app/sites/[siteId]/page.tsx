import {
  getLocation,
  getChargePoints,
  getChargePointEVSEs,
  localized,
} from "@/lib/ampeco";
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

  // Fetch charge points for this location, then EVSEs per charge point
  const ports: {
    evseId: number;
    networkId: string;
    connectorType: string;
    maxPowerKw: number;
  }[] = [];

  try {
    const chargePointsRes = await getChargePoints(siteId);
    const evseResults = await Promise.all(
      chargePointsRes.data.map((cp) => getChargePointEVSEs(cp.id))
    );
    for (const evseRes of evseResults) {
      for (const evse of evseRes.data) {
        if (evse.bookingEnabled) {
          ports.push({
            evseId: evse.id,
            networkId: evse.networkId,
            connectorType: evse.connectorType,
            maxPowerKw: evse.maxPowerKw,
          });
        }
      }
    }
  } catch {
    // If charge point fetch fails, proceed with empty ports —
    // BookingForm will show a "no chargers" message.
  }

  return (
    <div>
      <a
        href="/sites"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        &larr; Back to sites
      </a>
      <div className="mb-2 text-sm text-gray-500">
        {localized(location.address)}, {location.city}, {location.state}
      </div>
      <BookingForm siteId={siteId} siteName={localized(location.name)} ports={ports} />
    </div>
  );
}
