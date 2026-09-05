import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from "@nestjs/swagger";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "System liveness and readiness probe" })
  @SwaggerResponse({ status: 200, description: "System is healthy" })
  check() {
    return {
      status: "healthy",
      service: "vetralink-api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
