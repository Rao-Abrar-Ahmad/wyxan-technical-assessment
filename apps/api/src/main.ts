import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger Documentation mounted at /api/docs (§7)
  const config = new DocumentBuilder()
    .setTitle("Equipment Ledger API")
    .setDescription(
      "Operational REST API for equipment store management with append-only ledger, mutual exclusion guards, and live reconstruction.",
    )
    .setVersion("1.0")
    .addTag(
      "assets",
      "Asset operations (issue, return, reserve, out-of-service, history)",
    )
    .addTag("workers", "Worker directory and certifications")
    .addTag("reservations", "Reservation queries and cancellation")
    .addTag("movements", "Ledger corrections")
    .addTag("reconstruct", "Store reconstruction as of any historical instant")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.API_PORT || process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
