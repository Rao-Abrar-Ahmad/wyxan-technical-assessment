import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkersService } from './workers.service';

@ApiTags('workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({ summary: 'List all workers and their certifications' })
  async findAll() {
    return this.workersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get worker details' })
  async findOne(@Param('id') id: string) {
    return this.workersService.findOne(id);
  }
}
