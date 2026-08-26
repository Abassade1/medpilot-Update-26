import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";
import { log } from "./common/logger";
import { buildOpenApi } from "./docs/registry";

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  const env = loadEnv();

  app.set("trust proxy", env.isProd);
  app.use(helmet());
  app.use(express.json({ limit: "256kb" })); // JSON bodies only; file bytes go to storage
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  // API docs derived from the live Zod registry
  const doc = buildOpenApi();
  app.use("/docs.json", (_req: express.Request, res: express.Response) => { res.json(doc); });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc));

  app.enableShutdownHooks();
  return app;
}

async function bootstrap() {
  const env = loadEnv();
  const app = await createApp();
  await app.listen(env.PORT);
  log.info("api_started", { port: env.PORT, env: env.NODE_ENV });
}
if (require.main === module) bootstrap();
