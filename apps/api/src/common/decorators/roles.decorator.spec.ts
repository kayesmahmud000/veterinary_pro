import { Reflector } from "@nestjs/core";
import { UserRole } from "@vetralink/shared-types";
import { ROLES_KEY, Roles } from "./roles.decorator";
import { IS_PUBLIC_KEY, Public } from "./public.decorator";

describe("RBAC Decorators", () => {
  const reflector = new Reflector();

  describe("@Roles()", () => {
    class TestController {
      @Roles(UserRole.VET, UserRole.ADMIN)
      testMethod() {}
    }

    it("should set roles metadata on handler", () => {
      const target = new TestController();
      const roles = reflector.get<UserRole[]>(ROLES_KEY, target.testMethod);

      expect(roles).toEqual([UserRole.VET, UserRole.ADMIN]);
    });
  });

  describe("@Public()", () => {
    class TestPublicController {
      @Public()
      publicMethod() {}
    }

    it("should set isPublic metadata to true", () => {
      const target = new TestPublicController();
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        target.publicMethod
      );

      expect(isPublic).toBe(true);
    });
  });
});
