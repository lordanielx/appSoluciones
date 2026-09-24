import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../config/env';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: env().JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env().ACCESS_TOKEN_TTL_SECONDS, issuer: 'mecaelectric-api', audience: 'mecaelectric-web' },
        verifyOptions: { issuer: 'mecaelectric-api', audience: 'mecaelectric-web' },
      }),
    }),
  ],
  providers: [AuthService, PasswordService],
  controllers: [AuthController],
  exports: [PasswordService],
})
export class AuthModule {}
