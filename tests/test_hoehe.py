"""Tests für die Kachelauswahl der LGB-Höhendaten (ohne Netzwerk)."""

from pyproj import CRS

from pipeline.io_hoehe import ist_lfb_lage, kachel_namen


def test_ein_rechteck_ueber_zwei_mal_zwei_kilometer_beruehrt_vier_kacheln() -> None:
    assert kachel_namen((412322.0, 5867261.0, 413900.0, 5868084.0)) == [
        "33412-5867",
        "33412-5868",
        "33413-5867",
        "33413-5868",
    ]


def test_rechteck_genau_auf_kachelgrenzen_nimmt_keine_nachbarkachel_dazu() -> None:
    assert kachel_namen((412000.0, 5867000.0, 413000.0, 5868000.0)) == ["33412-5867"]


def test_lgb_koordinatensystem_mit_hoehenangabe_gilt_als_lage_25833() -> None:
    zusammengesetzt = CRS("EPSG:25833+7837").to_wkt()
    assert ist_lfb_lage(zusammengesetzt)
    assert ist_lfb_lage(CRS.from_epsg(25833).to_wkt())
    assert not ist_lfb_lage(CRS.from_epsg(3035).to_wkt())
