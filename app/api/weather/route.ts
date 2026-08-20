import { NextResponse } from "next/server";

/**
 * Keyless weather proxy (open-meteo — free, no API key). The overview panel
 * calls this and reads `current.temperature_2m` + `current.weather_code`.
 * Coordinates default to Tel Aviv; change LAT/LON for your city.
 */
const LAT = 32.0853;
const LON = 34.7818;

export const revalidate = 600; // cache 10 minutes

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code`;
    const r = await fetch(url, { next: { revalidate: 600 } });
    const d = await r.json();
    return NextResponse.json({ current: d.current ?? null });
  } catch {
    return NextResponse.json({ current: null });
  }
}
