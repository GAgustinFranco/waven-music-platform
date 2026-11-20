import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ enum: ['up'] })
  database: 'up';

  @ApiProperty({ description: 'Process uptime in seconds.' })
  uptime: number;
}
