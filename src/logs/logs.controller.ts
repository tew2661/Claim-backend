import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { LogsService } from './logs.service';
import { FilterLogDto } from './dto/filter-log.dto';
import { PaginateLogDto } from './dto/paginate-log.dto';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() filter: PaginateLogDto,
    @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
  ) {
    return this.logsService.findAll(filter, actionBy);
  }
  
}
