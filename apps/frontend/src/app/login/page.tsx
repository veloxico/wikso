'use client';

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
    <div key={locale} className="relative flex min-h-screen w-full overflow-hidden">
      {/* ===== Left Panel — Deep dark branding (desktop) ===== */}
      <div className="relative hidden lg:flex lg:w-[46%] flex-col items-start justify-between overflow-hidden p-10">
        {/* Multi-layer background: deep charcoal base */}
        <div className="absolute inset-0 bg-[#0C0F1A]" />

        {/* Aurora gradient mesh — three overlapping color fields */}
        <motion.div
          className="absolute -top-1/4 -left-1/4 h-[70%] w-[70%] rounded-full opacity-40 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #3B3FD8 0%, transparent 70%)' }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -right-1/4 h-[60%] w-[60%] rounded-full opacity-30 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #0EA5E9 0%, transparent 70%)' }}
          animate={{ x: [0, -30, 25, 0], y: [0, 25, -35, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/4 left-1/4 h-[55%] w-[55%] rounded-full opacity-25 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }}
          animate={{ x: [0, 20, -30, 0], y: [0, -20, 30, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Noise grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />

        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Top: Logo */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <WiksoLogo className="h-10 w-auto text-white" />
        </motion.div>

        {/* Center: Hero text — asymmetric left-aligned, editorial */}
        <motion.div
          className="relative z-10 -mt-16 max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease }}
        >
          <h2
            className="text-[2.75rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-white"
          >
            Where ideas
            <br />
            <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              become knowledge
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/45 max-w-sm">
            A modern wiki platform for teams that value clarity and collaboration.
          </p>
        </motion.div>

        {/* Bottom: Decorative feature pills */}
        <motion.div
          className="relative z-10 flex flex-wrap gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease }}
        >
          {['Real-time editing', 'AI assistant', 'Full-text search', 'SSO'].map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/50 backdrop-blur-sm"
            >
              {feature}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ===== Right Panel — Login Form ===== */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 md:px-12">
        {/* Subtle ambient glow from left */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-48 hidden lg:block" style={{ background: 'linear-gradient(to right, rgba(59,63,216,0.04), transparent)' }} />

        {/* Mobile: compact top bar with logo */}
        <motion.div
          className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-5 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <WiksoLogo className="h-8 w-auto" />
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
          {/* Header */}
          <motion.div
            className="mb-10"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
          >
            <h1 className="text-[1.75rem] font-bold tracking-[-0.02em]">{t('auth.login.title')}</h1>
            <p className="mt-2 text-[0.95rem] text-muted-foreground leading-relaxed">{t('auth.login.description')}</p>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...register('email')}
                className="h-12 rounded-xl border-border/60 bg-muted/30 px-4 text-[0.95rem] placeholder:text-muted-foreground/50 focus-visible:bg-background"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[0.8rem] font-semibold uppercase tracking-wider text-muted-foreground">{t('common.password')}</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-muted-foreground/70 hover:text-foreground transition-colors">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                {...register('password')}
                className="h-12 rounded-xl border-border/60 bg-muted/30 px-4 text-[0.95rem] placeholder:text-muted-foreground/50 focus-visible:bg-background"
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3"
              >
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}

            <Button
              type="submit"
              className="group h-12 w-full rounded-xl text-[0.95rem] font-semibold text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 border-0 transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #4338CA 100%)' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.login.loggingIn')}</>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.login.button')}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </motion.form>

          {/* OAuth */}
          {hasOAuth && (
            <motion.div
              className="mt-8"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } } }}
            >
              <div className="relative flex items-center gap-4">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                  {t('common.orContinueWith')}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${[providers!.github, providers!.google, providers!.saml].filter(Boolean).length}, 1fr)` }}>
                {providers!.github && (
                  <Button variant="outline" className="h-12 w-full gap-2.5 rounded-xl border-border/60 bg-muted/20 text-sm font-medium hover:bg-muted/50" onClick={() => { window.location.href = `/api/v1/auth/github`; }}>
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                    GitHub
                  </Button>
                )}
                {providers!.google && (
                  <Button variant="outline" className="h-12 w-full gap-2.5 rounded-xl border-border/60 bg-muted/20 text-sm font-medium hover:bg-muted/50" onClick={() => { window.location.href = `/api/v1/auth/google`; }}>
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    Google
                  </Button>
                )}
                {providers!.saml && (
                  <Button variant="outline" className="h-12 w-full gap-2.5 rounded-xl border-border/60 bg-muted/20 text-sm font-medium hover:bg-muted/50" onClick={() => { window.location.href = `/api/v1/auth/saml`; }}>
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    SSO
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Sign up link */}
          {registrationEnabled && (
            <motion.p
              className="mt-10 text-center text-sm text-muted-foreground"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.4, delay: 0.15 } } }}
            >
              {t('auth.login.noAccount')}{' '}
              <Link href="/register" className="font-semibold text-foreground hover:text-primary transition-colors underline underline-offset-4 decoration-border hover:decoration-primary">
                {t('auth.login.signUp')}
              </Link>
            </motion.p>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          className="relative z-10 mt-auto pt-8 flex flex-col items-center gap-3 lg:mt-12"
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
