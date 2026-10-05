"""Beschränkt OSM-Wege auf den Wald: reine Geometrie ohne Datei- oder Netzzugriff.

Wege in Städten und Dörfern sind für die Pilzsuche unwichtig und machten am Barnim-Südrand (Berlin) den größten Teil
der Daten aus. Waldfläche = Standortflächen der LFB-Standortskarte (sie kartiert nur Wald), plus Rand.
"""

import geopandas as gpd
import shapely
from shapely.geometry.base import BaseGeometry

__all__ = ["nur_im_wald", "waldmaske"]

EPSG_LFB = 25833
# Wenige Segmente je Viertelkreis reichen für einen Rand von Metern und halbieren die Rechenzeit der Vereinigung.
PUFFER_SEGMENTE = 2


def _pruefe_crs(daten: gpd.GeoSeries | gpd.GeoDataFrame, was: str) -> None:
    if daten.crs is None or daten.crs.to_epsg() != EPSG_LFB:
        raise ValueError(f"Invariante verletzt: {was} hat CRS {daten.crs}, erwartet EPSG {EPSG_LFB}")


def waldmaske(flaechen: gpd.GeoSeries, rand_meter: float) -> BaseGeometry:
    """Alle Waldflächen (EPSG:25833) zu einer Fläche vereinigt und um `rand_meter` erweitert."""
    _pruefe_crs(flaechen, "Waldflächen")
    if rand_meter < 0:
        raise ValueError(f"Invariante verletzt: Rand muss mindestens 0 m sein, ist {rand_meter}")
    if len(flaechen) == 0:
        raise ValueError("Invariante verletzt: keine Waldflächen für die Maske")
    return shapely.union_all(flaechen.buffer(rand_meter, quad_segs=PUFFER_SEGMENTE).to_numpy())


def nur_im_wald(wege: gpd.GeoDataFrame, maske: BaseGeometry) -> gpd.GeoDataFrame:
    """Die Teilstücke der Wege (EPSG:25833) innerhalb der Maske, je Teilstück eine Zeile mit allen Spalten.

    Ein Weg, der durch ein Dorf führt, zerfällt in mehrere Stücke; Berührpunkte an der Maskengrenze fallen weg.
    """
    _pruefe_crs(wege, "Wege")
    geschnitten = wege.clip(maske).explode(index_parts=False)
    return geschnitten.loc[geschnitten.geom_type == "LineString"].reset_index(drop=True)
