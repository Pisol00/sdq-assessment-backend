import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImpactResponsesDto {
  @IsOptional() @IsBoolean() hasProblems?: boolean;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() distress?: string;
  @IsOptional() @IsString() homeImpact?: string;
  @IsOptional() @IsString() friendImpact?: string;
  @IsOptional() @IsString() classroomImpact?: string;
  @IsOptional() @IsString() leisureImpact?: string;
  @IsOptional() @IsString() burdenOnOthers?: string;
}

export class CreateAssessmentDto {
  @ApiProperty() @IsUUID() studentId: string;
}

export class SubmitResponsesDto {
  @ApiProperty({
    description: 'Map of questionId (1-25) to response value (0|1|2)',
    example: { '1': 0, '2': 1, '3': 2 },
  })
  @IsObject()
  responses: Record<string, 0 | 1 | 2>;

  @ApiProperty({ required: false, type: () => ImpactResponsesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImpactResponsesDto)
  impactResponses?: ImpactResponsesDto;

  @ApiProperty({ enum: [true, false] })
  @IsIn([true, false])
  completed: boolean;
}
