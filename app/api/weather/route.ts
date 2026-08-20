import { NextResponse } from "next/server";

/**
 * Weather for the *visitor's* location.
 *
 * On Vercel, the platform adds geo headers to every request
 * (`x-vercel-ip-latitude` / `-longitude` / `-city`) — no permission prompt, no
 * third-party service. We read those and fetch the weather from open-meteo
 * (free, keyless). Off Vercel / on localhost the headers are absent, so we fall
 * back to Tel Aviv. Returns `{ current, city }`.
 */
export const dynamic = "force-dynamic"; // per-visitor: reads geo headers

const FALLBACK = { lat: "32.0853", lon: "34.7818", city: "Tel Aviv" };

export async function GET(request: Request) {
  const h = request.headers;
  const lat = h.get("x-vercel-ip-latitude") || FALLBACK.lat;
  const lon = h.get("x-vercel-ip-longitude") || FALLBACK.lon;
  const cityHeader = h.get("x-vercel-ip-city");
  const city = cityHeader ? decodeURIComponent(cityHeader) : FALLBACK.city;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    // Cache per-coordinate for 10 min, so repeat visitors from the same city
    // don't each trigger a fresh upstream call.
    const r = await fetch(url, { next: { revalidate: 600 } });
    const d = await r.json();
    return NextResponse.json({ current: d.current ?? null, city });
  } catch {
    return NextResponse.json({ current: null, city });
  }
}
