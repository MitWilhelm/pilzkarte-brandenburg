"""Kachelraster für die Barnim-Karte: reine Berechnungen ohne Datei- oder Netzzugriff.

Die Kacheln sind 10 × 10 km in EPSG:25833, an vollen 10 km ausgerichtet; nur Kacheln, die den Kreis berühren, zählen.
"""

import math
from dataclasses import dataclass

from pyproj import Transformer
from shapely.geometry import box
from shapely.geometry.base import BaseGeometry

from pipeline.gebiete import Ausschnitt

__all__ = ["KANTE_METER", "Kachel", "kacheln_fuer", "rechteck_wgs84"]

KANTE_METER = 10_000
EPSG_LFB = 25833
EPSG_WGS84 = 4326


@dataclass(frozen=True)
class Kachel:
    name: str
    links: int
    unten: int


def kacheln_fuer(gebiet: BaseGeometry, praefix: str) -> tuple[Kachel, ...]:
    """Alle Kacheln des Rasters, die das Gebiet (EPSG:25833) schneiden, von Nordwest zeilenweise nach Südost.

    Der Name enthält die linke untere Ecke in 10 km (Ost, Nord), z. B. barnim_39_582 für 390.000 / 5.820.000 m.
    """
    links, unten, rechts, oben = gebiet.bounds
    spalten = range(math.floor(links / KANTE_METER), math.ceil(rechts / KANTE_METER))
    zeilen = range(math.ceil(oben / KANTE_METER) - 1, math.floor(unten / KANTE_METER) - 1, -1)
    ergebnis: list[Kachel] = []
    for zeile in zeilen:
        for spalte in spalten:
            kachel_links, kachel_unten = spalte * KANTE_METER, zeile * KANTE_METER
            flaeche = box(kachel_links, kachel_unten, kachel_links + KANTE_METER, kachel_unten + KANTE_METER)
            # Eine Kachel, die den Kreis nur an einer Kante oder Ecke berührt, hat keine Fläche darin.
            if flaeche.intersects(gebiet) and not flaeche.touches(gebiet):
                ergebnis.append(Kachel(name=f"{praefix}_{spalte}_{zeile}", links=kachel_links, unten=kachel_unten))
    if len(ergebnis) == 0:
        raise ValueError(f"Invariante verletzt: keine Kachel schneidet das Gebiet mit Ausdehnung {gebiet.bounds}")
    return tuple(ergebnis)


def rechteck_wgs84(kachel: Kachel, rand_meter: float) -> Ausschnitt:
    """Umschließendes Rechteck der Kachel samt Rand in Grad (EPSG:4326), z. B. für Overpass.

    Die vier Ecken werden umgerechnet, weil die Kachelkanten in WGS84 nicht achsenparallel sind.
    """
    links, unten = kachel.links - rand_meter, kachel.unten - rand_meter
    rechts, oben = kachel.links + KANTE_METER + rand_meter, kachel.unten + KANTE_METER + rand_meter
    nach_wgs84 = Transformer.from_crs(EPSG_LFB, EPSG_WGS84, always_xy=True)
    laengen, breiten = nach_wgs84.transform([links, rechts, rechts, links], [unten, unten, oben, oben])
    return Ausschnitt(links=min(laengen), unten=min(breiten), rechts=max(laengen), oben=max(breiten))
