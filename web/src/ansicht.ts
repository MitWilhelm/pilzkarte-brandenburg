// Ansicht: füllt die Tafel mit Index, 7-Tage-Trend und Punkt-Infos. Nur textContent und DOM-Knoten (Regel 12).
import { STUFEN, googleMapsRoute, komootPlaner, type Gebiet } from "./geo.ts";
import { indexWort, type Tagesindex, type Tageswetter } from "./wachstum.ts";

const WOCHENTAG = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });
const TAGE_REGEN_SUMME = 7;
const SCHWACHER_FAKTOR = 0.75;

export interface Punktinfo {
  readonly breite: number;
  readonly laenge: number;
  readonly stufe: number;
  readonly stufenname: string | null;
  readonly baumart: string | null;
  readonly boden: string | null;
}

export function element<T extends HTMLElement>(id: string, klasse: new () => T): T {
  const gefunden = document.getElementById(id);
  if (!(gefunden instanceof klasse)) {
    throw new Error(`Invariante verletzt: Element #${id} fehlt oder hat den falschen Typ`);
  }
  return gefunden;
}

function wochentag(datum: string): string {
  return WOCHENTAG.format(new Date(`${datum}T12:00:00Z`)).replace(".", "");
}

/** Nennt den Faktor, der den Index am stärksten bremst, in Alltagssprache. */
export function bremsgrund(tag: Tagesindex): string {
  const { faktoren } = tag;
  const kandidaten: readonly (readonly [number, string])[] = [
    [
      faktoren.regen,
      tag.tageSeitAusloeser === null
        ? "Kein kräftiger Regen in den letzten zwei Wochen."
        : `${String(tag.tageSeitAusloeser)} Tage seit dem letzten kräftigen Regen.`,
    ],
    [faktoren.bodentemperatur, "Boden ist zu kalt oder zu warm."],
    [faktoren.bodenfeuchte, "Boden ist trocken."],
    [faktoren.saison, "Außerhalb der Hauptsaison."],
    [faktoren.frost, "Nachtfrost in den letzten Tagen."],
  ];
  const schwaechster = [...kandidaten].sort((a, b) => a[0] - b[0])[0];
  if (schwaechster === undefined || schwaechster[0] >= SCHWACHER_FAKTOR) {
    return "Regen, Boden und Jahreszeit passen.";
  }
  return schwaechster[1];
}

export function zeigeIndex(ort: string, verlauf: readonly Tagesindex[]): void {
  const heute = verlauf[0];
  if (heute === undefined) {
    throw new Error("Invariante verletzt: leerer Indexverlauf");
  }
  element("index-ort", HTMLElement).textContent = ort;
  element("index-zahl", HTMLElement).textContent = String(heute.index);
  element("index-wort", HTMLElement).textContent = indexWort(heute.index);
  element("index-grund", HTMLElement).textContent = bremsgrund(heute);
  const liste = element("trend", HTMLOListElement);
  liste.replaceChildren(
    ...verlauf.map((tag, nummer) => {
      const eintrag = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = nummer === 0 ? "Heute" : wochentag(tag.datum);
      if (nummer === 0) {
        name.className = "trend-heute";
      }
      const zahl = document.createElement("span");
      zahl.className = "trend-zahl";
      zahl.textContent = String(tag.index);
      const balken = document.createElement("meter");
      balken.min = 0;
      balken.max = 100;
      balken.low = 40;
      balken.high = 60;
      balken.optimum = 100;
      balken.value = tag.index;
      eintrag.append(name, zahl, balken);
      return eintrag;
    }),
  );
}

export function zeigeIndexFehler(meldung: string): void {
  element("index-zahl", HTMLElement).textContent = "–";
  element("index-wort", HTMLElement).textContent = "Wetter nicht verfügbar";
  element("index-grund", HTMLElement).textContent = meldung;
  element("trend", HTMLOListElement).replaceChildren();
}

export function zeigePunkt(info: Punktinfo): void {
  element("block-punkt", HTMLElement).hidden = false;
  element("hinweis", HTMLElement).hidden = true;
  const chip = element("punkt-stufe", HTMLElement);
  chip.textContent = info.stufenname === null ? "Kein Habitat" : `${info.stufenname} · ${String(info.stufe)}`;
  chip.dataset["klasse"] = info.stufenname ?? "";
  element("punkt-baumart", HTMLElement).textContent = info.baumart ?? "Kein Wald laut Baumartenkarte";
  element("punkt-boden", HTMLElement).textContent = info.boden ?? "Keine Standortkartierung";
  element("punkt-koordinaten", HTMLElement).textContent = `${info.breite.toFixed(5)}, ${info.laenge.toFixed(5)}`;
  element("link-google", HTMLAnchorElement).href = googleMapsRoute(info.breite, info.laenge);
  element("link-komoot", HTMLAnchorElement).href = komootPlaner(info.breite, info.laenge);
  for (const id of ["punkt-index", "punkt-regen", "punkt-bodentemp", "punkt-feuchte"]) {
    element(id, HTMLElement).textContent = "…";
  }
}

export function zeigePunktwetter(tage: readonly Tageswetter[], heute: number, index: Tagesindex): void {
  const tag = tage[heute];
  if (tag === undefined) {
    throw new Error("Invariante verletzt: heutiger Wettertag fehlt");
  }
  const regen = tage.slice(Math.max(0, heute - TAGE_REGEN_SUMME + 1), heute + 1).reduce((s, t) => s + t.regenMm, 0);
  element("punkt-index", HTMLElement).textContent = `Wachstumsindex hier: ${String(index.index)} (${indexWort(index.index)})`;
  element("punkt-regen", HTMLElement).textContent = `${regen.toFixed(1)} mm`;
  element("punkt-bodentemp", HTMLElement).textContent = `${tag.bodentempC.toFixed(1)} °C`;
  element("punkt-feuchte", HTMLElement).textContent = `${String(Math.round(tag.bodenfeuchte * 100))} Vol.-%`;
}

export function zeigePunktwetterFehler(meldung: string): void {
  element("punkt-index", HTMLElement).textContent = meldung;
  for (const id of ["punkt-regen", "punkt-bodentemp", "punkt-feuchte"]) {
    element(id, HTMLElement).textContent = "–";
  }
}

export function fuelleGebiete(gebiete: readonly Gebiet[]): void {
  element("gebietswahl", HTMLSelectElement).replaceChildren(
    ...gebiete.map((gebiet) => new Option(gebiet.anzeigename, gebiet.name)),
  );
}

export function fuelleLegende(): void {
  element("legende", HTMLUListElement).replaceChildren(
    ...STUFEN.map((klasse) => {
      const eintrag = document.createElement("li");
      const feld = document.createElement("span");
      feld.className = "farbfeld";
      feld.dataset["klasse"] = klasse.name;
      const name = document.createElement("span");
      name.textContent = `${klasse.name} (ab ${String(klasse.ab)})`;
      eintrag.append(feld, name);
      return eintrag;
    }),
  );
}

export function zeigeSchutzhinweis(text: string | null): void {
  const hinweis = element("schutz-hinweis", HTMLElement);
  hinweis.hidden = text === null;
  hinweis.textContent = text ?? "";
}
