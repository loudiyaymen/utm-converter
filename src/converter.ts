import proj4 from "proj4";

/**
 * Coordinate conversion core for Ontario geotechnical fieldwork.
 *
 * Context:
 *  - Ottawa / Eastern Ontario = UTM Zone 18N. Western Ontario spills into 17N and 16N.
 *  - Canadian surveying/geotech data is almost always NAD83 (CSRS).
 *  - Google Maps expects WGS84 (lat/long, EPSG:4326).
 *  - In Ontario the NAD83 <-> WGS84 difference is ~1-2 m: fine for pinning a borehole
 *    on a map, NOT survey-grade. We surface the datum on every result so nobody
 *    mistakes a map pin for a survey monument.
 *
 * proj4 is the same engine desktop GIS uses, so results match ArcGIS/QGIS.
 */

export type Datum = "NAD83" | "WGS84";
export type Hemisphere = "N" | "S";

// WGS84 geographic (what Google Maps uses)
const WGS84_GEO = "EPSG:4326";

// proj4 doesn't ship EPSG definitions beyond a couple of defaults, so we build the
// UTM projection string on the fly. For NAD83 vs WGS84 the ellipsoid (GRS80 vs WGS84)
// is near-identical; proj4's +datum handles the small shift.
function utmProj(zone: number, hemisphere: Hemisphere, datum: Datum): string {
  const datumTag = datum === "NAD83" ? "+datum=NAD83" : "+datum=WGS84";
  const south = hemisphere === "S" ? " +south" : "";
  return `+proj=utm +zone=${zone}${south} ${datumTag} +units=m +no_defs`;
}

/** The EPSG code for a given UTM zone/datum/hemisphere — shown to the user for traceability. */
export function epsgCode(zone: number, hemisphere: Hemisphere, datum: Datum): string {
  // NAD83 UTM North: 269xx. WGS84 UTM North: 326xx. WGS84 UTM South: 327xx.
  // NAD83 is only defined for the northern hemisphere (North America), so we fall back
  // to WGS84 codes for the (unusual) southern case.
  if (datum === "NAD83" && hemisphere === "N") return `EPSG:${26900 + zone}`;
  if (hemisphere === "N") return `EPSG:${32600 + zone}`;
  return `EPSG:${32700 + zone}`;
}

export interface ConvertResult {
  lat: number;
  lng: number;
  mapsUrl: string;
}

/** Convert a single UTM easting/northing to lat/long (WGS84, for Google Maps). */
export function utmToLatLng(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: Hemisphere,
  datum: Datum,
): ConvertResult {
  const [lng, lat] = proj4(utmProj(zone, hemisphere, datum), WGS84_GEO, [easting, northing]);
  return {
    lat,
    lng,
    mapsUrl: `https://www.google.com/maps?q=${lat.toFixed(8)},${lng.toFixed(8)}`,
  };
}

export const UTM_ZONE_MIN = 1;
export const UTM_ZONE_MAX = 60;

/**
 * Sanity-check that an easting/northing is plausibly within a UTM zone.
 * UTM eastings run roughly 160,000–834,000 m (false easting is 500,000 at the
 * central meridian). Northings run 0–10,000,000. A value far outside these
 * usually means the columns are swapped or the wrong zone was chosen.
 */
export function plausibilityWarning(easting: number, northing: number): string | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return "Not a number.";
  if (easting < 100000 || easting > 900000)
    return "Easting looks out of range (expected ~160,000–834,000 m). Columns swapped or wrong zone?";
  if (northing < 0 || northing > 10000000)
    return "Northing looks out of range (expected 0–10,000,000 m). Columns swapped?";
  return null;
}

export interface BatchRow {
  id?: string; // optional label (e.g. borehole ID) from the first column
  easting: number;
  northing: number;
  lat?: number;
  lng?: number;
  mapsUrl?: string;
  warning?: string | null;
  error?: string;
}

/**
 * Parse pasted/loaded tabular text into rows. Accepts comma, tab, or whitespace
 * separators. Recognises an optional leading label column, so both of these work:
 *   "445000, 5030000"
 *   "BH-01, 445000, 5030000"
 * A header row (containing letters in the numeric columns) is skipped automatically.
 */
export function parseRows(text: string): BatchRow[] {
  const rows: BatchRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/[,\t;]+|\s{2,}|\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    // Find the last two numeric tokens -> easting, northing. Anything before -> id.
    const nums = parts.map((p) => Number(p.replace(/[^0-9.\-]/g, "")));
    // A row where the two trailing tokens aren't numeric is treated as a header and skipped.
    const e = nums[nums.length - 2];
    const n = nums[nums.length - 1];
    if (!Number.isFinite(e) || !Number.isFinite(n)) continue;

    const id = parts.length > 2 ? parts.slice(0, parts.length - 2).join(" ") : undefined;
    rows.push({ id, easting: e, northing: n });
  }
  return rows;
}

/** Convert a batch of parsed rows in place, attaching results/warnings/errors. */
export function convertBatch(
  rows: BatchRow[],
  zone: number,
  hemisphere: Hemisphere,
  datum: Datum,
): BatchRow[] {
  return rows.map((r) => {
    const warning = plausibilityWarning(r.easting, r.northing);
    try {
      const { lat, lng, mapsUrl } = utmToLatLng(r.easting, r.northing, zone, hemisphere, datum);
      return { ...r, lat, lng, mapsUrl, warning };
    } catch (err) {
      return { ...r, warning, error: err instanceof Error ? err.message : "conversion failed" };
    }
  });
}

/** Build a CSV string of results for download. */
export function toCsv(rows: BatchRow[], epsg: string): string {
  const header = ["id", "easting", "northing", "source_crs", "latitude", "longitude", "google_maps_url", "note"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const note = r.error ? `ERROR: ${r.error}` : r.warning ?? "";
    const cells = [
      r.id ?? "",
      r.easting,
      r.northing,
      epsg,
      r.lat?.toFixed(8) ?? "",
      r.lng?.toFixed(8) ?? "",
      r.mapsUrl ?? "",
      note.replace(/"/g, '""'),
    ];
    // Quote any cell containing a comma/quote.
    lines.push(cells.map((c) => (/[",]/.test(String(c)) ? `"${c}"` : String(c))).join(","));
  }
  return lines.join("\n");
}
