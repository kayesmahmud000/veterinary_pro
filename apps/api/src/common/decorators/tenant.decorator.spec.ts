import { Reflector } from "@nestjs/core";
import { FarmRole } from "@vetralink/shared-types";
import {
  FARM_ROLES_KEY,
  FarmRoles,
  TENANT_OPTIONS_KEY,
  Tenant,
  TenantOptions,
} from "./tenant.decorator";

describe("Tenant Decorators", () => {
  const reflector = new Reflector();

  describe("@Tenant()", () => {
    class TestController {
      @Tenant()
      defaultTenantMethod() {}

      @Tenant({ optional: true })
      optionalTenantMethod() {}
    }

    it("should set default tenant options { optional: false }", () => {
      const target = new TestController();
      const options = reflector.get<TenantOptions>(
        TENANT_OPTIONS_KEY,
        target.defaultTenantMethod
      );

      expect(options).toEqual({ optional: false });
    });

    it("should set custom tenant options { optional: true }", () => {
      const target = new TestController();
      const options = reflector.get<TenantOptions>(
        TENANT_OPTIONS_KEY,
        target.optionalTenantMethod
      );

      expect(options).toEqual({ optional: true });
    });
  });

  describe("@FarmRoles()", () => {
    class TestRolesController {
      @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
      managerMethod() {}
    }

    it("should set farmRoles metadata with provided roles", () => {
      const target = new TestRolesController();
      const roles = reflector.get<FarmRole[]>(
        FARM_ROLES_KEY,
        target.managerMethod
      );

      expect(roles).toEqual([FarmRole.OWNER, FarmRole.MANAGER]);
    });
  });
});
