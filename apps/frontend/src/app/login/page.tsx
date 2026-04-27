'use client';

/**
 * Login — warm-paper rewrite. The previous version used a dark indigo
 * aurora-mesh on a navy panel, which fought the rest of the app's cream
 * paper / terracotta identity. This rewrite commits fully to the warm-
 * paper system:
 *
 *  • Left panel is paper-elevated with a hand-drawn brand mark, three
 *    handwritten "feature notes" (Caveat font), and a deckle-edge
 *    pull-quote-style hero. Editorial, not corporate.
 *  • Right panel uses .wp-card-style fields with accent-soft focus rings,
 *    so the form surface matches every other input in the app.
 *  • Submit button uses var(--accent) directly — no hardcoded indigo
 *    gradient. Whichever accent preset (terracotta / ink / moss / plum
 *    / sky) the user has set persists into the auth flow.
 *  • Paper grain inherits from <body>::before. No giant gradient blobs.
 *
 * Layout rationale:
 *  • Two-panel asymmetric: 5/12 brand, 7/12 form on lg+. Brand panel
 *    is *quieter* than the form so the form is the focal point.
 *  • On mobile the brand panel collapses to a top "envelope" header
 *    with the logo and a single handwritten subtitle.
 */

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { WiksoLogo } from '@/components/ui/WiksoLogo';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(6, t('validation.passwordMin6')),
  });
}

type LoginValues = z.infer<ReturnType<typeof createLoginSchema>>;

interface AuthProviders {
  github: boolean;
  google: boolean;
  saml: boolean;
}

const ease = [0.22, 0.68, 0, 1.04] as const;

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t, locale } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    api.get('/setup/status')
      .then((res) => { if (res.data.setupRequired) router.replace('/setup'); })
      .catch(() => {});

    api.get('/auth/providers')
      .then((res) => setProviders(res.data))
      .catch(() => setProviders({ github: false, google: false, saml: false }));

    api.get('/auth/settings/public')
      .then((res) => setRegistrationEnabled(res.data.registrationEnabled))
      .catch(() => setRegistrationEnabled(true));
  }, [router]);

  const hasOAuth = providers && (providers.github || providers.google || providers.saml);

  const onSubmit = async (data: LoginValues) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', data);
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.push('/spaces');
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.login.failed'));
    }
  };

  return (
    <div key={locale} className="relative flex min-h-screen w-full overflow-hidden bg-[color:var(--bg)]">
      {/* ===== Left Panel — Editorial brand surface (desktop only) ===== */}
      <div className="relative hidden lg:flex lg:w-[42%] flex-col justify-between overflow-hidden border-r border-[color:var(--rule)] bg-[color:var(--bg-sunken)] p-10">
        {/* Subtle accent-tinted gradient wash — barely visible, replaces
            the harsh aurora blobs. Sits behind the paper grain. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(1200px 500px at 12% 110%, var(--accent-soft), transparent 65%), radial-gradient(900px 400px at 110% -10%, oklch(96% 0.03 var(--accent-h)), transparent 60%)',
          }}
        />

        {/* Top: Logo */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <WiksoLogo className="h-9 w-auto text-[color:var(--ink)]" />
        </motion.div>

        {/* Center: Editorial hero — pull-quote treatment */}
        <motion.div
          className="relative z-10 -mt-10 max-w-[420px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease }}
        >
          {/* Decorative opening quote — same treatment as .pullquote::before */}
          <span
            aria-hidden="true"
            className="absolute -left-1 -top-12 select-none text-[7rem] leading-none text-[color:var(--accent)] opacity-25"
            style={{ fontFamily: 'var(--body-font)' }}
          >
            &ldquo;
          </span>

          <h2
            className="relative text-[2.6rem] font-medium leading-[1.08] tracking-[-0.012em] text-[color:var(--ink)]"
            style={{
              fontFamily: 'var(--body-font)',
              fontVariationSettings: "'opsz' 144, 'SOFT' 30",
              textWrap: 'balance',
            }}
          >
            {t('auth.login.heroLine1') || 'Quiet pages.'}
            <br />
            <span className="italic text-[color:var(--ink-2)]">
              {t('auth.login.heroLine2') || 'Loud ideas.'}
            </span>
          </h2>

          <p className="mt-6 text-[0.95rem] leading-relaxed text-[color:var(--ink-3)]">
            {t('auth.login.tagline') ||
              'A wiki that reads like a notebook. Cream paper, sharp edges, your team\u2019s thinking — all in one place.'}
          </p>

          {/* Handwritten signature accent — Caveat */}
          <p
            className="mt-5 text-[1.15rem] text-[color:var(--accent)]"
            style={{ fontFamily: 'var(--hand-font)' }}
          >
            — {t('auth.login.handSig') || 'made for thinkers'}
          </p>
        </motion.div>

        {/* Bottom: Three small "notes" — Caveat handwriting on dashed cards.
            Replaces generic feature pills with something editorial. */}
        <motion.div
          className="relative z-10 grid grid-cols-3 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35, ease }}
        >
          {[
            { hand: t('auth.login.note1') || 'real-time', body: t('auth.login.note1Body') || 'edit together' },
            { hand: t('auth.login.note2') || 'AI helper', body: t('auth.login.note2Body') || 'expand · summarize' },
            { hand: t('auth.login.note3') || 'fast search', body: t('auth.login.note3Body') || 'every word indexed' },
          ].map((note, i) => (
            <div
              key={i}
              className="rounded-md border border-dashed border-[color:var(--rule-strong)] bg-[color:var(--bg-raised)] px-3 py-2.5"
              style={{ transform: `rotate(${[-1.2, 0.6, -0.4][i]}deg)` }}
            >
              <div
                className="text-[1rem] leading-none text-[color:var(--accent)]"
                style={{ fontFamily: 'var(--hand-font)' }}
              >
                {note.hand}
              </div>
              <div className="mt-1 text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--ink-4)]">
                {note.body}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ===== Right Panel — Form ===== */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-12">
        {/* Mobile: top bar with logo + language */}
        <motion.div
          className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <WiksoLogo className="h-8 w-auto text-[color:var(--ink)]" />
          <LanguageSwitcher compact />
        </motion.div>

        {/* Form container */}
        <motion.div
          className="relative z-10 w-full max-w-[400px]"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
          }}
        >
          {/* Header — serif title + handwritten "today" accent */}
          <motion.div
            className="mb-9"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
          >
            <h1
              className="text-[2rem] leading-[1.1] tracking-[-0.015em] text-[color:var(--ink)]"
              style={{
                fontFamily: 'var(--body-font)',
                fontVariationSettings: "'opsz' 144, 'SOFT' 30",
                fontWeight: 600,
              }}
            >
              {t('auth.login.title')}
            </h1>
            <p className="mt-2 flex items-baseline gap-2 text-[0.95rem] leading-relaxed text-[color:var(--ink-3)]">
              <span>{t('auth.login.description')}</span>
              <span
                className="text-[1rem] text-[color:var(--accent)]"
                style={{ fontFamily: 'var(--hand-font)' }}
              >
                ✦
              </span>
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-4)]"
              >
                {t('common.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('email')}
                className="h-11 rounded-lg border-[color:var(--rule)] bg-[color:var(--bg-raised)] px-3.5 text-[0.95rem] placeholder:text-[color:var(--ink-4)] focus-visible:border-[color:var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--accent-soft)]"
              />
              {errors.email && (
                <p className="text-xs text-[color:var(--danger)]">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--ink-4)]"
                >
                  {t('common.password')}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[color:var(--ink-3)] underline-offset-4 transition-colors hover:text-[color:var(--accent)] hover:underline"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="h-11 rounded-lg border-[color:var(--rule)] bg-[color:var(--bg-raised)] px-3.5 text-[0.95rem] placeholder:text-[color:var(--ink-4)] focus-visible:border-[color:var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--accent-soft)]"
              />
              {errors.password && (
                <p className="text-xs text-[color:var(--danger)]">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-[color:var(--danger)]/25 bg-[color:var(--danger)]/5 px-3.5 py-2.5"
              >
                <p className="text-sm text-[color:var(--danger)]">{error}</p>
              </motion.div>
            )}

            <Button
              type="submit"
              className="group h-11 w-full rounded-lg border-0 bg-[color:var(--accent)] text-[0.95rem] font-medium text-[color:var(--primary-foreground)] shadow-[0_1px_0_oklch(40%_0.02_60_/_0.15),0_4px_14px_oklch(40%_0.02_60_/_0.10)] transition-all duration-200 hover:bg-[color:var(--accent-hover)] hover:shadow-[0_2px_0_oklch(40%_0.02_60_/_0.18),0_8px_22px_oklch(40%_0.02_60_/_0.18)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.login.loggingIn')}</>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {t('auth.login.button')}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </motion.form>

          {/* OAuth */}
          {hasOAuth && (
            <motion.div
              className="mt-7"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
            >
              <div className="relative flex items-center gap-4">
                <div className="h-px flex-1 bg-[color:var(--rule)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-4)]">
                  {t('common.orContinueWith')}
                </span>
                <div className="h-px flex-1 bg-[color:var(--rule)]" />
              </div>
              <div
                className="mt-4 grid gap-2.5"
                style={{ gridTemplateColumns: `repeat(${[providers!.github, providers!.google, providers!.saml].filter(Boolean).length}, 1fr)` }}
              >
                {providers!.github && (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 rounded-lg border-[color:var(--rule)] bg-[color:var(--bg-raised)] text-sm font-medium text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent-ink)]"
                    onClick={() => { window.location.href = `/api/v1/auth/github`; }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                    GitHub
                  </Button>
                )}
                {providers!.google && (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 rounded-lg border-[color:var(--rule)] bg-[color:var(--bg-raised)] text-sm font-medium text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent-ink)]"
                    onClick={() => { window.location.href = `/api/v1/auth/google`; }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    Google
                  </Button>
                )}
                {providers!.saml && (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 rounded-lg border-[color:var(--rule)] bg-[color:var(--bg-raised)] text-sm font-medium text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent-ink)]"
                    onClick={() => { window.location.href = `/api/v1/auth/saml`; }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    SSO
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Sign-up link */}
          {registrationEnabled && (
            <motion.p
              className="mt-9 text-center text-sm text-[color:var(--ink-3)]"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4, delay: 0.15 } } }}
            >
              {t('auth.login.noAccount')}{' '}
              <Link
                href="/register"
                className="font-medium text-[color:var(--ink)] underline underline-offset-4 decoration-[color:var(--rule-strong)] transition-colors hover:text-[color:var(--accent)] hover:decoration-[color:var(--accent)]"
              >
                {t('auth.login.signUp')}
              </Link>
            </motion.p>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          className="relative z-10 mt-auto flex flex-col items-center gap-3 pt-8 lg:mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <AuthFooter />
          <div className="hidden lg:block">
            <LanguageSwitcher compact />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
