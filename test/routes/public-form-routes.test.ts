// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAudit } from "@/app/api/audit/route";
import { POST as postContact } from "@/app/api/contact/route";
import { POST as postNewsletter } from "@/app/api/newsletter/route";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const RESEND_SECRET = "re_super_secret_value";
const PERSONAL_EMAIL = "person-sensitive@example.com";
const PERSONAL_NAME = "Distinctive Personal Name";
const PROVIDER_SECRET = "provider-secret-response-body";

const contactPayload = {
  name: PERSONAL_NAME,
  email: PERSONAL_EMAIL,
  company: "Private Company",
  service: "Branding",
  heardAbout: "Referral or word of mouth",
  message: "Sensitive message body that must never appear in logs.",
  website: "",
};

const auditPayload = {
  name: PERSONAL_NAME,
  email: PERSONAL_EMAIL,
  company: "Private Company",
  website: "https://private.example.com",
  challenge: "Sensitive audit challenge that must never appear in logs.",
  trap: "",
};

const newsletterPayload = {
  email: PERSONAL_EMAIL,
  consent: true,
  company: "",
};

function request(path: string, body: unknown, raw = false) {
  return new Request(`https://example.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": REQUEST_ID,
    },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

function setResendEnv() {
  vi.stubEnv("RESEND_API_KEY", RESEND_SECRET);
  vi.stubEnv("RESEND_FROM_EMAIL", "Alchemy <forms@example.com>");
  vi.stubEnv("RESEND_TO_EMAIL", "studio@example.com");
  vi.stubEnv("RESEND_AUDIT_TO_EMAIL", "audits@example.com");
}

function setHubSpotEnv() {
  vi.stubEnv("HUBSPOT_PORTAL_ID", "123456");
  vi.stubEnv(
    "HUBSPOT_NEWSLETTER_FORM_GUID",
    "123e4567-e89b-42d3-a456-426614174001",
  );
  vi.stubEnv("HUBSPOT_CONSENT_TEXT", "I agree to receive brand notes.");
  vi.stubEnv("HUBSPOT_NEWSLETTER_SUBSCRIPTION_ID", "42");
  vi.stubEnv("HUBSPOT_FORMS_REGION", "eu1");
}

function hangingFetch() {
  return vi.fn((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }),
  );
}

function expectRedacted(logSpy: ReturnType<typeof vi.spyOn>) {
  const serialized = JSON.stringify(logSpy.mock.calls);
  expect(serialized).not.toContain(PERSONAL_EMAIL);
  expect(serialized).not.toContain(PERSONAL_NAME);
  expect(serialized).not.toContain("Sensitive");
  expect(serialized).not.toContain(RESEND_SECRET);
  expect(serialized).not.toContain(PROVIDER_SECRET);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/contact", () => {
  it("returns success only after Resend accepts and returns a message id", async () => {
    setResendEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ id: "resend-message-id" }, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await postContact(request("/api/contact", contactPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, requestId: REQUEST_ID });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reproduces the former false-success path as a redacted 503", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const logSpy = vi.mocked(console.error);

    const response = await postContact(request("/api/contact", contactPayload));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "delivery_not_configured", requestId: REQUEST_ID },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectRedacted(logSpy);
  });

  it("returns structured errors for invalid JSON, fields, and honeypot input", async () => {
    const invalidJson = await postContact(request("/api/contact", "{", true));
    const invalidFields = await postContact(request("/api/contact", {}));
    const honeypot = await postContact(
      request("/api/contact", { ...contactPayload, website: "bot value" }),
    );

    expect(invalidJson.status).toBe(400);
    expect((await invalidJson.json()).error.code).toBe("invalid_json");
    expect(invalidFields.status).toBe(422);
    expect((await invalidFields.json()).error.fields).toEqual({
      name: "Please enter your name.",
      email: "Please enter a valid email.",
      message: "Tell us a little more about the project.",
    });
    expect(honeypot.status).toBe(422);
    expect((await honeypot.json()).error.code).toBe("invalid_input");
  });

  it("returns a redacted 502 for provider rejection or malformed acceptance", async () => {
    setResendEnv();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(PROVIDER_SECRET, { status: 400 }))
        .mockResolvedValueOnce(Response.json({}, { status: 200 })),
    );
    const logSpy = vi.mocked(console.error);

    const rejected = await postContact(request("/api/contact", contactPayload));
    const malformed = await postContact(request("/api/contact", contactPayload));

    expect(rejected.status).toBe(502);
    expect((await rejected.json()).error.code).toBe("delivery_rejected");
    expect(malformed.status).toBe(502);
    expectRedacted(logSpy);
  });

  it("returns a 504 on timeout and a 500 on unexpected exceptions", async () => {
    setResendEnv();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const timedOutPromise = postContact(request("/api/contact", contactPayload));
    await vi.advanceTimersByTimeAsync(10_000);
    const timedOut = await timedOutPromise;
    expect(timedOut.status).toBe(504);
    expect((await timedOut.json()).error.code).toBe("delivery_timeout");

    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private failure")));
    const unexpected = await postContact(request("/api/contact", contactPayload));
    expect(unexpected.status).toBe(500);
    expect((await unexpected.json()).error.code).toBe("internal_error");
  });
});

describe("POST /api/audit", () => {
  it("accepts success and rejects missing configuration, invalid input, and honeypots", async () => {
    setResendEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ id: "audit-message" }, { status: 202 })),
    );
    const accepted = await postAudit(request("/api/audit", auditPayload));
    expect(accepted.status).toBe(200);

    vi.stubEnv("RESEND_API_KEY", "");
    const unconfigured = await postAudit(request("/api/audit", auditPayload));
    expect(unconfigured.status).toBe(503);
    expect((await unconfigured.json()).error.code).toBe("delivery_not_configured");

    const invalid = await postAudit(request("/api/audit", {}));
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.fields).toHaveProperty("challenge");

    const honeypot = await postAudit(
      request("/api/audit", { ...auditPayload, trap: "bot value" }),
    );
    expect(honeypot.status).toBe(422);
  });

  it("returns structured rejection, timeout, and unexpected failures", async () => {
    setResendEnv();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    const rejected = await postAudit(request("/api/audit", auditPayload));
    expect(rejected.status).toBe(502);

    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const timeoutPromise = postAudit(request("/api/audit", auditPayload));
    await vi.advanceTimersByTimeAsync(10_000);
    const timeout = await timeoutPromise;
    expect(timeout.status).toBe(504);

    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unexpected")));
    const unexpected = await postAudit(request("/api/audit", auditPayload));
    expect(unexpected.status).toBe(500);
  });
});

describe("POST /api/newsletter", () => {
  it("returns success only after HubSpot returns its documented 200 acceptance", async () => {
    setHubSpotEnv();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ inlineMessage: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await postNewsletter(
      request("/api/newsletter", newsletterPayload),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, requestId: REQUEST_ID });
    expect(String(fetchMock.mock.calls[0][0])).toContain("api-eu1.hsforms.com");
  });

  it("reproduces missing configuration and rejects invalid and honeypot input", async () => {
    const missing = await postNewsletter(
      request("/api/newsletter", newsletterPayload),
    );
    expect(missing.status).toBe(503);
    expect((await missing.json()).error.code).toBe("delivery_not_configured");

    const invalid = await postNewsletter(request("/api/newsletter", {}));
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.fields).toEqual({
      email: "Please enter a valid email.",
      consent: "Please tick the box so we can email you the checklist.",
    });

    const honeypot = await postNewsletter(
      request("/api/newsletter", { ...newsletterPayload, company: "bot" }),
    );
    expect(honeypot.status).toBe(422);
  });

  it("returns redacted rejection, timeout, and unexpected failures", async () => {
    setHubSpotEnv();
    const logSpy = vi.mocked(console.error);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(PROVIDER_SECRET, { status: 400 })),
    );
    const rejected = await postNewsletter(
      request("/api/newsletter", newsletterPayload),
    );
    expect(rejected.status).toBe(502);
    expectRedacted(logSpy);

    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const timeoutPromise = postNewsletter(
      request("/api/newsletter", newsletterPayload),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const timeout = await timeoutPromise;
    expect(timeout.status).toBe(504);

    vi.useRealTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("unexpected")));
    const unexpected = await postNewsletter(
      request("/api/newsletter", newsletterPayload),
    );
    expect(unexpected.status).toBe(500);
  });
});
