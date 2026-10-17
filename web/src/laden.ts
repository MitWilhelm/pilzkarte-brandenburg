// Fortschritt des Ladens (reine Berechnung): ein Anteil von 0 bis 1 und der Text dazu, für den Ladeschleier der Seite.
// Gewicht: Die grobe Vorschau zählt ANTEIL_VORSCHAU, die Kacheln teilen sich den Rest zu gleichen Teilen.

export const ANTEIL_VORSCHAU = 0.12;

/** Anteil 0 bis 1 des Gesamtladens; mit der Vorschau beginnt er bei ANTEIL_VORSCHAU, nach allen Kacheln ist er 1. */
export function ladeanteil(isVorschauFertig: boolean, kachelnFertig: number, kachelnGesamt: number): number {
  if (kachelnGesamt <= 0) {
    throw new Error(`Invariante verletzt: ${String(kachelnGesamt)} Kacheln insgesamt`);
  }
  if (kachelnFertig < 0 || kachelnFertig > kachelnGesamt) {
    throw new Error(`Invariante verletzt: ${String(kachelnFertig)} von ${String(kachelnGesamt)} Kacheln fertig`);
  }
  const vorschau = isVorschauFertig ? ANTEIL_VORSCHAU : 0;
  return vorschau + (1 - ANTEIL_VORSCHAU) * (kachelnFertig / kachelnGesamt);
}

const PHASEN: readonly { readonly ab: number; readonly text: string }[] = [
  { ab: 1, text: "Fertig" },
  { ab: 0.6, text: "Gleich geschafft …" },
  { ab: 0.3, text: "Waldstücke werden bewertet …" },
  { ab: 0.1, text: "Karte wird aufgebaut …" },
  { ab: 0, text: "Barnim wird geöffnet …" },
];

export function ladetext(anteil: number): string {
  const phase = PHASEN.find((eintrag) => anteil >= eintrag.ab);
  if (phase === undefined) {
    throw new Error(`Invariante verletzt: Ladeanteil ${String(anteil)} ist negativ`);
  }
  return phase.text;
}
