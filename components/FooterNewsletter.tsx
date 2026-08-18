"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import Button from "@/components/Button";
import SubmissionError from "@/components/forms/SubmissionError";
import { submitPublicForm } from "@/lib/forms/client";
import type { PublicFormFailure } from "@/lib/forms/contracts";

const CHECKLIST_PATH = "/alchemy-brand-checklist.pdf";

type FieldErrors = Partial<Record<"email" | "consent", string>>;
type Status = "idle" | "submitting" | "success" | "error";

const inputBase =
  "w-full rounded-card bg-dawn-80 border border-dawn-60 px-4 py-3 text-[0.9rem] text-white " +
  "placeholder:text-white/35 focus:outline-none focus:border-dragon-fire transition-colors duration-200";

function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(event);
}

export default function FooterNewsletter() {
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<PublicFormFailure | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

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

    pushDataLayer({ event: "newsletter_signup", form_location: "footer" });
    setStatus("success");
  }

  return (
    <div className="border-b border-dawn-80 pb-12 mb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-dragon-fire">
            The brand checklist
          </p>
          <h2 className="font-display text-h3 mt-3 text-white">
            Find the gaps before your buyers do.
          </h2>
          <p className="mt-3 text-[0.9rem] leading-[1.6] text-white/60 max-w-md">
            Twenty things we check before any brand build. Free, straight to
            your inbox.
          </p>
        </div>

        <div className="lg:pt-1">
          {status === "success" ? (
            <div role="status" className="text-[0.95rem] text-white/80">
              <p className="font-display text-[1.125rem] text-white">
                Check your inbox.
              </p>
              <p className="mt-2 text-white/60">
                The checklist is on its way.{" "}
                <a
                  href={CHECKLIST_PATH}
                  download
                  onClick={() =>
                    pushDataLayer({
                      event: "checklist_download",
                      form_location: "footer",
                    })
                  }
                  className="text-dragon-fire underline underline-offset-4 hover:text-fire-80 transition-colors"
                >
                  Download it now.
                </a>
              </p>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              noValidate
              className="space-y-3"
              aria-busy={status === "submitting"}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className={inputBase}
                  aria-label="Email"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "footer-email-error" : undefined}
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={status === "submitting"}
                  className="shrink-0"
                >
                  {status === "submitting"
                    ? "Sending…"
                    : status === "error"
                      ? "Try again"
                      : "Send it over"}
                </Button>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-0.5 size-4 shrink-0 accent-dragon-fire"
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={
                    errors.consent ? "footer-consent-error" : undefined
                  }
                />
                <span className="text-[0.75rem] leading-[1.5] text-white/45">
                  Email me the checklist and the occasional brand note. No spam,
                  unsubscribe anytime.
                </span>
              </label>

              {errors.email ? (
                <p id="footer-email-error" className="text-[0.8rem] text-dragon-fire">
                  {errors.email}
                </p>
              ) : null}
              {errors.consent ? (
                <p id="footer-consent-error" className="text-[0.8rem] text-dragon-fire">
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
                  className="text-[0.8rem] text-dragon-fire"
                />
              ) : null}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
