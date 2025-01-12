import { UsersEntity } from 'src/users/entities/users.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne
} from 'typeorm';

@Entity({ schema: 'dbo', name: 'auth' })
export class AuthEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UsersEntity, user => user.id, { nullable: false, onDelete: 'CASCADE' })
  user: UsersEntity;

  @Column({ type: 'text', nullable: true , select: false })
  refreshToken: string;
}
