"""Holt Wege und Pfade aus OpenStreetMap (Overpass) für die Gebiete und schreibt GeoJSON für die Webseite.

Aufruf: python -m pipeline.io_waldwege  (läuft auf GitHub Actions; Overpass ist aus Claudes Umgebung gesperrt).
Ziel: web/public/daten/<gebiet>_wege.geojson mit "art" = "strasse" (für Autos), "weg" (Forstweg) oder "pfad".
Overpass-Nutzungsregeln: höchstens etwa 10.000 Abfragen/Tag und 1 Abfrage gleichzeitig; wir stellen eine je Gebiet,
mit 5 s Pause, ohne Retry (Fehler brechen den Lauf mit Ursache ab). Daten: © OpenStreetMap-Mitwirkende, ODbL.
"""

import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

__all__ = ["Weg", "art_von", "main"]

DIENST_URL = "https://overpass-api.de/api/interpreter"
GEBIETE = Path("web/public/daten/gebiete.json")
ZIELORDNER = Path("web/public/daten")
PAUSE_SEKUNDEN = 5.0
ZEITLIMIT_SEKUNDEN = 120
NACHKOMMASTELLEN = 5  # ~1 m, hält die Datei klein
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


def main() -> None:
    gebiete = json.loads(GEBIETE.read_text(encoding="utf-8"))
    for nummer, gebiet in enumerate(gebiete):
        if nummer > 0:
            time.sleep(PAUSE_SEKUNDEN)
        west, nord = gebiet["ecken"][0]
        ost, sued = gebiet["ecken"][2]
        wege = _wege_aus(_hole(_abfrage(sued, west, nord, ost)))
        if len(wege) == 0:
            raise ValueError(f"Invariante verletzt: keine Wege für {gebiet['name']} gefunden")
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
        ziel = ZIELORDNER / f"{gebiet['name']}_wege.geojson"
        ziel.write_text(json.dumps(sammlung, separators=(",", ":")), encoding="utf-8")
        anzahl = {art: sum(1 for weg in wege if weg.art == art) for art in ("strasse", "weg", "pfad")}
        print(f"{gebiet['name']}: {len(wege)} Linien {anzahl}, {ziel.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
