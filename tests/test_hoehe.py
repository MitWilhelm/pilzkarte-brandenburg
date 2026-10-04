"""Tests für die Kachelauswahl der LGB-Höhendaten (ohne Netzwerk)."""

from pipeline.io_hoehe import kachel_namen


def test_ein_rechteck_ueber_zwei_mal_zwei_kilometer_beruehrt_vier_kacheln() -> None:
    assert kachel_namen((412322.0, 5867261.0, 413900.0, 5868084.0)) == [
        "33412-5867",
        "33412-5868",
        "33413-5867",
        "33413-5868",
    ]


def test_rechteck_genau_auf_kachelgrenzen_nimmt_keine_nachbarkachel_dazu() -> None:
    assert kachel_namen((412000.0, 5867000.0, 413000.0, 5868000.0)) == ["33412-5867"]
