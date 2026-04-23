import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '../../common/enums';

type PaidPlan = SubscriptionPlan.MONTHLY | SubscriptionPlan.LIFETIME;

export class CreateCheckoutSessionDto {
  @ApiProperty({
    enum: [SubscriptionPlan.MONTHLY, SubscriptionPlan.LIFETIME],
    description: 'Plan to purchase (FREE is not purchasable)',
  })
  @IsEnum(SubscriptionPlan)
  plan: PaidPlan;
}
