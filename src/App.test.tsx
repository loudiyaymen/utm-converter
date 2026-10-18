import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

describe("App — UI", () => {
  it("renders the English title by default", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("UTM → Google Maps Converter");
  });

  it("switches to French when the language toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /language|langue/i }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Convertisseur UTM → Google Maps");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("toggles the theme and reflects it on <html data-theme>", async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = document.documentElement.dataset.theme;
    await user.click(screen.getByRole("button", { name: /theme|thème/i }));
    const after = document.documentElement.dataset.theme;
    expect(after).not.toBe(before);
    expect(["light", "dark"]).toContain(after);
  });

  it("converts a single point and shows lat/long", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByPlaceholderText(/e\.g\. 445000/), "445000");
    await user.type(screen.getByPlaceholderText(/e\.g\. 5030000/), "5030000");
    // Downtown Ottawa latitude ~45.4213
    expect(await screen.findByText(/45\.4213/)).toBeInTheDocument();
    expect(screen.getByText(/-75\.7030/)).toBeInTheDocument();
  });

  it("defaults the coordinate system to EPSG:26918 (Ottawa 18N NAD83)", () => {
    render(<App />);
    expect(screen.getByText("EPSG:26918")).toBeInTheDocument();
  });
});
