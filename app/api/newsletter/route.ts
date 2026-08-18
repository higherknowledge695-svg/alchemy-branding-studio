import {
  deliveryFailureResponse,
  failureResponse,
  getRequestId,
  logDeliveryFailure,
  successResponse,
} from "@/lib/forms/server";
import {
  deliverWithHubSpot,
  getHubSpotConfig,
} from "@/lib/forms/providers";

type NewsletterField = "email" | "consent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isConsented(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function readString(body: Record<string, unknown>, field: string) {
  return typeof body[field] === "string" ? body[field].trim() : "";
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failureResponse(
      requestId,
      400,
      "invalid_json",
      "The request was not valid JSON.",
      false,
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return failureResponse(
      requestId,
      400,
      "invalid_json",
      "The request was not valid JSON.",
      false,
    );
  }

  const payload = body as Record<string, unknown>;
  if (readString(payload, "company")) {
    return failureResponse(
      requestId,
      422,
      "invalid_input",
      "The submitted details were not valid.",
      false,
    );
  }

  const email = readString(payload, "email");
  const fields: Partial<Record<NewsletterField, string>> = {};
  if (!EMAIL_RE.test(email)) fields.email = "Please enter a valid email.";
  if (!isConsented(payload.consent)) {
    fields.consent = "Please tick the box so we can email you the checklist.";
  }

  if (Object.keys(fields).length > 0) {
    return failureResponse(
      requestId,
      422,
      "invalid_input",
      "Please check the highlighted fields.",
      false,
      fields,
    );
  }

  const config = getHubSpotConfig();
  if (!config) {
    logDeliveryFailure({
      requestId,
      form: "newsletter",
      provider: "hubspot",
      code: "delivery_not_configured",
      startedAt,
    });
    return failureResponse(
      requestId,
      503,
      "delivery_not_configured",
      "Newsletter signup is temporarily unavailable. Please try again later.",
      true,
    );
  }

  try {
    await deliverWithHubSpot({ config, email });
    return successResponse(requestId);
  } catch (error) {
    return deliveryFailureResponse({
      error,
      requestId,
      form: "newsletter",
      provider: "hubspot",
      startedAt,
    });
  }
}
