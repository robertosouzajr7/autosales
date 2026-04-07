import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { LeadsService } from '../../application/services/leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async findAll() {
    return this.leadsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Post()
  async create(@Body() data: any) {
    return this.leadsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.leadsService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.leadsService.delete(id);
  }
}
