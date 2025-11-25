import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SdsLogService } from './sds-log.service';
import { FilterSdsLogDto } from './dto/filter-sds-log.dto';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { UsersEntity } from 'src/users/entities/users.entity';

@Controller('sds-log')
@UseGuards(JwtAuthGuard)
export class SdsLogController {
    constructor(private readonly sdsLogService: SdsLogService) { }

    @Get()
    async getLogs(
        @Query() filterDto: FilterSdsLogDto,
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
    ) {
        // If user is Supplier, force filter by Supplier role
        if (actionBy?.role === 'Supplier') {
            filterDto.actionRole = 'Supplier';
        }
        const logs = await this.sdsLogService.findAll(filterDto);
        return {
            success: true,
            data: logs,
        };
    }

    @Get('by-part')
    async getLogsByPartNo(
        @Query('partNo') partNo: string,
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
    ) {
        const actionRole = actionBy?.role === 'Supplier' ? 'Supplier' : undefined;
        const logs = await this.sdsLogService.findByPartNo(partNo, actionRole);
        return {
            success: true,
            data: logs,
        };
    }

    @Get('by-inspection-detail')
    async getLogsByInspectionDetailId(
        @Query('sdsId') sdsId: number,
        @Query('inspectionDetailId') inspectionDetailId: number,
        @Req() { headers: { actionBy } }: { headers: { actionBy: UsersEntity } },
    ) {
        const actionRole = actionBy?.role === 'Supplier' ? 'Supplier' : undefined;
        const logs = await this.sdsLogService.findByInspectionDetailId(sdsId, inspectionDetailId, actionRole);
        return {
            success: true,
            data: logs,
        };
    }
}
