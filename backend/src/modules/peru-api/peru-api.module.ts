import { Global, Module } from '@nestjs/common';
import { PeruApiService } from './peru-api.service';

@Global()
@Module({
  providers: [PeruApiService],
  exports: [PeruApiService],
})
export class PeruApiModule {}
