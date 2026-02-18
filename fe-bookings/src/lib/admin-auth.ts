import { NextRequest, NextResponse } from "next/server";

/**
 * MVP admin auth: simple password check via Authorization header.
 * Replace with proper auth (OAuth, Supabase Auth, etc.) in Phase 2.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.ADMIN_PASSWORD}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // auth passed
}
