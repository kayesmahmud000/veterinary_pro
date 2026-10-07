import { RoleNotificationProcessor } from "./role-notification.processor";
import { RoleNotificationDispatcher } from "./role-notification-dispatcher.service";
import { roleNotificationTemplate } from "./role-notification.template";

describe("Durable role notification recovery and privacy", () => {
  let records: any, mail: any, processor: RoleNotificationProcessor;
  const context = () => ({
    delivery: {
      id: "delivery",
      status: "PENDING",
      recipient: {
        email: "synthetic@example.test",
        role: "ADMIN",
        status: "ACTIVE",
        deletedAt: null,
      },
      outbox: { eventType: "ROLE_REQUEST_SUBMITTED", locale: "en" },
    },
    request: {
      id: "request",
      targetRole: "BUYER",
      status: "PENDING",
      privateReviewNote: "private note must never be mailed",
    },
  });
  const job = (attemptsMade = 0) =>
    ({
      data: { deliveryId: "delivery" },
      attemptsMade,
      opts: { attempts: 5 },
    }) as any;
  beforeEach(() => {
    records = {
      context: jest.fn().mockResolvedValue(context()),
      skip: jest.fn(),
      sent: jest.fn(),
      failed: jest.fn(),
    };
    mail = {
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: "synthetic-provider-id",
      }),
    };
    processor = new RoleNotificationProcessor(records, mail, {
      webBaseUrl: "https://website.example.test",
      emailFrom: "roles@example.test",
    } as any);
  });
  it("records provider acceptance after sending only the protected reference", async () => {
    await processor.process(job());
    expect(mail.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "synthetic@example.test",
        text: expect.stringContaining(
          "https://website.example.test/admin/role-requests/request",
        ),
      }),
    );
    expect(JSON.stringify(mail.sendEmail.mock.calls)).not.toContain(
      "private note",
    );
    expect(records.sent).toHaveBeenCalledWith(
      "delivery",
      "synthetic-provider-id",
    );
  });
  it("does not resend a durable accepted delivery", async () => {
    records.context.mockResolvedValue({
      ...context(),
      delivery: { ...context().delivery, status: "SENT" },
    });
    await processor.process(job());
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
  it.each(["demoted", "decided", "suspended"])(
    "skips an obsolete %s reviewer notification",
    async (state) => {
      const value = context();
      if (state === "demoted") value.delivery.recipient.role = "LEARNER";
      if (state === "decided") value.request.status = "APPROVED";
      if (state === "suspended") value.delivery.recipient.status = "SUSPENDED";
      records.context.mockResolvedValue(value);
      await processor.process(job());
      expect(records.skip).toHaveBeenCalledWith("delivery");
      expect(mail.sendEmail).not.toHaveBeenCalled();
    },
  );
  it.each([0, 4])(
    "persists failure without leaking provider details at attempt %s",
    async (attempt) => {
      mail.sendEmail.mockRejectedValue(
        new Error("sensitive provider configuration"),
      );
      await expect(processor.process(job(attempt))).rejects.toThrow(
        "ROLE_EMAIL_PROVIDER_FAILURE",
      );
      expect(records.failed).toHaveBeenCalledWith("delivery", attempt === 4);
      expect(records.sent).not.toHaveBeenCalled();
    },
  );
  it("escapes public reasons and links in both languages", () => {
    for (const lang of ["bn", "en"]) {
      const value = roleNotificationTemplate(
        lang,
        "ROLE_REQUEST_REJECTED",
        "BUYER",
        'https://website.example.test/?q="x"',
        "<script>private & public</script>",
      );
      expect(value.html).not.toContain("<script>");
      expect(value.html).toContain("&lt;script&gt;");
      expect(value.html).toContain("&quot;");
    }
  });
  it("keeps dispatch durable when Redis is unavailable", async () => {
    const repository = {
      claim: jest.fn().mockResolvedValue([{ id: "event" }]),
      recipients: jest.fn().mockResolvedValue({ ids: ["reviewer"] }),
      delivery: jest
        .fn()
        .mockResolvedValue({ id: "delivery", status: "PENDING" }),
      retry: jest.fn(),
    };
    const queue = {
      add: jest.fn().mockRejectedValue(new Error("Redis unavailable")),
    };
    await new RoleNotificationDispatcher(
      repository as any,
      queue as any,
    ).dispatch();
    expect(repository.retry).toHaveBeenCalledWith("event", "DISPATCH_FAILED");
  });
  it("retains submissions until an active reviewer exists", async () => {
    const repository = {
      claim: jest.fn().mockResolvedValue([{ id: "event" }]),
      recipients: jest.fn().mockResolvedValue({ ids: [] }),
      retry: jest.fn(),
      finish: jest.fn(),
    };
    const queue = { add: jest.fn() };
    await new RoleNotificationDispatcher(
      repository as any,
      queue as any,
    ).dispatch();
    expect(repository.retry).toHaveBeenCalledWith(
      "event",
      "NO_ACTIVE_REVIEWER",
    );
    expect(repository.finish).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
