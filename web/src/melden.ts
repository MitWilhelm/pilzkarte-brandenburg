// Melde-Ablauf: Knopf (nur mit GPS-Standort und Internet), Formular, Senden über den Meldeserver (ohne GitHub-Konto),
// Liste der bisherigen Meldungen. Ohne Internet ist Melden nicht möglich: Eine Meldung wird erst beim erfolgreichen
// Senden im Handy vermerkt, nie vorher.
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
  markiereGesendet,
  speichereMeldung,
  type GesendeteMeldung,
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
  /** Sendet die Meldung an den Meldeserver und liefert die Nummer des angelegten GitHub-Issues. */
  readonly sende: (meldung: Meldung) => Promise<number>;
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

function meldeStand(gesendet: GesendeteMeldung | null, geoeffnetAm: string | null): string {
  if (gesendet !== null) {
    return `gesendet (Issue #${String(gesendet.issueNummer)})`;
  }
  return geoeffnetAm === null ? "noch nicht gesendet" : "GitHub-Issue geöffnet";
}

function meldeKnopf(beschriftung: string, aktion: string, id: string): HTMLButtonElement {
  const knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "knopf knopf-klein";
  knopf.textContent = beschriftung;
  knopf.dataset["aktion"] = aktion;
  knopf.dataset["id"] = id;
  return knopf;
}

/** Melden braucht GPS und Internet; ohne Internet bleibt der Knopf aus und der Text sagt es. */
function meldeLage(standort: Standort | null, jetztMs: number, isOnline: boolean): { readonly isBereit: boolean; readonly text: string } {
  if (!isOnline) {
    return { isBereit: false, text: "Kein Internet: Melden geht nur mit Internet und GPS." };
  }
  return standortStatus(standort, jetztMs);
}

function zeigeListe(liste: HTMLElement, gespeichert: GespeicherteMeldungen): void {
  const eintraege: HTMLElement[] = gespeichert.meldungen.map(({ meldung, geoeffnetAm, gesendet }) => {
    const punkt = document.createElement("li");
    punkt.className = "melde-eintrag";
    const beschreibung = document.createElement("span");
    beschreibung.className = "melde-text";
    beschreibung.textContent = `${kurztext(meldung)} · ${koordinatentext(meldung.breite, meldung.laenge)} · ${meldeStand(gesendet, geoeffnetAm)}`;
    punkt.append(beschreibung);
    if (gesendet === null) {
      punkt.append(meldeKnopf("Senden", "senden", meldung.id));
      // Ausweichweg ohne Meldeserver: vorausgefülltes Issue auf github.com (braucht ein GitHub-Konto).
      const github = document.createElement("a");
      github.className = "knopf knopf-klein";
      github.href = issueUrl(meldung);
      github.target = "_blank";
      github.rel = "noopener";
      github.textContent = "Über GitHub";
      github.dataset["aktion"] = "github";
      github.dataset["id"] = meldung.id;
      punkt.append(github);
    }
    punkt.append(meldeKnopf("Löschen", "loeschen", meldung.id));
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
    const offen = gespeichert.meldungen.filter(({ geoeffnetAm, gesendet }) => geoeffnetAm === null && gesendet === null).length;
    const lage = meldeLage(standort, Date.now(), navigator.onLine);
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
    const jetzt = meldeLage(standort, Date.now(), navigator.onLine);
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
    speichern.textContent = "Wird gesendet …";
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
        if (!navigator.onLine) {
          throw new Error("Kein Internet: Die Meldung wurde nicht gesendet und nicht gespeichert. Melden geht nur mit Internet.");
        }
        let issueNummer: number;
        try {
          issueNummer = await umgebung.sende(meldung);
        } catch (fehler) {
          throw new Error(
            `Nicht gesendet, nichts gespeichert (${fehler instanceof Error ? fehler.message : String(fehler)}). Bitte mit Internet erneut versuchen.`,
            { cause: fehler },
          );
        }
        // Erst nach dem erfolgreichen Senden im Handy vermerkt (Verlauf, kein Zwischenspeicher für später).
        speichereMeldung(umgebung.speicher, meldung);
        markiereGesendet(umgebung.speicher, meldung.id, { am: new Date().toISOString(), issueNummer });
        hinweisNachSpeichern = [`Gesendet: ${kurztext(meldung)} (Issue #${String(issueNummer)}). Danke!`, bewertung.hinweis ?? ""]
          .filter((teil) => teil !== "")
          .join(" ");
        dialog.close();
        zeigeMeldungen();
      } catch (fehler) {
        fehlerText.textContent = fehler instanceof Error ? fehler.message : String(fehler);
      } finally {
        speichern.disabled = false;
        speichern.textContent = "Senden";
      }
    })();
  });

  const sendeMeldung = async (id: string, knopfSenden: HTMLButtonElement): Promise<void> => {
    const treffer = ladeMeldungen(umgebung.speicher).meldungen.find((eintrag) => eintrag.meldung.id === id);
    if (treffer === undefined || treffer.gesendet !== null) {
      zeigeMeldungen();
      return;
    }
    knopfSenden.disabled = true;
    status.textContent = "Meldung wird gesendet …";
    try {
      const issueNummer = await umgebung.sende(treffer.meldung);
      markiereGesendet(umgebung.speicher, id, { am: new Date().toISOString(), issueNummer });
      hinweisNachSpeichern = `Gesendet als Issue #${String(issueNummer)}. Danke!`;
    } catch (fehler) {
      hinweisNachSpeichern = `Senden fehlgeschlagen: ${fehler instanceof Error ? fehler.message : String(fehler)}. Die Meldung bleibt im Handy; „Über GitHub“ geht mit GitHub-Konto.`;
    }
    zeigeMeldungen();
  };

  liste.addEventListener("click", (ereignis) => {
    const ziel = ereignis.target instanceof Element ? ereignis.target.closest("[data-aktion]") : null;
    if (!(ziel instanceof HTMLElement)) {
      return;
    }
    const id = ziel.dataset["id"];
    if (id === undefined) {
      return;
    }
    const aktion = ziel.dataset["aktion"];
    if (aktion === "github") {
      markiereGeoeffnet(umgebung.speicher, id, new Date());
      window.setTimeout(zeigeMeldungen, 0); // erst nach dem Öffnen des Links neu zeichnen
    } else if (aktion === "senden" && ziel instanceof HTMLButtonElement) {
      void sendeMeldung(id, ziel);
    } else if (aktion === "loeschen" && window.confirm("Diese Meldung wirklich aus dem Handy löschen?")) {
      loescheMeldung(umgebung.speicher, id);
      zeigeMeldungen();
    }
  });

  window.addEventListener("online", zeigeMeldungen);
  window.addEventListener("offline", zeigeMeldungen);
  window.setInterval(zeigeMeldungen, AUFFRISCHEN_MS);
  zeigeMeldungen();
  return (neuerStandort) => {
    standort = neuerStandort;
    zeigeMeldungen();
  };
}

