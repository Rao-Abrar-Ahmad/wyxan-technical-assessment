"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const logger = new common_1.Logger('Bootstrap');
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Equipment Ledger API')
        .setDescription('Operational REST API for equipment store management with append-only ledger, mutual exclusion guards, and live reconstruction.')
        .setVersion('1.0')
        .addTag('assets', 'Asset operations (issue, return, reserve, out-of-service, history)')
        .addTag('workers', 'Worker directory and certifications')
        .addTag('reservations', 'Reservation queries and cancellation')
        .addTag('movements', 'Ledger corrections')
        .addTag('reconstruct', 'Store reconstruction as of any historical instant')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.API_PORT || process.env.PORT || 4000;
    await app.listen(port);
    logger.log(`API running on http://localhost:${port}`);
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map