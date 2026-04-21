'use client';

import { useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Eye,
  Link as LinkIcon,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import {
  buildShareUrl,
  useCreateShare,
  usePageShares,
  useRevokeShare,
  type PageShare,
} from '@/hooks/useShares';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  pageId: string;
  pageTitle: string;
}

export function ShareDialog({ open, onOpenChange, slug, pageId, pageTitle }: ShareDialogProps) {
  const { t } = useTranslation();
  const { data: shares, isLoading } = usePageShares(slug, pageId, open);
  const createShare = useCreateShare(slug, pageId);
  const revokeShare = useRevokeShare(slug, pageId);

  // Create form state
  const [expiresAt, setExpiresAt] = useState('');
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [allowComments, setAllowComments] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeShares = (shares ?? []).filter((s) => !s.revokedAt);

  async function handleCreate() {
    if (creating) return;
    if (withPassword && password.length < 4) {
      toast.error(t('shares.passwordTooShort') || 'Password must be at least 4 characters');
      return;
    }
    setCreating(true);
    try {
      const input: Parameters<typeof createShare.mutateAsync>[0] = { allowComments };
      if (expiresAt) input.expiresAt = new Date(expiresAt).toISOString();
      if (withPassword && password) input.password = password;
      const share = await createShare.mutateAsync(input);
      toast.success(t('shares.linkCreated') || 'Share link created');
      // Reset form
      setExpiresAt('');
      setWithPassword(false);
      setPassword('');
      setAllowComments(false);
      // Copy immediately — most common next action
      const url = buildShareUrl(share.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success(t('shares.linkCopied') || 'Link copied to clipboard');
      } catch {
        // Clipboard may be blocked; user can still copy from the list
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        (t('shares.createFailed') || 'Failed to create share');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(shareId: string) {
    try {
      await revokeShare.mutateAsync(shareId);
      toast.success(t('shares.revoked') || 'Share link revoked');
    } catch {
      toast.error(t('shares.revokeFailed') || 'Failed to revoke share');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            {t('shares.title') || 'Share this page'}
          </DialogTitle>
          <DialogDescription>
            {t('shares.description') || 'Anyone with the link can view this page without a Wikso account.'}
            {pageTitle ? (
              <span className="mt-1 block truncate text-foreground/80">“{pageTitle}”</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Existing shares */}
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading') || 'Loading…'}
            </div>
          ) : activeShares.length === 0 ? (
            <EmptyShares />
          ) : (
            <ul className="divide-y rounded-lg border bg-card/50">
              {activeShares.map((s) => (
                <ShareRow
                  key={s.id}
                  share={s}
                  onRevoke={() => handleRevoke(s.id)}
                  revoking={revokeShare.isPending}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Create new share */}
        <div className="mt-2 space-y-3 rounded-lg border border-dashed bg-card/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-3.5 w-3.5 text-primary" />
            {t('shares.newLink') || 'New share link'}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expires" className="text-xs text-muted-foreground">
                {t('shares.expiresAt') || 'Expires (optional)'}
              </Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('shares.password') || 'Password (optional)'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setWithPassword(!withPassword);
                    if (withPassword) setPassword('');
                  }}
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider transition-colors',
                    withPassword ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {withPassword ? (t('common.enabled') || 'ON') : (t('common.disabled') || 'OFF')}
                </button>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!withPassword}
                placeholder={withPassword ? (t('shares.passwordPlaceholder') || 'At least 4 characters') : '—'}
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allowComments}
              onChange={(e) => setAllowComments(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            <MessageSquare className="h-3.5 w-3.5" />
            {t('shares.allowComments') || 'Allow anonymous comments'}
          </label>

          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            {creating ? (t('shares.creating') || 'Creating…') : (t('shares.createLink') || 'Create share link')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyShares() {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-dashed py-8 text-center">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LinkIcon className="h-4 w-4" />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('shares.emptyTitle') || 'No active share links'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/80">
        {t('shares.emptyHint') || 'Create one below to share this page publicly.'}
      </p>
    </div>
  );
}

function ShareRow({
  share,
  onRevoke,
  revoking,
}: {
  share: PageShare;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(share.token);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('shares.linkCopied') || 'Link copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('shares.copyFailed') || 'Could not copy to clipboard');
    }
  }

  const expiresSoon =
    share.expiresAt && new Date(share.expiresAt).getTime() - Date.now() < 1000 * 60 * 60 * 24;

  return (
    <li className="flex flex-col gap-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {url}
        </code>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy} title={t('shares.copy') || 'Copy'}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRevoke}
          disabled={revoking}
          title={t('shares.revoke') || 'Revoke'}
        >
          {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {share.hasPassword ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Lock className="h-3 w-3" />
            {t('shares.protected') || 'Password'}
          </Badge>
        ) : null}
        {share.allowComments ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <MessageSquare className="h-3 w-3" />
            {t('shares.comments') || 'Comments'}
          </Badge>
        ) : null}
        {share.expiresAt ? (
          <Badge
            variant={expiresSoon ? 'destructive' : 'outline'}
            className="gap-1 text-[10px]"
          >
            <Clock className="h-3 w-3" />
            {new Date(share.expiresAt).toLocaleDateString()}
          </Badge>
        ) : null}
        <span className="ml-auto flex items-center gap-1 text-muted-foreground">
          <Eye className="h-3 w-3" />
          {share.viewCount}
        </span>
      </div>
    </li>
  );
}

export function ShareMenuTrigger({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 h-7 text-xs"
      onClick={onClick}
    >
      <Share2 className="h-3.5 w-3.5" />
      {label || t('shares.share') || 'Share'}
    </Button>
  );
}

/** Not all dialogs need a close icon — some contexts use a ghost "X" button. */
export function ShareCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClick}>
      <X className="h-4 w-4" />
    </Button>
  );
}
