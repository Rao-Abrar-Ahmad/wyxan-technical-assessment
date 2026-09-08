import { Controller, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { CorrectMovementDto } from './dto/correct-movement.dto';

@ApiTags('movements')
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post(':id/correct')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Correct the occurredAt timestamp of an earlier movement (ADR-0001 / §6.5)' })
  @ApiResponse({ status: 201, description: 'Correction recorded successfully' })
  @ApiResponse({ status: 404, description: 'Original movement not found' })
  @ApiResponse({ status: 409, description: 'Idempotency key reused with mismatched payload' })
  @ApiResponse({ status: 422, description: 'Business rule refusal' })
  async correctMovement(
    @Param('id') id: string,
    @Body() dto: CorrectMovementDto,
  ) {
    return this.movementsService.recordCorrection(id, dto);
  }
}
