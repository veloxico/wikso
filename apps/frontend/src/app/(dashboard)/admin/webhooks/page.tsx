'use client';

import { useState } from 'react';
import { Webhook, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import {
  useAdminWebhooks,
  useToggleWebhook,
  useCreateAdminWebhook,
  useUpdateAdminWebhook,
  useDeleteAdminWebhook,
  type AdminWebhook,
} from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const PAGE_SIZE = 20;

const AVAILABLE_EVENTS = [
  'page.created',
  'page.updated',
  'page.deleted',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'space.created',
  'space.deleted',
  'user.created',
  'user.invited',
] as const;

interface WebhookFormData {
  url: string;
  events: string[];
  secret: string;
}

const emptyForm: WebhookFormData = { url: '', events: [], secret: '' };

export default function AdminWebhooksPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(0);
  const { data: webhooks, isLoading } = useAdminWebhooks(page * PAGE_SIZE, PAGE_SIZE);
  const toggleWebhook = useToggleWebhook();
  const createWebhook = useCreateAdminWebhook();
  const updateWebhook = useUpdateAdminWebhook();
  const deleteWebhook = useDeleteAdminWebhook();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<AdminWebhook | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>(emptyForm);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const openCreate = () => {
    setFormData(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (webhook: AdminWebhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      url: webhook.url,
      events: [...webhook.events],
      secret: webhook.secret || '',
    });
    setEditOpen(true);
  };

  const openDelete = (webhook: AdminWebhook) => {
    setSelectedWebhook(webhook);
    setDeleteOpen(true);
  };

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleCreate = () => {
    createWebhook.mutate(
      { url: formData.url, events: formData.events, secret: formData.secret || undefined },
      { onSuccess: () => setCreateOpen(false) },
    );
  };

  const handleUpdate = () => {
    if (!selectedWebhook) return;
    updateWebhook.mutate(
      {
        id: selectedWebhook.id,
        url: formData.url,
        events: formData.events,
        secret: formData.secret || undefined,
      },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!selectedWebhook) return;
    deleteWebhook.mutate(selectedWebhook.id, {
      onSuccess: () => setDeleteOpen(false),
    });
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskSecret = (secret: string | null, id: string) => {
    if (!secret) return <span className="text-muted-foreground">--</span>;
    if (visibleSecrets.has(id)) {
      return (
        <span className="font-mono text-xs">{secret}</span>
      );
    }
    return <span className="font-mono text-xs">{'*'.repeat(Math.min(secret.length, 20))}</span>;
  };

  const webhookFormFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          type="url"
          placeholder="https://example.com/webhook"
          value={formData.url}
          onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Events</Label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_EVENTS.map((event) => (
            <label
              key={event}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={formData.events.includes(event)}
                onChange={() => toggleEvent(event)}
                className="rounded border-border"
              />
              {event}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-secret">Secret (optional)</Label>
        <Input
          id="webhook-secret"
          type="text"
          placeholder="whsec_..."
          value={formData.secret}
          onChange={(e) => setFormData((prev) => ({ ...prev, secret: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Used to sign webhook payloads for verification.
        </p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Webhook className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('admin.webhooks.title')}</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{t('admin.webhooks.addWebhook') || 'Add Webhook'}</span>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.urlColumn') || 'URL'}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.eventsColumn') || 'Events'}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.statusColumn') || 'Status'}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.secretColumn') || 'Secret'}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.createdColumn') || 'Created'}</th>
                      <th className="pb-3 font-medium text-muted-foreground">{t('admin.webhooks.actionsColumn') || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhooks.map((webhook) => (
                      <tr key={webhook.id} className="border-b border-border last:border-0">
                        <td className="py-3 max-w-[300px]">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded truncate block">
                            {webhook.url}
                          </code>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.map((event) => (
                              <span
                                key={event}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              >
                                {event}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              webhook.active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {webhook.active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {maskSecret(webhook.secret, webhook.id)}
                            {webhook.secret && (
                              <button
                                onClick={() => toggleSecretVisibility(webhook.id)}
                                className="p-1 text-muted-foreground hover:text-foreground"
                              >
                                {visibleSecrets.has(webhook.id) ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(webhook.createdAt).toLocaleDateString(locale)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleWebhook.mutate({
                                  id: webhook.id,
                                  active: !webhook.active,
                                })
                              }
                            >
                              {webhook.active ? t('common.disable') || 'Disable' : t('common.enable') || 'Enable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(webhook)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openDelete(webhook)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('common.pageNum', { num: page + 1 })}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!webhooks || webhooks.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <Webhook className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{t('admin.webhooks.noWebhooks')}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                {t('admin.webhooks.addWebhook') || 'Add Webhook'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.webhooks.createTitle') || 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              {t('admin.webhooks.createDescription') || 'Add a new webhook endpoint to receive event notifications.'}
            </DialogDescription>
          </DialogHeader>
          {webhookFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.url || formData.events.length === 0 || createWebhook.isPending}
            >
              {createWebhook.isPending ? (t('common.creating') || 'Creating...') : (t('common.create') || 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.webhooks.editTitle') || 'Edit Webhook'}</DialogTitle>
            <DialogDescription>
              {t('admin.webhooks.editDescription') || 'Update the webhook configuration.'}
            </DialogDescription>
          </DialogHeader>
          {webhookFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.url || formData.events.length === 0 || updateWebhook.isPending}
            >
              {updateWebhook.isPending ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.webhooks.deleteTitle') || 'Delete Webhook'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.webhooks.deleteDescription') || 'Are you sure you want to delete this webhook? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWebhook.isPending ? (t('common.deleting') || 'Deleting...') : (t('common.delete') || 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
