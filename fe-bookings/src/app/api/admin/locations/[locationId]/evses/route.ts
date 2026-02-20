import { NextRequest, NextResponse } from "next/server";
import { getBookableEVSEs } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";
import { requireAdmin } from "@/lib/admin-auth";

interface RouteParams {
  params: { locationId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  const locationId = parseInt(params.locationId);
  if (isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid location ID" }, { status: 400 });
  }

  try {
    const bookableEVSEs = await getBookableEVSEs(locationId);
    const data = bookableEVSEs.map((evse) => ({
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
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err, "Failed to load EVSEs");
  }
}
