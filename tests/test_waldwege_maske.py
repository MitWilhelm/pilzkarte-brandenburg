"""Tests für das Beschränken der OSM-Wege auf den Wald (kleine Geometrien in EPSG:25833)."""

import geopandas as gpd
import pytest
from shapely.geometry import LineString, box

from pipeline.waldwege import nur_im_wald, waldmaske


def _wald() -> gpd.GeoSeries:
    # Zwei Waldstücke mit einem 200 m breiten Dorf dazwischen.
    return gpd.GeoSeries([box(0, 0, 1000, 1000), box(1200, 0, 2200, 1000)], crs=25833)


def _wege(linien: list[LineString], arten: list[str]) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame({"art": arten}, geometry=linien, crs=25833)


def test_die_maske_reicht_um_den_rand_ueber_den_wald_hinaus() -> None:
    maske = waldmaske(_wald(), 50.0)
    assert maske.contains(box(-40, 100, 1040, 900))
    assert not maske.intersects(box(1060, 400, 1140, 600))


def test_ein_weg_im_wald_bleibt_vollstaendig_mit_seiner_art() -> None:
    ergebnis = nur_im_wald(_wege([LineString([(100, 100), (900, 900)])], ["weg"]), waldmaske(_wald(), 50.0))
    assert list(ergebnis["art"]) == ["weg"]
    assert ergebnis.geometry.iloc[0].length == pytest.approx(LineString([(100, 100), (900, 900)]).length)


def test_eine_strasse_nur_im_dorf_faellt_weg() -> None:
    ergebnis = nur_im_wald(_wege([LineString([(1100, 100), (1100, 900)])], ["strasse"]), waldmaske(_wald(), 50.0))
    assert len(ergebnis) == 0


def test_ein_weg_durchs_dorf_zerfaellt_in_zwei_stuecke_bis_zum_rand() -> None:
    weg = _wege([LineString([(500, 500), (1700, 500)])], ["pfad"])
    ergebnis = nur_im_wald(weg, waldmaske(_wald(), 50.0))
    assert list(ergebnis["art"]) == ["pfad", "pfad"]
    assert sorted(round(linie.length) for linie in ergebnis.geometry) == [550, 550]


def test_wege_in_falschem_koordinatensystem_sind_eine_verletzte_invariante() -> None:
    wege = gpd.GeoDataFrame({"art": ["weg"]}, geometry=[LineString([(13.7, 52.9), (13.8, 52.9)])], crs=4326)
    with pytest.raises(ValueError, match="Invariante verletzt: Wege hat CRS"):
        nur_im_wald(wege, waldmaske(_wald(), 50.0))


def test_ein_negativer_rand_ist_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: Rand muss mindestens 0 m sein, ist -1"):
        waldmaske(_wald(), -1.0)
