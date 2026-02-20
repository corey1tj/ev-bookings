import { NextResponse } from "next/server";
import { AmpecoError } from "@/lib/ampeco";

/**
 * Try to extract a human-readable message from an Ampeco error body.
 * Handles common shapes: { message }, { error: { message } }, { errors: [{ message }] }.
 */
function extractAmpecoMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  if (typeof b.message === "string" && b.message) return b.message;

  if (b.error && typeof b.error === "object") {
    const err = b.error as Record<string, unknown>;
    if (typeof err.message === "string" && err.message) return err.message;
  }

  if (Array.isArray(b.errors) && b.errors.length > 0) {
    const first = b.errors[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).message === "string") {
      return (first as Record<string, unknown>).message as string;
    }
  }

  return null;
}

/**
 * Standard error handler for API routes.
 * Returns a JSON error response with the appropriate status code.
 * Extracts a human-readable message from the Ampeco error body when available.
 */
export function handleApiError(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof AmpecoError) {
    const message = extractAmpecoMessage(err.body) || fallbackMessage;
    return NextResponse.json(
      { error: fallbackMessage, message, details: err.body },
      { status: err.status },
    );
  }
  return NextResponse.json(
    { error: "Internal server error", message: "An unexpected error occurred. Please try again." },
    { status: 500 },
  );
}
