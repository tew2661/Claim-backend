import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { FilterLogDto } from './dto/filter-log.dto';
import { PaginateLogDto } from './dto/paginate-log.dto';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() filter: PaginateLogDto) {
    return this.logsService.findAll(filter);
  }
  
}
