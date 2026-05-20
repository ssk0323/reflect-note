import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInWithGoogleButton } from "./SignInWithGoogleButton";

const signInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOAuth },
  }),
}));

describe("SignInWithGoogleButton", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
  });

  it("renders a sign-in button labelled with Google", () => {
    render(<SignInWithGoogleButton redirectTo="/" />);
    expect(
      screen.getByRole("button", { name: /Google でサインイン/i }),
    ).toBeInTheDocument();
  });

  it("calls signInWithOAuth with google when clicked", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignInWithGoogleButton redirectTo="/" />);

    await user.click(
      screen.getByRole("button", { name: /Google でサインイン/i }),
    );

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });

  it("shows the error message when sign-in fails", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "boom" } });
    const user = userEvent.setup();
    render(<SignInWithGoogleButton redirectTo="/" />);

    await user.click(
      screen.getByRole("button", { name: /Google でサインイン/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
