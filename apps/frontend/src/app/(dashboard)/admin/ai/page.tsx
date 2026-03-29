'use client';

import { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Save,
  Plug,
  Eye,
  EyeOff,
  Loader2,
  Star,
  Info,
  Unplug,
} from 'lucide-react';
import {
  useAiSettings,
  useSaveAiProvider,
  useSetActiveAiProvider,
  useTestAiProvider,
  useAiModels,
  useGeminiOAuthStart,
  useGeminiOAuthCallback,
  useCodexOAuthStart,
  useCodexOAuthCallback,
  useDisconnectAiProvider,
} from '@/hooks/useAdminAi';
import type { AiTestResult } from '@/hooks/useAdminAi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

interface ProviderDef {
  key: string;
  name: string;
  description: string;
  defaultModel: string;
  supportsAuth: boolean;
  needsApiKey?: boolean;
  showEndpoint: boolean;
  endpointPlaceholder?: string;
  showSetupToken?: boolean;
  tokenPlaceholder?: string;
  tokenHintKey?: string;
  beta?: boolean;
}

const PROVIDERS: ProviderDef[] = [
  // ── Subscription-based (primary) ──
  {
    key: 'claude-cli',
    name: 'Claude (Subscription)',
    description: 'Use Claude via your Anthropic subscription — no API key needed',
    defaultModel: 'haiku',
    supportsAuth: false,
    showEndpoint: false,
    showSetupToken: true,
    tokenPlaceholder: 'sk-ant-oat01-...',
    tokenHintKey: 'admin.ai.setupTokenHint',
  },
  {
    key: 'openai-codex',
    name: 'OpenAI (Subscription)',
    description: 'Use GPT via your ChatGPT Plus/Pro subscription — no API key needed',
    defaultModel: 'gpt-4o',
    supportsAuth: false,
    showEndpoint: false,
    showSetupToken: false,
  },
  {
    key: 'gemini-cli',
    name: 'Gemini (Subscription)',
    description: 'Use Gemini with your Google subscription via OAuth — no API key needed',
    defaultModel: 'gemini-3.1-pro-preview',
    supportsAuth: false,
    showEndpoint: false,
    showSetupToken: false,
  },
  // ── API-key based (beta) ──
  {
    key: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude Sonnet, Opus, Haiku (API Key)',
    defaultModel: 'claude-sonnet-4-6',
    supportsAuth: false,
    needsApiKey: true,
    showEndpoint: false,
    beta: true,
  },
  {
    key: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, GPT-3.5 (API Key)',
    defaultModel: 'gpt-4o',
    supportsAuth: false,
    needsApiKey: true,
    showEndpoint: false,
    beta: true,
  },
  {
    key: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Flash, Pro (API Key from Google AI Studio)',
    defaultModel: 'gemini-2.5-flash',
    supportsAuth: false,
    needsApiKey: true,
    showEndpoint: false,
    beta: true,
  },
  {
    key: 'ollama',
    name: 'Ollama',
    description: 'Self-hosted LLMs (Llama, Mistral, etc.)',
    defaultModel: 'llama3',
    supportsAuth: false,
    showEndpoint: true,
    endpointPlaceholder: 'http://localhost:11434',
    beta: true,
  },
];

type AuthMode = 'api_key' | 'access_token';

interface ProviderFormState {
  authMode: AuthMode;
  apiKey: string;
  endpoint: string;
  model: string;
  customModel: string;
  useCustomModel: boolean;
}

function GeminiOAuthFlow({ t }: { t: (key: string) => string }) {
  const startOAuth = useGeminiOAuthStart();
  const exchangeCallback = useGeminiOAuthCallback();
  const [authUrl, setAuthUrl] = useState('');
  const [oauthState, setOauthState] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [step, setStep] = useState<'idle' | 'waiting' | 'done'>('idle');

  const handleStart = async () => {
    startOAuth.mutate(undefined, {
      onSuccess: (data) => {
        setAuthUrl(data.authUrl);
        setOauthState(data.state);
        setStep('waiting');
      },
    });
  };

  const handleExchange = () => {
    if (!callbackUrl.trim()) return;
    exchangeCallback.mutate(
      { callbackUrl: callbackUrl.trim(), state: oauthState },
      {
        onSuccess: () => {
          setStep('done');
          setAuthUrl('');
          setCallbackUrl('');
        },
      },
    );
  };

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span className="text-green-800 dark:text-green-200">
          Google account connected. Click Save then Test Connection.
        </span>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <p className="text-sm font-medium">Step 1: Open this URL in your browser and sign in:</p>
        <div className="flex gap-2">
          <Input
            readOnly
            value={authUrl}
            className="text-xs font-mono bg-background"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(authUrl);
            }}
          >
            Copy
          </Button>
        </div>
        <p className="text-sm font-medium">
          Step 2: After login, your browser will redirect to a localhost URL. Copy that full URL and paste here:
        </p>
        <div className="flex gap-2">
          <Input
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            placeholder="http://localhost:8085/oauth2callback?code=..."
            className="text-xs font-mono"
          />
          <Button
            size="sm"
            onClick={handleExchange}
            disabled={exchangeCallback.isPending || !callbackUrl.trim()}
          >
            {exchangeCallback.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <p className="text-muted-foreground mb-2">
          Connect your Google account to use Gemini with your subscription. No API key needed.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={startOAuth.isPending}
          className="gap-2"
        >
          {startOAuth.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          Connect Google Account
        </Button>
      </div>
    </div>
  );
}

function CodexOAuthFlow({ t }: { t: (key: string) => string }) {
  const startOAuth = useCodexOAuthStart();
  const exchangeCallback = useCodexOAuthCallback();
  const [authUrl, setAuthUrl] = useState('');
  const [oauthState, setOauthState] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [step, setStep] = useState<'idle' | 'waiting' | 'done'>('idle');

  const handleStart = async () => {
    startOAuth.mutate(undefined, {
      onSuccess: (data) => {
        setAuthUrl(data.authUrl);
        setOauthState(data.state);
        setStep('waiting');
      },
    });
  };

  const handleExchange = () => {
    if (!callbackUrl.trim()) return;
    exchangeCallback.mutate(
      { callbackUrl: callbackUrl.trim(), state: oauthState },
      {
        onSuccess: () => {
          setStep('done');
          setAuthUrl('');
          setCallbackUrl('');
        },
      },
    );
  };

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span className="text-green-800 dark:text-green-200">
          ChatGPT account connected. Click Save then Test Connection.
        </span>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
        <p className="text-sm font-medium">Step 1: Open this URL in your browser and sign in to ChatGPT:</p>
        <div className="flex gap-2">
          <Input
            readOnly
            value={authUrl}
            className="text-xs font-mono bg-background"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => { navigator.clipboard.writeText(authUrl); }}
          >
            Copy
          </Button>
        </div>
        <p className="text-sm font-medium">
          Step 2: After login, your browser will redirect to a localhost URL. Copy that full URL and paste here:
        </p>
        <div className="flex gap-2">
          <Input
            value={callbackUrl}
            onChange={(e) => setCallbackUrl(e.target.value)}
            placeholder="http://localhost:1455/auth/callback?code=..."
            className="text-xs font-mono"
          />
          <Button
            size="sm"
            onClick={handleExchange}
            disabled={exchangeCallback.isPending || !callbackUrl.trim()}
          >
            {exchangeCallback.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <p className="text-muted-foreground mb-2">
          Connect your ChatGPT account to use GPT models with your subscription. No API key needed.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={startOAuth.isPending}
          className="gap-2"
        >
          {startOAuth.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          Connect ChatGPT Account
        </Button>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  settings,
  t,
}: {
  provider: ProviderDef;
  settings: any;
  t: (key: string) => string;
}) {
  const saveProvider = useSaveAiProvider();
  const setActive = useSetActiveAiProvider();
  const testProvider = useTestAiProvider();
  const disconnectProvider = useDisconnectAiProvider();
  const { data: modelsData } = useAiModels(provider.key);

  const saved = settings?.providers?.[provider.key];
  const isActive = settings?.activeProvider === provider.key;
  const isSaved = !!saved?.enabled;

  const [form, setForm] = useState<ProviderFormState>({
    authMode: 'api_key',
    apiKey: '',
    endpoint: saved?.endpoint || '',
    model: saved?.model || '',
    customModel: '',
    useCustomModel: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const models = modelsData?.models || [];
  const selectedModelInList = models.some((m) => m.id === form.model);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModelSelect = (value: string) => {
    if (value === '__custom__') {
      updateField('useCustomModel', true);
      updateField('model', '');
    } else {
      updateField('useCustomModel', false);
      updateField('model', value);
      updateField('customModel', '');
    }
  };

  const getEffectiveModel = () => {
    if (form.useCustomModel) return form.customModel;
    return form.model;
  };

  const handleSave = () => {
    const config: Record<string, any> = {
      model: getEffectiveModel() || undefined,
      endpoint: form.endpoint || undefined,
    };
    if (form.apiKey) config.apiKey = form.apiKey;
    saveProvider.mutate({ provider: provider.key, config });
  };

  const handleTest = () => {
    setIsTesting(true);
    setTestResult(null);
    const config: Record<string, any> = {};
    if (form.apiKey) config.apiKey = form.apiKey;
    if (form.endpoint) config.endpoint = form.endpoint;
    const model = getEffectiveModel();
    if (model) config.model = model;

    testProvider.mutate(
      { provider: provider.key, config },
      {
        onSuccess: (result) => {
          setTestResult(result);
          setIsTesting(false);
        },
        onError: () => {
          setTestResult({ ok: false, message: t('admin.ai.testFailed') });
          setIsTesting(false);
        },
      },
    );
  };

  return (
    <Card className={isActive ? 'border-primary/50 bg-primary/[0.02]' : ''}>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {provider.name}
              {provider.beta && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Beta
                </span>
              )}
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Star className="h-3 w-3" />
                  {t('admin.ai.active')}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {provider.description}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Auth Mode Toggle — only for providers that support it */}
          {provider.supportsAuth && (
            <div className="space-y-2">
              <Label>{t('admin.ai.authMode')}</Label>
              <div className="flex rounded-lg border border-border p-1 w-fit">
                <button
                  type="button"
                  onClick={() => updateField('authMode', 'api_key')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    form.authMode === 'api_key'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('admin.ai.apiKeyMode')}
                </button>
                <button
                  type="button"
                  onClick={() => updateField('authMode', 'access_token')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    form.authMode === 'access_token'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('admin.ai.accessTokenMode')}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* API Key Field */}
            {(provider.supportsAuth || provider.needsApiKey) && (
              <div className="space-y-2">
                <Label>{t('admin.ai.apiKey')}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => updateField('apiKey', e.target.value)}
                    placeholder={
                      isSaved ? saved?.apiKey || '********' : 'sk-...'
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>{t('admin.ai.model')}</Label>
              {provider.key === 'ollama' && models.length === 0 ? (
                // Ollama with no models loaded — text input
                <Input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder={provider.defaultModel}
                />
              ) : models.length > 0 && !form.useCustomModel ? (
                // Dropdown with predefined models
                <Select
                  value={form.model || undefined}
                  onValueChange={handleModelSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t('admin.ai.selectModel')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">
                      {t('admin.ai.customModel')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : form.useCustomModel ? (
                // Custom model input
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={form.customModel}
                    onChange={(e) => {
                      updateField('customModel', e.target.value);
                      updateField('model', e.target.value);
                    }}
                    placeholder={provider.defaultModel}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateField('useCustomModel', false);
                      updateField('customModel', '');
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('admin.ai.selectModel')}
                  </button>
                </div>
              ) : (
                <Input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder={provider.defaultModel}
                />
              )}
            </div>

            {/* Endpoint */}
            {provider.showEndpoint && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('admin.ai.endpoint')}</Label>
                <Input
                  type="text"
                  value={form.endpoint}
                  onChange={(e) => updateField('endpoint', e.target.value)}
                  placeholder={provider.endpointPlaceholder || 'https://...'}
                />
              </div>
            )}

            {/* Token Field (subscription providers) */}
            {provider.showSetupToken && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('admin.ai.token')}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => updateField('apiKey', e.target.value)}
                    placeholder={
                      isSaved
                        ? saved?.apiKey || '********'
                        : provider.tokenPlaceholder || '...'
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(provider.tokenHintKey || 'admin.ai.setupTokenHint')}
                </p>
              </div>
            )}
          </div>

          {/* Session Token Hint */}
          {provider.supportsAuth && form.authMode === 'access_token' && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p className="text-muted-foreground">
                {t('admin.ai.accessTokenHint')}
              </p>
            </div>
          )}

          {/* Subscription Provider Hints */}
          {provider.key === 'claude-cli' && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <p className="text-muted-foreground">
                {t('admin.ai.cliHint')}
              </p>
            </div>
          )}
          {provider.key === 'gemini-cli' && (
            <GeminiOAuthFlow t={t} />
          )}
          {provider.key === 'openai-codex' && (
            <CodexOAuthFlow t={t} />
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                testResult.ok
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200'
                  : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {testResult.ok
                  ? testResult.message || t('admin.ai.testSuccess')
                  : testResult.message || t('admin.ai.testFailed')}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button
              onClick={handleSave}
              disabled={saveProvider.isPending}
              size="sm"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveProvider.isPending ? t('common.saving') : t('admin.ai.save')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
              className="gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              {isTesting
                ? t('admin.ai.testing')
                : t('admin.ai.testConnection')}
            </Button>

            {isSaved && !isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActive.mutate(provider.key)}
                disabled={setActive.isPending}
                className="gap-2"
              >
                <Star className="h-4 w-4" />
                {t('admin.ai.setActive')}
              </Button>
            )}

            {isSaved && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.confirm(t('admin.ai.disconnectConfirm'))) {
                    disconnectProvider.mutate(provider.key);
                    setTestResult(null);
                  }
                }}
                disabled={disconnectProvider.isPending}
                className="gap-2 text-destructive hover:text-destructive ml-auto"
              >
                <Unplug className="h-4 w-4" />
                {t('admin.ai.disconnect')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAiPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useAiSettings();
  const disableAi = useSetActiveAiProvider();

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">
          {t('admin.ai.title')}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">
              {t('admin.ai.status')}
            </h2>
            {isLoading ? (
              <div className="h-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                {settings?.activeProvider ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="font-medium">
                    {settings?.activeProvider
                      ? `${t('admin.ai.activeProvider')}: ${
                          PROVIDERS.find(
                            (p) => p.key === settings.activeProvider,
                          )?.name || settings.activeProvider
                        }`
                      : t('admin.ai.notConfigured')}
                  </p>
                  {!settings?.activeProvider && (
                    <p className="text-sm text-muted-foreground">
                      {t('admin.ai.notConfiguredDesc')}
                    </p>
                  )}
                </div>
                {settings?.activeProvider && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disableAi.mutate(null)}
                    disabled={disableAi.isPending}
                    className="ml-auto shrink-0 text-destructive hover:text-destructive"
                  >
                    {t('admin.ai.disable')}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider Cards */}
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.key}
            provider={provider}
            settings={settings}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
