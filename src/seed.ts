import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { User } from './users/user.entity';
import { Subscription } from './subscriptions/subscription.entity';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from './common/enums';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  const users = ds.getRepository(User);
  const subs = ds.getRepository(Subscription);

  const seedAccounts = [
    {
      email: 'admin@admin.com',
      password: 'password',
      name: 'Admin',
      role: UserRole.ADMIN,
      plan: SubscriptionPlan.LIFETIME,
    },
    {
      email: 'teacher@demo.com',
      password: 'password',
      name: 'ครูทดสอบ',
      role: UserRole.TEACHER,
      plan: SubscriptionPlan.FREE,
    },
  ];

  for (const account of seedAccounts) {
    let user = await users.findOne({ where: { email: account.email } });
    if (!user) {
      user = users.create({
        email: account.email,
        password: await bcrypt.hash(account.password, 10),
        name: account.name,
        role: account.role,
      });
      await users.save(user);
      console.log(`✓ Created user ${account.email}`);
    } else {
      console.log(`• User ${account.email} already exists`);
    }

    let sub = await subs.findOne({ where: { userId: user.id } });
    if (!sub) {
      sub = subs.create({
        userId: user.id,
        plan: account.plan,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
      });
      await subs.save(sub);
      console.log(`  ↳ subscription ${account.plan}`);
    }
  }

  await app.close();
  console.log('\n✅ Seed complete');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
