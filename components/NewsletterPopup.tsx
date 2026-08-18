"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import Button from "@/components/Button";
import SubmissionError from "@/components/forms/SubmissionError";
import { submitPublicForm } from "@/lib/forms/client";
import type { PublicFormFailure } from "@/lib/forms/contracts";

const CHECKLIST_PATH = "/alchemy-brand-checklist.pdf";
const STORAGE_KEY = "alchemy-checklist-popup";
const CAP_DAYS = 30;
const SCROLL_THRESHOLD = 0.4; // fraction of page scrolled
const MIN_DWELL_MS = 7000; // engagement gate (mobile-safe: never on entry)

/** Paths where the pop-up should never arm (Studio + pages with their own form). */
const SUPPRESS_PREFIXES = [
  "/studio",
  "/free-brand-audit-for-smes",
  "/contact",
  "/motion",
  "/portal",
];

type FieldErrors = Partial<Record<"email" | "consent", string>>;
type Status = "idle" | "submitting" | "success" | "error";

const inputBase =
  "w-full rounded-card bg-dawn border border-dawn-60 px-4 py-3 text-white placeholder:text-white/35 " +
  "focus:outline-none focus:border-dragon-fire transition-colors duration-200";

function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(event);
}

function capped(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < CAP_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // no-op
  }
}

export default function NewsletterPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<PublicFormFailure | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const convertedRef = useRef(false);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  // Arm the scroll + dwell trigger.
  useEffect(() => {
    if (!pathname) return;
    if (SUPPRESS_PREFIXES.some((p) => pathname.startsWith(p))) return;
    if (capped()) return;

    const mountedAt = Date.now();
    let opened = false;

    const tryOpen = () => {
      if (opened) return;
      const doc = document.documentElement;
      const scrolled =
        (window.scrollY + window.innerHeight) / (doc.scrollHeight || 1);
      if (scrolled >= SCROLL_THRESHOLD && Date.now() - mountedAt >= MIN_DWELL_MS) {
        opened = true;
        window.removeEventListener("scroll", tryOpen);
        markSeen();
        pushDataLayer({ event: "newsletter_popup_shown", form_location: "popup" });
        setOpen(true);
      }
    };

    window.addEventListener("scroll", tryOpen, { passive: true });
    const timer = window.setTimeout(tryOpen, MIN_DWELL_MS + 50);
    return () => {
      window.removeEventListener("scroll", tryOpen);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  const close = useCallback(() => {
    if (!convertedRef.current) {
      pushDataLayer({ event: "newsletter_popup_dismissed", form_location: "popup" });
    }
    setOpen(false);
  }, []);

  // Focus trap, body-scroll lock, Esc to close.
  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = dialogRef.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, close]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrors({});
    setFailure(null);

    const data = new FormData(event.currentTarget);
    const payload = {
      email: String(data.get("email") ?? ""),
      consent: data.get("consent") === "on",
      company: String(data.get("company") ?? ""),
    };

    const result = await submitPublicForm<keyof FieldErrors>(
      "/api/newsletter",
      payload,
    );
    if (!result.ok) {
      setStatus("error");
      setFailure(result);
      setErrors(result.error.fields ?? {});
      return;
    }

    convertedRef.current = true;
    pushDataLayer({ event: "newsletter_signup", form_location: "popup" });
    setStatus("success");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dawn/85 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-heading"
        className="relative w-full max-w-md rounded-card bg-dawn-80 border border-dawn-60 p-7 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors text-[1.5rem] leading-none"
        >
          &times;
        </button>

        {status === "success" ? (
          <div role="status" className="text-center pt-2">
            <h2 className="font-display text-h3 text-white">Check your inbox.</h2>
            <p className="mt-3 text-white/70">
              The brand checklist is on its way. Can&apos;t wait? Grab it now.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                variant="primary"
                href={CHECKLIST_PATH}
                download
                data-autofocus
                onClick={() =>
                  pushDataLayer({
                    event: "checklist_download",
                    form_location: "popup",
                  })
                }
              >
                Download the checklist
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-dragon-fire">
              Free download
            </p>
            <h2
              id="popup-heading"
              className="font-display text-h3 mt-2 text-white"
            >
              The checklist we run{" "}
              <span className="italic">before every workshop.</span>
            </h2>
            <p className="mt-3 text-[0.95rem] leading-[1.6] text-white/65">
              Twenty things we check before any brand build. Find the gaps in
              your own brand in five minutes. Add your email and we will send it
              over.
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-6 space-y-4"
              noValidate
              aria-busy={status === "submitting"}
            >
              <div>
                <input
                  data-autofocus
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className={inputBase}
                  aria-label="Email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "popup-email-error" : undefined}
                />
                {errors.email ? (
                  <p id="popup-email-error" className="mt-2 text-[0.8rem] text-dragon-fire">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-1 size-4 shrink-0 accent-dragon-fire"
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={
                    errors.consent ? "popup-consent-error" : undefined
                  }
                />
                <span className="text-[0.8125rem] leading-[1.5] text-white/60">
                  Email me the checklist and the occasional brand note. No spam,
                  unsubscribe anytime.
                </span>
              </label>
              {errors.consent ? (
                <p id="popup-consent-error" className="text-[0.8rem] text-dragon-fire">
                  {errors.consent}
                </p>
              ) : null}

              {/* Honeypot */}
              <div
                className="absolute -left-[9999px] w-px h-px overflow-hidden"
                aria-hidden="true"
              >
                <label>
                  Company
                  <input
                    type="text"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              {failure ? (
                <SubmissionError
                  ref={errorRef}
                  failure={failure}
                  className="text-[0.875rem] text-dragon-fire bg-dawn rounded-card p-3 border border-dragon-fire/40"
                />
              ) : null}

              <Button
                variant="primary"
                type="submit"
                disabled={status === "submitting"}
                className="w-full"
              >
                {status === "submitting"
                  ? "Sending…"
                  : status === "error"
                    ? "Try again"
                    : "Send me the checklist"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
