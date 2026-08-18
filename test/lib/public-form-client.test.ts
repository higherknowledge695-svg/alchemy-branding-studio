import { afterEach, describe, expect, it, vi } from "vitest";

import { submitPublicForm } from "@/lib/forms/client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("submitPublicForm", () => {
  it("rejects an HTTP 200 response that lacks the structured success contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 200 })),
    );

    const result = await submitPublicForm("/api/contact", { name: "Test" });

    expect(result).toMatchObject({ ok: false, error: { code: "internal_error" } });
  });

  it("returns the structured server failure without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: {
              code: "invalid_input",
              message: "Check the fields.",
              retryable: false,
              requestId: "server-reference",
              fields: { email: "Invalid email" },
            },
          },
          { status: 422 },
        ),
      ),
    );

    const result = await submitPublicForm<"email">("/api/newsletter", {});

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_input",
        message: "Check the fields.",
        retryable: false,
        requestId: "server-reference",
        fields: { email: "Invalid email" },
      },
    });
  });

  it("returns a retryable client timeout after 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      ),
    );

    const resultPromise = submitPublicForm("/api/contact", {});
    await vi.advanceTimersByTimeAsync(15_000);
    const result = await resultPromise;

    expect(result).toMatchObject({
      ok: false,
      error: { code: "delivery_timeout", retryable: true },
    });
  });
});
