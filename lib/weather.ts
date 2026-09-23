// Weather snapshot for the newsletter weather block.
// Uses Open-Meteo (https://open-meteo.com) — free, no API key required.
// The snapshot is fetched once at send time and baked into the email HTML,
// so readers always see the forecast as it was when the issue went out.

export interface WeatherHour {
  time: string; // e.g. "10 AM"
  emoji: string;
  tempF: number;
  precipChance: number; // 0-100
}

export interface WeatherSnapshot {
  locationName: string;
  currentTempF: number;
  feelsLikeF: number;
  condition: string;
  emoji: string;
  humidity: number;
  windMph: number;
  hours: WeatherHour[]; // ~6 hours starting at the current hour
}

export function weatherCodeInfo(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear sky", emoji: "☀️" };
  if (code === 1) return { label: "Mainly clear", emoji: "🌤️" };
  if (code === 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Foggy", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { label: "Rain", emoji: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: "Snow", emoji: "❄️" };
  if (code >= 95) return { label: "Thunderstorms", emoji: "⛈️" };
  return { label: "Cloudy", emoji: "☁️" };
}

function formatHourLabel(isoLocal: string): string {
  // isoLocal looks like "2026-09-23T10:00" in the requested timezone
  const hour = Number(isoLocal.slice(11, 13));
  if (Number.isNaN(hour)) return "";
  const suffix = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

export async function fetchWeatherSnapshot(
  latitude: number,
  longitude: number,
  locationName: string
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    timezone: "America/Chicago",
    forecast_days: "2",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    // Fail fast — a weather hiccup must never block the newsletter send
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
  const data = await res.json();

  const current = data.current;
  const info = weatherCodeInfo(Number(current.weather_code));

  // Find the current hour in the hourly series, then take ~6 hours from there
  const times: string[] = data.hourly.time;
  const currentHourPrefix = String(current.time).slice(0, 13); // "YYYY-MM-DDTHH"
  let startIdx = times.findIndex((t) => t.slice(0, 13) === currentHourPrefix);
  if (startIdx < 0) startIdx = 0;

  const hours: WeatherHour[] = [];
  for (let i = startIdx; i < Math.min(startIdx + 6, times.length); i++) {
    const hInfo = weatherCodeInfo(Number(data.hourly.weather_code[i]));
    hours.push({
      time: formatHourLabel(times[i]),
      emoji: hInfo.emoji,
      tempF: Math.round(Number(data.hourly.temperature_2m[i])),
      precipChance: Math.round(Number(data.hourly.precipitation_probability?.[i] ?? 0)),
    });
  }

  return {
    locationName,
    currentTempF: Math.round(Number(current.temperature_2m)),
    feelsLikeF: Math.round(Number(current.apparent_temperature)),
    condition: info.label,
    emoji: info.emoji,
    humidity: Math.round(Number(current.relative_humidity_2m)),
    windMph: Math.round(Number(current.wind_speed_10m)),
    hours,
  };
}

// Static sample used in the template builder / compose previews so Chad can
// see the block's layout before sending.
export function sampleWeatherSnapshot(): WeatherSnapshot {
  return {
    locationName: "Decatur",
    currentTempF: 72,
    feelsLikeF: 74,
    condition: "Partly cloudy",
    emoji: "⛅",
    humidity: 58,
    windMph: 9,
    hours: [
      { time: "10 AM", emoji: "⛅", tempF: 72, precipChance: 10 },
      { time: "11 AM", emoji: "⛅", tempF: 74, precipChance: 10 },
      { time: "12 PM", emoji: "🌤️", tempF: 76, precipChance: 5 },
      { time: "1 PM", emoji: "🌤️", tempF: 78, precipChance: 5 },
      { time: "2 PM", emoji: "☀️", tempF: 79, precipChance: 0 },
      { time: "3 PM", emoji: "☀️", tempF: 80, precipChance: 0 },
    ],
  };
}
