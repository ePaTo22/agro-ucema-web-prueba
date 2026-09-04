"use client";

import {
  AlertTriangle,
  CalendarDays,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  RefreshCw,
  Snowflake,
  Sprout,
  Sun,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metric = "temperature" | "rain";
type DayRange = 7 | 14;

type Zone = {
  id: string;
  code: string;
  name: string;
  province: string;
  region: string;
  profile: string;
  latitude: number;
  longitude: number;
  accent: "lime" | "orange" | "blue";
};

type ForecastResponse = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    et0_fao_evapotranspiration: number[];
  };
};

type ZoneForecast = Zone & ForecastResponse;

const ZONES: Zone[] = [
  {
    id: "pergamino",
    code: "PER",
    name: "Pergamino",
    province: "Buenos Aires",
    region: "Núcleo norte",
    profile: "Soja · maíz · trigo",
    latitude: -33.89,
    longitude: -60.57,
    accent: "lime",
  },
  {
    id: "marcos-juarez",
    code: "MJU",
    name: "Marcos Juárez",
    province: "Córdoba",
    region: "Pampa húmeda",
    profile: "Maíz · soja · sorgo",
    latitude: -32.7,
    longitude: -62.11,
    accent: "orange",
  },
  {
    id: "rafaela",
    code: "RAF",
    name: "Rafaela",
    province: "Santa Fe",
    region: "Cuenca lechera",
    profile: "Lechería · alfalfa",
    latitude: -31.25,
    longitude: -61.49,
    accent: "blue",
  },
  {
    id: "general-pico",
    code: "GPI",
    name: "General Pico",
    province: "La Pampa",
    region: "Pampa semiárida",
    profile: "Girasol · maíz · ganadería",
    latitude: -35.66,
    longitude: -63.76,
    accent: "lime",
  },
  {
    id: "san-rafael",
    code: "SRA",
    name: "San Rafael",
    province: "Mendoza",
    region: "Oasis sur",
    profile: "Vid · frutales",
    latitude: -34.62,
    longitude: -68.33,
    accent: "orange",
  },
  {
    id: "tafi-viejo",
    code: "TVI",
    name: "Tafí Viejo",
    province: "Tucumán",
    region: "Pedemonte NOA",
    profile: "Cítricos · caña de azúcar",
    latitude: -26.73,
    longitude: -65.26,
    accent: "blue",
  },
];

function weatherMeta(code: number) {
  if (code === 0) return { label: "Despejado", Icon: Sun };
  if (code <= 3) return { label: "Parcialmente nublado", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Neblina", Icon: CloudFog };
  if (code >= 51 && code <= 67) return { label: "Lluvias", Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: "Nevadas", Icon: Snowflake };
  if (code >= 80 && code <= 82) return { label: "Chaparrones", Icon: CloudRain };
  if (code >= 95) return { label: "Tormentas", Icon: CloudLightning };
  return { label: "Variable", Icon: Cloud };
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "")
    .slice(0, 3);
}

function agronomicSignal(forecast: ZoneForecast, days: DayRange) {
  const min = Math.min(...forecast.daily.temperature_2m_min.slice(0, days));
  const rain = forecast.daily.precipitation_sum
    .slice(0, days)
    .reduce((sum, value) => sum + value, 0);
  const probability = Math.max(
    ...forecast.daily.precipitation_probability_max.slice(0, days),
  );
  const wind = Math.max(...forecast.daily.wind_speed_10m_max.slice(0, days));

  if (min <= 2) return { tone: "danger", label: "Riesgo de helada", Icon: Snowflake };
  if (wind >= 42) return { tone: "danger", label: "Viento fuerte", Icon: Wind };
  if (probability >= 70 && rain >= 18)
    return { tone: "watch", label: "Lluvias relevantes", Icon: CloudRain };
  if (rain <= 2) return { tone: "watch", label: "Ventana seca", Icon: Sun };
  return { tone: "good", label: "Condición estable", Icon: Leaf };
}

async function fetchZone(zone: Zone): Promise<ZoneForecast> {
  const params = new URLSearchParams({
    latitude: String(zone.latitude),
    longitude: String(zone.longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration",
    timezone: "America/Argentina/Buenos_Aires",
    forecast_days: "14",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
  const data = (await response.json()) as ForecastResponse;
  return { ...zone, ...data };
}

function WeatherCard({
  forecast,
  days,
  metric,
  index,
}: {
  forecast: ZoneForecast;
  days: DayRange;
  metric: Metric;
  index: number;
}) {
  const current = weatherMeta(forecast.current.weather_code);
  const signal = agronomicSignal(forecast, days);
  const SignalIcon = signal.Icon;
  const visibleDays = forecast.daily.time.slice(0, days).map((date, dayIndex) => ({
    date,
    day: formatDay(date),
    max: Math.round(forecast.daily.temperature_2m_max[dayIndex]),
    min: Math.round(forecast.daily.temperature_2m_min[dayIndex]),
    rain: Number(forecast.daily.precipitation_sum[dayIndex].toFixed(1)),
  }));
  const totalRain = visibleDays.reduce((sum, day) => sum + day.rain, 0);
  const totalEt0 = forecast.daily.et0_fao_evapotranspiration
    .slice(0, days)
    .reduce((sum, value) => sum + value, 0);

  return (
    <article className={`weather-card accent-${forecast.accent}`}>
      <div className="card-topline">
        <span className="zone-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="zone-code">{forecast.code}</span>
        <span className="live-dot" aria-label="Datos en vivo" />
      </div>

      <div className="card-heading">
        <div>
          <p className="region-label">{forecast.region}</p>
          <h2>{forecast.name}</h2>
          <p className="province-label">{forecast.province}</p>
        </div>
        <div className="weather-icon" title={current.label}>
          <current.Icon aria-hidden="true" size={26} strokeWidth={1.8} />
        </div>
      </div>

      <div className="current-row">
        <div className="temperature">
          {Math.round(forecast.current.temperature_2m)}
          <span>°</span>
        </div>
        <div className="current-description">
          <strong>{current.label}</strong>
          <span>{forecast.profile}</span>
        </div>
      </div>

      <div className="micro-metrics">
        <div>
          <Droplets size={15} aria-hidden="true" />
          <span>Humedad</span>
          <strong>{Math.round(forecast.current.relative_humidity_2m)}%</strong>
        </div>
        <div>
          <Wind size={15} aria-hidden="true" />
          <span>Viento</span>
          <strong>{Math.round(forecast.current.wind_speed_10m)} km/h</strong>
        </div>
      </div>

      <div className="chart-wrap" aria-label={`Pronóstico de ${forecast.name}`}>
        <div className="chart-label">
          <span>{metric === "temperature" ? "Rango térmico" : "Precipitación"}</span>
          <span>{days} días</span>
        </div>
        <ResponsiveContainer width="100%" height={126}>
          {metric === "temperature" ? (
            <LineChart data={visibleDays} margin={{ top: 9, right: 5, left: -27, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 5" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                interval={days === 14 ? 1 : 0}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#707b72", fontSize: 9 }}
                width={30}
              />
              <Tooltip
                cursor={{ stroke: "#59645b", strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "#202721",
                  color: "#e8ede5",
                  border: "1px solid #39443b",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, .3)",
                  fontSize: 11,
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date
                    ? new Intl.DateTimeFormat("es-AR", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(`${payload[0].payload.date}T12:00:00`))
                    : ""
                }
                formatter={(value, name) => [
                  `${value} °C`,
                  name === "max" ? "Máxima" : "Mínima",
                ]}
              />
              <Line
                type="monotone"
                dataKey="max"
                stroke="#ff6b35"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 4, fill: "#ff6b35", strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="min"
                stroke="#78b7c8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#78b7c8", strokeWidth: 0 }}
              />
            </LineChart>
          ) : (
            <BarChart data={visibleDays} margin={{ top: 9, right: 5, left: -27, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 5" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                interval={days === 14 ? 1 : 0}
                tick={{ fill: "var(--muted)", fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#707b72", fontSize: 9 }}
                width={30}
              />
              <Tooltip
                cursor={{ fill: "rgba(120, 183, 200, .08)" }}
                contentStyle={{
                  backgroundColor: "#202721",
                  color: "#e8ede5",
                  border: "1px solid #39443b",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(0, 0, 0, .3)",
                  fontSize: 11,
                }}
                formatter={(value) => [`${value} mm`, "Lluvia"]}
              />
              <Bar dataKey="rain" fill="#78b7c8" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="card-footer">
        <div className="water-balance">
          <span>Lluvia / ET₀</span>
          <strong>
            {totalRain.toFixed(1)} <small>/ {totalEt0.toFixed(1)} mm</small>
          </strong>
        </div>
        <div className={`signal signal-${signal.tone}`}>
          <SignalIcon size={13} aria-hidden="true" />
          {signal.label}
        </div>
      </div>
    </article>
  );
}

function LoadingCard({ zone, index }: { zone: Zone; index: number }) {
  return (
    <article className={`weather-card loading-card accent-${zone.accent}`}>
      <div className="card-topline">
        <span className="zone-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="zone-code">{zone.code}</span>
      </div>
      <div className="card-heading">
        <div>
          <p className="region-label">{zone.region}</p>
          <h2>{zone.name}</h2>
          <p className="province-label">{zone.province}</p>
        </div>
      </div>
      <div className="loading-block loading-temp" />
      <div className="loading-block loading-metrics" />
      <div className="loading-block loading-chart" />
    </article>
  );
}

export function AgroPage({ view }: { view: "home" | "zones" }) {
  const [forecasts, setForecasts] = useState<ZoneForecast[]>([]);
  const [days, setDays] = useState<DayRange>(7);
  const [metric, setMetric] = useState<Metric>("temperature");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await Promise.all(ZONES.map(fetchZone));
      setForecasts(next);
      setLastUpdated(new Date());
    } catch {
      setError("No pudimos actualizar los datos. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    if (!forecasts.length) return null;
    const allMins = forecasts.flatMap((zone) =>
      zone.daily.temperature_2m_min.slice(0, days),
    );
    const allMaxes = forecasts.flatMap((zone) =>
      zone.daily.temperature_2m_max.slice(0, days),
    );
    const meanRain =
      forecasts.reduce(
        (total, zone) =>
          total +
          zone.daily.precipitation_sum
            .slice(0, days)
            .reduce((sum, value) => sum + value, 0),
        0,
      ) / forecasts.length;
    const alerts = forecasts.filter(
      (zone) => agronomicSignal(zone, days).tone === "danger",
    ).length;
    return {
      min: Math.round(Math.min(...allMins)),
      max: Math.round(Math.max(...allMaxes)),
      meanRain: meanRain.toFixed(1),
      alerts,
    };
  }, [forecasts, days]);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Agroclima Argentina, inicio">
          <span className="brand-mark">
            <Sprout size={18} strokeWidth={2.1} aria-hidden="true" />
          </span>
          <span>AGROCLIMA</span>
          <i>//</i>
          <span>ARGENTINA</span>
        </a>
        <nav aria-label="Navegación principal">
          <a className={view === "home" ? "active" : ""} href="/#resumen">Resumen</a>
          <a className={view === "zones" ? "active" : ""} href="/zonas">Zonas</a>
          <a href="#metodologia">Metodología</a>
        </nav>
        <div className="header-status">
          <span className="pulse" />
          Datos en vivo
        </div>
      </header>

      {view === "home" && <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow"><span>MONITOREO NACIONAL</span> · 6 ZONAS PRODUCTIVAS</p>
          <h1>El clima del campo,<br /><em>de un vistazo.</em></h1>
          <a
            className="zones-cta"
            href="https://wa.me/5493537670107?text=gera%2C%20te%20consulto%20sobre%20esta%20zona%2E%2E%2E"
            target="_blank"
            rel="noreferrer"
            aria-label="Contactar a Gera por WhatsApp"
          >
            <span>GERA PIDIO ESTO</span>
            <span aria-hidden="true">↗</span>
          </a>
          <p className="hero-description">
            Información meteorológica accionable para anticipar labores,
            proteger cultivos y leer la campaña con contexto.
          </p>
        </div>

        <div className="hero-summary" id="resumen">
          <div className="summary-head">
            <div>
              <span>Panorama</span>
              <strong>Próximos {days} días</strong>
            </div>
            <CalendarDays size={22} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="summary-grid">
            <div>
              <span>Lluvia media</span>
              <strong>{summary ? summary.meanRain : "—"}<small> mm</small></strong>
            </div>
            <div>
              <span>Rango térmico</span>
              <strong>{summary ? `${summary.min}°–${summary.max}°` : "—"}</strong>
            </div>
            <div>
              <span>Alertas</span>
              <strong>{summary ? summary.alerts : "—"}<small> / 6</small></strong>
            </div>
          </div>
        </div>
      </section>}

      {view === "zones" && <>
      <section className="zones-route-header">
        <div>
          <p className="eyebrow"><span>RADAR AGROCLIMÁTICO</span> · DATOS EN VIVO</p>
          <h1>Pronóstico por zona.</h1>
        </div>
        <a href="/">← Volver al inicio</a>
      </section>

      <section className="dashboard-section zones-page-dashboard" id="zonas">
        <div className="dashboard-toolbar">
          <div>
            <p className="section-kicker">TABLERO TERRITORIAL</p>
            <h2>Seis pulsos del agro argentino</h2>
            <p>
              {lastUpdated
                ? `Actualizado hoy, ${lastUpdated.toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Conectando con Open-Meteo…"}
            </p>
          </div>
          <div className="toolbar-actions">
            <div className="segmented" aria-label="Cantidad de días">
              <button className={days === 7 ? "selected" : ""} onClick={() => setDays(7)} type="button">
                7 días
              </button>
              <button className={days === 14 ? "selected" : ""} onClick={() => setDays(14)} type="button">
                14 días
              </button>
            </div>
            <div className="segmented metric-switch" aria-label="Variable del gráfico">
              <button
                className={metric === "temperature" ? "selected" : ""}
                onClick={() => setMetric("temperature")}
                type="button"
              >
                Temperatura
              </button>
              <button className={metric === "rain" ? "selected" : ""} onClick={() => setMetric("rain")} type="button">
                Lluvias
              </button>
            </div>
            <button
              className="refresh-button"
              onClick={() => void loadData()}
              disabled={loading}
              type="button"
              aria-label="Actualizar datos"
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={() => void loadData()}>Reintentar</button>
          </div>
        )}

        <div className="weather-grid">
          {loading && forecasts.length === 0
            ? ZONES.map((zone, index) => <LoadingCard key={zone.id} zone={zone} index={index} />)
            : forecasts.map((forecast, index) => (
                <WeatherCard
                  key={forecast.id}
                  forecast={forecast}
                  days={days}
                  metric={metric}
                  index={index}
                />
              ))}
        </div>
      </section>
      </>}

      <section className="methodology" id="metodologia">
        <div className="method-icon"><Gauge size={22} aria-hidden="true" /></div>
        <div>
          <p className="section-kicker">CÓMO LEER ESTE TABLERO</p>
          <h2>Una señal rápida, no una receta agronómica.</h2>
        </div>
        <p>
          Las alertas combinan temperatura mínima, viento y lluvia pronosticada.
          Contrastá siempre con condiciones de lote, suelo y recomendaciones locales.
        </p>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Fuente: Open-Meteo ↗
        </a>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark"><Sprout size={16} aria-hidden="true" /></span>
          <span>AGROCLIMA</span><i>//</i><span>ARGENTINA</span>
        </div>
        <p>Clima abierto para decisiones a campo.</p>
        <p>Sin registro · Sin almacenamiento de datos</p>
      </footer>
    </main>
  );
}

export default function Home() {
  return <AgroPage view="home" />;
}
