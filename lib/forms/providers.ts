import {
  ProviderRejectedError,
  withProviderTimeout,
} from "@/lib/forms/server";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const GUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMailbox(value: string) {
  const match = value.match(/<([^<>]+)>$/);
  return EMAIL_RE.test((match?.[1] ?? value).trim());
}

export type ResendDeliveryConfig = {
  apiKey: string;
  from: string;
  to: string;
};

export function getResendConfig(form: "contact" | "audit") {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const to =
    (form === "audit" ? process.env.RESEND_AUDIT_TO_EMAIL?.trim() : "") ||
    process.env.RESEND_TO_EMAIL?.trim() ||
    "";

  if (!apiKey.startsWith("re_") || !isMailbox(from) || !isMailbox(to)) {
    return null;
  }

  return { apiKey, from, to } satisfies ResendDeliveryConfig;
}

export async function deliverWithResend(args: {
  config: ResendDeliveryConfig;
  requestId: string;
  replyTo: string;
  subject: string;
  html: string;
}) {
  await withProviderTimeout(async (signal) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": args.requestId,
      },
      body: JSON.stringify({
        from: args.config.from,
        to: args.config.to,
        reply_to: args.replyTo,
        subject: args.subject,
        html: args.html,
      }),
      signal,
    });

    if (!response.ok) throw new ProviderRejectedError(response.status);

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ProviderRejectedError(response.status);
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("id" in data) ||
      typeof data.id !== "string" ||
      data.id.trim() === ""
    ) {
      throw new ProviderRejectedError(response.status);
    }
  });
}

export type HubSpotDeliveryConfig = {
  portalId: string;
  formGuid: string;
  consentText: string;
  subscriptionId: number;
  host: string;
};

export function getHubSpotConfig() {
  const portalId = process.env.HUBSPOT_PORTAL_ID?.trim() ?? "";
  const formGuid = process.env.HUBSPOT_NEWSLETTER_FORM_GUID?.trim() ?? "";
  const consentText = process.env.HUBSPOT_CONSENT_TEXT?.trim() ?? "";
  const subscriptionIdRaw =
    process.env.HUBSPOT_NEWSLETTER_SUBSCRIPTION_ID?.trim() ?? "";
  const region = process.env.HUBSPOT_FORMS_REGION?.trim().toLowerCase() || "eu1";
  const subscriptionId = Number(subscriptionIdRaw);

  if (
    !/^\d+$/.test(portalId) ||
    !GUID_RE.test(formGuid) ||
    consentText.length === 0 ||
    !/^\d+$/.test(subscriptionIdRaw) ||
    !Number.isSafeInteger(subscriptionId) ||
    subscriptionId <= 0 ||
    !/^[a-z]{2}\d$/.test(region)
  ) {
    return null;
  }

  return {
    portalId,
    formGuid,
    consentText,
    subscriptionId,
    host: region === "na1" ? "api.hsforms.com" : `api-${region}.hsforms.com`,
  } satisfies HubSpotDeliveryConfig;
}

export async function deliverWithHubSpot(args: {
  config: HubSpotDeliveryConfig;
  email: string;
}) {
  const endpoint = `https://${args.config.host}/submissions/v3/integration/submit/${args.config.portalId}/${args.config.formGuid}`;
  await withProviderTimeout(async (signal) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: [{ objectTypeId: "0-1", name: "email", value: args.email }],
        legalConsentOptions: {
          consent: {
            consentToProcess: true,
            text: args.config.consentText,
            communications: [
              {
                value: true,
                subscriptionTypeId: args.config.subscriptionId,
                text: args.config.consentText,
              },
            ],
          },
        },
        context: { pageName: "Newsletter signup", pageUri: "/" },
      }),
      signal,
    });

    if (response.status !== 200) {
      throw new ProviderRejectedError(response.status);
    }
  });
}
