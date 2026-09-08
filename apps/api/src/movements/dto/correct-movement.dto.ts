import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CorrectMovementDto {
  @ApiProperty({ description: 'The corrected occurredAt timestamp (ISO 8601)', example: '2026-09-08T09:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  correctedOccurredAt: string;

  @ApiProperty({ description: 'Free-text reason for why this correction is being made', example: 'Keeper noted return happened at 09:00, not 11:40' })
  @IsString()
  @IsNotEmpty()
  correctionReason: string;

  @ApiProperty({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' })
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  keeperName?: string;
}
