import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAARL = { latitude: -33.73378, longitude: 18.97523 };

export async function GET() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(PAARL.latitude));
  url.searchParams.set("longitude", String(PAARL.longitude));
  url.searchParams.set("timezone", "Africa/Johannesburg");
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");

  try {
    const response = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return NextResponse.json({ city: "Paarl", error: "Weather service is temporarily unavailable." }, { status: 502 });
    }
    const forecast = await response.json();
    if (!forecast.current) {
      return NextResponse.json({ city: "Paarl", error: "No current weather is available for Paarl." }, { status: 502 });
    }
    return NextResponse.json({ city: "Paarl", current: forecast.current });
  } catch {
    return NextResponse.json({ city: "Paarl", error: "Could not reach the weather service. Try again later." }, { status: 502 });
  }
}
