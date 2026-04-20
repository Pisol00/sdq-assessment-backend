import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Gender } from '../../common/enums';

export class CreateStudentDto {
  @ApiProperty() @IsUUID() classroomId: string;
  @ApiProperty() @IsString() @MinLength(1) studentCode: string;
  @ApiProperty() @IsString() @MinLength(1) name: string;
  @ApiProperty() @IsString() @MinLength(1) grade: string;
  @ApiProperty() @IsInt() @Min(3) @Max(25) age: number;
  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender: Gender;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
