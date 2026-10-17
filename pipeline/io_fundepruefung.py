"""Prüft die Funde in daten/funde.csv gegen die Habitat-Karten und schreibt eine Übersicht auf die Konsole.

Aufruf: python -m pipeline.io_fundepruefung
Je Pilzart: Stufe an der Fundstelle, beste Stufe im 30-m-Umkreis (GPS-Ungenauigkeit), Anteil der Funde ab Stufe 85 gegen
den Flächenanteil ab Stufe 85. Hinweis: Wer dort sucht, wo die Karte hohe Stufen zeigt, findet dort auch eher; die
Zahlen belegen das Modell deshalb nur schwach. Aussagekräftiger sind Fehlanzeigen (daten/keine_funde.csv).
"""

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import numpy.typing as npt
import rasterio
from pyproj import Transformer

from pipeline.gebiete import BAUMARTEN
from pipeline.habitat import PILZARTEN, Pilzart

__all__ = ["main"]

DATEN = Path("daten")
EPSG_WGS84 = 4326
EPSG_LFB = 25833
HOCH_AB_STUFE = 85
CODE_KEIN_WERT = 999
UMKREIS_PIXEL = 1  # 10-m-Pixel: 30 m Umkreis um die Fundstelle
QUELLE_NUTZER = "Nutzer"


@dataclass(frozen=True)
class Fund:
    id: str
    pilz: Pilzart
    datum: str
    breite: float
    laenge: float


def lies_funde(datei: Path, nur_quelle: str) -> list[Fund]:
    funde: list[Fund] = []
    with datei.open(encoding="utf-8", newline="") as quelle:
        for zeile in csv.DictReader(quelle):
            pilz = next((kandidat for kandidat in PILZARTEN if kandidat == zeile["pilz"]), None)
            if pilz is None:
                continue  # z. B. Funde anderer Arten (keine Karte dafür)
            if zeile["quelle"] != nur_quelle and not zeile["quelle"].startswith(f"{nur_quelle} "):
                continue
            funde.append(Fund(zeile["id"], pilz, zeile["datum"], float(zeile["breite"]), float(zeile["laenge"])))
    return funde


def _lies(name: str) -> npt.NDArray[np.uint16]:
    with rasterio.open(DATEN / name) as quelle:
        if quelle.crs.to_epsg() != EPSG_LFB:
            raise ValueError(f"Invariante verletzt: {name} hat EPSG {quelle.crs.to_epsg()}, erwartet {EPSG_LFB}")
        return np.asarray(quelle.read(1), dtype=np.uint16)


def main() -> None:
    baumarten = _lies("barnim_baumarten.tif")
    with rasterio.open(DATEN / "barnim_baumarten.tif") as quelle:
        transform = quelle.transform
    is_wald = baumarten != CODE_KEIN_WERT
    nach_lfb = Transformer.from_crs(EPSG_WGS84, EPSG_LFB, always_xy=True)
    for pilz in PILZARTEN:
        stufen = _lies(f"barnim_{pilz}_habitat.tif")
        habitat = is_wald & (stufen > 0)
        flaechenanteil = float(((stufen >= HOCH_AB_STUFE) & habitat).sum() / habitat.sum())
        funde = lies_funde(DATEN / "funde.csv", QUELLE_NUTZER)
        funde = [fund for fund in funde if fund.pilz == pilz]
        if len(funde) == 0:
            print(f"{pilz}: keine Funde von Nutzern")
            continue
        treffer = 0
        for fund in funde:
            ost, nord = nach_lfb.transform(fund.laenge, fund.breite)
            spalte, zeile = (int(wert) for wert in ~transform * (ost, nord))
            stufe = int(stufen[zeile, spalte])
            umkreis = int(
                stufen[
                    max(zeile - UMKREIS_PIXEL, 0) : zeile + UMKREIS_PIXEL + 1,
                    max(spalte - UMKREIS_PIXEL, 0) : spalte + UMKREIS_PIXEL + 1,
                ].max()
            )
            baum = BAUMARTEN.get(int(baumarten[zeile, spalte]), "ohne Wert")
            treffer += int(stufe >= HOCH_AB_STUFE)
            print(f"{fund.id} {fund.datum} {pilz}: Karte sagt {baum}, Stufe {stufe} (30-m-Umkreis {umkreis})")
        print(
            f"{pilz}: {len(funde)} Funde, davon {treffer} ab Stufe {HOCH_AB_STUFE} ({treffer / len(funde):.0%}); "
            f"Flächenanteil ab Stufe {HOCH_AB_STUFE}: {flaechenanteil:.0%}"
        )


if __name__ == "__main__":
    main()
