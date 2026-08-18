"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import Button from "@/components/Button";
import SubmissionError from "@/components/forms/SubmissionError";
import { submitPublicForm } from "@/lib/forms/client";
import type { PublicFormFailure } from "@/lib/forms/contracts";

/** Path to the lead-magnet PDF in /public. */
const CHECKLIST_PATH = "/alchemy-brand-checklist.pdf";

type FieldErrors = Partial<Record<"email" | "consent", string>>;
type Status = "idle" | "submitting" | "success" | "error";

type Props = {
  /** Distinguishes signup location in the GTM event (e.g. "homepage", "footer"). */
  location?: string;
};

const inputBase =
  "w-full rounded-card bg-dawn-80 border border-dawn-60 px-4 py-3 text-white placeholder:text-white/35 " +
  "focus:outline-none focus:border-dragon-fire transition-colors duration-200";

const labelBase =
  "text-[0.8rem] font-medium uppercase tracking-[0.08em] text-white/60 mb-2 inline-block";

function pushDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push(event);
}

export default function NewsletterSignup({ location = "homepage" }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<PublicFormFailure | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("submitting");
    setErrors({});
    setFailure(null);

    const data = new FormData(form);
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

    pushDataLayer({ event: "newsletter_signup", form_location: location });
    setStatus("success");
    form.reset();
  }

  return (
    <section
      aria-labelledby="newsletter-heading"
      className="bg-dusk text-dawn py-[140px]"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">
          <div>
            <p className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-dragon-fire">
              Free download
            </p>
            <h2
              id="newsletter-heading"
              className="font-display text-h2 mt-4 text-dawn"
            >
              The checklist we run{" "}
              <span className="italic">before every workshop.</span>
            </h2>
            <p className="mt-6 text-[1.0625rem] leading-[1.75] text-dawn/80">
              Twenty things we check before we start any brand build. Use it to
              find the gaps in your own brand: where it is vague, where it is
              inconsistent, and where it is quietly costing you work. Add your
              email and we will send it straight over, plus the occasional note
              when we publish something worth your time.
            </p>
          </div>

          <div>
            {status === "success" ? (
              <div
                role="status"
                className="rounded-card bg-dawn-80 border border-dragon-fire/60 p-8 text-center"
              >
                <h3 className="font-display text-h3 text-white">
                  Check your inbox.
                </h3>
                <p className="mt-3 text-white/70">
                  The brand checklist is on its way. Can&apos;t wait? Grab it
                  now.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="primary"
                    href={CHECKLIST_PATH}
                    download
                    onClick={() =>
                      pushDataLayer({
                        event: "checklist_download",
                        form_location: location,
                      })
                    }
                  >
                    Download the checklist
                  </Button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                className="rounded-card bg-dawn-80 border border-dawn-60 p-7 space-y-5"
                noValidate
                aria-busy={status === "submitting"}
              >
                <div>
                  <label htmlFor="newsletter-email" className={labelBase}>
                    Email
                  </label>
                  <input
                    id="newsletter-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.com"
                    className={inputBase}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? "newsletter-email-error" : undefined
                    }
                  />
                  {errors.email ? (
                    <p
                      id="newsletter-email-error"
                      className="mt-2 text-[0.8rem] text-dragon-fire"
                    >
                      {errors.email}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="consent"
                      required
                      className="mt-1 size-4 shrink-0 accent-dragon-fire"
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={
                        errors.consent ? "newsletter-consent-error" : undefined
                      }
                    />
                    <span className="text-[0.8125rem] leading-[1.5] text-white/60">
                      Email me the checklist and the occasional brand note. No
                      spam, unsubscribe anytime.
                    </span>
                  </label>
                  {errors.consent ? (
                    <p
                      id="newsletter-consent-error"
                      className="mt-2 text-[0.8rem] text-dragon-fire"
                    >
                      {errors.consent}
                    </p>
                  ) : null}
                </div>

                {/* Honeypot — hidden from humans, bots fill it. */}
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
