"""Holt Wege und Pfade aus OpenStreetMap (Overpass) und schreibt GeoJSON für die Webseite.

Aufruf: python -m pipeline.io_waldwege   10-km-Kacheln -> web/public/daten/barnim/<kachel>_wege.geojson
"art" = "strasse" (für Autos), "weg" (Forstweg) oder "pfad". Die volle Overpass-Antwort liegt in
rohdaten/barnim_wege/ (nicht im Git, vorhandene Kacheln werden nicht neu abgefragt); fürs Web nur Wege im Wald.
Overpass-Nutzungsregeln: höchstens etwa 10.000 Abfragen/Tag und 1 Abfrage gleichzeitig; wir stellen eine je Kachel,
mit 5 s Pause. Retry: bis zu 6 Versuche bei Überlast (HTTP 429/504) oder Netzwerkfehler; die Pause
verdoppelt sich ab 60 s (60, 120, 240, 480, 960 s, zusammen höchstens ~31 min je Abfrage), danach bricht der Lauf mit
Ursache ab. Daten: © OpenStreetMap-Mitwirkende, ODbL.
"""

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
from shapely.geometry import shape

from pipeline.kacheln import Kachel, kacheln_fuer, rechteck_wgs84
from pipeline.waldwege import nur_im_wald, waldmaske

__all__ = ["Weg", "art_von", "main", "wartezeit"]

DIENST_URL = "https://overpass-api.de/api/interpreter"
ZIELORDNER = Path("web/public/daten")
BARNIM_ORDNER = ZIELORDNER / "barnim"
BARNIM_ROH = Path("rohdaten/barnim_wege")
WALDFLAECHEN = Path("daten/barnim_stok_25833.gpkg")
# 50 m: Zufahrten und Parkplätze am Waldrand bleiben sichtbar; Wege in Städten und Dörfern fallen weg.
WALD_RAND_METER = 50.0
EPSG_LFB = 25833
EPSG_WGS84 = 4326
BARNIM_GRENZE = Path("daten/barnim_grenze_25833.geojson")
KREIS_AGS = "12060"  # Landkreis Barnim
# Rand um jede Kachel, damit der Wegrand-Aufschlag (~25 m) an Kachelgrenzen auch Wege der Nachbarkachel sieht.
KACHEL_RAND_METER = 50.0
PAUSE_SEKUNDEN = 5.0
ZEITLIMIT_SEKUNDEN = 120
# 3 feste Versuche à 60 s reichten am 05.10. bei überlasteter Overpass-Instanz zweimal nicht (dichte Kacheln).
VERSUCHE = 6
WARTEN_NACH_FEHLER_SEKUNDEN = 60.0
UEBERLAST_CODES = {429, 504}
NACHKOMMASTELLEN = 5  # ~1 m, hält die Datei klein
MIN_PUNKTE_JE_LINIE = 2
KENNUNG = "pilzkarte-brandenburg (private Nutzung, github.com/MitWilhelm/pilzkarte-brandenburg)"
WEGE_TYPEN = (
    "track|path|footway|bridleway|cycleway|unclassified|service|residential|living_street|tertiary|secondary|primary"
)
STRASSEN = {"primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service"}
# Spurqualität 4/5: unbefestigte Spuren, Rückegassen. Ohne Angabe gilt ein track als Forstweg (in Brandenburg häufig).
UNBEFESTIGTE_SPUR = {"grade4", "grade5"}


@dataclass(frozen=True)
class Weg:
    art: str
    punkte: tuple[tuple[float, float], ...]


def art_von(highway: str, tracktype: str | None) -> str:
    """'strasse' für öffentliche Straßen (Autos), 'weg' für Forst- und Wirtschaftswege, sonst 'pfad'."""
    if highway in STRASSEN:
        return "strasse"
    if highway == "track" and tracktype not in UNBEFESTIGTE_SPUR:
        return "weg"
    return "pfad"


def _abfrage(sued: float, west: float, nord: float, ost: float) -> str:
    return f'[out:json][timeout:90];way["highway"~"^({WEGE_TYPEN})$"]({sued},{west},{nord},{ost});out tags geom;'


def wartezeit(versuch: int) -> float:
    """Pause in Sekunden nach dem fehlgeschlagenen Versuch Nummer `versuch` (ab 1), verdoppelt sich je Versuch."""
    if versuch < 1:
        raise ValueError(f"Invariante verletzt: Versuch muss mindestens 1 sein, ist {versuch}")
    return WARTEN_NACH_FEHLER_SEKUNDEN * 2.0 ** (versuch - 1)


def _hole_mit_wiederholung(abfrage: str) -> dict[str, object]:
    for versuch in range(1, VERSUCHE + 1):
        try:
            return _hole(abfrage)
        except urllib.error.HTTPError as fehler:
            if fehler.code not in UEBERLAST_CODES or versuch == VERSUCHE:
                raise
            print(f"Overpass HTTP {fehler.code}, Versuch {versuch}/{VERSUCHE}")
        except urllib.error.URLError as fehler:
            if versuch == VERSUCHE:
                raise
            print(f"Overpass nicht erreichbar ({fehler.reason}), Versuch {versuch}/{VERSUCHE}")
        time.sleep(wartezeit(versuch))
    raise ValueError(f"Invariante verletzt: VERSUCHE muss mindestens 1 sein, ist {VERSUCHE}")


def _hole(abfrage: str) -> dict[str, object]:
    daten = urllib.parse.urlencode({"data": abfrage}).encode("utf-8")
    anfrage = urllib.request.Request(DIENST_URL, data=daten, headers={"User-Agent": KENNUNG})
    with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT_SEKUNDEN) as antwort:
        inhalt: dict[str, object] = json.loads(antwort.read().decode("utf-8"))
    return inhalt


def _wege_aus(antwort: dict[str, object]) -> list[Weg]:
    elemente = antwort.get("elements")
    if not isinstance(elemente, list):
        raise ValueError(f"Invariante verletzt: Overpass-Antwort ohne Liste 'elements': {str(antwort)[:200]}")
    wege: list[Weg] = []
    for element in elemente:
        tags = element["tags"]
        punkte = tuple(
            (round(p["lon"], NACHKOMMASTELLEN), round(p["lat"], NACHKOMMASTELLEN)) for p in element["geometry"]
        )
        wege.append(Weg(art=art_von(tags["highway"], tags.get("tracktype")), punkte=punkte))
    return wege


def _schreibe(ziel: Path, wege: list[Weg]) -> None:
    sammlung = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"art": weg.art},
                "geometry": {"type": "LineString", "coordinates": [list(p) for p in weg.punkte]},
            }
            for weg in wege
        ],
    }
    ziel.write_text(json.dumps(sammlung, separators=(",", ":")), encoding="utf-8")
    anzahl = {art: sum(1 for weg in wege if weg.art == art) for art in ("strasse", "weg", "pfad")}
    print(f"{ziel.name}: {len(wege)} Linien {anzahl}, {ziel.stat().st_size // 1024} KB")


def _hole_fehlende(kacheln: tuple[Kachel, ...]) -> None:
    BARNIM_ROH.mkdir(parents=True, exist_ok=True)
    offen = [kachel for kachel in kacheln if not (BARNIM_ROH / f"{kachel.name}_wege.geojson").exists()]
    print(f"{len(kacheln)} Kacheln, davon {len(offen)} noch nicht abgefragt")
    for nummer, kachel in enumerate(offen):
        if nummer > 0:
            time.sleep(PAUSE_SEKUNDEN)
        rechteck = rechteck_wgs84(kachel, KACHEL_RAND_METER)
        antwort = _hole_mit_wiederholung(_abfrage(rechteck.unten, rechteck.links, rechteck.oben, rechteck.rechts))
        # Leere Kacheln sind möglich (z. B. fast nur Acker am Kreisrand); sie bekommen eine leere Datei.
        _schreibe(BARNIM_ROH / f"{kachel.name}_wege.geojson", _wege_aus(antwort))


def _wege_aus_tabelle(tabelle: gpd.GeoDataFrame) -> list[Weg]:
    if "art" not in tabelle.columns:
        raise ValueError(f"Invariante verletzt: Wege ohne Spalte 'art': {list(tabelle.columns)}")
    wege: list[Weg] = []
    for art, linie in zip(tabelle["art"], tabelle.geometry, strict=True):
        punkte = tuple((round(x, NACHKOMMASTELLEN), round(y, NACHKOMMASTELLEN)) for x, y in linie.coords)
        # Stückchen unter ~1 m an der Waldgrenze fallen nach dem Runden auf einen Punkt zusammen: keine Linie mehr.
        if len(set(punkte)) >= MIN_PUNKTE_JE_LINIE:
            wege.append(Weg(art=art, punkte=punkte))
    return wege


def _barnim() -> None:
    merkmale = json.loads(BARNIM_GRENZE.read_text(encoding="utf-8"))["features"]
    if len(merkmale) != 1 or merkmale[0]["properties"]["ags"] != KREIS_AGS:
        raise ValueError(f"Invariante verletzt: {BARNIM_GRENZE} enthält nicht genau den Kreis {KREIS_AGS}")
    kacheln = kacheln_fuer(shape(merkmale[0]["geometry"]), "barnim")
    _hole_fehlende(kacheln)
    print(f"Waldmaske aus {WALDFLAECHEN} mit {WALD_RAND_METER:.0f} m Rand …")
    maske = waldmaske(gpd.read_file(WALDFLAECHEN).geometry, WALD_RAND_METER)
    BARNIM_ORDNER.mkdir(parents=True, exist_ok=True)
    for kachel in kacheln:
        roh = gpd.read_file(BARNIM_ROH / f"{kachel.name}_wege.geojson")
        if len(roh) == 0:
            _schreibe(BARNIM_ORDNER / f"{kachel.name}_wege.geojson", [])
            continue
        if roh.crs is None or roh.crs.to_epsg() != EPSG_WGS84:
            raise ValueError(f"Invariante verletzt: Wege {kachel.name} haben CRS {roh.crs}, erwartet EPSG {EPSG_WGS84}")
        im_wald = nur_im_wald(roh.to_crs(EPSG_LFB), maske).to_crs(EPSG_WGS84)
        _schreibe(BARNIM_ORDNER / f"{kachel.name}_wege.geojson", _wege_aus_tabelle(im_wald))


def main() -> None:
    _barnim()


if __name__ == "__main__":
    main()
