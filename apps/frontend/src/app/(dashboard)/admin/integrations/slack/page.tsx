'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSlackWorkspace,
  useSlackChannels,
  useSlackSubscriptions,
  useSlackConfigStatus,
  useStartSlackOAuth,
  useDisconnectSlack,
  useCreateSlackSubscription,
  useDeleteSlackSubscription,
  type SlackPageEventType,
} from '@/hooks/useSlackIntegration';
import { useAdminSpaces } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/hooks/useTranslation';

const EVENT_OPTIONS: SlackPageEventType[] = ['page.created', 'page.updated', 'page.deleted'];

export default function AdminSlackIntegrationPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state for new subscription
  const [formChannelId, setFormChannelId] = useState('');
  const [formSpaceId, setFormSpaceId] = useState('');
  const [formEvents, setFormEvents] = useState<SlackPageEventType[]>([
    'page.created',
    'page.updated',
  ]);

  const { data: workspace, isLoading: workspaceLoading } = useSlackWorkspace();
  const { data: subscriptions } = useSlackSubscriptions();
  const { data: channels } = useSlackChannels(showAdd && !!workspace);
  const { data: spaces } = useAdminSpaces(0, 100);
  const { data: configStatus } = useSlackConfigStatus();
  const isConfigured = configStatus?.configured ?? true; // Optimistic until proven otherwise

  const startOAuth = useStartSlackOAuth();
  const disconnect = useDisconnectSlack();
  const createSubscription = useCreateSlackSubscription();
  const deleteSubscription = useDeleteSlackSubscription();

  // React to OAuth callback query params
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'connected') {
      toast.success(
        t('admin.integrations.slack.connectedToast') || 'Slack workspace connected',
      );
    } else if (status === 'error') {
      const reason = searchParams.get('reason');
      toast.error(
        `${t('admin.integrations.slack.connectFailed') || 'Slack connection failed'}${
          reason ? ` (${reason})` : ''
        }`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = () => {
    startOAuth.mutate();
  };

  const handleToggleEvent = (event: SlackPageEventType) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const resetForm = () => {
    setFormChannelId('');
    setFormSpaceId('');
    setFormEvents(['page.created', 'page.updated']);
  };

  const handleCreateSubscription = () => {
    const channel = channels?.find((c) => c.id === formChannelId);
    if (!channel || !formSpaceId || formEvents.length === 0) return;
    createSubscription.mutate(
      {
        slackChannelId: channel.id,
        slackChannelName: channel.name,
        spaceId: formSpaceId,
        eventTypes: formEvents,
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          resetForm();
        },
      },
    );
  };

  const eventLabel = (event: SlackPageEventType): string => {
    if (event === 'page.created')
      return t('admin.integrations.slack.eventCreated') || 'Page created';
    if (event === 'page.updated')
      return t('admin.integrations.slack.eventUpdated') || 'Page updated';
    return t('admin.integrations.slack.eventDeleted') || 'Page deleted';
  };

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex flex-wrap items-center gap-3">
        <MessageCircle className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            {t('admin.integrations.slack.title') || 'Slack Integration'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.integrations.slack.description') ||
              'Connect Slack to post Wikso page updates to channels and auto-unfurl links.'}
          </p>
        </div>
      </div>

      {/* Workspace card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          {workspaceLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading') || 'Loading...'}
            </div>
          ) : workspace ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">
                    {t('admin.integrations.slack.connected') || 'Connected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">
                      {t('admin.integrations.slack.workspaceLabel') || 'Workspace'}:
                    </span>{' '}
                    {workspace.slackTeamName}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowDisconnect(true)}
              >
                {t('admin.integrations.slack.disconnectButton') || 'Disconnect'}
              </Button>
            </div>
          ) : !isConfigured ? (
            // Server is missing SLACK_* env vars — show setup guidance
            // instead of letting the admin click Connect and get a 400.
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Settings2 className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t('admin.integrations.slack.setupRequired') || 'Setup required'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('admin.integrations.slack.setupDesc') ||
                      'Slack integration needs server-side credentials before you can connect a workspace. Add the variables below to your backend environment, restart the backend, and reload this page.'}
                  </p>
                </div>
              </div>

              {configStatus?.missing && configStatus.missing.length > 0 && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t('admin.integrations.slack.missingVars') || 'Missing environment variables'}
                  </p>
                  <ul className="space-y-1">
                    {configStatus.missing.map((v) => (
                      <li key={v} className="font-mono text-xs">
                        <code className="rounded bg-background px-1.5 py-0.5">{v}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('admin.integrations.slack.howToSetup') || 'How to set up'}
                </p>
                <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>
                    {t('admin.integrations.slack.step1') || 'Create a Slack app at'}{' '}
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      api.slack.com/apps
                    </a>
                  </li>
                  <li>
                    {t('admin.integrations.slack.step2') ||
                      'Add bot scopes: channels:read, chat:write, links:read, links:write'}
                  </li>
                  <li>
                    {t('admin.integrations.slack.step3') ||
                      'Set the OAuth redirect URL to <SLACK_REDIRECT_URL> and copy Client ID / Client Secret / Signing Secret into your backend env.'}
                  </li>
                  <li>
                    {t('admin.integrations.slack.step4') ||
                      'Restart the backend container and reload this page.'}
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {t('admin.integrations.slack.notConnected') || 'Not connected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.integrations.slack.description') ||
                      'Connect Slack to receive Wikso page updates in your channels.'}
                  </p>
                </div>
              </div>
              <Button onClick={handleConnect} disabled={startOAuth.isPending}>
                {startOAuth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('admin.integrations.slack.connectButton') || 'Connect to Slack'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions (only shown when connected) */}
      {workspace && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                {t('admin.integrations.slack.subscriptionsTitle') || 'Channel subscriptions'}
              </h2>
              <Button onClick={() => setShowAdd(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('admin.integrations.slack.addSubscription') || 'Add subscription'}
              </Button>
            </div>

            {subscriptions && subscriptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">
                        {t('admin.integrations.slack.channelLabel') || 'Slack channel'}
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">
                        {t('admin.integrations.slack.spaceLabel') || 'Wikso space'}
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">
                        {t('admin.integrations.slack.eventsLabel') || 'Events'}
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">
                        {t('common.actions') || 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-mono text-xs">#{sub.slackChannelName}</td>
                        <td className="py-3">{sub.spaceName || sub.spaceId}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {sub.eventTypes.map((e) => (
                              <span
                                key={e}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDeleteId(sub.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">
                  {t('admin.integrations.slack.emptyTitle') || 'No subscriptions yet'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('admin.integrations.slack.emptyDesc') ||
                    'Subscribe a Slack channel to a Wikso space to receive page updates there.'}
                </p>
                <Button onClick={() => setShowAdd(true)} variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('admin.integrations.slack.addSubscription') || 'Add subscription'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add subscription dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(v) => {
          setShowAdd(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.integrations.slack.addSubscription') || 'Add subscription'}
            </DialogTitle>
            <DialogDescription>
              {t('admin.integrations.slack.emptyDesc') ||
                'Pick a Slack channel and a Wikso space, then choose which events to forward.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slack-channel">
                {t('admin.integrations.slack.channelLabel') || 'Slack channel'}
              </Label>
              <select
                id="slack-channel"
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                    {c.isPrivate ? ' (private)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slack-space">
                {t('admin.integrations.slack.spaceLabel') || 'Wikso space'}
              </Label>
              <select
                id="slack-space"
                value={formSpaceId}
                onChange={(e) => setFormSpaceId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {spaces?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.integrations.slack.eventsLabel') || 'Events'}</Label>
              <div className="grid grid-cols-1 gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => handleToggleEvent(event)}
                      className="rounded border-border"
                    />
                    {eventLabel(event)}
                    <code className="ml-auto text-xs text-muted-foreground">{event}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreateSubscription}
              disabled={
                !formChannelId ||
                !formSpaceId ||
                formEvents.length === 0 ||
                createSubscription.isPending
              }
            >
              {createSubscription.isPending
                ? t('common.saving') || 'Saving...'
                : t('admin.integrations.slack.saveButton') || 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.integrations.slack.disconnectButton') || 'Disconnect Slack'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.integrations.slack.disconnectConfirm') ||
                'Disconnect the Slack workspace? All channel subscriptions will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                disconnect.mutate(undefined, { onSuccess: () => setShowDisconnect(false) });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnect.isPending
                ? t('common.deleting') || 'Deleting...'
                : t('admin.integrations.slack.disconnectButton') || 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription delete confirmation */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.integrations.slack.removeButton') || 'Remove subscription'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.integrations.slack.removeConfirm') ||
                'Remove this Slack subscription? No more Wikso updates will be posted to this channel.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) {
                  deleteSubscription.mutate(confirmDeleteId, {
                    onSuccess: () => setConfirmDeleteId(null),
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubscription.isPending
                ? t('common.deleting') || 'Deleting...'
                : t('admin.integrations.slack.removeButton') || 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
