/**
 * Open-Meteo weather provider for the AI order-template prompt.
 *
 * Free, no API key, no attribution requirement. The forecast is advisory input for the
 * model — a failure here must never fail the order-template request, so every error path
 * returns `null` and the caller falls back to the history-only prompt.
 */

export type WeatherDay = {
  /** YYYY-MM-DD */
  date: string;
  tempMax: number;
  tempMin: number;
  /** mm */
  precipitation: number;
  /** 0-100 */
  precipitationProbability: number;
  /** km/h */
  windMax: number;
  /** WMO weather code */
  code: number;
  /** Short Dutch label for the code */
  label: string;
  /** 0-10 heuristic: "is this good frituur weather" */
  terrasScore: number;
};

const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 h — the forecast does not move faster than this
const FETCH_TIMEOUT_MS = 5000;

let cache: { at: number; data: WeatherDay[] } | null = null;

/** Common WMO weather codes → short Dutch label. Unknown codes fall back to "wisselend". */
const WMO_LABELS: Record<number, string> = {
  0: "onbewolkt",
  1: "overwegend zonnig",
  2: "halfbewolkt",
  3: "bewolkt",
  45: "mist",
  48: "aanvriezende mist",
  51: "motregen",
  53: "motregen",
  55: "motregen",
  56: "ijzel",
  57: "ijzel",
  61: "regen",
  63: "regen",
  65: "zware regen",
  66: "ijzel",
  67: "ijzel",
  71: "sneeuw",
  73: "sneeuw",
  75: "zware sneeuw",
  77: "sneeuwkorrels",
  80: "buien",
  81: "buien",
  82: "zware buien",
  85: "sneeuwbuien",
  86: "sneeuwbuien",
  95: "onweer",
  96: "onweer met hagel",
  99: "onweer met hagel",
};

export function weatherLabel(code: number): string {
  return WMO_LABELS[code] ?? "wisselend";
}

/**
 * Terrasscore: a single 0-10 number capturing how good a day is for a frituur.
 * Deliberately a crude heuristic for the model to read — not a forecast product.
 *
 *  - 15-25 °C is the sweet spot; every degree outside it costs a point (less harshly on the warm side)
 *  - rain volume hurts most, then rain probability, then hard wind
 */
export function terrasScore(day: {
  tempMax: number;
  precipitation: number;
  precipitationProbability: number;
  windMax: number;
}): number {
  let score = 10;

  if (day.tempMax < 15) score -= 15 - day.tempMax;
  else if (day.tempMax > 25) score -= (day.tempMax - 25) * 0.8;

  // Caps keep a thoroughly wet day around 2-3 rather than flattening everything bad to 0.
  score -= Math.min(5, day.precipitation * 1.5);
  score -= (day.precipitationProbability / 100) * 2;
  if (day.windMax > 25) score -= (day.windMax - 25) / 10;

  return Math.round(Math.min(10, Math.max(0, score)));
}

/**
 * 7-day forecast for the shop location. Cached in-module for 3 hours.
 * Returns `null` on any failure — callers must degrade gracefully.
 */
export async function getForecast(): Promise<WeatherDay[] | null> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const lat = process.env.SHOP_LAT || "50.7817"; // Bellegem (Kortrijk)
  const lon = process.env.SHOP_LON || "3.2456";

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code" +
    "&timezone=Europe/Brussels&forecast_days=7";

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.error("Open-Meteo responded", res.status);
      return null;
    }

    const json = (await res.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
        precipitation_probability_max?: number[];
        wind_speed_10m_max?: number[];
        weather_code?: number[];
      };
    };

    const d = json.daily;
    if (!d?.time?.length) {
      console.error("Open-Meteo returned no daily data");
      return null;
    }

    const days: WeatherDay[] = d.time.map((date, i) => {
      const tempMax = d.temperature_2m_max?.[i] ?? 0;
      const tempMin = d.temperature_2m_min?.[i] ?? 0;
      const precipitation = d.precipitation_sum?.[i] ?? 0;
      const precipitationProbability = d.precipitation_probability_max?.[i] ?? 0;
      const windMax = d.wind_speed_10m_max?.[i] ?? 0;
      const code = d.weather_code?.[i] ?? -1;

      return {
        date,
        tempMax,
        tempMin,
        precipitation,
        precipitationProbability,
        windMax,
        code,
        label: weatherLabel(code),
        terrasScore: terrasScore({ tempMax, precipitation, precipitationProbability, windMax }),
      };
    });

    cache = { at: Date.now(), data: days };
    return days;
  } catch (err) {
    console.error("Weather lookup failed:", err);
    return null;
  }
}

/** Test/dev helper — drops the in-module cache. */
export function clearForecastCache() {
  cache = null;
}
