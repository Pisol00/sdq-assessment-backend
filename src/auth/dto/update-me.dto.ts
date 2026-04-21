import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMeDto {
  @ApiProperty({ example: 'ครูสมหญิง', required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
