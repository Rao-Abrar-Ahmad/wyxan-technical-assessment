import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReconstructService } from './reconstruct.service';

@ApiTags('reconstruct')
@Controller('reconstruct')
export class ReconstructController {
  constructor(private readonly reconstructService: ReconstructService) {}

  @Get()
  @ApiOperation({
    summary: 'Reconstruct the whole store state as it stood at any past instant (§6.6)',
    description: 'Folds all ledger movements up to asOf live per request, honoring latest corrections.',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    description: 'ISO 8601 timestamp (e.g. 2026-09-08T14:20:00Z). Defaults to now.',
  })
  async reconstructStore(@Query('asOf') asOf?: string): Promise<any> {
    return this.reconstructService.reconstructStore(asOf);
  }
}
