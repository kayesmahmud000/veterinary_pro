import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PUBLIC_REGISTRATION_ROLES, UserRole } from "@vetralink/shared-types";
import { RegisterDto } from "./register.dto";

describe("RegisterDto public roles", () => {
  const payload = {
    email: "new@example.com",
    password: "SecurePassword123!",
    name: "New User",
  };

  it.each(PUBLIC_REGISTRATION_ROLES)("accepts %s", async (role) => {
    const dto = plainToInstance(RegisterDto, { ...payload, role });
    expect(await validate(dto)).toEqual([]);
  });

  it("accepts an omitted role", async () => {
    expect(await validate(plainToInstance(RegisterDto, payload))).toEqual([]);
  });

  it.each([UserRole.ADMIN, UserRole.SUPER_ADMIN, "UNKNOWN_ROLE"])(
    "rejects %s",
    async (role) => {
      const errors = await validate(
        plainToInstance(RegisterDto, { ...payload, role }),
      );
      expect(errors.map((error) => error.property)).toContain("role");
    },
  );
});
