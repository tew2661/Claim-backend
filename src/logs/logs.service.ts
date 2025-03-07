import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { LogEntity } from './entities/log.entity';
import { UsersEntity } from '../users/entities/users.entity';
import { PaginateLogDto } from './dto/paginate-log.dto';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(LogEntity)
    private readonly logRepository: Repository<LogEntity>,
  ) {}

//   async create(createLogDto: CreateLogDto) {
//     const user = await this.userRepository.findOne({
//       where: { id: createLogDto.performedBy },
//     });

//     if (!user) {
//       throw new Error('User not found');
//     }

//     const log = this.logRepository.create({
//       ...createLogDto,
//       performedBy: user,
//     });

//     return this.logRepository.save(log);
//   }

  async findAll(query: PaginateLogDto) {
    const where: FindOptionsWhere<LogEntity> | FindOptionsWhere<LogEntity>[] = [{
        ...query.qprNo ? { qprNo: Like(`%${query.qprNo}%`) } : {},
        ...query.user ? { performedBy: { id: query.user } } : {},
        ...query.documentType ? { documentType: query.documentType} : {},
        ...query.action ? { action: query.action } : {},
        ...query.roleType ? { roleType: query.roleType } : {}
    }];

    const [data, total] = await this.logRepository.findAndCount({
        relations: ['performedBy'],
        skip: query.offset,
        take: query.limit,
        where,
        order: {
            performedAt: 'DESC'
        }
    });

    return { data, total };
  }
}
