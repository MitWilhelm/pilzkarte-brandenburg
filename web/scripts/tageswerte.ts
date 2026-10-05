// Berechnet morgens einmal die Brennpunkte aller Barnim-Kacheln samt Wetter und schreibt tageswerte.json.
// Aufruf: node scripts/tageswerte.ts <ziel.json>   (liest public/daten/barnim/, läuft im Workflow pages.yml)
// Open-Meteo (nur nicht-kommerziell): < 600 Abrufe/Minute, < 10.000/Tag. Ein Abruf je ~2-km-Rasterzelle mit
// Brennpunkten (einige hundert), höchstens GLEICHZEITIG parallel; bei Status 429/503 bis zu VERSUCHE Versuche mit Pause.
// Scheitert eine Zelle endgültig, fehlen nur ihre Brennpunkte; scheitert mehr als MAX_FEHLANTEIL, bricht der Lauf ab.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { gebieteAusJson } from "../src/clients/daten.ts";
import { ladeWetter, type Wetterreihe } from "../src/clients/openmeteo.ts";
import { KANAL_JE_PILZ, type Gebiet } from "../src/geo.ts";
import { besterKern, findeHotspots, type Hotspot } from "../src/hotspots.ts";
import { brennpunktArt, wetterSchluessel, type Tagesbrennpunkt, type Tageswerte } from "../src/tageswerte.ts";
import type { Pilzart } from "../src/wachstum.ts";

const ORDNER = "public/daten/barnim";
const GLEICHZEITIG = 4;
const VERSUCHE = 3;
const PAUSE_NACH_UEBERLAST_MS = 60_000;
const UEBERLAST_STATUS = ["Status 429", "Status 503"];
const MAX_FEHLANTEIL = 0.5;
const PILZARTEN: readonly Pilzart[] = ["steinpilz", "pfifferling"];

interface Fund {
  readonly gebiet: Gebiet;
  readonly daten: Uint8ClampedArray;
  readonly hotspot: Hotspot;
  readonly pilz: Pilzart;
}

function warte(millisekunden: number): Promise<void> {
  return new Promise((fertig) => setTimeout(fertig, millisekunden));
}

async function wetterMitWiederholung(breite: number, laenge: number): Promise<Wetterreihe> {
  for (let versuch = 1; ; versuch += 1) {
    try {
      return await ladeWetter(breite, laenge);
    } catch (fehler) {
      const isUeberlast = fehler instanceof Error && UEBERLAST_STATUS.some((status) => fehler.message.includes(status));
      if (!isUeberlast || versuch === VERSUCHE) {
        throw new Error(`Wetter für ${breite.toFixed(3)}, ${laenge.toFixed(3)} nicht ladbar`, { cause: fehler });
      }
      console.log(`Open-Meteo überlastet, Versuch ${String(versuch)}/${String(VERSUCHE)}`);
      await warte(PAUSE_NACH_UEBERLAST_MS);
    }
  }
}

function findeAlle(kacheln: readonly Gebiet[]): Fund[] {
  const funde: Fund[] = [];
  for (const gebiet of kacheln) {
    const bild = PNG.sync.read(readFileSync(`${ORDNER}/${gebiet.name}.png`));
    if (bild.width !== gebiet.breitePixel || bild.height !== gebiet.hoehePixel) {
      throw new Error(`Invariante verletzt: ${gebiet.name}.png ist ${String(bild.width)}x${String(bild.height)}`);
    }
    const daten = new Uint8ClampedArray(bild.data.buffer, bild.data.byteOffset, bild.data.length);
    for (const pilz of PILZARTEN) {
      for (const hotspot of findeHotspots({ daten, kanal: KANAL_JE_PILZ[pilz], gebiet })) {
        funde.push({ gebiet, daten, hotspot, pilz });
      }
    }
  }
  return funde;
}

async function ladeWetterFuerAlle(funde: readonly Fund[]): Promise<Map<string, Wetterreihe>> {
  const offen = new Map<string, readonly [number, number]>();
  for (const { hotspot } of funde) {
    offen.set(wetterSchluessel(hotspot.breite, hotspot.laenge), [hotspot.breite, hotspot.laenge]);
  }
  const ergebnis = new Map<string, Wetterreihe>();
  const fehlgeschlagen: string[] = [];
  const warteschlange = [...offen.entries()];
  const arbeiter = Array.from({ length: GLEICHZEITIG }, async () => {
    for (let naechster = warteschlange.pop(); naechster !== undefined; naechster = warteschlange.pop()) {
      const [schluessel, [breite, laenge]] = naechster;
      try {
        ergebnis.set(schluessel, await wetterMitWiederholung(breite, laenge));
      } catch (fehler) {
        fehlgeschlagen.push(schluessel);
        console.log(fehler instanceof Error ? `${fehler.message} (${String(fehler.cause)})` : String(fehler));
      }
    }
  });
  await Promise.all(arbeiter);
  console.log(`${String(ergebnis.size)} Wetterabrufe, ${String(fehlgeschlagen.length)} fehlgeschlagen, für ${String(funde.length)} Kandidaten`);
  if (fehlgeschlagen.length > offen.size * MAX_FEHLANTEIL) {
    throw new Error(`Invariante verletzt: ${String(fehlgeschlagen.length)} von ${String(offen.size)} Wetterabrufen gescheitert`);
  }
  return ergebnis;
}

async function main(): Promise<void> {
  const ziel = process.argv[2];
  if (ziel === undefined) {
    throw new Error("Aufruf: node scripts/tageswerte.ts <ziel.json>");
  }
  const kacheln = gebieteAusJson(JSON.parse(readFileSync(`${ORDNER}/kacheln.json`, "utf8")), "daten/barnim");
  const funde = findeAlle(kacheln);
  const wetter = await ladeWetterFuerAlle(funde);
  const jePilz: Record<Pilzart, Tagesbrennpunkt[]> = { steinpilz: [], pfifferling: [] };
  for (const { gebiet, daten, hotspot, pilz } of funde) {
    const reihe = wetter.get(wetterSchluessel(hotspot.breite, hotspot.laenge));
    if (reihe === undefined) {
      continue; // Wetterabruf dieser Zelle gescheitert (oben gemeldet); ohne Wetter keine Bewertung
    }
    const { art, indexHeute } = brennpunktArt(reihe.tage, reihe.heute, pilz);
    if (art !== null) {
      const { laenge, breite, flaecheHektar, zellen } = hotspot;
      const kern = besterKern({ daten, kanal: KANAL_JE_PILZ[pilz], gebiet }, zellen);
      jePilz[pilz].push({ gebietName: gebiet.name, laenge, breite, flaecheHektar, zellen, art, indexHeute, kern });
    }
  }
  const tageswerte: Tageswerte = { erstellt: new Date().toISOString(), ...jePilz };
  writeFileSync(ziel, JSON.stringify(tageswerte));
  for (const pilz of PILZARTEN) {
    const heute = jePilz[pilz].filter((punkt) => punkt.art === "heute").length;
    console.log(`${pilz}: ${String(jePilz[pilz].length)} Brennpunkte, davon ${String(heute)} heute günstig`);
  }
}

await main();
