import {
  getLocation,
  getBookableEVSEs,
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

  // Fetch booking-enabled EVSEs for this location
  let ports: {
    evseId: number;
    networkId: string;
    connectorType: string;
    maxPowerKw: number;
    chargePointName: string;
    label?: string;
    physicalReference?: string;
    currentType?: string;
  }[] = [];

  try {
    const bookableEVSEs = await getBookableEVSEs(siteId);
    ports = bookableEVSEs.map((evse) => ({
      evseId: evse.id,
      networkId: evse.networkId,
      connectorType: evse.connectorType,
      maxPowerKw: evse.powerOptions?.maxPower
        ? evse.powerOptions.maxPower / 1000
        : evse.maxPowerKw,
      chargePointName: evse.chargePointName,
      label: evse.label,
      physicalReference: evse.physicalReference,
      currentType: evse.currentType,
    }));
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
      <BookingForm siteId={siteId} siteName={localized(location.name)} ports={ports} siteTimezone={location.timezone} />
    </div>
  );
}
