"use client";

import { forwardRef } from "react";

import type { PublicFormFailure } from "@/lib/forms/contracts";

type Props = {
  failure: PublicFormFailure;
  className?: string;
};

const SubmissionError = forwardRef<HTMLDivElement, Props>(
  ({ failure, className }, ref) => (
    <div
      ref={ref}
      role="alert"
      aria-live="assertive"
      tabIndex={-1}
      className={className}
    >
      <p>{failure.error.message}</p>
      <p className="mt-1 text-[0.75rem] opacity-70">
        Support reference: {failure.error.requestId}
      </p>
    </div>
  ),
);

SubmissionError.displayName = "SubmissionError";

export default SubmissionError;
