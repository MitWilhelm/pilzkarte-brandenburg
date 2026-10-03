// Wachstumsindex (0–100) für Steinpilz und Pfifferling aus Tageswetter – reine Funktionen, kein I/O.
// Idee: Pilze fruchten einige Tage nach kräftigem Regen, wenn der Boden mild und feucht ist und Saison ist.
// Alle Schwellen sind Fachwissen-Annahmen (docs/decisions.md), nicht mit Funden kalibriert.

export type Pilzart = "steinpilz" | "pfifferling";

export interface Tageswetter {
  readonly datum: string; // JJJJ-MM-TT, Ortszeit Europe/Berlin
  readonly regenMm: number;
  readonly lufttempMinC: number;
  readonly bodentempC: number; // Tagesmittel in 6 cm Tiefe
  readonly bodenfeuchte: number; // m³/m³ in 3–9 cm Tiefe
}

export interface Indexfaktoren {
  readonly regen: number;
  readonly bodentemperatur: number;
  readonly bodenfeuchte: number;
  readonly saison: number;
  readonly frost: number;
}

export interface Indexbedingungen {
  readonly pilz: Pilzart;
  readonly ausloeserMm: number;
}

export interface Tagesindex {
  readonly datum: string;
  readonly index: number;
  readonly faktoren: Indexfaktoren;
  readonly tageSeitAusloeser: number | null;
}

interface Latenz {
  readonly zuFruehBis: number; // bis hierhin: Myzel reagiert erst
  readonly ernteAb: number;
  readonly ernteBis: number;
  readonly abklingenBis: number;
}

interface Saison {
  readonly beginn: string; // MM-TT
  readonly hoehepunktBeginn: string;
  readonly hoehepunktEnde: string;
  readonly ende: string;
}

const AUSLOESER_TAGE = 3;
const AUSLOESER_MM = 12;
// Auf gut passenden Standorten (Habitat-Stufe ab 80) genügt weniger Regen als Auslöser (Angabe des Nutzers: 6-8 mm).
const AUSLOESER_MM_GUTER_STANDORT = 6;
const STUFE_GUTER_STANDORT = 80;
const LATENZ: Readonly<Record<Pilzart, Latenz>> = {
  steinpilz: { zuFruehBis: 4, ernteAb: 7, ernteBis: 14, abklingenBis: 21 },
  pfifferling: { zuFruehBis: 5, ernteAb: 9, ernteBis: 18, abklingenBis: 26 },
};
const SAISON: Readonly<Record<Pilzart, Saison>> = {
  steinpilz: { beginn: "06-20", hoehepunktBeginn: "08-10", hoehepunktEnde: "10-20", ende: "11-20" },
  pfifferling: { beginn: "06-01", hoehepunktBeginn: "07-01", hoehepunktEnde: "09-20", ende: "10-31" },
};
const REGEN_ZU_FRUEH = 0.35;
const REGEN_OHNE_AUSLOESER = 0.2;
const REGEN_ABKLINGEN = 0.6;
const BODENTEMP_IDEAL_MIN = 10;
const BODENTEMP_IDEAL_MAX = 18;
const BODENTEMP_NULL_UNTEN = 4;
const BODENTEMP_NULL_OBEN = 25;
const FEUCHTE_TROCKEN = 0.06; // Sandböden in Brandenburg trocknen stark aus
const FEUCHTE_GUT = 0.14;
const FEUCHTE_MINIMUM = 0.25;
const SAISON_AUSSERHALB = 0.05;
const SAISON_RAND = 0.6;
const FROST_TAGE = 3;
const FROST_LEICHT_C = 0;
const FROST_STARK_C = -3;
const FROST_LEICHT_FAKTOR = 0.6;
const FROST_STARK_FAKTOR = 0.2;
const MAX_INDEX = 100;

function linear(wert: number, von: number, bis: number): number {
  return Math.min(1, Math.max(0, (wert - von) / (bis - von)));
}

/** Regenmenge, ab der ein Regentag als Auslöser zählt: niedriger auf gut passenden Standorten.
 *  `stufe` ist die Habitat-Stufe der Stelle oder null, wenn sie unbekannt ist (dann gilt der strenge Wert). */
export function ausloeserFuerStufe(stufe: number | null): number {
  return stufe !== null && stufe >= STUFE_GUTER_STANDORT ? AUSLOESER_MM_GUTER_STANDORT : AUSLOESER_MM;
}

/** Tage seit dem letzten Regen-Auslöser bis zum Tag `position`.
 *  Auslöser ist ein Regentag, an dem die Summe der letzten AUSLOESER_TAGE Tage `ausloeserMm` erreicht. */
export function tageSeitAusloeser(tage: readonly Tageswetter[], position: number, ausloeserMm: number): number | null {
  for (let ende = position; ende >= 0; ende -= 1) {
    // Ohne Regen am Tag selbst wäre es nur das Nachklingen eines früheren Auslösers.
    if (tageswetter(tage, ende).regenMm <= 0) {
      continue;
    }
    let summe = 0;
    for (let tag = Math.max(0, ende - AUSLOESER_TAGE + 1); tag <= ende; tag += 1) {
      summe += tageswetter(tage, tag).regenMm;
    }
    if (summe >= ausloeserMm) {
      return position - ende;
    }
  }
  return null;
}

export function regenfaktor(pilz: Pilzart, tageSeit: number | null): number {
  if (tageSeit === null) {
    return REGEN_OHNE_AUSLOESER;
  }
  const latenz = LATENZ[pilz];
  if (tageSeit <= latenz.zuFruehBis) {
    return REGEN_ZU_FRUEH;
  }
  if (tageSeit < latenz.ernteAb) {
    return REGEN_ZU_FRUEH + (1 - REGEN_ZU_FRUEH) * linear(tageSeit, latenz.zuFruehBis, latenz.ernteAb);
  }
  if (tageSeit <= latenz.ernteBis) {
    return 1;
  }
  if (tageSeit <= latenz.abklingenBis) {
    return REGEN_ABKLINGEN;
  }
  return REGEN_OHNE_AUSLOESER;
}

export function bodentemperaturfaktor(gradC: number): number {
  if (gradC < BODENTEMP_IDEAL_MIN) {
    return linear(gradC, BODENTEMP_NULL_UNTEN, BODENTEMP_IDEAL_MIN);
  }
  if (gradC > BODENTEMP_IDEAL_MAX) {
    return 1 - linear(gradC, BODENTEMP_IDEAL_MAX, BODENTEMP_NULL_OBEN);
  }
  return 1;
}

export function bodenfeuchtefaktor(volumenanteil: number): number {
  return FEUCHTE_MINIMUM + (1 - FEUCHTE_MINIMUM) * linear(volumenanteil, FEUCHTE_TROCKEN, FEUCHTE_GUT);
}

export function saisonfaktor(pilz: Pilzart, datum: string): number {
  const tag = datum.slice(5);
  const saison = SAISON[pilz];
  if (tag < saison.beginn || tag > saison.ende) {
    return SAISON_AUSSERHALB;
  }
  if (tag < saison.hoehepunktBeginn || tag > saison.hoehepunktEnde) {
    return SAISON_RAND;
  }
  return 1;
}

export function frostfaktor(tage: readonly Tageswetter[], position: number): number {
  let kaeltester = Number.POSITIVE_INFINITY;
  for (let tag = Math.max(0, position - FROST_TAGE + 1); tag <= position; tag += 1) {
    kaeltester = Math.min(kaeltester, tageswetter(tage, tag).lufttempMinC);
  }
  if (kaeltester <= FROST_STARK_C) {
    return FROST_STARK_FAKTOR;
  }
  if (kaeltester < FROST_LEICHT_C) {
    return FROST_LEICHT_FAKTOR;
  }
  return 1;
}

function tageswetter(tage: readonly Tageswetter[], position: number): Tageswetter {
  const tag = tage[position];
  if (tag === undefined) {
    throw new Error(`Invariante verletzt: kein Wettertag an Position ${String(position)} von ${String(tage.length)}`);
  }
  return tag;
}

/** Index für den Tag an `position`; die Tage davor liefern Regen-Auslöser und Frost. */
export function tagesindex(tage: readonly Tageswetter[], position: number, bedingungen: Indexbedingungen): Tagesindex {
  const tag = tageswetter(tage, position);
  const { pilz, ausloeserMm } = bedingungen;
  const seit = tageSeitAusloeser(tage, position, ausloeserMm);
  const faktoren: Indexfaktoren = {
    regen: regenfaktor(pilz, seit),
    bodentemperatur: bodentemperaturfaktor(tag.bodentempC),
    bodenfeuchte: bodenfeuchtefaktor(tag.bodenfeuchte),
    saison: saisonfaktor(pilz, tag.datum),
    frost: frostfaktor(tage, position),
  };
  const produkt =
    faktoren.regen * faktoren.bodentemperatur * faktoren.bodenfeuchte * faktoren.saison * faktoren.frost;
  return { datum: tag.datum, index: Math.round(MAX_INDEX * produkt), faktoren, tageSeitAusloeser: seit };
}

/** Indizes ab dem Tag `heute` bis zum letzten Tag der Reihe (Prognose). */
export function indexverlauf(tage: readonly Tageswetter[], heute: number, bedingungen: Indexbedingungen): Tagesindex[] {
  const verlauf: Tagesindex[] = [];
  for (let position = heute; position < tage.length; position += 1) {
    verlauf.push(tagesindex(tage, position, bedingungen));
  }
  return verlauf;
}

const INDEX_WORTE: readonly { readonly ab: number; readonly wort: string }[] = [
  { ab: 80, wort: "Sehr günstig" },
  { ab: 60, wort: "Günstig" },
  { ab: 40, wort: "Mittel" },
  { ab: 20, wort: "Mäßig" },
  { ab: 0, wort: "Ungünstig" },
];

export function indexWort(index: number): string {
  const treffer = INDEX_WORTE.find((stufe) => index >= stufe.ab);
  if (treffer === undefined) {
    throw new Error(`Invariante verletzt: Index ${String(index)} ist negativ`);
  }
  return treffer.wort;
}
