import { useEffect, useMemo, useRef, useState } from "react";
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
import { DICTS, initialLang, initialTheme, type Dict, type Lang, type Theme } from "./i18n";

const ZONES = Array.from({ length: UTM_ZONE_MAX - UTM_ZONE_MIN + 1 }, (_, i) => i + UTM_ZONE_MIN);

// Fire a named Umami event if the analytics script has loaded (no-op otherwise).
function track(event: string) {
  (window as unknown as { umami?: { track?: (e: string) => void } }).umami?.track?.(event);
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const t = DICTS[lang];

  // Sync language + theme to the document and localStorage.
  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    document.title = t.title;
    localStorage.setItem("lang", lang);
  }, [lang, t]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Defaults: Ottawa / Eastern Ontario = Zone 18N, NAD83 (EPSG:26918).
  const [zone, setZone] = useState(18);
  const [hemisphere, setHemisphere] = useState<Hemisphere>("N");
  const [datum, setDatum] = useState<Datum>("NAD83");

  const epsg = useMemo(() => epsgCode(zone, hemisphere, datum), [zone, hemisphere, datum]);

  function zoneHint(z: number): string {
    if (z === 18) return t.zoneHintOttawa;
    if (z === 17) return t.zoneHintCentral;
    if (z === 16) return t.zoneHintWest;
    return "";
  }

  return (
    <div className="page">
      <div className="controls">
        <button className="ctrl" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t.switchTheme} title={t.switchTheme}>
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button className="ctrl" onClick={() => setLang(lang === "en" ? "fr" : "en")} aria-label={t.switchLang} title={t.switchLang}>
          {lang === "en" ? "FR" : "EN"}
        </button>
      </div>

      <header>
        <h1>{t.title}</h1>
        <p className="subtitle">
          {t.subtitleText}
          <strong>{t.defaultsLabel}</strong>
        </p>
      </header>

      <section className="card settings">
        <h2>{t.coordSystem}</h2>
        <div className="settings-grid">
          <label>
            {t.utmZone}
            <select value={zone} onChange={(e) => setZone(Number(e.target.value))}>
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                  {zoneHint(z)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.hemisphere}
            <select value={hemisphere} onChange={(e) => setHemisphere(e.target.value as Hemisphere)}>
              <option value="N">{t.north}</option>
              <option value="S">{t.south}</option>
            </select>
          </label>
          <label>
            {t.datum}
            <select value={datum} onChange={(e) => setDatum(e.target.value as Datum)}>
              <option value="NAD83">{t.nad83Opt}</option>
              <option value="WGS84">{t.wgs84Opt}</option>
            </select>
          </label>
          <div className="epsg-badge">
            {t.sourceCrs}
            <code>{epsg}</code>
          </div>
        </div>
        <p className="note">{t.datumNote}</p>
      </section>

      <SinglePoint t={t} zone={zone} hemisphere={hemisphere} datum={datum} />
      <BatchPanel t={t} zone={zone} hemisphere={hemisphere} datum={datum} epsg={epsg} />

      <footer>
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}

function SinglePoint({
  t,
  zone,
  hemisphere,
  datum,
}: {
  t: Dict;
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
      <h2>{t.single}</h2>
      <div className="single-grid">
        <label>
          {t.easting}
          <input
            inputMode="decimal"
            placeholder={t.eastingPlaceholder}
            value={easting}
            onChange={(e) => setEasting(e.target.value)}
          />
        </label>
        <label>
          {t.northing}
          <input
            inputMode="decimal"
            placeholder={t.northingPlaceholder}
            value={northing}
            onChange={(e) => setNorthing(e.target.value)}
          />
        </label>
      </div>
      {result && (
        <div className="single-result">
          <div>
            <span className="label">{t.latitude}</span>
            <span className="value">{result.lat.toFixed(8)}</span>
          </div>
          <div>
            <span className="label">{t.longitude}</span>
            <span className="value">{result.lng.toFixed(8)}</span>
          </div>
          <a className="btn" href={result.mapsUrl} target="_blank" rel="noreferrer" onClick={() => track("maps-click")}>
            {t.viewMaps}
          </a>
        </div>
      )}
    </section>
  );
}

function BatchPanel({
  t,
  zone,
  hemisphere,
  datum,
  epsg,
}: {
  t: Dict;
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
    track("convert-batch");
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
      track("convert-upload");
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
    track("download-csv");
  }

  const okCount = rows.filter((r) => !r.error).length;

  return (
    <section className="card">
      <h2>{t.batch}</h2>
      <p className="note">{t.batchNote}</p>
      <textarea
        rows={6}
        placeholder={"BH-01, 445000, 5030000\nBH-02, 445120, 5030090\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="batch-actions">
        <button className="btn" onClick={handlePaste}>
          {t.convertPasted}
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          {t.uploadFile}
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
            {t.downloadCsv}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <p className="count">{t.convertedOf(okCount, rows.length, epsg)}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.colLabel}</th>
                  <th>{t.colEasting}</th>
                  <th>{t.colNorthing}</th>
                  <th>{t.colLat}</th>
                  <th>{t.colLng}</th>
                  <th>{t.colMap}</th>
                  <th>{t.colNote}</th>
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
                          {t.open}
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
