// Open-Meteo-Client: lädt 14 Tage Vergangenheit + 7 Tage Prognose und prüft die Antwort an der Grenze.
// Rate-Limit (kostenlos, nur nicht-kommerziell): < 10.000 Abrufe/Tag, < 600/Minute. Kein Retry:
// ein Fehler wird mit Ursache weitergereicht und auf der Seite angezeigt. Lizenz der Daten: CC-BY-4.0.
import type { Tageswetter } from "../wachstum.ts";

export const TAGE_ZURUECK = 14;
const TAGE_VORAUS = 8; // heute + 7 Tage
const STUNDEN_PRO_TAG = 24;
const ENDPUNKT = "https://api.open-meteo.com/v1/forecast";

export interface Wetterreihe {
  readonly tage: readonly Tageswetter[];
  readonly heute: number; // Position von heute in `tage`
}

function zahlenliste(wert: unknown, name: string): number[] {
  if (!Array.isArray(wert) || !wert.every((eintrag) => typeof eintrag === "number")) {
    throw new Error(`Invariante verletzt: Open-Meteo-Feld ${name} ist keine Zahlenliste`);
  }
  return wert.filter((eintrag): eintrag is number => typeof eintrag === "number");
}

function textliste(wert: unknown, name: string): string[] {
  if (!Array.isArray(wert) || !wert.every((eintrag) => typeof eintrag === "string")) {
    throw new Error(`Invariante verletzt: Open-Meteo-Feld ${name} ist keine Textliste`);
  }
  return wert.filter((eintrag): eintrag is string => typeof eintrag === "string");
}

function feld(objekt: unknown, name: string): unknown {
  if (typeof objekt !== "object" || objekt === null || !(name in objekt)) {
    throw new Error(`Invariante verletzt: Open-Meteo-Antwort ohne Feld ${name}`);
  }
  return Object.entries(objekt).find(([schluessel]) => schluessel === name)?.[1];
}

function tagesmittel(stundenwerte: readonly number[], tag: number): number {
  const ausschnitt = stundenwerte.slice(tag * STUNDEN_PRO_TAG, (tag + 1) * STUNDEN_PRO_TAG);
  if (ausschnitt.length !== STUNDEN_PRO_TAG) {
    throw new Error(`Invariante verletzt: Tag ${String(tag)} hat ${String(ausschnitt.length)} Stundenwerte`);
  }
  return ausschnitt.reduce((summe, wert) => summe + wert, 0) / STUNDEN_PRO_TAG;
}

function wert(liste: readonly number[], position: number): number {
  const eintrag = liste[position];
  if (eintrag === undefined) {
    throw new Error(`Invariante verletzt: kein Wert an Position ${String(position)}`);
  }
  return eintrag;
}

/** Wandelt die rohe JSON-Antwort in geprüfte Tageswerte um (rein, ohne Netzwerk). */
export function wetterAusAntwort(antwort: unknown): Wetterreihe {
  const taeglich = feld(antwort, "daily");
  const stuendlich = feld(antwort, "hourly");
  const daten = textliste(feld(taeglich, "time"), "daily.time");
  const regen = zahlenliste(feld(taeglich, "precipitation_sum"), "precipitation_sum");
  const minimum = zahlenliste(feld(taeglich, "temperature_2m_min"), "temperature_2m_min");
  const bodentemp = zahlenliste(feld(stuendlich, "soil_temperature_6cm"), "soil_temperature_6cm");
  const feuchte = zahlenliste(feld(stuendlich, "soil_moisture_3_to_9cm"), "soil_moisture_3_to_9cm");
  if (bodentemp.length !== daten.length * STUNDEN_PRO_TAG || feuchte.length !== bodentemp.length) {
    throw new Error(
      `Invariante verletzt: ${String(daten.length)} Tage, aber ${String(bodentemp.length)} Stundenwerte`,
    );
  }
  const tage = daten.map((datum, tag) => ({
    datum,
    regenMm: wert(regen, tag),
    lufttempMinC: wert(minimum, tag),
    bodentempC: tagesmittel(bodentemp, tag),
    bodenfeuchte: tagesmittel(feuchte, tag),
  }));
  if (tage.length <= TAGE_ZURUECK) {
    throw new Error(`Invariante verletzt: nur ${String(tage.length)} Tage, erwartet mehr als ${String(TAGE_ZURUECK)}`);
  }
  return { tage, heute: TAGE_ZURUECK };
}

export function wetterUrl(breite: number, laenge: number): string {
  const parameter = new URLSearchParams({
    latitude: breite.toFixed(4),
    longitude: laenge.toFixed(4),
    hourly: "soil_temperature_6cm,soil_moisture_3_to_9cm",
    daily: "precipitation_sum,temperature_2m_min",
    past_days: String(TAGE_ZURUECK),
    forecast_days: String(TAGE_VORAUS),
    timezone: "Europe/Berlin",
  });
  return `${ENDPUNKT}?${parameter.toString()}`;
}

export async function ladeWetter(breite: number, laenge: number): Promise<Wetterreihe> {
  const url = wetterUrl(breite, laenge);
  let antwort: Response;
  try {
    antwort = await fetch(url);
  } catch (fehler) {
    throw new Error("Wetterdaten nicht erreichbar (keine Verbindung?)", { cause: fehler });
  }
  if (!antwort.ok) {
    throw new Error(`Wetterdienst antwortet mit Status ${String(antwort.status)}`);
  }
  const inhalt: unknown = await antwort.json();
  return wetterAusAntwort(inhalt);
}
