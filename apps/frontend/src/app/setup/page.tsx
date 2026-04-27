'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Users,
  FileText,
  Search,
  Shield,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Check,
  Terminal,
  Zap,
  RotateCw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { AuthFooter } from '@/components/features/AuthFooter';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';

// ─── Schemas ──────────────────────────────────────────────
function createSetupSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t('validation.nameMin2')),
    email: z.string().email(t('validation.emailInvalid')),
    password: z.string().min(8, t('validation.passwordMin8')),
    instanceName: z.string().optional(),
  });
}

type SetupValues = z.infer<ReturnType<typeof createSetupSchema>>;

type Step = 'welcome' | 'database' | 'admin' | 'complete';

const STEPS: Step[] = ['welcome', 'database', 'admin', 'complete'];

const DEFAULT_DB_URL = 'postgresql://postgres:password@postgres:5432/wikso';

const features = [
  { icon: FileText, labelKey: 'setup.welcome.featurePages' },
  { icon: Users, labelKey: 'setup.welcome.featureCollaboration' },
  { icon: Search, labelKey: 'setup.welcome.featureSearch' },
  { icon: Shield, labelKey: 'setup.welcome.featureAdmin' },
];

// ─── Animations ───────────────────────────────────────────
const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 60 : -60,
    opacity: 0,
  }),
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// ─── Step indicator ───────────────────────────────────────
function StepIndicator({
  steps,
  currentStep,
  t,
}: {
  steps: Step[];
  currentStep: Step;
  t: (key: string) => string;
}) {
  const currentIdx = steps.indexOf(currentStep);
  const stepLabels: Record<Step, string> = {
    welcome: t('setup.steps.welcome'),
    database: t('setup.steps.database'),
    admin: t('setup.steps.admin'),
    complete: t('setup.steps.complete'),
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {steps.map((step, i) => {
        const isActive = i === currentIdx;
        const isCompleted = i < currentIdx;
        return (
          <div key={step} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`
                  flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
                  transition-all duration-300
                  ${isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                      ? 'bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.45_0.2_270/0.3)]'
                      : 'bg-muted/60 text-muted-foreground/60'
                  }
                `}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`
                  hidden text-xs font-medium sm:block
                  transition-colors duration-300
                  ${isActive ? 'text-foreground' : 'text-muted-foreground/60'}
                `}
              >
                {stepLabels[step]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`
                  h-px w-4 sm:w-8 transition-colors duration-300
                  ${i < currentIdx ? 'bg-primary' : 'bg-border/60'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Background ───────────────────────────────────────────
function SetupBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/[0.03] blur-3xl" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function SetupPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { t, locale } = useTranslation();

  const [step, setStep] = useState<Step>('welcome');
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Database step state
  const [dbUrl, setDbUrl] = useState(DEFAULT_DB_URL);
  const [useTls, setUseTls] = useState(false);
  const [rejectUnauthorized, setRejectUnauthorized] = useState(true);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbResult, setDbResult] = useState<{
    success: boolean;
    message: string;
    version?: string;
    database?: string;
  } | null>(null);
  const [restartWaiting, setRestartWaiting] = useState(false);

  // Admin form
  const setupSchema = useMemo(() => createSetupSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<SetupValues>({ resolver: zodResolver(setupSchema) });

  // Determine initial stage from backend status
  useEffect(() => {
    api
      .get('/setup/status')
      .then((res) => {
        const { setupRequired, stage } = res.data;
        if (!setupRequired) {
          router.replace('/login');
          return;
        }
        setLoading(false);
        // If backend says we're past database step, skip to admin
        if (stage === 'admin') {
          setStep('admin');
        }
      })
      .catch(() => {
        // 503 during setup is expected — stay on wizard
        setLoading(false);
      });
  }, [router]);

  const goTo = useCallback(
    (target: Step) => {
      const currentIdx = STEPS.indexOf(step);
      const targetIdx = STEPS.indexOf(target);
      setDirection(targetIdx > currentIdx ? 1 : -1);
      setStep(target);
    },
    [step],
  );

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) goTo(STEPS[idx + 1]);
  }, [step, goTo]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) goTo(STEPS[idx - 1]);
  }, [step, goTo]);

  const testConnection = async () => {
    setDbTesting(true);
    setDbResult(null);
    try {
      const res = await api.post('/setup/test-db', {
        databaseUrl: dbUrl,
        useTls,
        rejectUnauthorized,
      });
      setDbResult(res.data);
    } catch (err: any) {
      setDbResult({
        success: false,
        message: err.response?.data?.message || 'Connection failed',
      });
    } finally {
      setDbTesting(false);
    }
  };

  // Save DB config + run migrations + wait for backend restart
  const saveDatabase = async () => {
    setDbSaving(true);
    setDbResult(null);
    try {
      await api.post('/setup/save-db', {
        databaseUrl: dbUrl,
        useTls,
        rejectUnauthorized,
      });

      // Backend will exit → Docker restart → we need to wait for it to come back.
      setRestartWaiting(true);
      setDbSaving(false);
      await waitForBackendReady();
      setRestartWaiting(false);
      goNext(); // → admin step
    } catch (err: any) {
      setDbSaving(false);
      setRestartWaiting(false);
      setDbResult({
        success: false,
        message: err.response?.data?.message || 'Failed to save configuration',
      });
    }
  };

  // Poll backend until /setup/status responds with stage === 'admin'
  const waitForBackendReady = async () => {
    const maxAttempts = 40; // ~40s
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await api.get('/setup/status');
        if (res.data.stage === 'admin' || !res.data.setupRequired) {
          return;
        }
      } catch {
        // Backend still restarting; keep polling
      }
    }
    throw new Error('Backend did not restart in time');
  };

  const onSubmit = async (data: SetupValues) => {
    try {
      setError(null);
      const res = await api.post('/setup/init', data);
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      goTo('complete');
    } catch (err: any) {
      setError(err.response?.data?.message || t('setup.failed'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      key={locale}
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background"
    >
      <SetupBackground />

      <div className="absolute left-0 right-0 top-0 z-20 flex justify-center pt-6 sm:pt-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <StepIndicator steps={STEPS} currentStep={step} t={t} />
        </motion.div>
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center px-6">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 'welcome' && (
            <WelcomeStep key="welcome" direction={direction} t={t} onContinue={goNext} />
          )}
          {step === 'database' && (
            <DatabaseStep
              key="database"
              direction={direction}
              t={t}
              dbUrl={dbUrl}
              setDbUrl={setDbUrl}
              useTls={useTls}
              setUseTls={setUseTls}
              rejectUnauthorized={rejectUnauthorized}
              setRejectUnauthorized={setRejectUnauthorized}
              dbTesting={dbTesting}
              dbSaving={dbSaving}
              restartWaiting={restartWaiting}
              dbResult={dbResult}
              testConnection={testConnection}
              saveDatabase={saveDatabase}
              onBack={goBack}
            />
          )}
          {step === 'admin' && (
            <AdminStep
              key="admin"
              direction={direction}
              t={t}
              register={register}
              formErrors={formErrors}
              error={error}
              isSubmitting={isSubmitting}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              onBack={goBack}
            />
          )}
          {step === 'complete' && (
            <CompleteStep key="complete" direction={direction} t={t} />
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 pb-6">
        <AuthFooter />
        <LanguageSwitcher compact />
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────
function WelcomeStep({
  direction,
  t,
  onContinue,
}: {
  direction: number;
  t: (key: string) => string;
  onContinue: () => void;
}) {
  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="flex w-full flex-col items-center gap-8"
    >
      <div className="relative">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
        <div className="setup-rocket-box relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
          <Rocket className="setup-rocket h-10 w-10 text-primary" />
        </div>
      </div>

      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t('setup.welcome.title')}
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          {t('setup.welcome.description')}
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        {features.map(({ icon: Icon, labelKey }, i) => (
          <motion.div
            key={labelKey}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all hover:border-primary/20 hover:bg-card"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-[18px] w-[18px] text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{t(labelKey)}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Button size="lg" className="group gap-2 px-8 text-base" onClick={onContinue}>
          {t('setup.welcome.continue')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </motion.div>

      <style>{`
        .setup-rocket {
          animation: setupFloat 3s ease-in-out infinite;
        }
        @keyframes setupFloat {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-6px) rotate(-12deg); }
        }
      `}</style>
    </motion.div>
  );
}

// ─── Step 2: Database (Terminal/Ops Aesthetic) ────────────
function DatabaseStep({
  direction,
  t,
  dbUrl,
  setDbUrl,
  useTls,
  setUseTls,
  rejectUnauthorized,
  setRejectUnauthorized,
  dbTesting,
  dbSaving,
  restartWaiting,
  dbResult,
  testConnection,
  saveDatabase,
  onBack,
}: {
  direction: number;
  t: (key: string) => string;
  dbUrl: string;
  setDbUrl: (v: string) => void;
  useTls: boolean;
  setUseTls: (v: boolean) => void;
  rejectUnauthorized: boolean;
  setRejectUnauthorized: (v: boolean) => void;
  dbTesting: boolean;
  dbSaving: boolean;
  restartWaiting: boolean;
  dbResult: {
    success: boolean;
    message: string;
    version?: string;
    database?: string;
  } | null;
  testConnection: () => void;
  saveDatabase: () => void;
  onBack: () => void;
}) {
  const isDefault = dbUrl === DEFAULT_DB_URL;
  const hasSuccessfulTest = dbResult?.success === true;
  const busy = dbTesting || dbSaving || restartWaiting;

  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="flex w-full flex-col items-center gap-5"
    >
      {/* Header */}
      <div className="flex w-full items-start gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/15">
            <Database className="h-6 w-6 text-primary" strokeWidth={2} />
          </div>
        </div>
        <div className="flex-1 pt-0.5">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t('setup.database.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('setup.database.description')}
          </p>
        </div>
      </div>

      {/* Terminal-style connection editor */}
      <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 shadow-sm">
        {/* Terminal header bar */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
            </div>
            <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70">
              postgres://connection
            </span>
          </div>
          {isDefault ? (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              docker
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-500 dark:text-amber-400">
              <Zap className="h-2.5 w-2.5" />
              custom
            </span>
          )}
        </div>

        {/* URL editor */}
        <div className="p-4">
          <label htmlFor="dbUrl" className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              {t('setup.database.connectionUrl')}
            </span>
            <div className="group relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-primary/70">
                $
              </span>
              <input
                id="dbUrl"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                disabled={busy}
                placeholder="postgresql://user:pass@host:5432/dbname"
                spellCheck={false}
                className="
                  w-full rounded-lg border border-border/60 bg-background/80
                  py-2.5 pl-8 pr-3 font-mono text-sm text-foreground
                  transition-all
                  placeholder:text-muted-foreground/40
                  focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20
                  disabled:opacity-60
                "
              />
            </div>
          </label>
        </div>

        {/* TLS controls */}
        <div className="space-y-2 border-t border-border/50 bg-muted/10 px-4 py-3">
          <ToggleRow
            id="useTls"
            icon={<Lock className="h-4 w-4 text-muted-foreground" />}
            label={t('setup.database.useTls')}
            hint={t('setup.database.useTlsHint')}
            checked={useTls}
            onChange={setUseTls}
            disabled={busy}
          />
          <AnimatePresence>
            {useTls && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <ToggleRow
                  id="rejectUnauthorized"
                  icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
                  label={t('setup.database.rejectUnauthorized')}
                  hint={t('setup.database.rejectUnauthorizedHint')}
                  checked={rejectUnauthorized}
                  onChange={setRejectUnauthorized}
                  disabled={busy}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Test result / progress strip */}
      <AnimatePresence mode="wait">
        {restartWaiting ? (
          <motion.div
            key="restarting"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-3">
              <RotateCw className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-primary/80">
                  {t('setup.database.restarting')}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {t('setup.database.restartingDescription')}
                </p>
              </div>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/10">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: '15%' }}
                animate={{ width: ['15%', '80%', '92%'] }}
                transition={{ duration: 15, times: [0, 0.8, 1], ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ) : dbSaving ? (
          <motion.div
            key="saving"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full rounded-xl border border-border/60 bg-muted/30 p-4"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {t('setup.database.savingConfig')}
                </p>
                <p className="mt-0.5 text-sm text-foreground">
                  {t('setup.database.runningMigrations')}
                </p>
              </div>
            </div>
          </motion.div>
        ) : dbResult ? (
          <motion.div
            key={dbResult.success ? 'success' : 'error'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`w-full rounded-xl border p-4 ${
              dbResult.success
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div className="flex items-start gap-3">
              {dbResult.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`font-mono text-[11px] uppercase tracking-wider ${
                    dbResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                  }`}
                >
                  {dbResult.success
                    ? t('setup.database.connectionSuccess')
                    : t('setup.database.connectionFailed')}
                </p>
                {dbResult.success && (dbResult.version || dbResult.database) ? (
                  <div className="mt-2 space-y-1 font-mono text-xs text-foreground/80">
                    {dbResult.version && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground/60">version</span>
                        <span>{dbResult.version}</span>
                      </div>
                    )}
                    {dbResult.database && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground/60">database</span>
                        <span>{dbResult.database}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 break-words text-sm text-foreground/80">
                    {dbResult.message}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex w-full items-center justify-between gap-3">
        <Button variant="ghost" className="gap-2" onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={testConnection}
            disabled={busy || !dbUrl.trim()}
          >
            {dbTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('setup.database.testing')}
              </>
            ) : (
              <>
                <Terminal className="h-4 w-4" />
                {t('setup.database.testConnection')}
              </>
            )}
          </Button>
          <Button
            className="gap-2"
            onClick={saveDatabase}
            disabled={busy || !hasSuccessfulTest}
          >
            {dbSaving || restartWaiting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {t('setup.database.saveAndContinue')}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Toggle Row (reusable) ────────────────────────────────
function ToggleRow({
  id,
  icon,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`
        flex items-center justify-between gap-3 rounded-lg px-3 py-2.5
        transition-colors
        ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'}
      `}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
          transition-colors duration-200
          disabled:cursor-not-allowed
          ${checked ? 'bg-primary' : 'bg-muted-foreground/25'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
            ring-0 transition-transform duration-200
            ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}
            mt-[2px]
          `}
        />
      </button>
    </label>
  );
}

// ─── Step 3: Admin ────────────────────────────────────────
function AdminStep({
  direction,
  t,
  register,
  formErrors,
  error,
  isSubmitting,
  handleSubmit,
  onSubmit,
  onBack,
}: {
  direction: number;
  t: (key: string) => string;
  register: any;
  formErrors: any;
  error: string | null;
  isSubmitting: boolean;
  handleSubmit: any;
  onSubmit: (data: SetupValues) => Promise<void>;
  onBack: () => void;
}) {
  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="flex w-full flex-col items-center gap-6"
    >
      <Card className="w-full rounded-xl border-border/50">
        <CardHeader className="pb-4">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('setup.admin.title')}</CardTitle>
          <CardDescription>{t('setup.admin.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.name')}</Label>
                <Input
                  id="name"
                  placeholder="Admin"
                  autoComplete="name"
                  className="bg-muted/30 border-border/60"
                  {...register('name')}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500">{formErrors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  className="bg-muted/30 border-border/60"
                  {...register('email')}
                />
                {formErrors.email && (
                  <p className="text-sm text-red-500">{formErrors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="bg-muted/30 border-border/60"
                {...register('password')}
              />
              {formErrors.password && (
                <p className="text-sm text-red-500">{formErrors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceName">{t('setup.admin.instanceName')}</Label>
              <Input
                id="instanceName"
                placeholder="My Wiki"
                className="bg-muted/30 border-border/60"
                {...register('instanceName')}
              />
              <p className="text-xs text-muted-foreground">
                {t('setup.admin.instanceNameHint')}
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" className="gap-2" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
              <Button type="submit" className="gap-2" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('setup.admin.creating')}
                  </>
                ) : (
                  <>
                    {t('setup.admin.button')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Step 4: Complete ─────────────────────────────────────
function CompleteStep({
  direction,
  t,
}: {
  direction: number;
  t: (key: string) => string;
}) {
  const router = useRouter();
  return (
    <motion.div
      custom={direction}
      variants={pageVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={pageTransition}
      className="flex w-full flex-col items-center gap-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="relative"
      >
        <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/20 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 ring-1 ring-green-500/20">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="space-y-3 text-center"
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t('setup.complete.title')}
        </h1>
        <p className="mx-auto max-w-md text-lg text-muted-foreground">
          {t('setup.complete.description')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400"
      >
        <Sparkles className="h-4 w-4" />
        {t('setup.complete.instanceReady')}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <Button
          size="lg"
          className="group gap-2 px-8 text-base"
          onClick={() => router.push('/spaces')}
        >
          {t('setup.complete.goToDashboard')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
