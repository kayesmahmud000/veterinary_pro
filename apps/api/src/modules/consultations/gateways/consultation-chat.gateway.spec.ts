import { randomUUID } from "crypto";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { ConsultationChatGateway } from "./consultation-chat.gateway";
const consultationId = randomUUID();
const user = {
  sub: randomUUID(),
  email: "vet@example.test",
  role: UserRole.VET,
  status: UserStatus.ACTIVE,
  authorizationVersion: 0,
};
function socket(id = "sender", identity: any = user) {
  return {
    id,
    data: { user: identity },
    handshake: { auth: { token: "Bearer token" }, headers: {} },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as any;
}
describe("Consultation chat current authorization", () => {
  let gateway: ConsultationChatGateway,
    identities: any,
    tokens: any,
    chat: any,
    consultations: any,
    room: any[];
  beforeEach(() => {
    room = [];
    tokens = { verifyAccessToken: jest.fn(async () => user) };
    identities = { resolve: jest.fn(async (claims: any) => claims) };
    chat = {
      sendMessage: jest.fn(async () => ({ content: "message" })),
      markMessagesRead: jest.fn(),
    };
    consultations = {
      findById: jest.fn(async () => ({
        vetId: user.sub,
        farmerId: randomUUID(),
        farmId: randomUUID(),
      })),
    };
    gateway = new ConsultationChatGateway(
      tokens,
      chat,
      consultations,
      { findMembership: async () => null } as any,
      identities,
    );
    gateway.server = {
      in: jest.fn(() => ({ fetchSockets: async () => room })),
      fetchSockets: async () => room,
    } as any;
  });
  it("uses token verification and current identity on connection", async () => {
    const client = socket();
    await gateway.handleConnection(client);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("token");
    expect(identities.resolve).toHaveBeenCalledWith(user);
    expect(client.disconnect).not.toHaveBeenCalled();
  });
  it("rejects invalid tokens", async () => {
    tokens.verifyAccessToken.mockRejectedValue(new Error("Expired"));
    const client = socket();
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it.each([UserRole.LEARNER, UserRole.BUYER])(
    "rejects %s even with farm membership",
    async (role) => {
      tokens.verifyAccessToken.mockResolvedValue({ ...user, role });
      const client = socket();
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    },
  );
  it("blocks an incomplete farmer", async () => {
    tokens.verifyAccessToken.mockResolvedValue({
      ...user,
      role: UserRole.FARMER,
      farmerOnboardingRequired: true,
    });
    const client = socket();
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it("prevents a revoked passive socket receiving a broadcast", async () => {
    const active = socket(),
      stale = socket("stale", { ...user, stale: true });
    room = [active, stale];
    identities.resolve.mockImplementation(async (claims: any) => {
      if (claims.stale) throw new Error("Role changed");
      return claims;
    });
    await gateway.broadcastMessage(consultationId, {
      content: "private",
    } as any);
    expect(active.emit).toHaveBeenCalledWith("new_message", {
      content: "private",
    });
    expect(stale.emit).not.toHaveBeenCalledWith(
      "new_message",
      expect.anything(),
    );
    expect(stale.disconnect).toHaveBeenCalledWith(true);
  });
  it("checks consultation participation for typing", async () => {
    const outsider = socket("outsider", { ...user, sub: randomUUID() });
    await gateway.handleTyping(outsider, { consultationId, isTyping: true });
    expect(outsider.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(gateway.server.in).not.toHaveBeenCalled();
  });
  it("rejects stale authorization before sending", async () => {
    identities.resolve.mockRejectedValue(new Error("Revoked"));
    const client = socket();
    await gateway.handleSendMessage(client, {
      consultationId,
      content: "Hello",
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalled();
  });
  it("joins and delivers a message to an authorized participant", async () => {
    const client = socket();
    room = [client];
    await gateway.handleJoinRoom(client, { consultationId });
    await gateway.handleSendMessage(client, {
      consultationId,
      content: "Hello",
    });
    expect(client.join).toHaveBeenCalledWith(`consultation:${consultationId}`);
    expect(client.emit).toHaveBeenCalledWith("new_message", {
      content: "message",
    });
  });
  it("marks messages read for an authorized participant", async () => {
    const client = socket();
    room = [client];
    await gateway.handleMarkAsRead(client, {
      consultationId,
      messageIds: [randomUUID()],
    });
    expect(chat.markMessagesRead).toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith(
      "messages_read",
      expect.anything(),
    );
  });
});
