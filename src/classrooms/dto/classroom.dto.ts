import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @ApiProperty() @IsString() @MinLength(1) name: string;
  @ApiProperty() @IsString() @MinLength(1) grade: string;
  @ApiProperty() @IsString() @MinLength(1) section: string;
  @ApiProperty() @IsString() @MinLength(1) year: string;
}

export class UpdateClassroomDto extends PartialType(CreateClassroomDto) {}
