"""Tests für das 10-km-Kachelraster der Barnim-Karte (reine Geometrie, plus ein echter Lauf mit der Kreisgrenze)."""

import json
from pathlib import Path

import pytest
from shapely.geometry import box, shape
from shapely.ops import unary_union

from pipeline.kacheln import KANTE_METER, Kachel, kacheln_fuer, rechteck_wgs84


def test_ein_gebiet_innerhalb_einer_kachel_ergibt_genau_diese_kachel() -> None:
    assert kacheln_fuer(box(391_000, 5_822_000, 399_000, 5_829_000), "t") == (
        Kachel(name="t_39_582", links=390_000, unten=5_820_000),
    )


def test_kacheln_laufen_zeilenweise_von_nordwest_nach_suedost() -> None:
    namen = [kachel.name for kachel in kacheln_fuer(box(395_000, 5_825_000, 405_000, 5_835_000), "t")]
    assert namen == ["t_39_583", "t_40_583", "t_39_582", "t_40_582"]


def test_eine_kachel_die_das_gebiet_nur_an_der_kante_beruehrt_faellt_weg() -> None:
    namen = [kachel.name for kachel in kacheln_fuer(box(390_000, 5_820_000, 400_000, 5_830_000), "t")]
    assert namen == ["t_39_582"]


def test_kacheln_ohne_anteil_am_gebiet_fallen_weg() -> None:
    l_form = unary_union([box(390_000, 5_820_000, 395_000, 5_840_000), box(390_000, 5_820_000, 410_000, 5_825_000)])
    namen = [kachel.name for kachel in kacheln_fuer(l_form, "t")]
    assert "t_40_583" not in namen
    assert sorted(namen) == ["t_39_582", "t_39_583", "t_40_582"]


def test_ein_leeres_gebiet_ist_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: keine Kachel"):
        kacheln_fuer(box(0, 0, 0, 0), "t")


def test_das_wgs84_rechteck_umschliesst_die_kachel_mit_rand() -> None:
    kachel = Kachel(name="t_41_585", links=410_000, unten=5_850_000)
    ohne_rand, mit_rand = rechteck_wgs84(kachel, 0.0), rechteck_wgs84(kachel, 50.0)
    assert 13.66 < ohne_rand.links < 13.67 < 13.81 < ohne_rand.rechts < 13.82
    assert 52.79 < ohne_rand.unten < 52.80 < 52.88 < ohne_rand.oben < 52.89
    assert mit_rand.links < ohne_rand.links
    assert mit_rand.oben > ohne_rand.oben


def test_die_barnim_kacheln_decken_die_echte_kreisgrenze_vollstaendig_ab() -> None:
    merkmal = json.loads(Path("daten/barnim_grenze_25833.geojson").read_text(encoding="utf-8"))["features"][0]
    grenze = shape(merkmal["geometry"])
    kacheln = kacheln_fuer(grenze, "barnim")
    flaeche = unary_union([box(k.links, k.unten, k.links + KANTE_METER, k.unten + KANTE_METER) for k in kacheln])
    assert grenze.difference(flaeche).area == pytest.approx(0.0, abs=1.0)
    assert len(kacheln) == 26
