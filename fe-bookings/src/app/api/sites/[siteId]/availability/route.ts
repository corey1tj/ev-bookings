import { NextRequest, NextResponse } from "next/server";
import { checkBookingAvailability } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";

interface RouteParams {
  params: { siteId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const siteId = parseInt(params.siteId);
  if (isNaN(siteId)) {
    return NextResponse.json({ error: "Invalid site ID" }, { status: 400 });
  }

  const searchParams = req.nextUrl.searchParams;
  const startAfter = searchParams.get("startAfter");
  const endBefore = searchParams.get("endBefore");

  if (!startAfter || !endBefore) {
    return NextResponse.json(
      { error: "startAfter and endBefore are required" },
      { status: 400 }
    );
  }

  try {
    const availability = await checkBookingAvailability(siteId, {
      startAfter,
      endBefore,
    });
    return NextResponse.json(availability);
  } catch (err) {
    return handleApiError(err, "Availability check failed");
  }
}
