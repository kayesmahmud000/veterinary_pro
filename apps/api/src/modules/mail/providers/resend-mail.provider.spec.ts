import { ResendMailProvider } from "./resend-mail.provider";
import { EnvService } from "../../../config/env.service";

describe("ResendMailProvider", () => {
  let provider: ResendMailProvider;
  let envService: Partial<EnvService>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    envService = {
      resendApiKey: "re_test_key_123",
      emailFrom: "orders@vetralink.pro",
    };
    provider = new ResendMailProvider(envService as EnvService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should fail gracefully if RESEND_API_KEY is not configured", async () => {
    provider = new ResendMailProvider({
      emailFrom: "orders@vetralink.pro",
    } as unknown as EnvService);

    const result = await provider.sendEmail({
      to: "farmer@vetralink.pro",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY is not configured");
  });

  it("should dispatch email via Resend REST API and return message id on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: "resend-msg-999" }),
    });

    const result = await provider.sendEmail({
      to: "farmer@vetralink.pro",
      subject: "Test Subject",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key_123",
        }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("resend-msg-999");
    expect(result.provider).toBe("resend");
  });

  it("should return error details when Resend returns non-200 HTTP status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: jest.fn().mockResolvedValue({
        name: "validation_error",
        message: "The 'from' email domain is unverified",
      }),
    });

    const result = await provider.sendEmail({
      to: "farmer@vetralink.pro",
      subject: "Test Subject",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("The 'from' email domain is unverified");
  });

  it("should handle unexpected fetch network errors cleanly", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network connection reset"));

    const result = await provider.sendEmail({
      to: "farmer@vetralink.pro",
      subject: "Test Subject",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection reset");
  });
});
