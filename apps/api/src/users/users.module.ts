import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './application/users.service';
import { UsersController } from './presentation/users.controller';

@Module({ imports: [AuthModule], providers: [UsersService], controllers: [UsersController] })
export class UsersModule {}
