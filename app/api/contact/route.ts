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

type ContactField = "name" | "email" | "message";

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
  if (readString(payload, "website")) {
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
  const message = readString(payload, "message");
  const company = readString(payload, "company");
  const service = readString(payload, "service");
  const heardAbout = readString(payload, "heardAbout");

  const fields: Partial<Record<ContactField, string>> = {};
  if (name.length < 2) fields.name = "Please enter your name.";
  if (!EMAIL_RE.test(email)) fields.email = "Please enter a valid email.";
  if (message.length < 10) {
    fields.message = "Tell us a little more about the project.";
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

  const config = getResendConfig("contact");
  if (!config) {
    logDeliveryFailure({
      requestId,
      form: "contact",
      provider: "resend",
      code: "delivery_not_configured",
      startedAt,
    });
    return failureResponse(
      requestId,
      503,
      "delivery_not_configured",
      "Message delivery is temporarily unavailable. Please try again later.",
      true,
    );
  }

  const subject = `New enquiry: ${name}${company ? ` (${company})` : ""}`;
  const lines = [
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
  ];
  if (company) lines.push(`<p><strong>Company:</strong> ${escapeHtml(company)}</p>`);
  if (service) {
    lines.push(`<p><strong>Service interest:</strong> ${escapeHtml(service)}</p>`);
  }
  if (heardAbout) {
    lines.push(`<p><strong>Heard about us:</strong> ${escapeHtml(heardAbout)}</p>`);
  }
  lines.push(
    `<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
  );

  try {
    await deliverWithResend({
      config,
      requestId,
      replyTo: email,
      subject,
      html: lines.join(""),
    });
    return successResponse(requestId);
  } catch (error) {
    return deliveryFailureResponse({
      error,
      requestId,
      form: "contact",
      provider: "resend",
      startedAt,
    });
  }
}
