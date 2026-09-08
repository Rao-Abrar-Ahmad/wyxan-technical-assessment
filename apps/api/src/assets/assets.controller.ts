import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { ReserveAssetDto } from './dto/reserve-asset.dto';
import { ActionIdempotencyDto } from './dto/action-idempotency.dto';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all assets with computed operational statuses' })
  @ApiQuery({ name: 'kind', required: false, description: 'Filter by asset kind' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (IN_STORE, ISSUED, RESERVED, OUT_OF_SERVICE)' })
  async findAll(@Query('kind') kind?: string, @Query('status') status?: string): Promise<any[]> {
    return this.assetsService.findAll(kind, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a single asset' })
  async findOne(@Param('id') id: string): Promise<any> {
    return this.assetsService.findOne(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get full movement history for an asset with corrections and derived state' })
  @ApiQuery({ name: 'asOf', required: false, description: 'ISO 8601 instant to fold state up to' })
  async getHistory(@Param('id') id: string, @Query('asOf') asOf?: string): Promise<any> {
    return this.assetsService.getHistory(id, asOf);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue an asset to a worker (ADR-0001)' })
  @ApiResponse({ status: 201, description: 'Asset issued successfully' })
  @ApiResponse({ status: 409, description: 'Asset already held or idempotency conflict' })
  @ApiResponse({ status: 422, description: 'Worker lacks required certification or cert expired' })
  async issue(@Param('id') id: string, @Body() dto: IssueAssetDto) {
    return this.assetsService.issue(id, dto);
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return an asset from a worker' })
  @ApiResponse({ status: 200, description: 'Asset returned successfully' })
  @ApiResponse({ status: 409, description: 'Asset is not currently issued' })
  @ApiResponse({ status: 422, description: 'Backdated before issue occurredAt' })
  async returnAsset(@Param('id') id: string, @Body() dto: ReturnAssetDto) {
    return this.assetsService.returnAsset(id, dto);
  }

  @Post(':id/reserve')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reserve an asset for a time window' })
  @ApiResponse({ status: 201, description: 'Reservation created successfully' })
  @ApiResponse({ status: 409, description: 'Reservation window overlaps with existing reservation' })
  @ApiResponse({ status: 422, description: 'Asset is out of service or invalid window' })
  async reserve(@Param('id') id: string, @Body() dto: ReserveAssetDto) {
    return this.assetsService.reserve(id, dto);
  }

  @Post(':id/out-of-service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an in-store asset out of service (ADR-0002)' })
  @ApiResponse({ status: 200, description: 'Asset marked out of service, pending reservations cancelled' })
  @ApiResponse({ status: 422, description: 'Cannot mark an issued asset out of service directly' })
  async outOfService(@Param('id') id: string, @Body() dto: ActionIdempotencyDto) {
    return this.assetsService.outOfService(id, dto);
  }

  @Post(':id/back-in-service')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an out-of-service asset back into service' })
  @ApiResponse({ status: 200, description: 'Asset returned to service' })
  @ApiResponse({ status: 409, description: 'Asset is already in service' })
  async backInService(@Param('id') id: string, @Body() dto: ActionIdempotencyDto) {
    return this.assetsService.backInService(id, dto);
  }
}
