import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SupplierEntity } from './entities/supplier.entity';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { UsersEntity } from 'src/users/entities/users.entity';
import { JwtAuthGuard } from 'src/middlewares/jwt-auth.middleware';
import { GetSupplierDto } from './dto/get-supplier.dto';

@Controller('supplier')
export class SupplierController {
    constructor(private readonly supplierService: SupplierService) {}
    // Create Supplier
    @Post()
    @UseGuards(JwtAuthGuard)
    async create(
        @Body() supplier: CreateSupplierDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ): Promise<SupplierEntity> {
        return await this.supplierService.create(supplier, actionBy);
    }

    // Get All Suppliers

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Query() Query : GetSupplierDto) {
        const suppliers = await this.supplierService.findAll(Query);
        const count = await this.supplierService.count(Query);
        return {
            statusCode: 200,
            data: suppliers,
            total: count
        }
    }

    // Get Supplier by ID
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async findOne(@Param('id') id: number): Promise<SupplierEntity> {
        return await this.supplierService.findOne(id);
    }

    // Update Supplier
    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async update(
        @Param('id') id: number,
        @Body() supplier: UpdateSupplierDto,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ): Promise<SupplierEntity> {
        return await this.supplierService.update(id, supplier, actionBy);
    }

    // Delete Supplier
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async delete(
        @Param('id') id: number,
        @Req() { headers: { actionBy } } : { headers: { actionBy : UsersEntity }},
    ): Promise<void> {
        await this.supplierService.delete(id, actionBy);
    }
}
