import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsMongoId, IsDateString } from 'class-validator';

export class IssueAssetDto {
  @ApiProperty({ description: 'ID of the worker receiving the asset', example: '652f10b7a812345678901234' })
  @IsMongoId()
  @IsNotEmpty()
  workerId: string;

  @ApiPropertyOptional({ description: 'Optional reservation ID being fulfilled', example: '652f10b7a812345678905678' })
  @IsMongoId()
  @IsOptional()
  reservationId?: string;

  @ApiProperty({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' })
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  keeperName?: string;

  @ApiPropertyOptional({ description: 'Occurred timestamp (ISO 8601)', example: '2026-09-08T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;
}
