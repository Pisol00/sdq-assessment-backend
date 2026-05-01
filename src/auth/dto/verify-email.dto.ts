import { Matches } from 'class-validator';

export class VerifyEmailDto {
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}
