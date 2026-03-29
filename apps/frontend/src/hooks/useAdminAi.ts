import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Interfaces ──────────────────────────────────────────

export interface AiProviderSettings {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
}

export interface AiSettingsResponse {
  activeProvider: string | null;
  providers: Record<string, AiProviderSettings>;
}

export interface AiTestResult {
  ok: boolean;
  message?: string;
}

export interface AiModelInfo {
  id: string;
  name: string;
}

export interface AiModelsResponse {
  models: AiModelInfo[];
  source: 'predefined' | 'ollama';
}

// ─── Hooks ───────────────────────────────────────────────

export function useAiSettings() {
  return useQuery<AiSettingsResponse>({
    queryKey: ['admin', 'ai-settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/ai/settings');
      return data;
    },
  });
}

export function useSaveAiProvider() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      provider,
      config,
    }: {
      provider: string;
      config: Record<string, any>;
    }) => {
      const { data } = await api.put(`/admin/ai/settings/${provider}`, config);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      toast.success(t('toasts.saved'));
    },
    onError: () => {
      toast.error(t('toasts.error'));
    },
  });
}

export function useSetActiveAiProvider() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (provider: string | null) => {
      const { data } = await api.put('/admin/ai/settings/active', {
        provider,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      toast.success(t('toasts.saved'));
    },
    onError: () => {
      toast.error(t('toasts.error'));
    },
  });
}

export function useAiModels(provider: string | null) {
  return useQuery<AiModelsResponse>({
    queryKey: ['admin', 'ai-models', provider],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/ai/settings/models/${provider}`,
      );
      return data;
    },
    enabled: !!provider,
  });
}

export function useGeminiOAuthStart() {
  return useMutation({
    mutationFn: async (): Promise<{ authUrl: string; state: string }> => {
      const { data } = await api.post('/admin/ai/settings/gemini-cli/oauth/start');
      return data;
    },
  });
}

export function useGeminiOAuthCallback() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { callbackUrl: string; state: string }) => {
      const { data } = await api.post(
        '/admin/ai/settings/gemini-cli/oauth/callback',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      toast.success(t('toasts.saved'));
    },
    onError: () => {
      toast.error(t('toasts.error'));
    },
  });
}

export function useCodexOAuthStart() {
  return useMutation({
    mutationFn: async (): Promise<{ authUrl: string; state: string }> => {
      const { data } = await api.post('/admin/ai/settings/openai-codex/oauth/start');
      return data;
    },
  });
}

export function useCodexOAuthCallback() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (dto: { callbackUrl: string; state: string }) => {
      const { data } = await api.post(
        '/admin/ai/settings/openai-codex/oauth/callback',
        dto,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      toast.success(t('toasts.saved'));
    },
    onError: () => {
      toast.error(t('toasts.error'));
    },
  });
}

export function useDisconnectAiProvider() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (provider: string) => {
      const { data } = await api.delete(`/admin/ai/settings/${provider}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ai-settings'] });
      toast.success(t('toasts.saved'));
    },
    onError: () => {
      toast.error(t('toasts.error'));
    },
  });
}

export function useTestAiProvider() {
  return useMutation({
    mutationFn: async ({
      provider,
      config,
    }: {
      provider: string;
      config?: Record<string, any>;
    }): Promise<AiTestResult> => {
      const { data } = await api.post(
        `/admin/ai/settings/${provider}/test`,
        config || {},
      );
      return data;
    },
  });
}
