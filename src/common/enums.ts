export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  MONTHLY = 'MONTHLY',
  LIFETIME = 'LIFETIME',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  PROMPTPAY = 'PROMPTPAY',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum SdqInterpretation {
  NORMAL = 'ปกติ',
  AT_RISK = 'เสี่ยง',
  PROBLEMATIC = 'มีปัญหา',
}
