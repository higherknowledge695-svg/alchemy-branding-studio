import { NextResponse } from "next/server";

import type {
  PublicFormErrorCode,
  PublicFormFailure,
  PublicFormFieldErrors,
  PublicFormSuccess,
} from "@/lib/forms/contracts";

const PROVIDER_TIMEOUT_MS = 10_000;
const REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicFormName = "contact" | "audit" | "newsletter";
export type DeliveryProvider = "resend" | "hubspot";

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Provider request timed out");
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderRejectedError extends Error {
  constructor(readonly providerStatus?: number) {
    super("Provider rejected the request");
    this.name = "ProviderRejectedError";
  }
}

export function getRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  return REQUEST_ID_RE.test(supplied) ? supplied : crypto.randomUUID();
}

export function successResponse(requestId: string) {
  return NextResponse.json<PublicFormSuccess>({ ok: true, requestId });
}

export function failureResponse<Field extends string = string>(
  requestId: string,
  status: number,
  code: PublicFormErrorCode,
  message: string,
  retryable: boolean,
  fields?: PublicFormFieldErrors<Field>,
) {
  return NextResponse.json<PublicFormFailure<Field>>(
    {
      ok: false,
      error: {
        code,
        message,
        retryable,
        requestId,
        ...(fields ? { fields } : {}),
      },
    },
    { status },
  );
}

export async function withProviderTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function logDeliveryFailure(args: {
  requestId: string;
  form: PublicFormName;
  provider: DeliveryProvider;
  code: PublicFormErrorCode;
  startedAt: number;
  providerStatus?: number;
}) {
  console.error("[public-form-delivery]", {
    requestId: args.requestId,
    form: args.form,
    provider: args.provider,
    code: args.code,
    ...(args.providerStatus === undefined
      ? {}
      : { providerStatus: args.providerStatus }),
    elapsedMs: Math.max(0, Date.now() - args.startedAt),
  });
}

export function deliveryFailureResponse(args: {
  error: unknown;
  requestId: string;
  form: PublicFormName;
  provider: DeliveryProvider;
  startedAt: number;
}) {
  if (args.error instanceof ProviderTimeoutError) {
    logDeliveryFailure({ ...args, code: "delivery_timeout" });
    return failureResponse(
      args.requestId,
      504,
      "delivery_timeout",
      "Delivery took too long. Please try again.",
      true,
    );
  }

  if (args.error instanceof ProviderRejectedError) {
    logDeliveryFailure({
      ...args,
      code: "delivery_rejected",
      providerStatus: args.error.providerStatus,
    });
    return failureResponse(
      args.requestId,
      502,
      "delivery_rejected",
      "The delivery service couldn't accept this just now. Please try again.",
      true,
    );
  }

  logDeliveryFailure({ ...args, code: "internal_error" });
  return failureResponse(
    args.requestId,
    500,
    "internal_error",
    "Something unexpected happened. Please try again.",
    true,
  );
}
