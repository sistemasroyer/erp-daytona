import { Module } from '@nestjs/common';
import { ConfigMargenesController } from './config-margenes.controller';
import { ConfigMargenesService } from './config-margenes.service';

@Module({
  controllers: [ConfigMargenesController],
  providers: [ConfigMargenesService],
  exports: [ConfigMargenesService],
})
export class ConfigMargenesModule {}
