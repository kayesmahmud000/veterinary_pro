import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import express, { Express, Request, Response } from "express";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

let cachedServer: Express;

async function bootstrapServer(): Promise<Express> {
  if (!cachedServer) {
    const expressApp = express();

    // Redirect root URL to interactive Swagger OpenAPI documentation
    expressApp.get("/", (_req: Request, res: Response) => {
      res.redirect("/api/docs");
    });

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        bufferLogs: true,
        rawBody: true,
      }
    );

    // Enable graceful shutdown hooks
    app.enableShutdownHooks();

    // Security headers (relaxed Content-Security-Policy for Swagger CDN assets)
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    const corsOrigins = process.env["CORS_ORIGINS"];
    app.enableCors({
      origin: corsOrigins ? corsOrigins.split(",") : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Farm-Id",
        "X-Trace-Id",
      ],
    });

    // Global API Prefix
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

    // Swagger OpenAPI Documentation with external CDN assets for Serverless compatibility
    const swaggerConfig = new DocumentBuilder()
      .setTitle("VETRALINK PRO — API Gateway")
      .setDescription(
        "Enterprise Farm SaaS ERP, LMS & Tele-Veterinary Platform API Specifications (Vercel Serverless)"
      )
      .setVersion("1.0.0")
      .addBearerAuth()
      .addApiKey(
        { type: "apiKey", name: "X-Farm-Id", in: "header" },
        "FarmTenant"
      )
      .build();

    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument, {
      customCssUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css",
      customJs: [
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js",
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js",
      ],
      customSiteTitle: "VETRALINK PRO — API Documentation",
    });

    await app.init();
    cachedServer = expressApp;
  }

  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  return server(req, res);
}
