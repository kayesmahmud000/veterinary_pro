import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { RoleNotificationsWorkerModule } from "./modules/role-notifications/role-notifications-worker.module";
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    RoleNotificationsWorkerModule,
  );
  app.enableShutdownHooks();
}
void bootstrap();
