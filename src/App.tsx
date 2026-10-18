import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  convertBatch,
  epsgCode,
  parseRows,
  toCsv,
  utmToLatLng,
  UTM_ZONE_MAX,
  UTM_ZONE_MIN,
  type BatchRow,
  type Datum,
  type Hemisphere,
} from "./converter";

const ZONES = Array.from({ length: UTM_ZONE_MAX - UTM_ZONE_MIN + 1 }, (_, i) => i + UTM_ZONE_MIN);

export default function App() {
  // Defaults: Ottawa / Eastern Ontario = Zone 18N, NAD83 (EPSG:26918).
  const [zone, setZone] = useState(18);
  const [hemisphere, setHemisphere] = useState<Hemisphere>("N");
  const [datum, setDatum] = useState<Datum>("NAD83");

  const epsg = useMemo(() => epsgCode(zone, hemisphere, datum), [zone, hemisphere, datum]);

  return (
    <div className="page">
      <header>
        <h1>UTM → Google Maps Converter</h1>
        <p className="subtitle">
          Convert UTM easting/northing to lat/long for Google Maps. Built for Ontario geotechnical
          fieldwork — defaults to <strong>Ottawa (Zone 18N, NAD83)</strong>.
        </p>
      </header>

      <section className="card settings">
        <h2>Coordinate system</h2>
        <div className="settings-grid">
          <label>
            UTM Zone
            <select value={zone} onChange={(e) => setZone(Number(e.target.value))}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                  {z === 18 ? " (Ottawa / E. Ontario)" : z === 17 ? " (Central Ontario)" : z === 16 ? " (W. Ontario)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hemisphere
            <select value={hemisphere} onChange={(e) => setHemisphere(e.target.value as Hemisphere)}>
              <option value="N">North</option>
              <option value="S">South</option>
            </select>
          </label>
          <label>
            Datum
            <select value={datum} onChange={(e) => setDatum(e.target.value as Datum)}>
              <option value="NAD83">NAD83 (Canadian survey/geotech)</option>
              <option value="WGS84">WGS84 (raw GPS / Google)</option>
            </select>
          </label>
          <div className="epsg-badge">
            Source CRS
            <code>{epsg}</code>
          </div>
        </div>
        <p className="note">
          NAD83 ↔ WGS84 differ by ~1–2&nbsp;m in Ontario — fine for map pins, not survey-grade.
        </p>
      </section>

      <SinglePoint zone={zone} hemisphere={hemisphere} datum={datum} />
      <BatchPanel zone={zone} hemisphere={hemisphere} datum={datum} epsg={epsg} />

      <footer>
        <p>
          Conversions by <code>proj4</code> (same engine as QGIS/ArcGIS). All processing happens in
          your browser — no coordinates are uploaded anywhere.
        </p>
      </footer>
    </div>
  );
}

function SinglePoint({
  zone,
  hemisphere,
  datum,
}: {
  zone: number;
  hemisphere: Hemisphere;
  datum: Datum;
}) {
  const [easting, setEasting] = useState("");
  const [northing, setNorthing] = useState("");

  const result = useMemo(() => {
    const e = Number(easting);
    const n = Number(northing);
    if (!easting || !northing || !Number.isFinite(e) || !Number.isFinite(n)) return null;
    return utmToLatLng(e, n, zone, hemisphere, datum);
  }, [easting, northing, zone, hemisphere, datum]);

  return (
    <section className="card">
      <h2>Single point</h2>
      <div className="single-grid">
        <label>
          Easting (m)
          <input
            inputMode="decimal"
            placeholder="e.g. 445000"
            value={easting}
            onChange={(e) => setEasting(e.target.value)}
          />
        </label>
        <label>
          Northing (m)
          <input
            inputMode="decimal"
            placeholder="e.g. 5030000"
            value={northing}
            onChange={(e) => setNorthing(e.target.value)}
          />
        </label>
      </div>
      {result && (
        <div className="single-result">
          <div>
            <span className="label">Latitude</span>
            <span className="value">{result.lat.toFixed(8)}</span>
          </div>
          <div>
            <span className="label">Longitude</span>
            <span className="value">{result.lng.toFixed(8)}</span>
          </div>
          <a className="btn" href={result.mapsUrl} target="_blank" rel="noreferrer">
            View on Google Maps →
          </a>
        </div>
      )}
    </section>
  );
}

function BatchPanel({
  zone,
  hemisphere,
  datum,
  epsg,
}: {
  zone: number;
  hemisphere: Hemisphere;
  datum: Datum;
  epsg: string;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function runConversion(parsed: BatchRow[]) {
    setRows(convertBatch(parsed, zone, hemisphere, datum));
  }

  function handlePaste() {
    runConversion(parseRows(text));
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // Flatten the first sheet to CSV text, then reuse the same tolerant parser.
      const csv = XLSX.utils.sheet_to_csv(sheet);
      setText(csv);
      runConversion(parseRows(csv));
    };
    reader.readAsBinaryString(file);
  }

  function download() {
    const csv = toCsv(rows, epsg);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "utm-converted.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const okCount = rows.filter((r) => !r.error).length;

  return (
    <section className="card">
      <h2>Batch — paste or upload</h2>
      <p className="note">
        Paste rows from Excel, or upload a <code>.csv</code>/<code>.xlsx</code>. Each row:
        optional label, then easting, then northing (e.g. <code>BH-01, 445000, 5030000</code>).
        Commas, tabs, or spaces all work. A header row is skipped automatically.
      </p>
      <textarea
        rows={6}
        placeholder={"BH-01, 445000, 5030000\nBH-02, 445120, 5030090\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="batch-actions">
        <button className="btn" onClick={handlePaste}>
          Convert pasted rows
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          Upload CSV / Excel
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {rows.length > 0 && (
          <button className="btn solid" onClick={download}>
            Download results CSV
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <p className="count">
            {okCount} of {rows.length} converted · source {epsg}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Easting</th>
                  <th>Northing</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Map</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.error ? "row-error" : r.warning ? "row-warn" : ""}>
                    <td>{r.id ?? ""}</td>
                    <td>{r.easting}</td>
                    <td>{r.northing}</td>
                    <td>{r.lat?.toFixed(7) ?? "—"}</td>
                    <td>{r.lng?.toFixed(7) ?? "—"}</td>
                    <td>
                      {r.mapsUrl ? (
                        <a href={r.mapsUrl} target="_blank" rel="noreferrer">
                          open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="note-cell">{r.error ? `⚠ ${r.error}` : r.warning ? `⚠ ${r.warning}` : "✓"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
