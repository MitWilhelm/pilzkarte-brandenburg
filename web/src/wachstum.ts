// Wachstumsindex (0–100) für Steinpilz und Pfifferling aus Tageswetter – reine Funktionen, kein I/O.
// Idee: Regen der letzten ~3 Wochen wirkt stufenlos (am stärksten 1–2 Wochen danach); feuchter Boden bei
// 10–17 °C trägt auch ohne Regen einen mittleren Index; warm und trocken bremst stark (docs/decisions.md).
// Alle Schwellen sind Fachwissen-Annahmen (docs/decisions.md), nicht mit Funden kalibriert.

export type Pilzart = "steinpilz" | "pfifferling";

export interface Tageswetter {
  readonly datum: string; // JJJJ-MM-TT, Ortszeit Europe/Berlin
  readonly regenMm: number;
  readonly lufttempMinC: number;
  readonly lufttempMittelC: number;
  readonly bodentempC: number; // Tagesmittel in 6 cm Tiefe
  readonly bodenfeuchte: number; // m³/m³ in 3–9 cm Tiefe
}

export interface Indexfaktoren {
  readonly regen: number;
  readonly temperatur: number;
  readonly bodenfeuchte: number;
  readonly saison: number;
  readonly frost: number;
  readonly hitze: number;
}

export interface Tagesindex {
  readonly datum: string;
  readonly index: number;
  readonly faktoren: Indexfaktoren;
  readonly wirksamerRegenMm: number;
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

const LATENZ: Readonly<Record<Pilzart, Latenz>> = {
  steinpilz: { zuFruehBis: 4, ernteAb: 7, ernteBis: 14, abklingenBis: 21 },
  pfifferling: { zuFruehBis: 5, ernteAb: 9, ernteBis: 18, abklingenBis: 26 },
};
const SAISON: Readonly<Record<Pilzart, Saison>> = {
  steinpilz: { beginn: "06-20", hoehepunktBeginn: "08-10", hoehepunktEnde: "10-20", ende: "11-20" },
  pfifferling: { beginn: "06-01", hoehepunktBeginn: "07-01", hoehepunktEnde: "09-20", ende: "10-31" },
};
// Gewicht eines Regentags nach Abstand in Tagen (Latenz): früh wenig, 1–2 Wochen danach voll, dann abklingend.
const GEWICHT_ZU_FRUEH = 0.35;
const GEWICHT_ABKLINGEN = 0.6;
const REGEN_VOLL_MM = 20; // so viel wirksamer Regen ergibt den vollen Regenfaktor (Salerni 2023: ab ~20 mm)
const REGEN_GRUND = 0.2; // ohne Regen und ohne günstigen Boden
const REGEN_GRUND_GUTER_BODEN = 0.5; // ohne Regen, aber feuchter Boden bei 10–17 °C: mittlerer Index
// Lufttemperatur (5-Tage-Mittel): Funde bei Bielefeld meist 7–19 °C, Optimum 13,2 °C (Brejon Lamartinière &
// Hoffman 2025, Preprint); kühle Fruchtmonate günstig (Tahvanainen et al. 2016). Plateau um das Optimum, stufenlos.
const LUFT_OPTIMAL_MIN_C = 11;
const LUFT_OPTIMAL_MAX_C = 15.5;
const LUFT_GRENZE_UNTEN_C = 5;
const LUFT_GRENZE_OBEN_C = 21;
const LUFT_MINDESTFAKTOR = 0.2; // keine harte Null: Funde gab es auch außerhalb von 7–19 °C
const MITTEL_TAGE = 5; // Fenster wie in der Bielefeld-Studie (5 Tage vor dem Fund)
const HITZE_AB_C = 17.5; // Bielefeld: über 17,5 °C und unter 1 mm/Tag keine Funde
const TROCKEN_UNTER_MM_PRO_TAG = 1;
const HITZE_TROCKEN_FAKTOR = 0.2;
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

function regengewicht(pilz: Pilzart, abstandTage: number): number {
  const latenz = LATENZ[pilz];
  if (abstandTage <= latenz.zuFruehBis) {
    return GEWICHT_ZU_FRUEH;
  }
  if (abstandTage < latenz.ernteAb) {
    return GEWICHT_ZU_FRUEH + (1 - GEWICHT_ZU_FRUEH) * linear(abstandTage, latenz.zuFruehBis, latenz.ernteAb);
  }
  if (abstandTage <= latenz.ernteBis) {
    return 1;
  }
  if (abstandTage <= latenz.abklingenBis) {
    return GEWICHT_ABKLINGEN;
  }
  return 0;
}

/** Regen der zurückliegenden Tage, gewichtet nach Abstand zum Tag `position` (mm). */
export function wirksamerRegen(tage: readonly Tageswetter[], position: number, pilz: Pilzart): number {
  let summe = 0;
  for (let tag = Math.max(0, position - LATENZ[pilz].abklingenBis); tag <= position; tag += 1) {
    summe += tageswetter(tage, tag).regenMm * regengewicht(pilz, position - tag);
  }
  return summe;
}

function mittelDerLetztenTage(tage: readonly Tageswetter[], position: number, wertVon: (tag: Tageswetter) => number): number {
  let summe = 0;
  let anzahl = 0;
  for (let tag = Math.max(0, position - MITTEL_TAGE + 1); tag <= position; tag += 1) {
    summe += wertVon(tageswetter(tage, tag));
    anzahl += 1;
  }
  return summe / anzahl;
}

/** Stufenloser Regenfaktor: Grundwert plus Anteil des wirksamen Regens.
 *  `bodenanteil` (0–1): wie günstig es ohne Regen ist; 1 = feuchter Boden bei 11–15,5 °C, hebt den Grundwert auf „mittel“. */
export function regenfaktor(wirksamerRegenMm: number, bodenanteil: number): number {
  const grund = REGEN_GRUND + (REGEN_GRUND_GUTER_BODEN - REGEN_GRUND) * bodenanteil;
  return grund + (1 - grund) * linear(wirksamerRegenMm, 0, REGEN_VOLL_MM);
}

/** Warm und trocken (5-Tage-Mittel) bremst stark. */
export function hitzefaktor(luftMittelC: number, regenMmProTag: number): number {
  return luftMittelC > HITZE_AB_C && regenMmProTag < TROCKEN_UNTER_MM_PRO_TAG ? HITZE_TROCKEN_FAKTOR : 1;
}

/** 1 im Bereich um das Optimum, darunter und darüber linear bis LUFT_MINDESTFAKTOR. */
export function temperaturfaktor(luftMittelC: number): number {
  if (luftMittelC < LUFT_OPTIMAL_MIN_C) {
    return LUFT_MINDESTFAKTOR + (1 - LUFT_MINDESTFAKTOR) * linear(luftMittelC, LUFT_GRENZE_UNTEN_C, LUFT_OPTIMAL_MIN_C);
  }
  if (luftMittelC > LUFT_OPTIMAL_MAX_C) {
    return 1 - (1 - LUFT_MINDESTFAKTOR) * linear(luftMittelC, LUFT_OPTIMAL_MAX_C, LUFT_GRENZE_OBEN_C);
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

/** Index für den Tag an `position`; die Tage davor liefern Regen, Mittelwerte und Frost. */
export function tagesindex(tage: readonly Tageswetter[], position: number, pilz: Pilzart): Tagesindex {
  const tag = tageswetter(tage, position);
  const luftMittel = mittelDerLetztenTage(tage, position, (eintrag) => eintrag.lufttempMittelC);
  const regenProTag = mittelDerLetztenTage(tage, position, (eintrag) => eintrag.regenMm);
  const temperatur = temperaturfaktor(luftMittel);
  // Feuchte und Temperatur stufenlos, damit kleine Änderungen den Index nicht springen lassen.
  const bodenanteil = linear(tag.bodenfeuchte, FEUCHTE_TROCKEN, FEUCHTE_GUT) * temperatur;
  const wirksam = wirksamerRegen(tage, position, pilz);
  const faktoren: Indexfaktoren = {
    regen: regenfaktor(wirksam, bodenanteil),
    temperatur,
    bodenfeuchte: bodenfeuchtefaktor(tag.bodenfeuchte),
    saison: saisonfaktor(pilz, tag.datum),
    frost: frostfaktor(tage, position),
    hitze: hitzefaktor(luftMittel, regenProTag),
  };
  const produkt =
    faktoren.regen *
    faktoren.temperatur *
    faktoren.bodenfeuchte *
    faktoren.saison *
    faktoren.frost *
    faktoren.hitze;
  return { datum: tag.datum, index: Math.round(MAX_INDEX * produkt), faktoren, wirksamerRegenMm: wirksam };
}

/** Indizes ab dem Tag `heute` bis zum letzten Tag der Reihe (Prognose). */
export function indexverlauf(tage: readonly Tageswetter[], heute: number, pilz: Pilzart): Tagesindex[] {
  const verlauf: Tagesindex[] = [];
  for (let position = heute; position < tage.length; position += 1) {
    verlauf.push(tagesindex(tage, position, pilz));
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
