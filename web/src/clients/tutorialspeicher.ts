// Merkt im Browser (localStorage), dass das Tutorial gezeigt wurde. Kein Netzwerk. Der Speicher wird übergeben
// (im Browser window.localStorage), damit Tests ihn ersetzen können. localStorage kann fehlen oder werfen (privater
// Modus, gesperrte Website-Daten): Dann gilt das Tutorial als nicht gesehen und erscheint beim nächsten Mal wieder.
export type Speicher = Pick<Storage, "getItem" | "setItem">;

// Der Schlüssel trägt eine Version: Bei grundlegenden Änderungen am Tutorial genügt eine neue Nummer,
// damit es allen noch einmal gezeigt wird.
const SCHLUESSEL = "pilzkarte-tutorial-v1";
const GESEHEN = "1";

export function warTutorialGesehen(speicher: Speicher): boolean {
  try {
    return speicher.getItem(SCHLUESSEL) === GESEHEN;
  } catch (fehler) {
    console.warn("Tutorial-Merker nicht lesbar, das Tutorial wird gezeigt", fehler);
    return false;
  }
}

export function merkeTutorialGesehen(speicher: Speicher): void {
  try {
    speicher.setItem(SCHLUESSEL, GESEHEN);
  } catch (fehler) {
    console.warn("Tutorial-Merker nicht speicherbar, das Tutorial erscheint beim nächsten Öffnen wieder", fehler);
  }
}
