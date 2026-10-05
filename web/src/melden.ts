// Melde-Ablauf: Knopf (nur mit GPS-Standort), Formular, Speichern im Handy, Liste mit Link zum GitHub-Issue.
// Rand-Modul (Bedienelemente und Browser-Speicher); die Regeln für Prüfung und Issue-Text stehen in meldung.ts.
import { element } from "./ansicht.ts";
import { KANAL_JE_PILZ, pixelAnStelle, type Standort } from "./geo.ts";
import { findeHotspots, flaecheAnStelle, type Hotspot, type Hotspotart } from "./hotspots.ts";
import type { Kartenebene } from "./karte.ts";
import {
  ERGEBNIS_FUND,
  issueUrl,
  koordinatentext,
  kurztext,
  MAX_GENAUIGKEIT_METER,
  PILZE,
  pruefeMeldung,
  type Meldung,
  type Modellwerte,
} from "./meldung.ts";
import {
  ladeMeldungen,
  loescheMeldung,
  markiereGeoeffnet,
  speichereMeldung,
  type GespeicherteMeldungen,
  type Speicher,
} from "./clients/meldespeicher.ts";
import type { Pilzart } from "./wachstum.ts";

const KANAELE_PRO_PIXEL = 4;
const MAX_ALTER_STANDORT_MS = 60_000; // ein älterer GPS-Wert gilt als nicht mehr aktuell
const AUFFRISCHEN_MS = 10_000;
const NACHKOMMA_KOORDINATE = 5;

export interface Meldeumgebung {
  readonly ebenen: readonly Kartenebene[];
  readonly aktuellePilzart: () => Pilzart;
  /** Art des Umrisses für eine Fläche aus dem Wetter an ihrer Stelle (heute / letzte Tage) oder null. */
  readonly ringart: (flaeche: Hotspot, pilz: Pilzart) => Promise<Hotspotart | null>;
  /** Wachstumsindex heute an einer Stelle für eine Pilzart. */
  readonly indexHeute: (stelle: Standort, pilz: Pilzart) => Promise<number>;
  readonly speicher: Speicher;
}

function runden(wert: number): number {
  return Number(wert.toFixed(NACHKOMMA_KOORDINATE));
}

/** Habitat-Stufe, Lage zu den Umrissen und Wachstumsindex an der Stelle; hinweis nennt, was nicht ermittelt wurde. */
async function bewerteStelle(
  umgebung: Meldeumgebung,
  stelle: Standort,
  pilz: Pilzart,
): Promise<{ readonly modell: Modellwerte; readonly hinweis: string | null }> {
  const treffer = umgebung.ebenen
    .map((ebene) => ({ ebene, pixel: pixelAnStelle(ebene.gebiet, stelle.laenge, stelle.breite) }))
    .find((kandidat) => kandidat.pixel !== null);
  if (treffer === undefined || treffer.pixel === null) {
    return { modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null }, hinweis: null };
  }
  const { ebene, pixel } = treffer;
  const kanal = KANAL_JE_PILZ[pilz];
  const start = (pixel.zeile * ebene.gebiet.breitePixel + pixel.spalte) * KANAELE_PRO_PIXEL;
  const stufe = ebene.daten.data[start + kanal];
  if (stufe === undefined) {
    throw new Error(`Invariante verletzt: Pixel ${String(pixel.spalte)}/${String(pixel.zeile)} außerhalb der Daten`);
  }
  const flaeche = flaecheAnStelle(ebene.gebiet, pixel, findeHotspots({ daten: ebene.daten.data, kanal, gebiet: ebene.gebiet }));
  try {
    const wachstumsindex = Math.round(await umgebung.indexHeute(stelle, pilz));
    let brennpunkt: Modellwerte["brennpunkt"] = "keiner";
    if (flaeche !== null) {
      brennpunkt = (await umgebung.ringart(flaeche, pilz)) ?? "flaeche-index-zu-niedrig";
    }
    return { modell: { gebiet: ebene.gebiet.name, stufe, brennpunkt, wachstumsindex }, hinweis: null };
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return {
      modell: { gebiet: ebene.gebiet.name, stufe, brennpunkt: null, wachstumsindex: null },
      hinweis: `Das Wetter war nicht ladbar, die Meldung wurde ohne Wachstumsindex gespeichert (${grund}).`,
    };
  }
}

function feld(daten: FormData, name: string): string {
  const wert = daten.get(name);
  if (typeof wert !== "string") {
    throw new Error(`Invariante verletzt: Formularfeld ${name} fehlt`);
  }
  return wert;
}

function mehrfach(daten: FormData, name: string): string[] {
  return daten.getAll(name).filter((wert): wert is string => typeof wert === "string");
}

function standortStatus(standort: Standort | null, jetztMs: number): { readonly isBereit: boolean; readonly text: string } {
  if (standort === null) {
    return { isBereit: false, text: "GPS ist aus. Tippen Sie auf den Standort-Knopf rechts oben, dann kann gemeldet werden." };
  }
  const genauigkeit = Math.round(standort.genauigkeitMeter);
  if (jetztMs - standort.zeitpunktMs > MAX_ALTER_STANDORT_MS) {
    return { isBereit: false, text: "Der GPS-Standort ist veraltet. Bitte kurz warten oder den Standort-Knopf erneut tippen." };
  }
  if (standort.genauigkeitMeter > MAX_GENAUIGKEIT_METER) {
    return {
      isBereit: false,
      text: `GPS zu ungenau (±${String(genauigkeit)} m, nötig ±${String(MAX_GENAUIGKEIT_METER)} m). Bitte einen Moment unter freiem Himmel warten.`,
    };
  }
  return { isBereit: true, text: `GPS bereit (±${String(genauigkeit)} m).` };
}

function zeigeListe(liste: HTMLElement, gespeichert: GespeicherteMeldungen): void {
  const eintraege: HTMLElement[] = gespeichert.meldungen.map(({ meldung, geoeffnetAm }) => {
    const punkt = document.createElement("li");
    punkt.className = "melde-eintrag";
    const beschreibung = document.createElement("span");
    beschreibung.className = "melde-text";
    const stand = geoeffnetAm === null ? "noch nicht gesendet" : "Issue geöffnet";
    beschreibung.textContent = `${kurztext(meldung)} · ${koordinatentext(meldung.breite, meldung.laenge)} · ${stand}`;
    const senden = document.createElement("a");
    senden.className = "knopf knopf-klein";
    senden.href = issueUrl(meldung);
    senden.target = "_blank";
    senden.rel = "noopener";
    senden.textContent = geoeffnetAm === null ? "Senden" : "Erneut senden";
    senden.dataset["aktion"] = "senden";
    senden.dataset["id"] = meldung.id;
    const loeschen = document.createElement("button");
    loeschen.type = "button";
    loeschen.className = "knopf knopf-klein";
    loeschen.textContent = "Löschen";
    loeschen.dataset["aktion"] = "loeschen";
    loeschen.dataset["id"] = meldung.id;
    punkt.append(beschreibung, senden, loeschen);
    return punkt;
  });
  const defekte = gespeichert.unlesbar.map(({ schluessel, grund }) => {
    const punkt = document.createElement("li");
    punkt.className = "melde-eintrag melde-defekt";
    punkt.textContent = `Eintrag ${schluessel} ist unlesbar (${grund}). Er bleibt im Handy erhalten.`;
    return punkt;
  });
  liste.replaceChildren(...eintraege, ...defekte);
}

/** Richtet Knopf, Formular und Liste ein; die Rückgabe wird bei jedem neuen GPS-Standort der Karte aufgerufen. */
export function richteMeldenEin(umgebung: Meldeumgebung): (neuerStandort: Standort) => void {
  const knopf = element("melde-knopf", HTMLButtonElement);
  const status = element("melde-status", HTMLElement);
  const liste = element("melde-liste", HTMLElement);
  const dialog = element("meldedialog", HTMLDialogElement);
  const formular = element("meldeformular", HTMLFormElement);
  const standortText = element("melde-standort", HTMLElement);
  const fehlerText = element("melde-fehler", HTMLElement);
  const abbrechen = element("melde-abbrechen", HTMLButtonElement);
  const speichern = element("melde-speichern", HTMLButtonElement);
  const groesse = element("melde-groesse", HTMLFieldSetElement);
  let standort: Standort | null = null;
  let hinweisNachSpeichern = "";

  const zeigeMeldungen = (): void => {
    const gespeichert = ladeMeldungen(umgebung.speicher);
    zeigeListe(liste, gespeichert);
    const offen = gespeichert.meldungen.filter(({ geoeffnetAm }) => geoeffnetAm === null).length;
    const lage = standortStatus(standort, Date.now());
    const offenText = offen === 0 ? "" : `${String(offen)} Meldung(en) noch nicht gesendet.`;
    status.textContent = [hinweisNachSpeichern, lage.text, offenText].filter((teil) => teil !== "").join(" ");
    knopf.disabled = !lage.isBereit;
  };

  const stelleGroesseEin = (): void => {
    const isFund = new FormData(formular).get("ergebnis") === ERGEBNIS_FUND;
    groesse.hidden = !isFund;
    groesse.disabled = !isFund; // deaktivierte Felder werden weder geprüft noch gesendet
  };

  knopf.addEventListener("click", () => {
    const jetzt = standortStatus(standort, Date.now());
    if (standort === null || !jetzt.isBereit) {
      zeigeMeldungen();
      return;
    }
    formular.reset();
    const pilzfeld = formular.querySelector(`input[name="pilz"][value="${umgebung.aktuellePilzart()}"]`);
    if (pilzfeld instanceof HTMLInputElement) {
      pilzfeld.checked = true;
    }
    standortText.textContent = `${koordinatentext(standort.breite, standort.laenge)} (GPS ±${String(Math.round(standort.genauigkeitMeter))} m)`;
    formular.dataset["breite"] = String(standort.breite);
    formular.dataset["laenge"] = String(standort.laenge);
    formular.dataset["genauigkeit"] = String(standort.genauigkeitMeter);
    fehlerText.textContent = "";
    stelleGroesseEin();
    dialog.showModal();
  });
  formular.addEventListener("change", () => {
    stelleGroesseEin();
    fehlerText.textContent = "";
  });
  abbrechen.addEventListener("click", () => {
    dialog.close();
  });

  formular.addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    const daten = new FormData(formular);
    const stelle: Standort = {
      breite: Number(formular.dataset["breite"]),
      laenge: Number(formular.dataset["laenge"]),
      genauigkeitMeter: Number(formular.dataset["genauigkeit"]),
      zeitpunktMs: Date.now(),
    };
    if (mehrfach(daten, "kronendach").length === 0 || mehrfach(daten, "unterstand").length === 0) {
      fehlerText.textContent = "Bitte mindestens eine Baumart im Kronendach und eine Angabe zum Unterstand wählen.";
      return;
    }
    speichern.disabled = true;
    fehlerText.textContent = "";
    void (async (): Promise<void> => {
      try {
        const pilz = PILZE.find((kandidat) => kandidat === feld(daten, "pilz"));
        if (pilz === undefined) {
          throw new Error(`Invariante verletzt: unbekannte Pilzart ${feld(daten, "pilz")}`);
        }
        const bewertung = await bewerteStelle(umgebung, stelle, pilz);
        const meldung: Meldung = pruefeMeldung({
          id: `m${String(stelle.zeitpunktMs)}`,
          zeitpunkt: new Date(stelle.zeitpunktMs).toISOString(),
          breite: runden(stelle.breite),
          laenge: runden(stelle.laenge),
          genauigkeitMeter: Math.round(stelle.genauigkeitMeter),
          ergebnis: feld(daten, "ergebnis"),
          pilz,
          groesse: feld(daten, "ergebnis") === ERGEBNIS_FUND ? feld(daten, "groesse") : null,
          kronendach: mehrfach(daten, "kronendach"),
          unterstand: mehrfach(daten, "unterstand"),
          bestandsalter: feld(daten, "bestandsalter"),
          dichte: feld(daten, "dichte"),
          notiz: feld(daten, "notiz").trim(),
          modell: bewertung.modell,
        });
        speichereMeldung(umgebung.speicher, meldung);
        hinweisNachSpeichern = [`Gespeichert: ${kurztext(meldung)}.`, bewertung.hinweis ?? ""].filter((teil) => teil !== "").join(" ");
        dialog.close();
        zeigeMeldungen();
      } catch (fehler) {
        fehlerText.textContent = fehler instanceof Error ? fehler.message : String(fehler);
      } finally {
        speichern.disabled = false;
      }
    })();
  });

  liste.addEventListener("click", (ereignis) => {
    const ziel = ereignis.target instanceof Element ? ereignis.target.closest("[data-aktion]") : null;
    if (!(ziel instanceof HTMLElement)) {
      return;
    }
    const id = ziel.dataset["id"];
    if (id === undefined) {
      return;
    }
    if (ziel.dataset["aktion"] === "senden") {
      markiereGeoeffnet(umgebung.speicher, id, new Date());
      window.setTimeout(zeigeMeldungen, 0); // erst nach dem Öffnen des Links neu zeichnen
    } else if (ziel.dataset["aktion"] === "loeschen" && window.confirm("Diese Meldung wirklich aus dem Handy löschen?")) {
      loescheMeldung(umgebung.speicher, id);
      zeigeMeldungen();
    }
  });

  window.setInterval(zeigeMeldungen, AUFFRISCHEN_MS);
  zeigeMeldungen();
  return (neuerStandort) => {
    standort = neuerStandort;
    zeigeMeldungen();
  };
}

