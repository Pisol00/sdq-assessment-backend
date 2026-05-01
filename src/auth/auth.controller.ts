import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditCtx } from '../audit/audit-context.decorator';
import type { AuditContext } from '../audit/audit-log.service';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { User } from '../users/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto, @AuditCtx() ctx: AuditContext) {
    return this.authService.signup(dto, ctx);
  }

  @Post('signin')
  signin(@Body() dto: SigninDto, @AuditCtx() ctx: AuditContext) {
    return this.authService.signin(dto, ctx);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      ctx,
    );
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @AuditCtx() ctx: AuditContext) {
    return this.authService.requestPasswordReset(dto.email, ctx);
  }

  @Get('forgot-password/:token')
  getPasswordResetSession(@Param('token') token: string) {
    return this.authService.getPasswordResetSession(token);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password/:token/verify-code')
  @HttpCode(200)
  verifyPasswordResetCode(
    @Param('token') token: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyPasswordResetCode(token, code);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password/:token/resend')
  @HttpCode(200)
  resendPasswordResetCode(@Param('token') token: string) {
    return this.authService.resendPasswordResetCode(token);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @AuditCtx() ctx: AuditContext) {
    return this.authService.resetPassword(
      dto.sessionToken,
      dto.code,
      dto.newPassword,
      ctx,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('verify-email/request')
  @HttpCode(200)
  requestEmailVerification(@CurrentUser() user: User) {
    return this.authService.requestEmailVerification(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('verify-email/confirm')
  @HttpCode(200)
  verifyEmail(
    @CurrentUser() user: User,
    @Body() dto: VerifyEmailDto,
    @AuditCtx() ctx: AuditContext,
  ) {
    return this.authService.verifyEmail(user.id, dto.code, ctx);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('check-email/:token')
  getCheckEmailSession(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    return this.authService.getCheckEmailSession(token, user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('check-email/issue')
  @HttpCode(200)
  issueCheckEmailSession(@CurrentUser() user: User) {
    return this.authService.issueCheckEmailSession(user.id);
  }
}
