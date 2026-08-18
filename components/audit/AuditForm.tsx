"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import Button from "@/components/Button";
import SubmissionError from "@/components/forms/SubmissionError";
import type { PublicFormFailure } from "@/lib/forms/contracts";
import {
  navigateAfterConfirmedDelivery,
  submitPublicForm,
} from "@/lib/forms/client";

type FieldErrors = Partial<
  Record<"name" | "email" | "company" | "website" | "challenge", string>
>;

type Status = "idle" | "submitting" | "success" | "error";

const inputBase =
  "w-full rounded-card bg-dawn-80 border border-dawn-60 px-4 py-3 text-white placeholder:text-white/35 " +
  "focus:outline-none focus:border-dragon-fire transition-colors duration-200";

const labelBase =
  "text-[0.8rem] font-medium uppercase tracking-[0.08em] text-white/60 mb-2 inline-block";

export default function AuditForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<PublicFormFailure | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "error") errorRef.current?.focus();
  }, [status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form node now: event.currentTarget is null after the await.
    const form = event.currentTarget;
    setStatus("submitting");
    setErrors({});
    setFailure(null);

    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());

    const result = await submitPublicForm<keyof FieldErrors>(
      "/api/audit",
      payload,
    );

    if (!result.ok) {
      setStatus("error");
      setFailure(result);
      setErrors(result.error.fields ?? {});
      return;
    }

    setStatus("success");
    form.reset();
    navigateAfterConfirmedDelivery("/free-brand-audit-for-smes/thank-you");
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-card bg-dawn-80 border border-dragon-fire/60 p-8 text-center"
      >
        <h3 className="font-display text-h3 text-white">
          Got it. Audit&apos;s on the way.
        </h3>
        <p className="mt-3 text-white/70">
          We&apos;ll review your site and reply within three business days
          with a short audit doc covering what&apos;s working, what isn&apos;t,
          and what we&apos;d fix first.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-[0.875rem] text-dragon-fire hover:underline underline-offset-4"
        >
          Request another audit
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card bg-dawn-80 border border-dawn-60 p-7 space-y-5"
      noValidate
      aria-busy={status === "submitting"}
    >
      <header>
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-dragon-fire">
          Request your audit
        </p>
        <h2 className="font-display text-h3 mt-2 text-white">
          Tell us where to start.
        </h2>
      </header>

      <div>
        <label htmlFor="audit-name" className={labelBase}>
          Your name
        </label>
        <input
          id="audit-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className={inputBase}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "audit-name-error" : undefined}
        />
        {errors.name ? (
          <p id="audit-name-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="audit-email" className={labelBase}>
          Email
        </label>
        <input
          id="audit-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputBase}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "audit-email-error" : undefined}
        />
        {errors.email ? (
          <p id="audit-email-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="audit-company" className={labelBase}>
          Company
        </label>
        <input
          id="audit-company"
          name="company"
          type="text"
          autoComplete="organization"
          required
          className={inputBase}
          aria-invalid={Boolean(errors.company)}
          aria-describedby={errors.company ? "audit-company-error" : undefined}
        />
        {errors.company ? (
          <p id="audit-company-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.company}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="audit-website" className={labelBase}>
          Website
        </label>
        <input
          id="audit-website"
          name="website"
          type="url"
          placeholder="https://"
          autoComplete="url"
          required
          className={inputBase}
          aria-invalid={Boolean(errors.website)}
          aria-describedby={errors.website ? "audit-website-error" : undefined}
        />
        {errors.website ? (
          <p id="audit-website-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.website}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="audit-challenge" className={labelBase}>
          What&apos;s the biggest thing that isn&apos;t working?
        </label>
        <textarea
          id="audit-challenge"
          name="challenge"
          rows={5}
          required
          className={inputBase}
          aria-invalid={Boolean(errors.challenge)}
          aria-describedby={errors.challenge ? "audit-challenge-error" : undefined}
        />
        {errors.challenge ? (
          <p id="audit-challenge-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.challenge}
          </p>
        ) : null}
      </div>

      <div
        className="absolute -left-[9999px] w-px h-px overflow-hidden"
        aria-hidden="true"
      >
        <label>
          Leave this empty
          <input type="text" name="trap" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {failure ? (
        <SubmissionError
          ref={errorRef}
          failure={failure}
          className="text-[0.875rem] text-dragon-fire bg-dawn rounded-card p-3 border border-dragon-fire/40"
        />
      ) : null}

      <Button variant="primary" type="submit" disabled={status === "submitting"} className="w-full">
        {status === "submitting"
          ? "Sending…"
          : status === "error"
            ? "Try again"
            : "Request my audit"}
      </Button>
      <p className="text-[0.75rem] text-white/40 text-center">
        Free. No commitment. Three-business-day turnaround.
      </p>
    </form>
  );
}
