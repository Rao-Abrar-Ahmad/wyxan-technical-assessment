import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'List reservations with optional asset and status filters' })
  @ApiQuery({ name: 'assetId', required: false, description: 'Filter by asset ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (PENDING, FULFILLED, CANCELLED)' })
  async findAll(
    @Query('assetId') assetId?: string,
    @Query('status') status?: string,
  ) {
    return this.reservationsService.findAll(assetId, status);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiResponse({ status: 200, description: 'Reservation cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 409, description: 'Reservation already cancelled' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(id, dto);
  }
}
