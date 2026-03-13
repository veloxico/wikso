import { Controller, Post, Get, Body, UseGuards, Req, Res, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SettingsService } from '../settings/settings.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private settingsService: SettingsService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @HttpCode(HttpStatus.OK)
  login(@Req() req: any, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password with token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout' })
  logout() {
    return { message: 'Logged out successfully' };
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get available auth providers' })
  getProviders() {
    return {
      github: !!process.env.GITHUB_CLIENT_ID,
      google: !!process.env.GOOGLE_CLIENT_ID,
      saml: !!process.env.SAML_ENTRY_POINT,
    };
  }

  // --- Public settings (no auth required) ---
  @Get('settings/public')
  @ApiOperation({ summary: 'Get public settings (registration enabled, site name)' })
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  // --- Invite acceptance (no auth required) ---
  @Get('invite/:token')
  @ApiOperation({ summary: 'Validate invite token' })
  validateInvite(@Param('token') token: string) {
    return this.authService.validateInviteToken(token);
  }

  @Post('accept-invite')
  @ApiOperation({ summary: 'Accept invitation and set password' })
  acceptInvite(@Body() body: AcceptInviteDto) {
    return this.authService.acceptInvite(body.token, body.name, body.password);
  }

  /**
   * Exchange a one-time OAuth code for tokens.
   * The code was created during the OAuth redirect and stored in Redis
   * with a 60-second TTL. This prevents JWTs from being exposed in URLs/logs.
   */
  @Post('exchange-code')
  @ApiOperation({ summary: 'Exchange one-time OAuth code for tokens' })
  exchangeCode(@Body('code') code: string) {
    return this.authService.exchangeOAuthCode(code);
  }

  // --- Helper: redirect to frontend with a one-time code (NOT tokens) ---
  private async oauthRedirect(req: any, res: any) {
    const code = await this.authService.createOAuthCode(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  }

  // OAuth2 routes — Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Login with Google' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: any, @Res() res: any) {
    return this.oauthRedirect(req, res);
  }

  // OAuth2 routes — GitHub
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Login with GitHub' })
  githubAuth() {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Req() req: any, @Res() res: any) {
    return this.oauthRedirect(req, res);
  }

  // SAML SSO routes
  @Get('saml')
  @UseGuards(AuthGuard('saml'))
  @ApiOperation({ summary: 'Initiate SAML SSO login' })
  samlAuth() {
    // Passport automatically redirects to the IdP
  }

  @Post('saml/callback')
  @UseGuards(AuthGuard('saml'))
  @ApiOperation({ summary: 'SAML Assertion Consumer Service (ACS)' })
  async samlCallback(@Req() req: any, @Res() res: any) {
    return this.oauthRedirect(req, res);
  }
}
