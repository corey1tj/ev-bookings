import { NextResponse } from "next/server";
import { getLocations, AmpecoError } from "@/lib/ampeco";

export async function GET() {
  try {
    const res = await getLocations();
    return NextResponse.json(res.data);
  } catch (err) {
    if (err instanceof AmpecoError) {
      return NextResponse.json(
        { error: "Failed to load sites" },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
