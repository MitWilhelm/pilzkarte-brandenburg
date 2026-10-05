"""Tests für die Oberhöhe aus nDOM-Punkten (künstliche Punkte, kein Netzwerk)."""

import numpy as np
import pytest

from pipeline.hoehe import (
    CODE_KEIN_WALD,
    KACHEL_METER,
    OHNE_WERT,
    PIXEL_JE_KACHEL,
    Punkte,
    kacheln_mit_wald,
    kachelname,
    oberhoehe,
    summiere_punkte,
    zellmittel,
)

URSPRUNG = (420_000.0, 5_851_000.0)


def _mittel_mit_block(hoehe: float, sued: int, nord: int, west: int, ost: int) -> np.ndarray:
    gitter = np.full((KACHEL_METER, KACHEL_METER), np.nan, dtype=np.float32)
    gitter[sued:nord, west:ost] = hoehe
    return gitter


def test_der_kachelname_entspricht_den_lgb_dateinamen() -> None:
    assert kachelname(420, 5851) == "33420-5851"
    assert kachelname(395, 5864) == "33395-5864"


def test_eine_kachel_ausserhalb_der_utm_kilometer_ist_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: Kachel 42/5851"):
        kachelname(42, 5851)


def test_punkte_werden_je_meterzelle_gemittelt_und_leere_zellen_sind_nan() -> None:
    punkte = Punkte(
        ost=np.array([420_000.2, 420_000.8, 420_001.5]),
        nord=np.array([5_851_000.1, 5_851_000.9, 5_851_002.5]),
        hoehe=np.array([10.0, 20.0, 7.0]),
    )
    mittel = zellmittel(*summiere_punkte(punkte, URSPRUNG))
    assert mittel[0, 0] == pytest.approx(15.0)
    assert mittel[2, 1] == pytest.approx(7.0)
    assert np.isnan(mittel[0, 1])


def test_punkte_am_kachelrand_landen_in_der_randzelle_statt_ausserhalb() -> None:
    punkte = Punkte(ost=np.array([421_000.05]), nord=np.array([5_852_000.0]), hoehe=np.array([5.0]))
    summe, anzahl = summiere_punkte(punkte, URSPRUNG)
    assert anzahl.sum() == 1
    assert anzahl.reshape(KACHEL_METER, KACHEL_METER)[KACHEL_METER - 1, KACHEL_METER - 1] == 1


def test_ein_gleichmaessiger_hoher_bestand_hat_ueberall_dessen_hoehe() -> None:
    mittel = _mittel_mit_block(24.0, 0, KACHEL_METER, 0, KACHEL_METER)
    assert (oberhoehe(mittel) == 24).all()


def test_in_einem_lueckigen_bestand_zaehlt_die_hoehe_der_baeume_nicht_der_boden_dazwischen() -> None:
    mittel = np.zeros((KACHEL_METER, KACHEL_METER), dtype=np.float32)
    mittel[::2, ::2] = 27.0  # ein Viertel der Zellen sind Kronen, der Rest Boden (wie bei Laubwald im Winter)
    assert oberhoehe(mittel)[50, 50] == 27


def test_wenige_kronenpunkte_genuegen_ab_einem_prozent_flaeche_als_bestand() -> None:
    mittel = np.zeros((KACHEL_METER, KACHEL_METER), dtype=np.float32)
    mittel[::6, ::6] = 27.0  # etwa 3 % Kronen, wie dünnes Laubdach im Winter
    assert oberhoehe(mittel)[50, 50] == 27


def test_unter_einem_prozent_kronenflaeche_gilt_das_fenster_als_offen() -> None:
    mittel = np.zeros((KACHEL_METER, KACHEL_METER), dtype=np.float32)
    mittel[::12, ::12] = 27.0  # etwa 0,7 % Kronen: einzelne Solitärbäume, keine Waldfläche
    assert oberhoehe(mittel)[50, 50] == 0


def test_der_norden_liegt_oben_im_ergebnis() -> None:
    mittel = _mittel_mit_block(18.0, 0, 200, 0, KACHEL_METER)  # nur die südlichsten 200 m
    ergebnis = oberhoehe(mittel)
    assert ergebnis[PIXEL_JE_KACHEL - 1, 50] == 18
    assert ergebnis[0, 50] == OHNE_WERT


def test_pixel_ohne_punkte_im_fenster_sind_ohne_wert_und_die_naehe_zaehlt_mit() -> None:
    mittel = _mittel_mit_block(15.0, 500, 520, 500, 520)  # ein 20 x 20 m Fleck
    ergebnis = oberhoehe(mittel)
    assert ergebnis[100 // 2 - 1, 100 // 2] == 15 or ergebnis[100 // 2, 100 // 2] == 15
    assert ergebnis[0, 0] == OHNE_WERT


def test_spitzen_ueber_60_meter_werden_gekappt() -> None:
    mittel = _mittel_mit_block(180.0, 0, KACHEL_METER, 0, KACHEL_METER)
    assert (oberhoehe(mittel) == 60).all()


def test_zellmittel_mit_falscher_form_ist_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: Summen"):
        zellmittel(np.zeros(10), np.zeros(10, dtype=np.int64))


def test_kacheln_mit_wald_nennt_jede_betroffene_kachel_einmal_und_ignoriert_leere() -> None:
    baumarten = np.full((300, 300), CODE_KEIN_WALD, dtype=np.uint16)  # 3 x 3 km ab 391.580 / 5.879.410
    baumarten[5, 5] = 0  # Kiefer (Code 0!) nahe der oberen linken Ecke
    baumarten[250, 250] = 5  # Buche rechts unten
    kacheln = kacheln_mit_wald(baumarten, (391_580.0, 5_879_410.0))
    assert kacheln == [(391, 5879), (394, 5876)]
