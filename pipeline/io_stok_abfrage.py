"""Fragt für Punkte aus daten/stok_punkte.csv die Standortskarte beim LFB-Kartendienst ab.

Läuft auf GitHub Actions (dort ist der Server erreichbar), nur Python-Standardbibliothek.
Rate-Limit: keines dokumentiert; wir drosseln selbst auf 1 Abfrage/Sekunde. Kein Retry:
Fehler werden mit Status und Text in die Ergebnisdatei geschrieben, nicht verschluckt.
"""

import argparse
import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path

__all__ = ["Abfragepunkt", "abfrage_url", "main"]

DIENST_URL = "https://www.brandenburg-forst.de/ogc/stok"
LAYER = "stok_fskf"
FENSTER_HALB_METER = 10
FENSTER_PIXEL = 21  # ungerade, damit der Punkt genau im Mittelpixel liegt
PAUSE_SEKUNDEN = 1.0
ZEITLIMIT_SEKUNDEN = 30
MAX_ANTWORT_ZEICHEN = 20_000
FORMAT_STANDARD = "application/json"
FORMATE_DIAGNOSE = ("application/json", "text/plain", "application/vnd.ogc.gml")
QUELLDATEI = Path("daten/stok_punkte.csv")
ZIELDATEI = Path("daten/stok_antworten.jsonl")
KENNUNG = "pilzkarte-brandenburg (private Nutzung, github.com/MitWilhelm/pilzkarte-brandenburg)"


@dataclass(frozen=True)
class Abfragepunkt:
    id: str
    x: float
    y: float


def abfrage_url(punkt: Abfragepunkt, info_format: str) -> str:
    """GetFeatureInfo (WMS 1.1.1, EPSG:25833) für das Mittelpixel eines kleinen Fensters um den Punkt."""
    rechteck = (
        punkt.x - FENSTER_HALB_METER,
        punkt.y - FENSTER_HALB_METER,
        punkt.x + FENSTER_HALB_METER,
        punkt.y + FENSTER_HALB_METER,
    )
    mitte = FENSTER_PIXEL // 2
    parameter = {
        "SERVICE": "WMS",
        "VERSION": "1.1.1",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": LAYER,
        "QUERY_LAYERS": LAYER,
        "STYLES": "",
        "SRS": "EPSG:25833",
        "BBOX": ",".join(f"{wert:.1f}" for wert in rechteck),
        "WIDTH": str(FENSTER_PIXEL),
        "HEIGHT": str(FENSTER_PIXEL),
        "X": str(mitte),
        "Y": str(mitte),
        "INFO_FORMAT": info_format,
        "FEATURE_COUNT": "1",
    }
    return f"{DIENST_URL}?{urllib.parse.urlencode(parameter)}"


def _lies_punkte(quelle: Path, bereich: tuple[int, int | None]) -> list[Abfragepunkt]:
    with quelle.open(encoding="utf-8") as datei:
        punkte = [Abfragepunkt(id=z["id"], x=float(z["x"]), y=float(z["y"])) for z in csv.DictReader(datei)]
    von, bis = bereich
    return punkte[von:bis]


def _bereits_abgefragt(ziel: Path) -> set[str]:
    if not ziel.exists():
        return set()
    with ziel.open(encoding="utf-8") as datei:
        return {json.loads(zeile)["id"] for zeile in datei if zeile.strip()}


def _frage_ab(url: str) -> dict[str, str | int]:
    anfrage = urllib.request.Request(url, headers={"User-Agent": KENNUNG})
    try:
        with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT_SEKUNDEN) as antwort:
            text = antwort.read().decode("utf-8", errors="replace")
            return {"status": antwort.status, "typ": antwort.headers.get_content_type(), "text": text}
    except urllib.error.HTTPError as fehler:
        return {"status": fehler.code, "typ": "fehler", "text": str(fehler)}
    except urllib.error.URLError as fehler:
        return {"status": 0, "typ": "fehler", "text": str(fehler.reason)}
    except TimeoutError as fehler:
        # Zeitüberlauf beim Lesen der Antwort ist kein URLError; ohne diesen Zweig brach der Barnim-Lauf ab.
        return {"status": 0, "typ": "zeitueberlauf", "text": str(fehler)}


def main() -> None:
    argumente = argparse.ArgumentParser()
    argumente.add_argument("--anzahl", type=int, default=None, help="nur die ersten N Punkte (Test)")
    argumente.add_argument("--alle-formate", action="store_true", help="jedes Antwortformat abfragen (Diagnose)")
    argumente.add_argument("--quelle", type=Path, default=QUELLDATEI, help="CSV mit id,x,y")
    argumente.add_argument("--ziel", type=Path, default=ZIELDATEI, help="JSONL mit den Antworten")
    argumente.add_argument("--von", type=int, default=0, help="erster Punkt (Index, einschließlich)")
    argumente.add_argument("--bis", type=int, default=None, help="letzter Punkt (Index, ausschließlich)")
    argumente.add_argument("--fortsetzen", action="store_true", help="bereits im Ziel stehende Punkte überspringen")
    eingabe = argumente.parse_args()
    formate = FORMATE_DIAGNOSE if eingabe.alle_formate else (FORMAT_STANDARD,)
    bis = eingabe.bis if eingabe.anzahl is None else eingabe.von + eingabe.anzahl
    erledigt = _bereits_abgefragt(eingabe.ziel) if eingabe.fortsetzen else set()
    modus = "a" if eingabe.fortsetzen else "w"
    eingabe.ziel.parent.mkdir(parents=True, exist_ok=True)
    with eingabe.ziel.open(modus, encoding="utf-8") as ziel:
        for punkt in _lies_punkte(eingabe.quelle, (eingabe.von, bis)):
            if punkt.id in erledigt:
                continue
            for info_format in formate:
                ergebnis = _frage_ab(abfrage_url(punkt, info_format))
                eintrag = {**asdict(punkt), "format": info_format, **ergebnis}
                eintrag["text"] = str(eintrag["text"])[:MAX_ANTWORT_ZEICHEN]
                ziel.write(json.dumps(eintrag, ensure_ascii=False) + "\n")
                ziel.flush()  # bei Abbruch (Zeitlimit des Laufs) bleiben die bisherigen Antworten erhalten
                print(f"{punkt.id} {info_format}: Status {ergebnis['status']}, {len(str(ergebnis['text']))} Zeichen")
                time.sleep(PAUSE_SEKUNDEN)


if __name__ == "__main__":
    main()
