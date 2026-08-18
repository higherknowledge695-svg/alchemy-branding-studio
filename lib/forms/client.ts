import {
  isPublicFormSuccess,
  parsePublicFormFailure,
} from "@/lib/forms/contracts";
import type {
  PublicFormFailure,
  PublicFormResult,
} from "@/lib/forms/contracts";

const CLIENT_TIMEOUT_MS = 15_000;

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function clientFailure<Field extends string>(
  requestId: string,
  code: "delivery_timeout" | "internal_error",
  message: string,
): PublicFormFailure<Field> {
  return {
    ok: false,
    error: { code, message, retryable: true, requestId },
  };
}

export async function submitPublicForm<Field extends string = string>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<PublicFormResult<Field>> {
  const requestId = createRequestId();
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return clientFailure(
        requestId,
        "internal_error",
        "We couldn't confirm that your submission was received. Please try again.",
      );
    }

    if (response.ok && isPublicFormSuccess(body)) {
      return body;
    }

    const failure = parsePublicFormFailure<Field>(body);
    if (failure) return failure;

    return clientFailure(
      requestId,
      "internal_error",
      "We couldn't confirm that your submission was received. Please try again.",
    );
  } catch {
    if (didTimeout) {
      return clientFailure(
        requestId,
        "delivery_timeout",
        "The request took too long. Your details are still here, so please try again.",
      );
    }

    return clientFailure(
      requestId,
      "internal_error",
      "We couldn't send that just now. Your details are still here, so please try again.",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function navigateAfterConfirmedDelivery(path: string) {
  window.location.assign(path);
}
