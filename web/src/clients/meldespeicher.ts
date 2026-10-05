// Speichert Meldungen im Browser des Handys (localStorage), damit sie auch ohne Netz im Wald nicht verloren gehen.
// Jede Meldung liegt unter einem eigenen Schlüssel: Ist eine beschädigt, bleiben die anderen les- und sendbar.
// Kein Netzwerk; der Speicher wird übergeben (im Browser window.localStorage), damit Tests ihn ersetzen können.
import { pruefeMeldung, type Meldung } from "../meldung.ts";

export type Speicher = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export interface GespeicherteMeldung {
  readonly meldung: Meldung;
  readonly geoeffnetAm: string | null; // wann das GitHub-Issue zuletzt geöffnet wurde (nicht: abgeschickt)
}

export interface UnlesbarerEintrag {
  readonly schluessel: string;
  readonly grund: string;
}

export interface GespeicherteMeldungen {
  readonly meldungen: readonly GespeicherteMeldung[]; // neueste zuerst
  readonly unlesbar: readonly UnlesbarerEintrag[]; // beschädigte Einträge mit Ursache
}

const PRAEFIX_MELDUNG = "pilzkarte-meldung:";
const PRAEFIX_GEOEFFNET = "pilzkarte-geoeffnet:";

function schluesselVon(speicher: Speicher): string[] {
  const schluessel: string[] = [];
  for (let nummer = 0; nummer < speicher.length; nummer += 1) {
    const name = speicher.key(nummer);
    if (name !== null) {
      schluessel.push(name);
    }
  }
  return schluessel;
}

export function speichereMeldung(speicher: Speicher, meldung: Meldung): void {
  try {
    speicher.setItem(`${PRAEFIX_MELDUNG}${meldung.id}`, JSON.stringify(meldung));
  } catch (fehler) {
    throw new Error("Speichern im Handy nicht möglich (Speicher voll oder gesperrt)", { cause: fehler });
  }
}

export function markiereGeoeffnet(speicher: Speicher, id: string, zeitpunkt: Date): void {
  try {
    speicher.setItem(`${PRAEFIX_GEOEFFNET}${id}`, zeitpunkt.toISOString());
  } catch (fehler) {
    throw new Error("Vermerk im Handy nicht möglich (Speicher voll oder gesperrt)", { cause: fehler });
  }
}

export function loescheMeldung(speicher: Speicher, id: string): void {
  speicher.removeItem(`${PRAEFIX_MELDUNG}${id}`);
  speicher.removeItem(`${PRAEFIX_GEOEFFNET}${id}`);
}

export function ladeMeldungen(speicher: Speicher): GespeicherteMeldungen {
  const meldungen: GespeicherteMeldung[] = [];
  const unlesbar: UnlesbarerEintrag[] = [];
  for (const schluessel of schluesselVon(speicher)) {
    if (!schluessel.startsWith(PRAEFIX_MELDUNG)) {
      continue;
    }
    try {
      const inhalt = speicher.getItem(schluessel);
      if (inhalt === null) {
        continue;
      }
      const parsed: unknown = JSON.parse(inhalt);
      const meldung = pruefeMeldung(parsed);
      meldungen.push({ meldung, geoeffnetAm: speicher.getItem(`${PRAEFIX_GEOEFFNET}${meldung.id}`) });
    } catch (fehler) {
      // Beschädigter Eintrag: nicht löschen (die Rohdaten bleiben erhalten), aber mit Ursache melden.
      unlesbar.push({ schluessel, grund: fehler instanceof Error ? fehler.message : String(fehler) });
    }
  }
  meldungen.sort((erste, zweite) => Date.parse(zweite.meldung.zeitpunkt) - Date.parse(erste.meldung.zeitpunkt));
  return { meldungen, unlesbar };
}
