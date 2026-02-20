import { NextResponse } from "next/server";
import { getLocations } from "@/lib/ampeco";
import { handleApiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await getLocations();
    return NextResponse.json(res.data);
  } catch (err) {
    return handleApiError(err, "Failed to load sites");
  }
}
