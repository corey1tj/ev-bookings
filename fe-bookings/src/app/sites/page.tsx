import Link from "next/link";
import { getLocationsWithBookableEVSEs, localized } from "@/lib/ampeco";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  let locations;
  try {
    locations = await getLocationsWithBookableEVSEs();
  } catch {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
        Unable to load sites. Please try again later.
      </div>
    );
  }

  if (!locations.length) {
    return <p className="text-gray-500">No bookable sites available yet.</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Book EV Charging</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {locations.map((loc) => (
          <Link
            key={loc.id}
            href={`/sites/${loc.id}`}
            className="block rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <h2 className="font-semibold">{localized(loc.name)}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {localized(loc.address)}, {loc.city}, {loc.state}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
