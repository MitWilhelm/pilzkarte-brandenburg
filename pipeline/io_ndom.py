"""Lädt die nDOM-Kacheln des LGB nacheinander, rechnet je Kachel die Oberhöhe und schreibt daten/barnim_oberhoehe.tif.

Aufruf: python -m pipeline.io_ndom
Quelle: https://data.geobasis-bb.de/geobasis/daten/ndom/ (Datenlizenz Deutschland, Namensnennung 2.0, © LGB), je Kachel
rund 18 MB LAZ. Nutzungsgrenzen sind dort nicht angegeben; wir laden höchstens PARALLEL Kacheln gleichzeitig,
wiederholen einen Fehlversuch zweimal nach kurzer Pause und löschen jede Kachel nach der Auswertung (außer vorhandene,
von Hand abgelegte). Zwischenstände liegen je Kachel in rohdaten/ndom_raster/, ein abgebrochener Lauf setzt dort fort.
Rohdaten und Zwischenstände sind nicht im Git.
"""

import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import laspy
import numpy as np
import rasterio

from pipeline.hoehe import (
    KACHEL_METER,
    OHNE_WERT,
    PIXEL_JE_KACHEL,
    Punkte,
    kacheln_mit_wald,
    kachelname,
    oberhoehe,
    summiere_punkte,
    zellmittel,
)

__all__ = ["main"]

BASIS_URL = "https://data.geobasis-bb.de/geobasis/daten/ndom"
KENNUNG = "pilzkarte-brandenburg (private Nutzung, github.com/MitWilhelm/pilzkarte-brandenburg)"
LAZ_ORDNER = Path("rohdaten/ndom")
ZWISCHENSTAND = Path("rohdaten/ndom_raster")
BAUMARTEN = Path("daten/barnim_baumarten.tif")
ZIEL = Path("daten/barnim_oberhoehe.tif")
EPSG_LFB = 25833
PARALLEL = 3
VERSUCHE = 3
PAUSE_SEKUNDEN = 10.0
ZEITLIMIT_SEKUNDEN = 120
BLOCK_BYTES = 1 << 20
PUNKTE_JE_STUECK = 4_000_000  # hält den Speicher je Prozess bei wenigen hundert MB statt 25 Mio. Punkten auf einmal
RAND_METER = 1.0  # Toleranz zwischen Kopfdaten der Kachel und ihrem Namen
FORTSCHRITT_ALLE = 25
PERZENTILE = (10, 25, 50, 75, 90)


def _pruefe_kopf(datei: laspy.LasReader, ursprung: tuple[float, float]) -> None:
    kopf = datei.header
    ausserhalb = (
        kopf.x_min < ursprung[0] - RAND_METER
        or kopf.x_max > ursprung[0] + KACHEL_METER + RAND_METER
        or kopf.y_min < ursprung[1] - RAND_METER
        or kopf.y_max > ursprung[1] + KACHEL_METER + RAND_METER
    )
    if ausserhalb:
        raise ValueError(
            f"Invariante verletzt: Punkte x {kopf.x_min}..{kopf.x_max}, y {kopf.y_min}..{kopf.y_max} "
            f"liegen nicht in der Kachel ab {ursprung}"
        )


def _lade(url: str, ziel: Path) -> None:
    for versuch in range(1, VERSUCHE + 1):
        try:
            anfrage = urllib.request.Request(url, headers={"User-Agent": KENNUNG})
            with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT_SEKUNDEN) as antwort, ziel.open("wb") as datei:
                erwartet = int(antwort.headers["Content-Length"])
                geladen = 0
                while block := antwort.read(BLOCK_BYTES):
                    datei.write(block)
                    geladen += len(block)
            if geladen != erwartet:
                raise ValueError(f"Invariante verletzt: {url} hat {geladen} statt {erwartet} Byte geliefert")
            return
        except (urllib.error.URLError, TimeoutError, ValueError) as fehler:
            ziel.unlink(missing_ok=True)
            if versuch == VERSUCHE:
                raise RuntimeError(f"{url} nach {VERSUCHE} Versuchen nicht ladbar") from fehler
            time.sleep(PAUSE_SEKUNDEN * versuch)


def _verarbeite(kachel: tuple[int, int]) -> str:
    name = kachelname(*kachel)
    ursprung = (float(kachel[0] * KACHEL_METER), float(kachel[1] * KACHEL_METER))
    pfad = LAZ_ORDNER / f"NDOM_{name}_LAS12.laz"
    ist_vorhanden = pfad.exists()
    if not ist_vorhanden:
        teil = pfad.with_suffix(".part")
        _lade(f"{BASIS_URL}/{pfad.name}", teil)
        teil.rename(pfad)
    try:
        summe = np.zeros(KACHEL_METER * KACHEL_METER, dtype=np.float64)
        anzahl = np.zeros(KACHEL_METER * KACHEL_METER, dtype=np.int64)
        with laspy.open(pfad) as datei:
            _pruefe_kopf(datei, ursprung)
            for stueck in datei.chunk_iterator(PUNKTE_JE_STUECK):
                teil_summe, teil_anzahl = summiere_punkte(
                    Punkte(ost=np.asarray(stueck.x), nord=np.asarray(stueck.y), hoehe=np.asarray(stueck.z)), ursprung
                )
                summe += teil_summe
                anzahl += teil_anzahl
        if anzahl.sum() == 0:
            raise ValueError(f"Invariante verletzt: Kachel {name} enthält keine Punkte")
        np.save(ZWISCHENSTAND / f"{name}.npy", oberhoehe(zellmittel(summe, anzahl)))
    finally:
        if not ist_vorhanden:
            pfad.unlink(missing_ok=True)
    return name


def _verarbeite_alle(offen: list[tuple[int, int]]) -> None:
    start = time.monotonic()
    fehler: list[str] = []
    with ProcessPoolExecutor(max_workers=PARALLEL) as pool:
        aufgaben = {pool.submit(_verarbeite, kachel): kachel for kachel in offen}
        for nummer, aufgabe in enumerate(as_completed(aufgaben), start=1):
            try:
                aufgabe.result()
            except (RuntimeError, ValueError, OSError) as ursache:
                fehler.append(f"{kachelname(*aufgaben[aufgabe])}: {ursache} ({ursache.__cause__})")
            if nummer % FORTSCHRITT_ALLE == 0 or nummer == len(offen):
                vergangen = time.monotonic() - start
                rest = vergangen / nummer * (len(offen) - nummer)
                print(
                    f"{nummer}/{len(offen)} Kacheln, {vergangen / 60:.1f} min, noch etwa {rest / 60:.1f} min",
                    flush=True,
                )
    if len(fehler) > 0:
        raise RuntimeError(f"{len(fehler)} Kacheln gescheitert (erneuter Start setzt fort):\n" + "\n".join(fehler[:10]))


def _setze_zusammen(kacheln: list[tuple[int, int]]) -> None:
    with rasterio.open(BAUMARTEN) as quelle:
        if quelle.crs.to_epsg() != EPSG_LFB:
            raise ValueError(
                f"Invariante verletzt: {BAUMARTEN.name} hat EPSG {quelle.crs.to_epsg()}, erwartet {EPSG_LFB}"
            )
        baumarten = quelle.read(1)
        transform, profil = quelle.transform, quelle.profile.copy()
    ergebnis = np.full(baumarten.shape, OHNE_WERT, dtype=np.uint8)
    for ost_km, nord_km in kacheln:
        block = np.load(ZWISCHENSTAND / f"{kachelname(ost_km, nord_km)}.npy")
        if block.shape != (PIXEL_JE_KACHEL, PIXEL_JE_KACHEL):
            raise ValueError(f"Invariante verletzt: Zwischenstand {ost_km}/{nord_km} hat Form {block.shape}")
        spalte0 = round((ost_km * KACHEL_METER - transform.c) / transform.a)
        zeile0 = round((transform.f - (nord_km + 1) * KACHEL_METER) / -transform.e)
        zeilen = slice(max(zeile0, 0), min(zeile0 + PIXEL_JE_KACHEL, baumarten.shape[0]))
        spalten = slice(max(spalte0, 0), min(spalte0 + PIXEL_JE_KACHEL, baumarten.shape[1]))
        ergebnis[zeilen, spalten] = block[
            zeilen.start - zeile0 : zeilen.stop - zeile0, spalten.start - spalte0 : spalten.stop - spalte0
        ]
    profil.update(dtype="uint8", nodata=OHNE_WERT, compress="lzw")
    with rasterio.open(ZIEL, "w", **profil) as datei:
        datei.write(ergebnis, 1)
    wald = baumarten != 999
    ohne = int(((ergebnis == OHNE_WERT) & wald).sum())
    print(f"{ZIEL}: {ZIEL.stat().st_size / 1e6:.1f} MB, Waldpixel ohne Wert: {ohne} von {int(wald.sum())}")
    werte = ergebnis[wald & (ergebnis != OHNE_WERT)]
    print(
        "Oberhöhe der Waldpixel P" + "/P".join(str(p) for p in PERZENTILE) + " (m):",
        [int(np.percentile(werte, p)) for p in PERZENTILE],
    )


def main() -> None:
    if len(sys.argv) != 1:
        raise SystemExit("Aufruf: python -m pipeline.io_ndom")
    LAZ_ORDNER.mkdir(parents=True, exist_ok=True)
    ZWISCHENSTAND.mkdir(parents=True, exist_ok=True)
    with rasterio.open(BAUMARTEN) as quelle:
        kacheln = kacheln_mit_wald(quelle.read(1), (quelle.transform.c, quelle.transform.f))
    offen = [kachel for kachel in kacheln if not (ZWISCHENSTAND / f"{kachelname(*kachel)}.npy").exists()]
    print(f"{len(kacheln)} Kacheln mit Wald, davon {len(offen)} noch auszuwerten", flush=True)
    if len(offen) > 0:
        _verarbeite_alle(offen)
    _setze_zusammen(kacheln)


if __name__ == "__main__":
    main()
