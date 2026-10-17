"""Exportiert die Barnim-Daten je 10-km-Kachel für die Webseite nach web/public/daten/barnim/.

Aufruf: python -m pipeline.io_webdaten   (Übersicht in barnim/kacheln.json)
Zusätzlich: vorschau.png (+ vorschau_reizker.png, vorschau.json) = ganz Barnim grob (100 m), damit die Karte beim
Start sofort etwas zeigt, und grenze.geojson = Kreisgrenze (WGS84) für die graue Fläche außerhalb.
<name>.png: Daten-Bild in Web-Mercator (EPSG:3857), R = Baumart-Index, G = Steinpilz-Stufe,
B = Pfifferling-Stufe, A = 255. Daneben <name>_reizker.png (ein Grauwert-Kanal = Edelreizker-Stufe; ein vierter
Farbkanal wäre durch die Deckkraft verfälscht), die Webseite fügt beide beim Laden zusammen. Dazu <name>_boden.geojson;
die Übersicht nennt Ecken (WGS84) und Pixelgröße.
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import rasterio
from pyproj import Transformer
from rasterio.features import rasterize
from rasterio.transform import from_origin
from rasterio.warp import Resampling, calculate_default_transform, reproject
from rasterio.windows import from_bounds
from shapely.geometry import box, shape

from pipeline.gebiete import CODE_KEIN_WERT
from pipeline.habitat import beschreibe_standort
from pipeline.io_heatmap import BARNIM_ANTWORTEN, lies_anteile
from pipeline.kacheln import KANTE_METER, Kachel, kacheln_fuer
from pipeline.maske import verlauf_ausserhalb

__all__ = ["main"]

DATEN = Path("daten")
ZIEL = Path("web/public/daten")
EPSG_WEB = 3857
EPSG_WGS84 = 4326
CODE_KRONENVERLUST = 666
INDEX_KRONENVERLUST = 10  # passt in einen Farbkanal; 0..9 sind die übrigen DLR-Codes
INDEX_KEIN_WERT = 255
UNDURCHSICHTIG = 255
VEREINFACHUNG_METER = 3.0  # Bodenflaechen: 3 m Toleranz reicht für die Karte und spart Platz
NACHKOMMASTELLEN_GRAD = 6
EPSG_LFB = 25833
VORSCHAU_PIXEL_METER_WEB = (
    166.0  # 100 m am Boden: in Web-Mercator sind Strecken bei 52,8° Breite um 1/cos(Breite) länger
)
GRENZE_VEREINFACHUNG_METER = 50.0
# Weicher Übergang am Rand: Das Bild reicht MASKE_RAND_WEB über die Grenze hinaus (Web-Mercator-Meter, ~66 km am
# Boden) und begrenzt zugleich Verschieben und Herauszoomen (Seite: begrenzeKarte). Der Rand ist so breit, dass auch
# ein hohes Handy-Bild bei "ganzer Barnim im Bild" ganz im Grau liegt (sonst endet die Karte sichtbar).
# Zellen 500 m, Weichzeichner Sigma 7 Zellen (~3,5 km Web-Meter, ~2 km am Boden); außerhalb des Bildes malt die Seite
# dasselbe Grau.
MASKE_RAND_WEB = 110_000.0
MASKE_ZELLE_WEB = 500.0
MASKE_SIGMA_ZELLEN = 7.0
MASKE_DECKKRAFT = 199  # 78 % von 255
MASKE_GRAU = (141, 146, 141)
BARNIM_ZIEL = ZIEL / "barnim"
BARNIM_GRENZE = DATEN / "barnim_grenze_25833.geojson"
LESERAND_METER = 500.0
PIXEL_METER = 10.0
NACHKOMMASTELLEN_KACHEL = 5  # ~1 m wie bei den Wegen; spart bei 26 Kacheln rund ein Fünftel der Boden-Dateien


def _baumart_index(codes: npt.NDArray[np.uint16]) -> npt.NDArray[np.uint8]:
    ergebnis = np.full(codes.shape, INDEX_KEIN_WERT, dtype=np.uint8)
    regulaer = codes < INDEX_KRONENVERLUST
    ergebnis[regulaer] = codes[regulaer].astype(np.uint8)
    ergebnis[codes == CODE_KRONENVERLUST] = INDEX_KRONENVERLUST
    return ergebnis


def _stufe(werte: npt.NDArray[np.uint16]) -> npt.NDArray[np.uint8]:
    return np.where(werte == CODE_KEIN_WERT, 0, werte).astype(np.uint8)


def _ecken_wgs84(transform: rasterio.Affine, breite: int, hoehe: int) -> list[list[float]]:
    links, oben = transform * (0, 0)
    rechts, unten = transform * (breite, hoehe)
    nach_wgs84 = Transformer.from_crs(EPSG_WEB, EPSG_WGS84, always_xy=True)
    ecken = [nach_wgs84.transform(x, y) for x, y in ((links, oben), (rechts, oben), (rechts, unten), (links, unten))]
    return [[round(lng, NACHKOMMASTELLEN_GRAD), round(lat, NACHKOMMASTELLEN_GRAD)] for lng, lat in ecken]


def _kachel_mercator(datei: Path, kachel: Kachel) -> tuple[npt.NDArray[np.uint16], rasterio.Affine]:
    rechteck = (kachel.links, kachel.unten, kachel.links + KANTE_METER, kachel.unten + KANTE_METER)
    # Das Mercator-Bild umschließt das (leicht gedrehte) Kachelquadrat; seine Ecken liegen bis ~175 m außerhalb.
    # Mit Rand gelesen, sind auch die Ecken echte Daten, und überlappende Nachbarkacheln zeigen dort dasselbe.
    mit_rand = (
        rechteck[0] - LESERAND_METER,
        rechteck[1] - LESERAND_METER,
        rechteck[2] + LESERAND_METER,
        rechteck[3] + LESERAND_METER,
    )
    with rasterio.open(datei) as quelle:
        if quelle.crs.to_epsg() != EPSG_LFB:
            raise ValueError(f"Invariante verletzt: {datei.name} hat EPSG {quelle.crs.to_epsg()}, erwartet {EPSG_LFB}")
        fenster = from_bounds(*mit_rand, quelle.transform).round_offsets().round_lengths()
        # boundless: Kacheln am Kreisrand ragen über das Barnim-Raster hinaus; dort gilt "kein Wert".
        werte = quelle.read(1, window=fenster, boundless=True, fill_value=quelle.nodata).astype(np.uint16)
        werte[werte == quelle.nodata] = CODE_KEIN_WERT
        quell_transform = quelle.window_transform(fenster)
    pixel_je_kante = round(KANTE_METER / PIXEL_METER)
    transform, breite, hoehe = calculate_default_transform(
        f"EPSG:{EPSG_LFB}", f"EPSG:{EPSG_WEB}", pixel_je_kante, pixel_je_kante, *rechteck
    )
    ziel = np.full((hoehe, breite), CODE_KEIN_WERT, dtype=np.uint16)
    # Nearest, weil Baumart-Codes und Stufen Klassen sind und nicht gemittelt werden dürfen.
    reproject(
        source=werte,
        destination=ziel,
        src_transform=quell_transform,
        src_crs=f"EPSG:{EPSG_LFB}",
        src_nodata=CODE_KEIN_WERT,
        dst_transform=transform,
        dst_crs=f"EPSG:{EPSG_WEB}",
        dst_nodata=CODE_KEIN_WERT,
        resampling=Resampling.nearest,
    )
    return ziel, transform


def _exportiere_kachel(kachel: Kachel) -> dict[str, object] | None:
    baum_codes, transform = _kachel_mercator(DATEN / "barnim_baumarten.tif", kachel)
    if np.all(baum_codes == CODE_KEIN_WERT):
        return None
    stein, _ = _kachel_mercator(DATEN / "barnim_steinpilz_habitat.tif", kachel)
    pfiff, _ = _kachel_mercator(DATEN / "barnim_pfifferling_habitat.tif", kachel)
    reizker, _ = _kachel_mercator(DATEN / "barnim_edelreizker_habitat.tif", kachel)
    hoehe, breite = baum_codes.shape
    deckend = np.full(baum_codes.shape, UNDURCHSICHTIG, dtype=np.uint8)
    profil = {"driver": "PNG", "width": breite, "height": hoehe, "count": 4, "dtype": "uint8"}
    with rasterio.open(BARNIM_ZIEL / f"{kachel.name}.png", "w", **profil) as ziel:
        ziel.write(np.stack([_baumart_index(baum_codes), _stufe(stein), _stufe(pfiff), deckend]))
    profil_reizker = {"driver": "PNG", "width": breite, "height": hoehe, "count": 1, "dtype": "uint8"}
    with rasterio.open(BARNIM_ZIEL / f"{kachel.name}_reizker.png", "w", **profil_reizker) as ziel:
        ziel.write(_stufe(reizker), 1)
    mitte = Transformer.from_crs(EPSG_LFB, EPSG_WGS84, always_xy=True).transform(
        kachel.links + KANTE_METER / 2, kachel.unten + KANTE_METER / 2
    )
    return {
        "name": kachel.name,
        "anzeigename": "Barnim",
        "mitte": [round(mitte[0], NACHKOMMASTELLEN_GRAD), round(mitte[1], NACHKOMMASTELLEN_GRAD)],
        "breitePixel": breite,
        "hoehePixel": hoehe,
        "ecken": _ecken_wgs84(transform, breite, hoehe),
    }


def _exportiere_kachel_boden(kachel: Kachel, flaechen: gpd.GeoDataFrame) -> int:
    rechteck = box(kachel.links, kachel.unten, kachel.links + KANTE_METER, kachel.unten + KANTE_METER)
    # Zuschnitt auf die Kachel: Die Karte fragt Bodenflaechen nur an der getippten Stelle ab, Überhang wäre Ballast.
    teil = gpd.clip(flaechen, rechteck)
    teil = teil.loc[~teil.geometry.is_empty]
    teil["geometry"] = teil.geometry.simplify(VEREINFACHUNG_METER)
    teil.to_crs(EPSG_WGS84).to_file(
        BARNIM_ZIEL / f"{kachel.name}_boden.geojson", driver="GeoJSON", COORDINATE_PRECISION=NACHKOMMASTELLEN_KACHEL
    )
    return len(teil)


def _barnim() -> None:
    BARNIM_ZIEL.mkdir(parents=True, exist_ok=True)
    grenze = shape(json.loads(BARNIM_GRENZE.read_text(encoding="utf-8"))["features"][0]["geometry"])
    anteile = lies_anteile(BARNIM_ANTWORTEN)
    flaechen = gpd.read_file(DATEN / "barnim_stok_25833.gpkg")
    if flaechen.crs is None or flaechen.crs.to_epsg() != EPSG_LFB:
        raise ValueError(f"Invariante verletzt: Barnim-Flächen haben CRS {flaechen.crs}, erwartet EPSG {EPSG_LFB}")
    flaechen["boden"] = [
        beschreibe_standort(anteile[kennung]) if len(anteile[kennung]) > 0 else "Keine Bodengruppe kartiert"
        for kennung in flaechen["id"]
    ]
    flaechen = flaechen[["boden", "geometry"]]
    uebersicht = []
    for kachel in kacheln_fuer(grenze, "barnim"):
        meta = _exportiere_kachel(kachel)
        if meta is None:
            print(f"{kachel.name}: ohne Wald, übersprungen")
            continue
        anzahl = _exportiere_kachel_boden(kachel, flaechen)
        uebersicht.append(meta)
        groesse = sum((BARNIM_ZIEL / f"{kachel.name}{endung}").stat().st_size for endung in (".png", "_boden.geojson"))
        pixel = f"{meta['breitePixel']}x{meta['hoehePixel']} Pixel"
        print(f"{kachel.name}: {pixel}, {anzahl} Bodenflaechen, {groesse // 1024} KB")
    (BARNIM_ZIEL / "kacheln.json").write_text(json.dumps(uebersicht, ensure_ascii=False, indent=1), encoding="utf-8")
    _exportiere_vorschau_und_grenze(grenze)
    _exportiere_maske(grenze)


def _vorschau_raster(datei: Path, transform: rasterio.Affine, form: tuple[int, int]) -> npt.NDArray[np.uint8]:
    ziel = np.zeros(form, dtype=np.uint8)
    with rasterio.open(datei) as quelle:
        if quelle.crs.to_epsg() != EPSG_LFB:
            raise ValueError(f"Invariante verletzt: {datei.name} hat EPSG {quelle.crs.to_epsg()}, erwartet {EPSG_LFB}")
        # Mittelwert über die Habitat-Pixel (0 = kein Habitat bleibt außen vor), sonst verschluckt die Vorschau Stufen.
        reproject(
            source=rasterio.band(quelle, 1),
            destination=ziel,
            dst_transform=transform,
            dst_crs=f"EPSG:{EPSG_WEB}",
            src_nodata=0,
            dst_nodata=0,
            resampling=Resampling.average,
        )
    return ziel


def _exportiere_vorschau_und_grenze(grenze: shape) -> None:
    with rasterio.open(DATEN / "barnim_steinpilz_habitat.tif") as quelle:
        links, unten, rechts, oben = quelle.bounds
        transform, breite, hoehe = calculate_default_transform(
            quelle.crs,
            f"EPSG:{EPSG_WEB}",
            quelle.width,
            quelle.height,
            links,
            unten,
            rechts,
            oben,
            resolution=VORSCHAU_PIXEL_METER_WEB,
        )
    form = (hoehe, breite)
    stein = _vorschau_raster(DATEN / "barnim_steinpilz_habitat.tif", transform, form)
    pfiff = _vorschau_raster(DATEN / "barnim_pfifferling_habitat.tif", transform, form)
    reizker = _vorschau_raster(DATEN / "barnim_edelreizker_habitat.tif", transform, form)
    keine_baumart = np.full(form, INDEX_KEIN_WERT, dtype=np.uint8)
    deckend = np.full(form, UNDURCHSICHTIG, dtype=np.uint8)
    profil = {"driver": "PNG", "width": breite, "height": hoehe, "count": 4, "dtype": "uint8"}
    with rasterio.open(BARNIM_ZIEL / "vorschau.png", "w", **profil) as ziel:
        ziel.write(np.stack([keine_baumart, stein, pfiff, deckend]))
    with rasterio.open(BARNIM_ZIEL / "vorschau_reizker.png", "w", **{**profil, "count": 1}) as ziel:
        ziel.write(reizker, 1)
    mitte = Transformer.from_crs(EPSG_LFB, EPSG_WGS84, always_xy=True).transform(
        (links + rechts) / 2, (unten + oben) / 2
    )
    meta = {
        "name": "vorschau",
        "anzeigename": "Barnim (Vorschau)",
        "mitte": [round(mitte[0], NACHKOMMASTELLEN_GRAD), round(mitte[1], NACHKOMMASTELLEN_GRAD)],
        "breitePixel": breite,
        "hoehePixel": hoehe,
        "ecken": _ecken_wgs84(transform, breite, hoehe),
    }
    (BARNIM_ZIEL / "vorschau.json").write_text(json.dumps([meta], ensure_ascii=False, indent=1), encoding="utf-8")
    einfach = gpd.GeoSeries([grenze.simplify(GRENZE_VEREINFACHUNG_METER)], crs=EPSG_LFB).to_crs(EPSG_WGS84)
    einfach.to_file(BARNIM_ZIEL / "grenze.geojson", driver="GeoJSON", COORDINATE_PRECISION=NACHKOMMASTELLEN_KACHEL)
    groesse = sum(
        (BARNIM_ZIEL / name).stat().st_size for name in ("vorschau.png", "vorschau_reizker.png", "grenze.geojson")
    )
    print(f"vorschau: {breite}x{hoehe} Pixel, mit Grenze {groesse // 1024} KB")


def _exportiere_maske(grenze: shape) -> None:
    flaeche = gpd.GeoSeries([grenze], crs=EPSG_LFB).to_crs(EPSG_WEB).iloc[0]
    links, unten, rechts, oben = flaeche.bounds
    links, unten, rechts, oben = (
        links - MASKE_RAND_WEB,
        unten - MASKE_RAND_WEB,
        rechts + MASKE_RAND_WEB,
        oben + MASKE_RAND_WEB,
    )
    breite = int(np.ceil((rechts - links) / MASKE_ZELLE_WEB))
    hoehe = int(np.ceil((oben - unten) / MASKE_ZELLE_WEB))
    transform = from_origin(links, oben, MASKE_ZELLE_WEB, MASKE_ZELLE_WEB)
    innen = (
        np.asarray(rasterize([(flaeche, 1)], out_shape=(hoehe, breite), transform=transform, fill=0, dtype="uint8"))
        == 1
    )
    deckkraft = verlauf_ausserhalb(innen, MASKE_SIGMA_ZELLEN, MASKE_DECKKRAFT)
    kanaele = [np.full((hoehe, breite), farbe, dtype=np.uint8) for farbe in MASKE_GRAU]
    profil = {"driver": "PNG", "width": breite, "height": hoehe, "count": 4, "dtype": "uint8"}
    with rasterio.open(BARNIM_ZIEL / "maske.png", "w", **profil) as ziel:
        ziel.write(np.stack([*kanaele, deckkraft]))
    meta = {
        "name": "maske",
        "anzeigename": "Barnim (Rand)",
        "mitte": [0.0, 0.0],
        "breitePixel": breite,
        "hoehePixel": hoehe,
        "ecken": _ecken_wgs84(transform, breite, hoehe),
    }
    (BARNIM_ZIEL / "maske.json").write_text(json.dumps([meta], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"maske: {breite}x{hoehe} Pixel, {(BARNIM_ZIEL / 'maske.png').stat().st_size // 1024} KB")


def main() -> None:
    _barnim()


if __name__ == "__main__":
    main()
