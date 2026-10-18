import { describe, it, expect } from "vitest";
import {
  convertBatch,
  epsgCode,
  parseRows,
  plausibilityWarning,
  toCsv,
  utmToLatLng,
} from "./converter";

describe("utmToLatLng", () => {
  it("converts a known Ottawa point (UTM 18N NAD83) to downtown lat/long", () => {
    const { lat, lng, mapsUrl } = utmToLatLng(445000, 5030000, 18, "N", "NAD83");
    expect(lat).toBeCloseTo(45.42136, 3);
    expect(lng).toBeCloseTo(-75.70301, 3);
    expect(mapsUrl).toContain("https://www.google.com/maps?q=");
  });

  it("round-trips with WGS84 within the ~2 m datum tolerance", () => {
    const nad = utmToLatLng(445000, 5030000, 18, "N", "NAD83");
    const wgs = utmToLatLng(445000, 5030000, 18, "N", "WGS84");
    expect(Math.abs(nad.lat - wgs.lat)).toBeLessThan(0.0001);
    expect(Math.abs(nad.lng - wgs.lng)).toBeLessThan(0.0001);
  });
});

describe("epsgCode", () => {
  it("maps zone/datum/hemisphere to the right EPSG code", () => {
    expect(epsgCode(18, "N", "NAD83")).toBe("EPSG:26918");
    expect(epsgCode(17, "N", "NAD83")).toBe("EPSG:26917");
    expect(epsgCode(18, "N", "WGS84")).toBe("EPSG:32618");
    expect(epsgCode(18, "S", "WGS84")).toBe("EPSG:32718");
  });
});

describe("plausibilityWarning", () => {
  it("passes in-range coordinates", () => {
    expect(plausibilityWarning(445000, 5030000)).toBeNull();
  });
  it("flags out-of-range easting (likely swapped/wrong zone)", () => {
    expect(plausibilityWarning(5030000, 445000)).toMatch(/Easting/);
  });
  it("flags non-numeric input", () => {
    expect(plausibilityWarning(NaN, 5030000)).toMatch(/number/i);
  });
});

describe("parseRows", () => {
  it("parses a labelled row with comma separators", () => {
    const rows = parseRows("BH-01, 445000, 5030000");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "BH-01", easting: 445000, northing: 5030000 });
  });

  it("parses an unlabelled row and skips a header line", () => {
    const rows = parseRows("easting,northing\n445000 5030000");
    expect(rows).toHaveLength(1);
    expect(rows[0].easting).toBe(445000);
    expect(rows[0].northing).toBe(5030000);
    expect(rows[0].id).toBeUndefined();
  });

  it("handles tabs and multiple rows", () => {
    const rows = parseRows("A\t445000\t5030000\nB\t445120\t5030090");
    expect(rows.map((r) => r.id)).toEqual(["A", "B"]);
  });
});

describe("convertBatch + toCsv", () => {
  it("converts rows and serializes CSV with a header and map URL", () => {
    const rows = convertBatch(parseRows("BH-01, 445000, 5030000"), 18, "N", "NAD83");
    expect(rows[0].lat).toBeCloseTo(45.42136, 3);
    expect(rows[0].mapsUrl).toContain("maps?q=");

    const csv = toCsv(rows, "EPSG:26918");
    const [header, firstRow] = csv.split("\n");
    expect(header).toContain("latitude");
    expect(header).toContain("google_maps_url");
    expect(firstRow).toContain("BH-01");
    expect(firstRow).toContain("EPSG:26918");
  });
});
