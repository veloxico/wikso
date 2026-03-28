import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
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

const VALID_PROVIDERS: AiProviderType[] = ['anthropic', 'openai', 'ollama'];

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
  async getSettings(@CurrentUser() user: any) {
    this.assertAdmin(user);
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
        deploymentName: c.deployment || undefined,
        apiVersion: c.apiVersion || undefined,
      };
    }

    return { activeProvider, providers };
  }

  // Literal PUT routes MUST come before parametric @Put(':provider')
  @Put('active')
  @ApiOperation({ summary: 'Set the active AI provider' })
  async setActiveProvider(
    @Body() dto: { provider: string },
    @CurrentUser() user: any,
  ) {
    this.assertAdmin(user);
    this.validateProvider(dto.provider);

    await this.prisma.aiConfig.updateMany({
      data: { isActive: false },
    });

    const result = await this.prisma.aiConfig.update({
      where: { provider: dto.provider },
      data: { isActive: true },
    });

    await this.registry.invalidateCache();
    this.logger.log(
      `Active AI provider set to: ${dto.provider} by user ${user.id}`,
    );
    return { provider: result.provider, isActive: result.isActive };
  }

  @Put(':provider')
  @ApiOperation({ summary: 'Save config for an AI provider' })
  async saveProviderSettings(
    @Param('provider') provider: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    this.assertAdmin(user);
    this.validateProvider(provider);

    const { apiKey, endpoint, model, deployment, apiVersion } = dto;

    const encrypted = this.registry.encryptFields({
      apiKey: apiKey || null,
      endpoint: endpoint || null,
      deployment: deployment || null,
    });

    const result = await this.prisma.aiConfig.upsert({
      where: { provider },
      create: {
        provider,
        apiKey: encrypted.apiKey,
        endpoint: encrypted.endpoint,
        model: model || null,
        deployment: encrypted.deployment,
        apiVersion: apiVersion || null,
      },
      update: {
        apiKey: encrypted.apiKey,
        endpoint: encrypted.endpoint,
        model: model || null,
        deployment: encrypted.deployment,
        apiVersion: apiVersion || null,
      },
    });

    await this.registry.invalidateCache();
    this.logger.log(`AI provider config saved: ${provider} by user ${user.id}`);
    return { provider: result.provider, saved: true };
  }

  // Literal POST routes MUST come before parametric @Post(':provider/test')
  @Post(':provider/test')
  @ApiOperation({ summary: 'Test AI provider connection' })
  async testConnection(
    @Param('provider') provider: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    this.assertAdmin(user);
    this.validateProvider(provider);

    // If DTO has credentials, test with those (unsaved / pre-save test)
    if (dto?.apiKey) {
      const testProvider = this.createTestProvider(
        provider as AiProviderType,
        dto,
      );
      return testProvider.testConnection();
    }

    // No credentials in DTO — test the saved configuration from DB
    const saved = await this.prisma.aiConfig.findUnique({
      where: { provider },
    });

    if (!saved || !saved.apiKey) {
      return {
        ok: false,
        message: `No saved configuration found for ${provider}`,
      };
    }

    const decryptedKey = this.registry.safeDecrypt(saved.apiKey);

    const testProvider = this.createTestProvider(provider as AiProviderType, {
      apiKey: decryptedKey,
      endpoint: saved.endpoint
        ? this.registry.safeDecrypt(saved.endpoint)
        : undefined,
      model: saved.model || undefined,
      deployment: saved.deployment
        ? this.registry.safeDecrypt(saved.deployment)
        : undefined,
      apiVersion: saved.apiVersion || undefined,
    });
    return testProvider.testConnection();
  }

  // ─── Private ──────────────────────────────────────────

  private assertAdmin(user: any): void {
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private validateProvider(provider: string): void {
    if (!VALID_PROVIDERS.includes(provider as AiProviderType)) {
      throw new ForbiddenException(
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
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}
