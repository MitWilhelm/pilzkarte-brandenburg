"""Tests für das Lesen der Bodenanteile aus einer oder mehreren LFB-Antwortdateien (kleine JSONL-Dateien)."""

import json
from pathlib import Path

import pytest

from pipeline.habitat import Standortanteil
from pipeline.io_heatmap import lies_anteile


def _antwort(kennung: str, status: int) -> str:
    merkmale = {"nfgr1": "Z2", "az1": 7, "nfgr2": "M2", "az2": 3, "nfgr3": "", "az3": None, "nfgr4": "K2"}
    text = json.dumps({"features": [{"properties": merkmale}]}) if status == 200 else ""
    return json.dumps({"id": kennung, "status": status, "text": text}) + "\n"


def test_eine_datei_liefert_die_anteile_ohne_leere_und_ohne_vierte_gruppe(tmp_path: Path) -> None:
    datei = tmp_path / "a.jsonl"
    datei.write_text(_antwort("b-0", 200), encoding="utf-8")
    assert lies_anteile((datei,)) == {"b-0": [Standortanteil(code="Z2", anteil=7), Standortanteil(code="M2", anteil=3)]}


def test_ein_nachholer_in_einer_spaeteren_datei_ersetzt_die_fehlgeschlagene_abfrage(tmp_path: Path) -> None:
    erste, nachholen = tmp_path / "1.jsonl", tmp_path / "nachholen.jsonl"
    erste.write_text(_antwort("b-0", 200) + _antwort("b-1", 0), encoding="utf-8")
    nachholen.write_text(_antwort("b-1", 200), encoding="utf-8")
    assert sorted(lies_anteile((erste, nachholen))) == ["b-0", "b-1"]


def test_der_nachholer_zaehlt_auch_wenn_er_vor_dem_fehlschlag_gelesen_wird(tmp_path: Path) -> None:
    nachholen, erste = tmp_path / "nachholen.jsonl", tmp_path / "1.jsonl"
    nachholen.write_text(_antwort("b-1", 200), encoding="utf-8")
    erste.write_text(_antwort("b-1", 404), encoding="utf-8")
    assert sorted(lies_anteile((nachholen, erste))) == ["b-1"]


def test_eine_id_ganz_ohne_erfolgreiche_antwort_bricht_mit_status_ab(tmp_path: Path) -> None:
    datei = tmp_path / "a.jsonl"
    datei.write_text(_antwort("b-0", 200) + _antwort("b-1", 404), encoding="utf-8")
    with pytest.raises(
        ValueError, match="Invariante verletzt: 1 IDs ohne erfolgreiche Antwort, z. B. b-1 mit Status 404"
    ):
        lies_anteile((datei,))


def test_zwei_erfolgreiche_antworten_fuer_dieselbe_id_brechen_ab(tmp_path: Path) -> None:
    erste, zweite = tmp_path / "1.jsonl", tmp_path / "2.jsonl"
    erste.write_text(_antwort("b-0", 200), encoding="utf-8")
    zweite.write_text(_antwort("b-0", 200), encoding="utf-8")
    with pytest.raises(ValueError, match="b-0 hat mehr als eine erfolgreiche Antwort"):
        lies_anteile((erste, zweite))


def _antwort_mit(kennung: str, merkmale: dict[str, object]) -> str:
    return (
        json.dumps({"id": kennung, "status": 200, "text": json.dumps({"features": [{"properties": merkmale}]})}) + "\n"
    )


def test_ein_dreifach_wiederholter_code_mit_falscher_summe_wird_zu_einem_vollen_anteil(tmp_path: Path) -> None:
    datei = tmp_path / "a.jsonl"
    merkmale = {"nfgr1": "K2", "az1": 4, "nfgr2": "K2", "az2": 4, "nfgr3": "K2", "az3": 4, "nfgr4": ""}
    datei.write_text(_antwort_mit("b-0", merkmale), encoding="utf-8")
    assert lies_anteile((datei,)) == {"b-0": [Standortanteil(code="K2", anteil=10)]}


def test_verschiedene_codes_mit_falscher_summe_bleiben_unveraendert_fuer_die_invariante(tmp_path: Path) -> None:
    datei = tmp_path / "a.jsonl"
    merkmale = {"nfgr1": "K2", "az1": 4, "nfgr2": "M2", "az2": 4, "nfgr3": "", "az3": None, "nfgr4": ""}
    datei.write_text(_antwort_mit("b-0", merkmale), encoding="utf-8")
    assert lies_anteile((datei,)) == {"b-0": [Standortanteil(code="K2", anteil=4), Standortanteil(code="M2", anteil=4)]}
