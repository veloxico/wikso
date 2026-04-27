'use client';

import { use, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { Lock, Eye, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { apiPublic } from '@/lib/api-public';
import { ShareViewer } from '@/components/features/ShareViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ShareMeta = {
  requiresPassword: boolean;
  allowComments: boolean;
  expiresAt: string | null;
  page: { id: string; title: string };
};

type ShareContent = {
  share: { id: string; allowComments: boolean; expiresAt: string | null };
  page: {
    id: string;
    title: string;
    slug: string;
    contentJson: Record<string, unknown> | null;
    updatedAt: string;
    author: { name: string; avatarUrl: string | null } | null;
  };
};

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; title: string; detail: string; icon: 'gone' | 'missing' | 'generic' }
  | { kind: 'gate'; meta: ShareMeta }
  | { kind: 'ready'; content: ShareContent };

export default function ShareTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Stage 1: load metadata. Tells us if a password is required before we
  // expose any content.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiPublic.get<ShareMeta>(`/public/shares/${token}`);
        if (cancelled) return;
        if (data.requiresPassword) {
          setState({ kind: 'gate', meta: data });
        } else {
          // No password — fetch content directly.
          const { data: full } = await apiPublic.post<ShareContent>(
            `/public/shares/${token}/content`,
            {},
          );
          if (cancelled) return;
          setState({ kind: 'ready', content: full });
        }
      } catch (err) {
        if (cancelled) return;
        const e = err as AxiosError<{ message?: string }>;
        const status = e.response?.status;
        if (status === 404) {
          setState({
            kind: 'error',
            title: 'Link not found',
            detail: 'This share link is invalid or has been deleted.',
            icon: 'missing',
          });
        } else if (status === 410) {
          setState({
            kind: 'error',
            title: 'Link no longer active',
            detail: 'This share has been revoked or has expired.',
            icon: 'gone',
          });
        } else if (status === 429) {
          setState({
            kind: 'error',
            title: 'Too many requests',
            detail: 'Please wait a moment and try again.',
            icon: 'generic',
          });
        } else {
          setState({
            kind: 'error',
            title: 'Something went wrong',
            detail: 'We could not load this page. Please try again later.',
            icon: 'generic',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleVerifyPassword(ev: React.FormEvent) {
    ev.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setPasswordError(null);
    try {
      const { data } = await apiPublic.post<ShareContent>(
        `/public/shares/${token}/content`,
        { password },
      );
      setState({ kind: 'ready', content: data });
    } catch (err) {
      const e = err as AxiosError<{ message?: string }>;
      if (e.response?.status === 401) {
        setPasswordError('Incorrect password');
      } else if (e.response?.status === 410) {
        setState({
          kind: 'error',
          title: 'Link no longer active',
          detail: 'This share has been revoked or has expired.',
          icon: 'gone',
        });
      } else if (e.response?.status === 429) {
        setPasswordError('Too many attempts — please wait a minute and try again.');
      } else {
        setPasswordError('Something went wrong. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  }

  // ─── renderers ──────────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return <ShareShell><LoadingScreen /></ShareShell>;
  }

  if (state.kind === 'error') {
    return (
      <ShareShell>
        <ErrorScreen title={state.title} detail={state.detail} icon={state.icon} />
      </ShareShell>
    );
  }

  if (state.kind === 'gate') {
    return (
      <ShareShell>
        <PasswordGate
          title={state.meta.page.title}
          password={password}
          setPassword={setPassword}
          error={passwordError}
          verifying={verifying}
          onSubmit={handleVerifyPassword}
        />
      </ShareShell>
    );
  }

  return (
    <ShareShell>
      <Article content={state.content} />
    </ShareShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   Shell                                                                   */
/* ──────────────────────────────────────────────────────────────────────── */
function ShareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top,oklch(0.985_0.03_100),oklch(0.97_0.01_80))] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.15_0.02_260),oklch(0.12_0.02_260))]">
      {/* subtle grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <header className="relative border-b border-black/5 bg-white/60 backdrop-blur-sm dark:border-white/10 dark:bg-black/30">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <a href="/" className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
            Wikso
          </a>
          <span className="text-xs text-muted-foreground">Shared page</span>
        </div>
      </header>

      <main className="relative mx-auto max-w-[720px] px-6 pb-24 pt-16">{children}</main>

      <footer className="relative mx-auto max-w-5xl border-t border-black/5 px-6 py-6 text-center text-xs text-muted-foreground dark:border-white/10">
        Powered by{' '}
        <a href="/" className="font-medium text-foreground hover:underline">
          Wikso
        </a>
        {' — a self-hosted wiki & knowledge base.'}
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*   States                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">Loading…</p>
    </div>
  );
}

function ErrorScreen({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon: 'gone' | 'missing' | 'generic';
}) {
  const Icon = icon === 'gone' ? Clock : icon === 'missing' ? Eye : AlertTriangle;
  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-black/5 bg-white/70 p-10 text-center shadow-[0_30px_60px_-30px_rgba(0,0,0,0.15)] backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="mb-2 font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function PasswordGate({
  title,
  password,
  setPassword,
  error,
  verifying,
  onSubmit,
}: {
  title: string;
  password: string;
  setPassword: (s: string) => void;
  error: string | null;
  verifying: boolean;
  onSubmit: (ev: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-8 max-w-md rounded-2xl border border-black/5 bg-white/70 p-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.15)] backdrop-blur dark:border-white/10 dark:bg-white/5"
    >
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="mb-1 text-center font-[family-name:var(--font-fraunces)] text-2xl font-semibold">
        Password required
      </h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Enter the password to view{' '}
        <span className="font-medium text-foreground">“{title}”</span>.
      </p>
      <div className="space-y-3">
        <Input
          type="password"
          autoFocus
          autoComplete="off"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!error}
          className="text-base"
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={verifying || !password}>
          {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {verifying ? 'Verifying…' : 'Unlock'}
        </Button>
      </div>
    </form>
  );
}

function Article({ content }: { content: ShareContent }) {
  const updated = new Date(content.page.updatedAt);
  return (
    <article>
      <div className="mb-10 border-b border-black/5 pb-8 dark:border-white/10">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
          {content.page.title}
        </h1>
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          {content.page.author ? (
            <span className="flex items-center gap-2">
              {content.page.author.avatarUrl ? (
                <img
                  src={content.page.author.avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full ring-1 ring-black/5 dark:ring-white/10"
                />
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {content.page.author.name.charAt(0).toUpperCase()}
                </span>
              )}
              {content.page.author.name}
            </span>
          ) : null}
          <span className="text-muted-foreground/40">·</span>
          <time dateTime={updated.toISOString()}>
            {updated.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>
      </div>
      <div className="wikso-share-body">
        <ShareViewer content={content.page.contentJson} />
      </div>
    </article>
  );
}
