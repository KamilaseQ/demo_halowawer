import { NextResponse } from "next/server";
import { getHouse } from "@/lib/estate";

/**
 * Lead intake (demo). Validates and acknowledges; wire the CRM / e-mail
 * here (e.g. HubSpot, Pipedrive, Resend) when the sales team picks one.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const { name, phone, house, consent, style, source } = (body ?? {}) as Record<string, unknown>;
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";

  if (typeof name !== "string" || !name.trim() || name.length > 60) {
    return NextResponse.json({ ok: false, error: "name" }, { status: 422 });
  }
  if (digits.length < 9 || digits.length > 15) {
    return NextResponse.json({ ok: false, error: "phone" }, { status: 422 });
  }
  if (consent !== true) {
    return NextResponse.json({ ok: false, error: "consent" }, { status: 422 });
  }
  if (house && !getHouse(String(house))) {
    return NextResponse.json({ ok: false, error: "house" }, { status: 422 });
  }

  console.info("[lead]", { name: name.trim(), phone: digits, house: house || null, style: style ?? null, source: source ?? null, at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
