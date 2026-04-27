import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Types ───────────────────────────────────────────────

export interface SlackWorkspace {
  id: string;
  slackTeamId: string;
  slackTeamName: string;
  botUserId: string;
  connectedByUserId: string;
  connectedAt: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
}

export type SlackPageEventType = 'page.created' | 'page.updated' | 'page.deleted';

export interface SlackSubscription {
  id: string;
  slackChannelId: string;
  slackChannelName: string;
  spaceId: string;
  spaceSlug?: string;
  spaceName?: string;
  eventTypes: SlackPageEventType[];
  createdAt: string;
}

export interface CreateSubscriptionInput {
  slackChannelId: string;
  slackChannelName: string;
  spaceId: string;
  eventTypes: SlackPageEventType[];
}

export interface SlackConfigStatus {
  configured: boolean;
  missing: string[];
}

// ─── Queries ─────────────────────────────────────────────

/**
 * Pre-flight: are the SLACK_* env vars wired up server-side? Lets the
 * admin UI render setup guidance instead of letting the user click
 * Connect and get a confusing 400.
 */
export function useSlackConfigStatus() {
  return useQuery<SlackConfigStatus>({
    queryKey: ['slack', 'config-status'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/slack/config-status');
      return data;
    },
    staleTime: 60_000,
  });
}

export function useSlackWorkspace() {
  return useQuery<SlackWorkspace | null>({
    queryKey: ['slack', 'workspace'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/slack/workspace');
      return data || null;
    },
  });
}

export function useSlackChannels(enabled = true) {
  return useQuery<SlackChannel[]>({
    queryKey: ['slack', 'channels'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/slack/channels');
      return data || [];
    },
    enabled,
  });
}

export function useSlackSubscriptions() {
  return useQuery<SlackSubscription[]>({
    queryKey: ['slack', 'subscriptions'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/slack/subscriptions');
      return data || [];
    },
  });
}

// ─── Mutations ───────────────────────────────────────────

/** Start the OAuth flow. Redirects the browser to Slack's install URL. */
export function useStartSlackOAuth() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/integrations/slack/oauth/start');
      return data as { url: string };
    },
    onSuccess: (data) => {
      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }
    },
    onError: (err: unknown) => {
      // Surface the real backend message so config errors like
      // "SLACK_CLIENT_ID is not configured" reach the admin instead of
      // a generic toast that leaves them guessing.
      const e = err as { response?: { data?: { message?: string } } };
      const detail = e?.response?.data?.message;
      const fallback =
        t('admin.integrations.slack.connectFailed') || 'Failed to start Slack OAuth';
      toast.error(detail ? `${fallback}: ${detail}` : fallback);
    },
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/integrations/slack/workspace');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack'] });
      toast.success(t('admin.integrations.slack.disconnected') || 'Slack disconnected');
    },
    onError: () => {
      toast.error(t('admin.integrations.slack.disconnectFailed') || 'Failed to disconnect Slack');
    },
  });
}

export function useCreateSlackSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const { data } = await api.post('/integrations/slack/subscriptions', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack', 'subscriptions'] });
      toast.success(t('admin.integrations.slack.subscriptionCreated') || 'Subscription added');
    },
    onError: () => {
      toast.error(t('admin.integrations.slack.subscriptionCreateFailed') || 'Failed to add subscription');
    },
  });
}

export function useDeleteSlackSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/integrations/slack/subscriptions/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack', 'subscriptions'] });
      toast.success(t('admin.integrations.slack.subscriptionDeleted') || 'Subscription removed');
    },
    onError: () => {
      toast.error(t('admin.integrations.slack.subscriptionDeleteFailed') || 'Failed to remove subscription');
    },
  });
}
