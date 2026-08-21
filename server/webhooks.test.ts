import { describe, expect, it } from "vitest";
import { encryptWebhookSecret, isSafeWebhookUrl } from "./webhooks";

describe("operational webhook protections", () => {
  it("allows public HTTPS endpoints but rejects local, private, and insecure destinations", () => {
    expect(isSafeWebhookUrl("https://events.example.com/vellum")).toBe(true);
    expect(isSafeWebhookUrl("http://events.example.com/vellum")).toBe(false);
    expect(isSafeWebhookUrl("https://localhost/events")).toBe(false);
    expect(isSafeWebhookUrl("https://127.0.0.1/events")).toBe(false);
    expect(isSafeWebhookUrl("https://10.1.2.3/events")).toBe(false);
  });

  it("encrypts the one-time endpoint secret before persistence", () => {
    const encrypted = encryptWebhookSecret("whsec_example_secret");
    expect(encrypted).not.toContain("whsec_example_secret");
    expect(encrypted.split(".")).toHaveLength(3);
  });
});
