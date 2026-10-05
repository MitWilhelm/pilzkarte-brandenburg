"""Tests für den URL-Bau der Standortskarten-Abfrage (ohne Netzwerk)."""

import urllib.parse
import urllib.request
from pathlib import Path

import pytest

from pipeline.io_stok_abfrage import (
    Abfragepunkt,
    _bereits_abgefragt,
    _frage_ab,
    _lies_punkte,
    abfrage_url,
    fehlgeschlagene_ids,
)


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


def test_punkte_werden_nach_bereich_gelesen_und_bereits_erledigte_erkannt(tmp_path: Path) -> None:
    quelle = tmp_path / "punkte.csv"
    quelle.write_text("id,x,y,lokale_id\na,1.0,2.0,x\nb,3.0,4.0,y\nc,5.0,6.0,z\nd,7.0,8.0,w\n", encoding="utf-8")
    ziel = tmp_path / "antworten.jsonl"
    ziel.write_text('{"id": "b"}\n{"id": "c"}\n', encoding="utf-8")

    assert [punkt.id for punkt in _lies_punkte(quelle, (1, 3))] == ["b", "c"]
    assert [punkt.id for punkt in _lies_punkte(quelle, (2, None))] == ["c", "d"]
    assert _bereits_abgefragt(ziel) == {"b", "c"}
    assert _bereits_abgefragt(tmp_path / "gibt-es-nicht.jsonl") == set()


def test_ein_zeitueberlauf_beim_lesen_wird_als_status_0_vermerkt_statt_abzubrechen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def zeitueberlauf(*_argumente: object, **_schluessel: object) -> object:
        raise TimeoutError("The read operation timed out")

    # Ausnahme (Regel 4, Monkeypatching): Netzwerk-Mock nach Regel 9; der echte Fehler trat auf GitHub Actions auf.
    monkeypatch.setattr(urllib.request, "urlopen", zeitueberlauf)
    ergebnis = _frage_ab("https://example.invalid/")
    assert ergebnis["status"] == 0
    assert ergebnis["typ"] == "zeitueberlauf"


def test_nachholen_nennt_nur_ids_ohne_erfolgreiche_antwort(tmp_path: Path) -> None:
    erste = tmp_path / "eins.jsonl"
    zweite = tmp_path / "zwei.jsonl"
    erste.write_text(
        '{"id": "1", "status": 200}\n{"id": "2", "status": 0}\n{"id": "3", "status": 404}\n', encoding="utf-8"
    )
    zweite.write_text('{"id": "3", "status": 200}\n{"id": "4", "status": 0}\n\n', encoding="utf-8")
    assert fehlgeschlagene_ids([erste, zweite]) == {"2", "4"}
