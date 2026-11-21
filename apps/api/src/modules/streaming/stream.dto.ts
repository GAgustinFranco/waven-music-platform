import { ApiProperty } from '@nestjs/swagger';
import { StreamQuality } from '../users/plan.js';

export class StreamUrlDto {
  @ApiProperty({ description: 'Signed URL for `<audio src>`; supports Range requests.' })
  url: string;

  @ApiProperty({ enum: StreamQuality, enumName: 'StreamQuality' })
  quality: StreamQuality;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
