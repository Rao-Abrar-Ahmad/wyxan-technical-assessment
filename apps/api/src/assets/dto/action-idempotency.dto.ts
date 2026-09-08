import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActionIdempotencyDto {
  @ApiProperty({ description: 'Client-generated UUID for idempotency', example: 'd3b07384-d113-40e9-a4a3-76f57e5e31e5' })
  @IsUUID()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'Name of the keeper at the hatch', example: 'Alex Morgan' })
  @IsString()
  @IsOptional()
  keeperName?: string;
}
