import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AiProviderRegistry } from '../../ai/ai-provider.registry';
import { AiProviderType } from '../../ai/providers/ai-provider.interface';
import { AnthropicProvider } from '../../ai/providers/anthropic.provider';
import { OpenAiProvider } from '../../ai/providers/openai.provider';
import { OllamaProvider } from '../../ai/providers/ollama.provider';
import { ClaudeCliProvider } from '../../ai/providers/claude-cli.provider';
import { GeminiProvider } from '../../ai/providers/gemini.provider';
import { GeminiCliProvider } from '../../ai/providers/gemini-cli.provider';
import { OpenAiCodexProvider } from '../../ai/providers/openai-codex.provider';

const VALID_PROVIDERS: AiProviderType[] = ['anthropic', 'openai', 'ollama', 'claude-cli', 'gemini', 'gemini-cli', 'openai-codex'];

@ApiTags('Admin AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
@Controller('admin/ai/settings')
export class AdminAiController {
  private readonly logger = new Logger(AdminAiController.name);

  constructor(
    private registry: AiProviderRegistry,
    private prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all AI provider configs (keys masked)' })
  async getSettings() {
    const configs = await this.registry.getAllConfigs();

    let activeProvider: string | null = null;
    const providers: Record<string, any> = {};

    for (const c of configs) {
      if (c.isActive) activeProvider = c.provider;
      providers[c.provider] = {
        enabled: true,
        apiKey: c.apiKey || undefined,
        model: c.model || undefined,
        endpoint: c.endpoint || undefined,
        deployment: c.deployment || undefined,
        apiVersion: c.apiVersion || undefined,
      };
    }

    return { activeProvider, providers };
  }

  // Literal PUT routes MUST come before parametric @Put(':provider')
  @Put('active')
  @ApiOperation({ summary: 'Set the active AI provider' })
  async setActiveProvider(
    @Body() dto: { provider: string | null },
    @CurrentUser() user: any,
  ) {
    // Disable AI if provider is null/empty
    if (!dto?.provider) {
      await this.prisma.aiConfig.updateMany({ data: { isActive: false } });
      await this.registry.invalidateCache();
      this.logger.log(`AI disabled by user ${user.id}`);
      return { provider: null, isActive: false };
    }

    this.validateProvider(dto.provider);

    const existing = await this.prisma.aiConfig.findUnique({
      where: { provider: dto.provider },
    });
    if (!existing) {
      throw new NotFoundException(
        `Provider '${dto.provider}' has no saved configuration`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.aiConfig.updateMany({ data: { isActive: false } });
      return tx.aiConfig.update({
        where: { provider: dto.provider! },
        data: { isActive: true },
      });
    });

    await this.registry.invalidateCache();
    this.logger.log(
      `Active AI provider set to: ${dto.provider} by user ${user.id}`,
    );
    return { provider: result.provider, isActive: result.isActive };
  }

  @Delete(':provider')
  @ApiOperation({ summary: 'Disconnect / remove an AI provider config' })
  async disconnectProvider(
    @Param('provider') provider: string,
    @CurrentUser() user: any,
  ) {
    this.validateProvider(provider);

    const existing = await this.prisma.aiConfig.findUnique({
      where: { provider },
    });
    if (!existing) {
      return { provider, disconnected: true };
    }

    // If this provider is active, deactivate it
    if (existing.isActive) {
      await this.prisma.aiConfig.update({
        where: { provider },
        data: { isActive: false },
      });
    }

    // Remove credentials and config
    await this.prisma.aiConfig.delete({ where: { provider } });

    // Clean up CLI credential files if applicable
    try {
      const { unlinkSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      if (provider === 'openai-codex') {
        unlinkSync(join(homedir(), '.codex', 'auth.json'));
      }
      if (provider === 'gemini-cli') {
        unlinkSync(join(homedir(), '.gemini', 'gemini-credentials.json'));
      }
    } catch {
      // Files may not exist — ignore
    }

    await this.registry.invalidateCache();
    this.logger.log(`AI provider disconnected: ${provider} by user ${user.id}`);
    return { provider, disconnected: true };
  }

  @Put(':provider')
  @ApiOperation({ summary: 'Save config for an AI provider' })
  async saveProviderSettings(
    @Param('provider') provider: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    this.validateProvider(provider);

    const { apiKey, endpoint, model, deployment, apiVersion } = dto;

    const encrypted = this.registry.encryptFields({
      ...(apiKey ? { apiKey } : {}),
      ...(deployment ? { deployment } : {}),
    });

    // Build update data — only include apiKey if explicitly provided
    const updateData: Record<string, any> = {
      endpoint: endpoint || null,
      model: model || null,
      apiVersion: apiVersion || null,
    };
    if (apiKey) {
      updateData.apiKey = encrypted.apiKey;
    }
    if (deployment) {
      updateData.deployment = encrypted.deployment;
    }

    const result = await this.prisma.aiConfig.upsert({
      where: { provider },
      create: {
        provider,
        ...updateData,
        apiKey: updateData.apiKey || null,
        deployment: updateData.deployment || null,
      },
      update: updateData,
    });

    await this.registry.invalidateCache();
    this.logger.log(`AI provider config saved: ${provider} by user ${user.id}`);
    return { provider: result.provider, saved: true };
  }

  @Post(':provider/test')
  @ApiOperation({ summary: 'Test AI provider connection' })
  async testConnection(
    @Param('provider') provider: string,
    @Body() dto: any,
  ) {
    this.validateProvider(provider);
    this.logger.log(`Test connection: provider=${provider}, hasApiKeyInBody=${!!dto?.apiKey}, hasEndpointInBody=${!!dto?.endpoint}`);

    // If DTO has credentials, test with those (unsaved / pre-save test)
    if (dto?.apiKey || (provider === 'ollama' && dto?.endpoint)) {
      const { apiKey, endpoint, model, deployment, apiVersion } = dto;
      const testProvider = this.createTestProvider(
        provider as AiProviderType,
        { apiKey, endpoint, model, deployment, apiVersion },
      );
      return testProvider.testConnection();
    }

    // No credentials in DTO — test the saved configuration from DB
    const saved = await this.prisma.aiConfig.findUnique({
      where: { provider },
    });

    if (!saved) {
      return {
        ok: false,
        message: `No saved configuration found for ${provider}`,
      };
    }

    // Some providers don't strictly require apiKey in the traditional sense
    const noKeyRequired = ['ollama', 'claude-cli', 'gemini-cli'];
    if (!noKeyRequired.includes(provider) && !saved.apiKey) {
      return {
        ok: false,
        message: `No API key configured for ${provider}`,
      };
    }

    const decryptedKey = saved.apiKey
      ? this.registry.safeDecrypt(saved.apiKey)
      : undefined;
    this.logger.log(`Test saved config: provider=${provider}, hasDecryptedKey=${!!decryptedKey}, isOAuth=${decryptedKey?.includes('sk-ant-oat') || false}`);

    const testProvider = this.createTestProvider(provider as AiProviderType, {
      apiKey: decryptedKey,
      endpoint: saved.endpoint || undefined,
      model: saved.model || undefined,
      deployment: saved.deployment
        ? this.registry.safeDecrypt(saved.deployment)
        : undefined,
      apiVersion: saved.apiVersion || undefined,
    });
    return testProvider.testConnection();
  }

  @Get('models/:provider')
  @ApiOperation({ summary: 'Get available models for a provider' })
  async getModels(@Param('provider') provider: string) {
    this.validateProvider(provider);

    const PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
      anthropic: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      ],
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'o3-mini', name: 'o3 Mini' },
      ],
      'claude-cli': [
        { id: 'sonnet', name: 'Claude Sonnet' },
        { id: 'opus', name: 'Claude Opus' },
        { id: 'haiku', name: 'Claude Haiku' },
      ],
      gemini: [
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      ],
      'gemini-cli': [
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      ],
      'openai-codex': [
        { id: 'gpt-5.4', name: 'GPT-5.4' },
        { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
        { id: 'gpt-5.3-codex-spark', name: 'GPT-5.3 Codex Spark' },
        { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
        { id: 'gpt-5.2', name: 'GPT-5.2' },
        { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
        { id: 'gpt-4o', name: 'GPT-4o' },
      ],
    };

    if (provider === 'ollama') {
      // Fetch installed models from Ollama
      const saved = await this.prisma.aiConfig.findUnique({
        where: { provider: 'ollama' },
      });
      const endpoint = (saved?.endpoint || 'http://localhost:11434').replace(
        /\/+$/,
        '',
      );
      try {
        const res = await fetch(`${endpoint}/api/tags`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          return { models: [], source: 'ollama' };
        }
        const data: any = await res.json();
        const models = (data.models || []).map((m: any) => ({
          id: m.name || m.model,
          name: m.name || m.model,
        }));
        return { models, source: 'ollama' };
      } catch {
        return { models: [], source: 'ollama' };
      }
    }

    return {
      models: PROVIDER_MODELS[provider] || [],
      source: 'predefined',
    };
  }

  // ─── Gemini OAuth Flow ────────────────────────────────

  private geminiPkceStore = new Map<string, { verifier: string; createdAt: number }>();

  @Post('gemini-cli/oauth/start')
  @ApiOperation({ summary: 'Start Gemini OAuth flow — returns auth URL' })
  async geminiOAuthStart() {
    const { randomBytes, createHash } = await import('crypto');
    const verifier = randomBytes(32).toString('hex');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const clientId = process.env.GEMINI_CLI_OAUTH_CLIENT_ID || '';
    const redirectUri = 'http://localhost:8085/oauth2callback';
    const scopes = [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: verifier,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // Store verifier for callback exchange (expires in 10 min)
    this.geminiPkceStore.set(verifier, { verifier, createdAt: Date.now() });
    // Cleanup old entries
    for (const [key, val] of this.geminiPkceStore.entries()) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) {
        this.geminiPkceStore.delete(key);
      }
    }

    return { authUrl, state: verifier };
  }

  @Post('gemini-cli/oauth/callback')
  @ApiOperation({ summary: 'Exchange Gemini OAuth callback URL for token' })
  async geminiOAuthCallback(
    @Body() dto: { callbackUrl: string; state: string },
    @CurrentUser() user: any,
  ) {
    if (!dto?.callbackUrl || !dto?.state) {
      throw new BadRequestException('callbackUrl and state are required');
    }

    const stored = this.geminiPkceStore.get(dto.state);
    if (!stored) {
      throw new BadRequestException('Invalid or expired state. Start the OAuth flow again.');
    }
    this.geminiPkceStore.delete(dto.state);

    // Parse code from callback URL
    let code: string;
    try {
      const url = new URL(dto.callbackUrl);
      code = url.searchParams.get('code') || '';
      if (!code) throw new Error('No code');
    } catch {
      throw new BadRequestException('Invalid callback URL — paste the full URL from your browser');
    }

    // Exchange code for tokens
    const clientId = process.env.GEMINI_CLI_OAUTH_CLIENT_ID || '';
    const clientSecret = process.env.GEMINI_CLI_OAUTH_CLIENT_SECRET || '';

    const body = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:8085/oauth2callback',
      code_verifier: stored.verifier,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'google-api-nodejs-client/9.15.1',
      },
      body,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      this.logger.error(`Gemini OAuth token exchange failed: ${errText}`);
      throw new BadRequestException('Token exchange failed — try starting the flow again');
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      throw new BadRequestException('No access token received');
    }

    // Save both tokens as JSON so we can refresh later
    const tokenPayload = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken || null,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    });
    const encrypted = this.registry.encryptFields({ apiKey: tokenPayload });
    await this.prisma.aiConfig.upsert({
      where: { provider: 'gemini-cli' },
      create: {
        provider: 'gemini-cli',
        apiKey: encrypted.apiKey,
        model: 'gemini-2.5-flash',
      },
      update: { apiKey: encrypted.apiKey },
    });

    // Also write to Gemini CLI's FileKeychain so `gemini -p` works
    try {
      await this.writeGeminiCliCredentials(
        accessToken,
        tokenData.refresh_token,
        tokenData.expires_in,
      );
    } catch (err) {
      this.logger.warn('Failed to write Gemini CLI credentials', err);
    }

    await this.registry.invalidateCache();
    this.logger.log(`Gemini OAuth connected by user ${user.id}`);
    return { ok: true, message: 'Google account connected successfully' };
  }

  /**
   * Write OAuth credentials directly to Gemini CLI's FileKeychain store
   * so `gemini -p` can use them without interactive login.
   * Replicates the same encryption format Gemini CLI uses internally.
   */
  private async writeGeminiCliCredentials(
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number,
  ): Promise<void> {
    const { createCipheriv, randomBytes, scryptSync } = await import('crypto');
    const { writeFileSync, mkdirSync } = await import('fs');
    const { join } = await import('path');
    const { homedir, hostname, userInfo } = await import('os');

    const geminiDir = join(homedir(), '.gemini');
    mkdirSync(geminiDir, { recursive: true });

    // Derive encryption key same way Gemini CLI does
    const salt = `${hostname()}-${userInfo().username}-gemini-cli`;
    const key = scryptSync('gemini-cli-oauth', salt, 32);

    // Build the credential data structure
    const data: Record<string, Record<string, string>> = {
      'gemini-cli-oauth': {
        'main-account': JSON.stringify({
          serverName: 'main-account',
          token: {
            accessToken,
            refreshToken: refreshToken || undefined,
            tokenType: 'Bearer',
            expiresAt: expiresIn
              ? Date.now() + expiresIn * 1000
              : undefined,
          },
          updatedAt: Date.now(),
        }),
      },
    };

    // Encrypt using AES-256-GCM (same as FileKeychain)
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const encryptedStr = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    const credFile = join(geminiDir, 'gemini-credentials.json');
    writeFileSync(credFile, encryptedStr, { mode: 0o600 });
    this.logger.log('Wrote Gemini CLI credentials to FileKeychain');
  }

  // ─── OpenAI Codex OAuth Flow ──────────────────────────

  private codexPkceStore = new Map<string, { verifier: string; createdAt: number }>();

  @Post('openai-codex/oauth/start')
  @ApiOperation({ summary: 'Start OpenAI Codex OAuth flow' })
  async codexOAuthStart() {
    const { randomBytes, createHash } = await import('crypto');
    const verifier = randomBytes(32).toString('hex');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann';
    const redirectUri = 'http://localhost:1455/auth/callback';
    const scopes = 'openid profile email offline_access';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: verifier,
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      originator: 'pi',
    });

    const authUrl = `https://auth.openai.com/oauth/authorize?${params.toString()}`;

    this.codexPkceStore.set(verifier, { verifier, createdAt: Date.now() });
    // Cleanup old entries
    for (const [key, val] of this.codexPkceStore.entries()) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) {
        this.codexPkceStore.delete(key);
      }
    }

    return { authUrl, state: verifier };
  }

  @Post('openai-codex/oauth/callback')
  @ApiOperation({ summary: 'Exchange OpenAI Codex OAuth callback URL for token' })
  async codexOAuthCallback(
    @Body() dto: { callbackUrl: string; state: string },
    @CurrentUser() user: any,
  ) {
    if (!dto?.callbackUrl || !dto?.state) {
      throw new BadRequestException('callbackUrl and state are required');
    }

    const stored = this.codexPkceStore.get(dto.state);
    if (!stored) {
      throw new BadRequestException('Invalid or expired state. Start the OAuth flow again.');
    }
    this.codexPkceStore.delete(dto.state);

    let code: string;
    try {
      const url = new URL(dto.callbackUrl);
      code = url.searchParams.get('code') || '';
      if (!code) throw new Error('No code');
    } catch {
      throw new BadRequestException('Invalid callback URL — paste the full URL from your browser');
    }

    const clientId = 'app_EMoamEEZ73f0CkXaXp7hrann';
    const body = new URLSearchParams({
      client_id: clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:1455/auth/callback',
      code_verifier: stored.verifier,
    });

    const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      this.logger.error(`Codex OAuth token exchange failed: ${errText}`);
      throw new BadRequestException('Token exchange failed — try starting the flow again');
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const idToken = tokenData.id_token;

    if (!accessToken) {
      throw new BadRequestException('No access token received');
    }

    // Extract chatgpt_account_id from id_token JWT claims
    let chatgptAccountId: string | null = null;
    if (idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8'),
          );
          const authClaim = payload['https://api.openai.com/auth'];
          chatgptAccountId = authClaim?.chatgpt_account_id || null;
          this.logger.log(`Codex OAuth: chatgpt_account_id=${chatgptAccountId}`);
        }
      } catch (err) {
        this.logger.warn('Failed to parse Codex id_token JWT', err);
      }
    }

    const tokenPayload = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken || null,
      id_token: idToken || null,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      chatgpt_account_id: chatgptAccountId,
    });
    const encrypted = this.registry.encryptFields({ apiKey: tokenPayload });
    await this.prisma.aiConfig.upsert({
      where: { provider: 'openai-codex' },
      create: {
        provider: 'openai-codex',
        apiKey: encrypted.apiKey,
        model: 'gpt-4o',
      },
      update: { apiKey: encrypted.apiKey },
    });

    await this.registry.invalidateCache();
    this.logger.log(`OpenAI Codex OAuth connected by user ${user.id}`);
    return { ok: true, message: 'ChatGPT account connected successfully' };
  }

  // ─── Private ──────────────────────────────────────────

  private validateProvider(provider: string): void {
    if (!VALID_PROVIDERS.includes(provider as AiProviderType)) {
      throw new BadRequestException(
        `Invalid provider: ${provider}. Valid providers: ${VALID_PROVIDERS.join(', ')}`,
      );
    }
  }

  private createTestProvider(type: AiProviderType, dto: any) {
    const config = {
      apiKey: dto.apiKey,
      endpoint: dto.endpoint,
      model: dto.model,
      deployment: dto.deployment,
      apiVersion: dto.apiVersion,
    };
    switch (type) {
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'openai':
        return new OpenAiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'claude-cli':
        return new ClaudeCliProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'gemini-cli':
        return new GeminiCliProvider(config);
      case 'openai-codex':
        return new OpenAiCodexProvider(config);
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}
