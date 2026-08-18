import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    delete (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
  }
});
