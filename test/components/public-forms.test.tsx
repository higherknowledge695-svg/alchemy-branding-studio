import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FooterNewsletter from "@/components/FooterNewsletter";
import NewsletterPopup from "@/components/NewsletterPopup";
import AuditForm from "@/components/audit/AuditForm";
import ContactForm from "@/components/contact/ContactForm";
import NewsletterSignup from "@/components/home/NewsletterSignup";

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

vi.mock("@/lib/forms/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/forms/client")>(
    "@/lib/forms/client",
  );
  return { ...actual, navigateAfterConfirmedDelivery: navigateSpy };
});

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function providerFailure(fields?: Record<string, string>) {
  return vi.fn().mockResolvedValue(
    Response.json(
      {
        ok: false,
        error: {
          code: "delivery_rejected",
          message: "The delivery service couldn't accept this just now. Please try again.",
          retryable: true,
          requestId: REQUEST_ID,
          ...(fields ? { fields } : {}),
        },
      },
      { status: 502 },
    ),
  );
}

function confirmedSuccess() {
  return vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        Response.json({ ok: true, requestId: REQUEST_ID }, { status: 200 }),
      ),
    );
}

function dataLayer() {
  return (
    window as typeof window & { dataLayer?: Record<string, unknown>[] }
  ).dataLayer ?? [];
}

function fillNewsletter() {
  const email = screen.getByRole("textbox", { name: /email/i });
  const consent = screen.getByRole("checkbox");
  fireEvent.change(email, { target: { value: "kept@example.com" } });
  fireEvent.click(consent);
  return { email, consent };
}

afterEach(() => {
  navigateSpy.mockClear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("contact and audit forms", () => {
  it("keeps contact details, focuses a retryable alert, and does not redirect on failure", async () => {
    vi.stubGlobal("fetch", providerFailure());
    render(<ContactForm />);

    const name = screen.getByLabelText("Name");
    const email = screen.getByLabelText("Email");
    const message = screen.getByLabelText("Tell us about the project");
    fireEvent.change(name, { target: { value: "Kept Name" } });
    fireEvent.change(email, { target: { value: "kept@example.com" } });
    fireEvent.change(message, {
      target: { value: "These project details must remain after failure." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Support reference: ${REQUEST_ID}`);
    expect(alert).toHaveFocus();
    expect(name).toHaveValue("Kept Name");
    expect(email).toHaveValue("kept@example.com");
    expect(message).toHaveValue("These project details must remain after failure.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("Thanks, we've got it.")).not.toBeInTheDocument();
  });

  it("keeps audit details and does not reveal success or redirect on failure", async () => {
    vi.stubGlobal("fetch", providerFailure());
    render(<AuditForm />);

    const values = {
      "Your name": "Kept Auditor",
      Email: "kept@example.com",
      Company: "Kept Company",
      Website: "https://kept.example.com",
      "What's the biggest thing that isn't working?":
        "This challenge should stay in the form after a failure.",
    };
    for (const [label, value] of Object.entries(values)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Request my audit" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    for (const [label, value] of Object.entries(values)) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
    }
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("Got it. Audit's on the way.")).not.toBeInTheDocument();
  });

  it("redirects contact and audit forms only after confirmed acceptance", async () => {
    vi.stubGlobal("fetch", confirmedSuccess());
    const { unmount } = render(<ContactForm />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Valid Name" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Tell us about the project"), {
      target: { value: "A valid project message for delivery." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/contact/confirmation"),
    );

    unmount();
    navigateSpy.mockClear();
    render(<AuditForm />);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "valid@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "Valid Company" },
    });
    fireEvent.change(screen.getByLabelText("Website"), {
      target: { value: "https://valid.example.com" },
    });
    fireEvent.change(
      screen.getByLabelText("What's the biggest thing that isn't working?"),
      { target: { value: "A valid audit challenge for delivery." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Request my audit" }));
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        "/free-brand-audit-for-smes/thank-you",
      ),
    );
  });
});

describe("newsletter forms", () => {
  it("keeps homepage newsletter input and withholds tracking and download on failure", async () => {
    vi.stubGlobal("fetch", providerFailure());
    render(<NewsletterSignup location="homepage" />);
    const { email, consent } = fillNewsletter();
    fireEvent.click(screen.getByRole("button", { name: "Send me the checklist" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(email).toHaveValue("kept@example.com");
    expect(consent).toBeChecked();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    expect(dataLayer()).not.toContainEqual(
      expect.objectContaining({ event: "newsletter_signup" }),
    );
  });

  it("keeps footer newsletter input and presents an accessible retry", async () => {
    vi.stubGlobal("fetch", providerFailure());
    render(<FooterNewsletter />);
    const { email, consent } = fillNewsletter();
    fireEvent.click(screen.getByRole("button", { name: "Send it over" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(email).toHaveValue("kept@example.com");
    expect(consent).toBeChecked();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.queryByText("Check your inbox.")).not.toBeInTheDocument();
  });

  it("keeps popup newsletter input and withholds conversion state on failure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", providerFailure());
    render(<NewsletterPopup />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_100);
    });
    vi.useRealTimers();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const { email, consent } = fillNewsletter();
    fireEvent.click(screen.getByRole("button", { name: "Send me the checklist" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveFocus();
    expect(email).toHaveValue("kept@example.com");
    expect(consent).toBeChecked();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
    expect(dataLayer()).not.toContainEqual(
      expect.objectContaining({ event: "newsletter_signup" }),
    );
  });

  it("tracks and reveals the checklist only after structured acceptance", async () => {
    vi.stubGlobal("fetch", confirmedSuccess());
    render(<NewsletterSignup location="homepage" />);
    fillNewsletter();
    fireEvent.click(screen.getByRole("button", { name: "Send me the checklist" }));

    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download the checklist" })).toBeVisible();
    expect(dataLayer()).toContainEqual({
      event: "newsletter_signup",
      form_location: "homepage",
    });
  });
});
