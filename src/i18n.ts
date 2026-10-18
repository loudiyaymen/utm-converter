// Lightweight i18n: EN + Canadian French (correct geomatics terminology).
// Dictionary-based — proportionate for a single-page tool; no i18n library needed.

export type Lang = "en" | "fr";

export interface Dict {
  htmlLang: string;
  title: string;
  subtitleText: string;
  defaultsLabel: string;
  // coordinate system
  coordSystem: string;
  utmZone: string;
  hemisphere: string;
  north: string;
  south: string;
  datum: string;
  nad83Opt: string;
  wgs84Opt: string;
  sourceCrs: string;
  datumNote: string;
  zoneHintOttawa: string;
  zoneHintCentral: string;
  zoneHintWest: string;
  // single point
  single: string;
  easting: string;
  northing: string;
  eastingPlaceholder: string;
  northingPlaceholder: string;
  latitude: string;
  longitude: string;
  viewMaps: string;
  // batch
  batch: string;
  batchNote: string;
  convertPasted: string;
  uploadFile: string;
  downloadCsv: string;
  colLabel: string;
  colEasting: string;
  colNorthing: string;
  colLat: string;
  colLng: string;
  colMap: string;
  colNote: string;
  open: string;
  convertedOf: (ok: number, n: number, epsg: string) => string;
  footer: string;
  // controls (aria)
  switchTheme: string;
  switchLang: string;
}

export const DICTS: Record<Lang, Dict> = {
  en: {
    htmlLang: "en",
    title: "UTM → Google Maps Converter",
    subtitleText:
      "Convert UTM easting/northing to lat/long for Google Maps. Built for Ontario geotechnical fieldwork — defaults to ",
    defaultsLabel: "Ottawa (Zone 18N, NAD83).",
    coordSystem: "Coordinate system",
    utmZone: "UTM Zone",
    hemisphere: "Hemisphere",
    north: "North",
    south: "South",
    datum: "Datum",
    nad83Opt: "NAD83 (Canadian survey/geotech)",
    wgs84Opt: "WGS84 (raw GPS / Google)",
    sourceCrs: "Source CRS",
    datumNote: "NAD83 ↔ WGS84 differ by ~1–2 m in Ontario — fine for map pins, not survey-grade.",
    zoneHintOttawa: " (Ottawa / E. Ontario)",
    zoneHintCentral: " (Central Ontario)",
    zoneHintWest: " (W. Ontario)",
    single: "Single point",
    easting: "Easting (m)",
    northing: "Northing (m)",
    eastingPlaceholder: "e.g. 445000",
    northingPlaceholder: "e.g. 5030000",
    latitude: "Latitude",
    longitude: "Longitude",
    viewMaps: "View on Google Maps →",
    batch: "Batch — paste or upload",
    batchNote:
      "Paste rows from Excel, or upload a .csv/.xlsx. Each row: optional label, then easting, then northing (e.g. BH-01, 445000, 5030000). Commas, tabs, or spaces all work. A header row is skipped automatically.",
    convertPasted: "Convert pasted rows",
    uploadFile: "Upload CSV / Excel",
    downloadCsv: "Download results CSV",
    colLabel: "Label",
    colEasting: "Easting",
    colNorthing: "Northing",
    colLat: "Latitude",
    colLng: "Longitude",
    colMap: "Map",
    colNote: "Note",
    open: "open",
    convertedOf: (ok, n, epsg) => `${ok} of ${n} converted · source ${epsg}`,
    footer:
      "Conversions by proj4 (same engine as QGIS/ArcGIS). All processing happens in your browser — no coordinates are uploaded anywhere.",
    switchTheme: "Toggle light / dark theme",
    switchLang: "Switch language",
  },
  fr: {
    htmlLang: "fr",
    title: "Convertisseur UTM → Google Maps",
    subtitleText:
      "Convertissez des coordonnées UTM (Est/Nord) en latitude/longitude pour Google Maps. Conçu pour les travaux géotechniques en Ontario — valeurs par défaut : ",
    defaultsLabel: "Ottawa (zone 18N, NAD83).",
    coordSystem: "Système de coordonnées",
    utmZone: "Zone UTM",
    hemisphere: "Hémisphère",
    north: "Nord",
    south: "Sud",
    datum: "Référentiel géodésique",
    nad83Opt: "NAD83 (levés / géotechnique au Canada)",
    wgs84Opt: "WGS84 (GPS brut / Google)",
    sourceCrs: "SRC source",
    datumNote:
      "NAD83 et WGS84 diffèrent d'environ 1–2 m en Ontario — suffisant pour un repère sur carte, mais sans précision topographique.",
    zoneHintOttawa: " (Ottawa / Est de l'Ontario)",
    zoneHintCentral: " (Centre de l'Ontario)",
    zoneHintWest: " (Ouest de l'Ontario)",
    single: "Point unique",
    easting: "Coordonnée Est (m)",
    northing: "Coordonnée Nord (m)",
    eastingPlaceholder: "p. ex. 445000",
    northingPlaceholder: "p. ex. 5030000",
    latitude: "Latitude",
    longitude: "Longitude",
    viewMaps: "Voir sur Google Maps →",
    batch: "Par lot — coller ou téléverser",
    batchNote:
      "Collez des lignes depuis Excel, ou téléversez un fichier .csv/.xlsx. Chaque ligne : une étiquette facultative, puis l'Est, puis le Nord (p. ex. BH-01, 445000, 5030000). Les virgules, tabulations et espaces fonctionnent. Une ligne d'en-tête est ignorée automatiquement.",
    convertPasted: "Convertir les lignes collées",
    uploadFile: "Téléverser CSV / Excel",
    downloadCsv: "Télécharger les résultats (CSV)",
    colLabel: "Étiquette",
    colEasting: "Est",
    colNorthing: "Nord",
    colLat: "Latitude",
    colLng: "Longitude",
    colMap: "Carte",
    colNote: "Note",
    open: "ouvrir",
    convertedOf: (ok, n, epsg) => `${ok} sur ${n} converti(e)s · source ${epsg}`,
    footer:
      "Conversions par proj4 (le même moteur que QGIS/ArcGIS). Tout le traitement se fait dans votre navigateur — aucune coordonnée n'est téléversée.",
    switchTheme: "Basculer le thème clair / sombre",
    switchLang: "Changer de langue",
  },
};

export function initialLang(): Lang {
  const saved = localStorage.getItem("lang");
  if (saved === "en" || saved === "fr") return saved;
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export type Theme = "light" | "dark";

export function initialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
