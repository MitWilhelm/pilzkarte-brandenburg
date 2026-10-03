"""Tests für den URL-Bau der Standortskarten-Abfrage (ohne Netzwerk)."""

import urllib.parse

from pipeline.io_stok_abfrage import Abfragepunkt, abfrage_url


def _parameter(url: str) -> dict[str, str]:
    return {
        schluessel: werte[0] for schluessel, werte in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).items()
    }


def test_abfrage_fragt_das_mittelpixel_eines_20_meter_fensters_um_den_punkt_ab() -> None:
    parameter = _parameter(abfrage_url(Abfragepunkt(id="t-0", x=413528.7, y=5849509.9), "application/json"))
    assert parameter["BBOX"] == "413518.7,5849499.9,413538.7,5849519.9"
    assert parameter["WIDTH"] == "21"
    assert parameter["X"] == "10"
    assert parameter["Y"] == "10"


def test_abfrage_nutzt_den_layer_standortskarte_im_lfb_koordinatensystem() -> None:
    parameter = _parameter(abfrage_url(Abfragepunkt(id="t-0", x=0.0, y=0.0), "text/plain"))
    assert parameter["QUERY_LAYERS"] == "stok_fskf"
    assert parameter["SRS"] == "EPSG:25833"
    assert parameter["INFO_FORMAT"] == "text/plain"
