import {
  deliveryFailureResponse,
  failureResponse,
  getRequestId,
  logDeliveryFailure,
  successResponse,
} from "@/lib/forms/server";
import {
  deliverWithResend,
  getResendConfig,
} from "@/lib/forms/providers";

type AuditField = "name" | "email" | "company" | "website" | "challenge";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (readString(payload, "trap")) {
    return failureResponse(
      requestId,
      422,
      "invalid_input",
      "The submitted details were not valid.",
      false,
    );
  }

  const name = readString(payload, "name");
  const email = readString(payload, "email");
  const company = readString(payload, "company");
  const website = readString(payload, "website");
  const challenge = readString(payload, "challenge");

  const fields: Partial<Record<AuditField, string>> = {};
  if (name.length < 2) fields.name = "Please enter your name.";
  if (!EMAIL_RE.test(email)) fields.email = "Please enter a valid email.";
  if (company.length < 2) fields.company = "Which company is this for?";
  if (website.length < 3) {
    fields.website = "Drop your website URL so we can take a look.";
  }
  if (challenge.length < 10) {
    fields.challenge = "Tell us a little more about what's not working.";
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

  const config = getResendConfig("audit");
  if (!config) {
    logDeliveryFailure({
      requestId,
      form: "audit",
      provider: "resend",
      code: "delivery_not_configured",
      startedAt,
    });
    return failureResponse(
      requestId,
      503,
      "delivery_not_configured",
      "Audit delivery is temporarily unavailable. Please try again later.",
      true,
    );
  }

  const subject = `Brand audit request: ${name} (${company})`;
  const html = [
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
    `<p><strong>Company:</strong> ${escapeHtml(company)}</p>`,
    `<p><strong>Website:</strong> ${escapeHtml(website)}</p>`,
    `<p><strong>Biggest brand or marketing challenge:</strong></p><p>${escapeHtml(challenge).replace(/\n/g, "<br />")}</p>`,
  ].join("");

  try {
    await deliverWithResend({
      config,
      requestId,
      replyTo: email,
      subject,
      html,
    });
    return successResponse(requestId);
  } catch (error) {
    return deliveryFailureResponse({
      error,
      requestId,
      form: "audit",
      provider: "resend",
      startedAt,
    });
  }
}
