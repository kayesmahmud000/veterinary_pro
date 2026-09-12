import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Enable graceful shutdown hooks for Prisma and async teardown
  app.enableShutdownHooks();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.enableCors({
    origin: process.env["CORS_ORIGINS"]?.split(",") || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Farm-Id", "X-Trace-Id"],
  });

  // Global prefixes
  app.setGlobalPrefix("api/v1");

  // Global Pipes & Interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("VETRALINK PRO — API Gateway")
    .setDescription("Enterprise Farm SaaS ERP, LMS & Tele-Veterinary Platform API Specifications")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-Farm-Id", in: "header" }, "FarmTenant")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const port = process.env["PORT"] ? parseInt(process.env["PORT"], 10) : 3001;
  await app.listen(port);
  logger.log(`🚀 VETRALINK PRO API operational on: http://localhost:${port}/api/v1`);
  logger.log(`📚 OpenAPI Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
