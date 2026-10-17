// Schickt eine Meldung an den Cloudflare-Worker, der daraus ein GitHub-Issue anlegt (Anleitung: docs/anleitung-cloudflare-worker.md).
// Rate-Limit: keines auf unserer Seite; der Worker prüft Herkunft, Größe und Werte jeder Meldung. Kein Wiederholen:
// Ein zweiter Versuch nach einer unklaren Antwort könnte ein doppeltes Issue anlegen, deshalb entscheidet der Nutzer.
import type { Meldung } from "../meldung.ts";

export const MELDE_WORKER_URL = "https://pilzkarte-meldungen.timw-andreae.workers.dev";

export type Abruf = (url: string, optionen: RequestInit) => Promise<Response>;

function nummerAusAntwort(inhalt: unknown): number {
  if (typeof inhalt === "object" && inhalt !== null && "ok" in inhalt && inhalt.ok === true && "nummer" in inhalt) {
    const nummer = inhalt.nummer;
    if (typeof nummer === "number" && Number.isInteger(nummer) && nummer > 0) {
      return nummer;
    }
  }
  throw new Error(`Invariante verletzt: Worker-Antwort ohne ok und Issue-Nummer: ${JSON.stringify(inhalt)}`);
}

/** Sendet die Meldung und liefert die Nummer des angelegten Issues; Fehler tragen Status oder Ursache im Text. */
export async function sendeAnWorker(meldung: Meldung, abruf: Abruf = (url, optionen) => fetch(url, optionen)): Promise<number> {
  let antwort: Response;
  try {
    antwort = await abruf(MELDE_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meldung),
    });
  } catch (fehler) {
    throw new Error("Meldeserver nicht erreichbar (kein Netz?)", { cause: fehler });
  }
  let inhalt: unknown;
  try {
    inhalt = await antwort.json();
  } catch (fehler) {
    throw new Error(`Meldeserver antwortet mit Status ${String(antwort.status)} ohne lesbaren Inhalt`, { cause: fehler });
  }
  if (!antwort.ok) {
    const grund = typeof inhalt === "object" && inhalt !== null && "fehler" in inhalt ? String(inhalt.fehler) : "unbekannt";
    throw new Error(`Meldeserver lehnt ab (Status ${String(antwort.status)}): ${grund}`);
  }
  return nummerAusAntwort(inhalt);
}
