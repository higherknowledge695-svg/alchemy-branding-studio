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

const serviceOptions = [
  "Branding",
  "Animation",
  "Website",
  "Strategy",
  "Proposal Design",
  "Not sure yet",
] as const;

const heardAboutOptions = [
  "Google search",
  "Social media",
  "LinkedIn",
  "Referral or word of mouth",
  "Brand to Scale podcast",
  "Event or talk",
  "Other",
] as const;

type FieldErrors = Partial<
  Record<"name" | "email" | "message", string>
>;

type Status = "idle" | "submitting" | "success" | "error";

const inputBase =
  "w-full rounded-card bg-dawn-80 border border-dawn-60 px-4 py-3 text-white placeholder:text-white/35 " +
  "focus:outline-none focus:border-dragon-fire transition-colors duration-200";

const labelBase =
  "text-[0.8rem] font-medium uppercase tracking-[0.08em] text-white/60 mb-2 inline-block";

export default function ContactForm() {
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
      "/api/contact",
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
    navigateAfterConfirmedDelivery("/contact/confirmation");
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-card bg-dawn-80 border border-dragon-fire/60 p-8 text-center"
      >
        <h3 className="font-display text-h3 text-white">
          Thanks, we&apos;ve got it.
        </h3>
        <p className="mt-3 text-white/70">
          We&apos;ll reply within one business day. If it&apos;s urgent,
          WhatsApp us. We&apos;re faster there.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-[0.875rem] text-dragon-fire hover:underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6"
      noValidate
      aria-busy={status === "submitting"}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className={labelBase}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputBase}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name ? (
            <p id="name-error" className="mt-2 text-[0.8rem] text-dragon-fire">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email" className={labelBase}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputBase}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? (
            <p id="email-error" className="mt-2 text-[0.8rem] text-dragon-fire">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="company" className={labelBase}>
          Company <span className="text-white/35 normal-case">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          className={inputBase}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="service" className={labelBase}>
            What are you looking for?
          </label>
          <select id="service" name="service" defaultValue="" className={inputBase}>
            <option value="">Choose one</option>
            {serviceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="heardAbout" className={labelBase}>
            Where did you hear about us?
          </label>
          <select id="heardAbout" name="heardAbout" defaultValue="" className={inputBase}>
            <option value="">Choose one</option>
            {heardAboutOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className={labelBase}>
          Tell us about the project
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          className={inputBase}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message ? (
          <p id="message-error" className="mt-2 text-[0.8rem] text-dragon-fire">
            {errors.message}
          </p>
        ) : null}
      </div>

      {/* Honeypot: hidden from humans, visible to naive bots. */}
      <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {failure ? (
        <SubmissionError
          ref={errorRef}
          failure={failure}
          className="text-[0.875rem] text-dragon-fire bg-dawn-80 rounded-card p-3 border border-dragon-fire/40"
        />
      ) : null}

      <div className="flex items-center gap-4">
        <Button variant="primary" type="submit" disabled={status === "submitting"}>
          {status === "submitting"
            ? "Sending…"
            : status === "error"
              ? "Try again"
              : "Send message"}
        </Button>
        <p className="text-[0.8rem] text-white/40">
          We&apos;ll reply within one business day.
        </p>
      </div>
    </form>
  );
}
