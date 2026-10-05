// Meldungen des Nutzers (Fund oder "nichts gefunden") mit Waldbeschreibung: Typen, Prüfung und GitHub-Issue-Text.
// Rein, ohne I/O. Gedacht, um die Hotspots und das Habitat-Modell mit echten Beobachtungen zu prüfen.
import type { Hotspotart } from "./hotspots.ts";
import type { Pilzart } from "./wachstum.ts";

export type Ergebnis = "fund" | "nichts";
export type Pilzgroesse = "jung" | "mittel" | "alt" | "gemischt";
export type Bestandsalter = "jung" | "mittel" | "alt" | "unbekannt";
export type Dichte = "licht" | "mittel" | "dicht";
/** Lage der Stelle zu den Brennpunkt-Umrissen auf der Karte zum Zeitpunkt der Meldung. */
export type Brennpunktstatus = Hotspotart | "flaeche-index-zu-niedrig" | "keiner";

export const ERGEBNIS_FUND: Ergebnis = "fund";
export const ERGEBNISSE: readonly Ergebnis[] = [ERGEBNIS_FUND, "nichts"];
export const PILZE: readonly Pilzart[] = ["steinpilz", "pfifferling"];
export const GROESSEN: readonly Pilzgroesse[] = ["jung", "mittel", "alt", "gemischt"];
export const BESTANDSALTER: readonly Bestandsalter[] = ["jung", "mittel", "alt", "unbekannt"];
export const DICHTEN: readonly Dichte[] = ["licht", "mittel", "dicht"];
export const BAUMARTEN_MELDUNG: readonly string[] = [
  "Kiefer",
  "Fichte",
  "Douglasie",
  "Lärche",
  "Buche",
  "Eiche",
  "Birke",
  "Erle",
  "Sonstige",
];
export const KEIN_UNTERSTAND = "Kein Unterstand";
export const UNTERSTAND_ARTEN: readonly string[] = [...BAUMARTEN_MELDUNG, "Sträucher", KEIN_UNTERSTAND];
export const BRENNPUNKTSTATUS: readonly Brennpunktstatus[] = ["heute", "letzte-tage", "flaeche-index-zu-niedrig", "keiner"];

export const MAX_NOTIZ_ZEICHEN = 500;
export const MAX_GENAUIGKEIT_METER = 30; // schlechter: die Stelle ist zu unsicher, um das Modell zu prüfen
const MAX_URL_ZEICHEN = 7500; // GitHub lehnt längere Adressen ab
const MAX_KENNUNG_ZEICHEN = 40; // id und Zeitstempel
const MIN_BREITE = 47;
const MAX_BREITE = 55.1;
const MIN_LAENGE = 5.8;
const MAX_LAENGE = 15.1;
const MAX_STUFE = 100;
const MAX_INDEX = 100;
const MAX_GENAUIGKEIT_PRUEFUNG = 1000;
const NACHKOMMA_KOORDINATE = 5; // ~1 m
const REPOSITORY = "MitWilhelm/pilzkarte-brandenburg";
const ISSUE_LABEL = "meldung";
const JSON_EINRUECKUNG = 2;

export interface Modellwerte {
  readonly gebiet: string | null; // null: außerhalb der Gebiete mit Karte
  readonly stufe: number | null; // Habitat-Stufe der gemeldeten Pilzart, 0 = kein Habitat
  readonly brennpunkt: Brennpunktstatus | null;
  readonly wachstumsindex: number | null; // am Tag der Meldung, null wenn das Wetter nicht ladbar war
}

export interface Meldung {
  readonly id: string;
  readonly zeitpunkt: string; // ISO 8601, UTC
  readonly breite: number;
  readonly laenge: number;
  readonly genauigkeitMeter: number;
  readonly ergebnis: Ergebnis;
  readonly pilz: Pilzart;
  readonly groesse: Pilzgroesse | null; // nur bei einem Fund
  readonly kronendach: readonly string[];
  readonly unterstand: readonly string[];
  readonly bestandsalter: Bestandsalter;
  readonly dichte: Dichte;
  readonly notiz: string;
  readonly modell: Modellwerte;
}

export interface IssueText {
  readonly titel: string;
  readonly text: string;
}

function eintrag(objekt: unknown, schluessel: string): unknown {
  if (typeof objekt !== "object" || objekt === null) {
    throw new Error(`Invariante verletzt: Meldung, Objekt erwartet bei ${schluessel}`);
  }
  return Object.entries(objekt).find(([name]) => name === schluessel)?.[1];
}

function aus<T extends string>(erlaubt: readonly T[], wert: unknown, name: string): T {
  const gefunden = erlaubt.find((kandidat) => kandidat === wert);
  if (gefunden === undefined) {
    throw new Error(`Invariante verletzt: Meldung, ${name} ist ${JSON.stringify(wert)}, erlaubt: ${erlaubt.join(", ")}`);
  }
  return gefunden;
}

function zahlZwischen(wert: unknown, name: string, grenzen: { readonly min: number; readonly max: number }): number {
  if (typeof wert !== "number" || !Number.isFinite(wert) || wert < grenzen.min || wert > grenzen.max) {
    throw new Error(`Invariante verletzt: Meldung, ${name} ist ${JSON.stringify(wert)}, erlaubt ${String(grenzen.min)} bis ${String(grenzen.max)}`);
  }
  return wert;
}

function text(wert: unknown, name: string, maxZeichen: number): string {
  if (typeof wert !== "string" || wert.length > maxZeichen) {
    throw new Error(`Invariante verletzt: Meldung, ${name} ist kein Text bis ${String(maxZeichen)} Zeichen`);
  }
  return wert;
}

function auswahlListe(wert: unknown, erlaubt: readonly string[], name: string): string[] {
  if (!Array.isArray(wert) || wert.length === 0) {
    throw new Error(`Invariante verletzt: Meldung, ${name} ist keine nicht-leere Liste`);
  }
  const liste: readonly unknown[] = wert;
  return liste.map((einzel) => aus(erlaubt, einzel, name));
}

function oderNull<T>(wert: unknown, pruefe: (inhalt: unknown) => T): T | null {
  return wert === null ? null : pruefe(wert);
}

function pruefeModell(roh: unknown): Modellwerte {
  const gebiet = eintrag(roh, "gebiet");
  if (gebiet !== null && (typeof gebiet !== "string" || gebiet === "")) {
    throw new Error("Invariante verletzt: Meldung, modell.gebiet ist weder null noch ein Name");
  }
  return {
    gebiet,
    stufe: oderNull(eintrag(roh, "stufe"), (wert) => zahlZwischen(wert, "modell.stufe", { min: 0, max: MAX_STUFE })),
    brennpunkt: oderNull(eintrag(roh, "brennpunkt"), (wert) => aus(BRENNPUNKTSTATUS, wert, "modell.brennpunkt")),
    wachstumsindex: oderNull(eintrag(roh, "wachstumsindex"), (wert) =>
      zahlZwischen(wert, "modell.wachstumsindex", { min: 0, max: MAX_INDEX }),
    ),
  };
}

/** Prüft ein unbekanntes Objekt (z. B. aus dem Handy-Speicher) und liefert eine Meldung oder wirft. */
export function pruefeMeldung(roh: unknown): Meldung {
  const id = text(eintrag(roh, "id"), "id", MAX_KENNUNG_ZEICHEN);
  const zeitpunkt = text(eintrag(roh, "zeitpunkt"), "zeitpunkt", MAX_KENNUNG_ZEICHEN);
  if (id === "" || !Number.isFinite(Date.parse(zeitpunkt))) {
    throw new Error(`Invariante verletzt: Meldung, id ${JSON.stringify(id)} oder zeitpunkt ${JSON.stringify(zeitpunkt)} ungültig`);
  }
  const ergebnis = aus(ERGEBNISSE, eintrag(roh, "ergebnis"), "ergebnis");
  const groesse = oderNull(eintrag(roh, "groesse"), (wert) => aus(GROESSEN, wert, "groesse"));
  if ((ergebnis === ERGEBNIS_FUND) !== (groesse !== null)) {
    throw new Error(`Invariante verletzt: Meldung, Ergebnis ${ergebnis} passt nicht zur Größe ${JSON.stringify(groesse)}`);
  }
  const unterstand = auswahlListe(eintrag(roh, "unterstand"), UNTERSTAND_ARTEN, "unterstand");
  if (unterstand.includes(KEIN_UNTERSTAND) && unterstand.length !== 1) {
    throw new Error(`Invariante verletzt: Meldung, "${KEIN_UNTERSTAND}" darf nicht mit Baumarten kombiniert sein: ${unterstand.join(", ")}`);
  }
  return {
    id,
    zeitpunkt,
    breite: zahlZwischen(eintrag(roh, "breite"), "breite", { min: MIN_BREITE, max: MAX_BREITE }),
    laenge: zahlZwischen(eintrag(roh, "laenge"), "laenge", { min: MIN_LAENGE, max: MAX_LAENGE }),
    genauigkeitMeter: zahlZwischen(eintrag(roh, "genauigkeitMeter"), "genauigkeitMeter", {
      min: 0,
      max: MAX_GENAUIGKEIT_PRUEFUNG,
    }),
    ergebnis,
    pilz: aus(PILZE, eintrag(roh, "pilz"), "pilz"),
    groesse,
    kronendach: auswahlListe(eintrag(roh, "kronendach"), BAUMARTEN_MELDUNG, "kronendach"),
    unterstand,
    bestandsalter: aus(BESTANDSALTER, eintrag(roh, "bestandsalter"), "bestandsalter"),
    dichte: aus(DICHTEN, eintrag(roh, "dichte"), "dichte"),
    notiz: text(eintrag(roh, "notiz"), "notiz", MAX_NOTIZ_ZEICHEN),
    modell: pruefeModell(eintrag(roh, "modell")),
  };
}

const PILZ_NAME: Readonly<Record<Pilzart, string>> = { steinpilz: "Steinpilz", pfifferling: "Pfifferling" };
const BRENNPUNKT_TEXT: Readonly<Record<Brennpunktstatus, string>> = {
  heute: "in einem Umriss, Index heute günstig (türkis)",
  "letzte-tage": "in einem Umriss, nur in den letzten 7 Tagen günstig (pink)",
  "flaeche-index-zu-niedrig": "in einer Top-Fläche, Wachstumsindex aber unter 60 (kein Umriss)",
  keiner: "nicht in einer Top-Fläche",
};

export function pilzName(pilz: Pilzart): string {
  return PILZ_NAME[pilz];
}

export function koordinatentext(breite: number, laenge: number): string {
  return `${breite.toFixed(NACHKOMMA_KOORDINATE)}, ${laenge.toFixed(NACHKOMMA_KOORDINATE)}`;
}

/** Kurzfassung für die Liste im Handy und den Titel des Issues. */
export function kurztext(meldung: Meldung): string {
  const was = meldung.ergebnis === ERGEBNIS_FUND ? `Fund ${pilzName(meldung.pilz)}` : `Nichts gefunden (${pilzName(meldung.pilz)})`;
  return `${was}, ${meldung.zeitpunkt.slice(0, "JJJJ-MM-TT".length)}`;
}

function stufentext(stufe: number | null): string {
  if (stufe === null) {
    return "Stufe unbekannt";
  }
  return stufe === 0 ? "kein Habitat" : `Stufe ${String(stufe)}`;
}

function modelltext(modell: Modellwerte): string {
  if (modell.gebiet === null) {
    return "außerhalb der Gebiete mit Karte";
  }
  const stufe = stufentext(modell.stufe);
  const index = modell.wachstumsindex === null ? "Wachstumsindex nicht ermittelt" : `Wachstumsindex ${String(modell.wachstumsindex)}`;
  const lage = modell.brennpunkt === null ? "" : `, ${BRENNPUNKT_TEXT[modell.brennpunkt]}`;
  return `${modell.gebiet}: ${stufe}, ${index}${lage}`;
}

/** Text des GitHub-Issues: lesbare Zusammenfassung plus die Rohdaten als JSON (zum maschinellen Auswerten). */
export function meldungAlsIssue(meldung: Meldung): IssueText {
  const groesse = meldung.groesse === null ? "" : `, Größe ${meldung.groesse}`;
  const zeilen = [
    `**${kurztext(meldung)}${groesse}**`,
    "",
    `- Stelle: ${koordinatentext(meldung.breite, meldung.laenge)} (GPS ±${String(Math.round(meldung.genauigkeitMeter))} m)`,
    `- Kronendach: ${meldung.kronendach.join(", ")}; Unterstand: ${meldung.unterstand.join(", ")}`,
    `- Bestandsalter: ${meldung.bestandsalter}; Dichte: ${meldung.dichte}`,
    `- Modell: ${modelltext(meldung.modell)}`,
    "",
    "```json",
    JSON.stringify(meldung, null, JSON_EINRUECKUNG),
    "```",
  ];
  return {
    titel: `Meldung: ${kurztext(meldung)} ${koordinatentext(meldung.breite, meldung.laenge)}`,
    text: zeilen.join("\n"),
  };
}

/** Adresse, die auf github.com ein vorausgefülltes Issue öffnet; der Nutzer bestätigt dort nur noch. */
export function issueUrl(meldung: Meldung): string {
  const { titel, text: inhalt } = meldungAlsIssue(meldung);
  const parameter = new URLSearchParams({ title: titel, body: inhalt, labels: ISSUE_LABEL });
  const url = `https://github.com/${REPOSITORY}/issues/new?${parameter.toString()}`;
  if (url.length > MAX_URL_ZEICHEN) {
    throw new Error(`Invariante verletzt: Issue-Adresse hat ${String(url.length)} Zeichen, erlaubt ${String(MAX_URL_ZEICHEN)}`);
  }
  return url;
}
