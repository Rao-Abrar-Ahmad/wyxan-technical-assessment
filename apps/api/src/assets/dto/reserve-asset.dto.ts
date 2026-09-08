import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsMongoId, IsDateString } from 'class-validator';

export class ReserveAssetDto {
  @ApiProperty({ description: 'ID of worker reserving the asset', example: '652f10b7a812345678901234' })
  @IsMongoId()
  @IsNotEmpty()
  workerId: string;

  @ApiProperty({ description: 'Window start time (ISO 8601)', example: '2026-09-09T08:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  windowStart: string;

  @ApiProperty({ description: 'Window end time (ISO 8601)', example: '2026-09-09T17:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  windowEnd: string;

  @ApiProperty({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' })
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  keeperName?: string;
}
