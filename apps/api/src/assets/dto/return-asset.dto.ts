import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsMongoId, IsIn, IsDateString } from 'class-validator';
import { ReturnCondition } from '../../schemas/movement.schema';

export class ReturnAssetDto {
  @ApiPropertyOptional({ description: 'ID of worker physically returning the asset (defaults to current holder)', example: '652f10b7a812345678901234' })
  @IsMongoId()
  @IsOptional()
  workerId?: string;

  @ApiProperty({ description: 'Condition upon return (OK or DAMAGED)', enum: ['OK', 'DAMAGED'], example: 'OK' })
  @IsIn(['OK', 'DAMAGED'])
  @IsNotEmpty()
  condition: ReturnCondition;

  @ApiPropertyOptional({ description: 'When the return physically occurred (can be backdated)', example: '2026-09-08T11:40:00Z' })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @ApiProperty({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' })
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  keeperName?: string;
}
