// Tutorial beim ersten Öffnen: reine Schrittlogik (welcher Schritt kommt als nächster, wie heißt der Fortschritt).
// Kein DOM, kein Speicher; die Anzeige steht in tutorialansicht.ts, der Merker in clients/tutorialspeicher.ts.
export type Richtung = "vor" | "zurueck";

function pruefeSchritt(aktuell: number, anzahl: number): void {
  if (!Number.isInteger(anzahl) || anzahl < 1) {
    throw new Error(`Invariante verletzt: Tutorial mit ${String(anzahl)} Schritten`);
  }
  if (!Number.isInteger(aktuell) || aktuell < 0 || aktuell >= anzahl) {
    throw new Error(`Invariante verletzt: Tutorial-Schritt ${String(aktuell)} von ${String(anzahl)}`);
  }
}

/** Der Schritt nach "vor" oder "zurueck"; am Anfang und Ende bleibt es beim ersten bzw. letzten Schritt. */
export function naechsterSchritt(aktuell: number, anzahl: number, richtung: Richtung): number {
  pruefeSchritt(aktuell, anzahl);
  const ziel = richtung === "vor" ? aktuell + 1 : aktuell - 1;
  return Math.min(Math.max(ziel, 0), anzahl - 1);
}

export function istLetzterSchritt(aktuell: number, anzahl: number): boolean {
  pruefeSchritt(aktuell, anzahl);
  return aktuell === anzahl - 1;
}

export function fortschrittText(aktuell: number, anzahl: number): string {
  pruefeSchritt(aktuell, anzahl);
  return `Schritt ${String(aktuell + 1)} von ${String(anzahl)}`;
}
