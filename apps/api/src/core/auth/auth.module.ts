import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('env.JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('env.JWT_ACCESS_TTL') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EncryptionService],
  exports: [AuthService, EncryptionService, JwtModule],
})
export class AuthModule {}
