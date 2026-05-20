import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the reflect-note heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /reflect-note/i }),
    ).toBeInTheDocument();
  });

  it("links to the morning setup flow", () => {
    render(<Home />);
    const link = screen.getByRole("link", {
      name: /朝のセットアップを始める/,
    });
    expect(link).toHaveAttribute("href", "/flows/morning");
  });
});
