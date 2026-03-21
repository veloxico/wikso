'use client';

import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { useSystemSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function AdminSecurityPage() {
  const { data: settings, isLoading } = useSystemSettings();
  const updateSettings = useUpdateSettings();
  const { t } = useTranslation();

  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState(6);
  const [maxAttachmentSizeMb, setMaxAttachmentSizeMb] = useState(25);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    if (settings) {
      setRegistrationEnabled(settings.registrationEnabled);
      setEmailVerificationRequired(settings.emailVerificationRequired);
      setPasswordMinLength(settings.passwordMinLength);
      setMaxAttachmentSizeMb(settings.maxAttachmentSizeMb);
      setAllowedDomains(settings.allowedEmailDomains);
    }
  }, [settings]);

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase();
    if (d && !allowedDomains.includes(d)) {
      setAllowedDomains([...allowedDomains, d]);
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  const handleSave = () => {
    updateSettings.mutate({
      registrationEnabled,
      emailVerificationRequired,
      passwordMinLength,
      maxAttachmentSizeMb,
      allowedEmailDomains: allowedDomains,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-8 flex items-center gap-3">
        <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">{t('admin.security.title')}</h1>
      </div>

      <div className="space-y-6">
        {/* Registration Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.security.registration')}</CardTitle>
            <CardDescription>
              {t('admin.security.registrationDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Toggle
              checked={registrationEnabled}
              onChange={setRegistrationEnabled}
              label={t('admin.security.allowPublicRegistration')}
              description={t('admin.security.allowPublicRegistrationDescription')}
            />
          </CardContent>
        </Card>

        {/* Email Domain Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.security.emailDomainWhitelist')}</CardTitle>
            <CardDescription>
              {t('admin.security.emailDomainWhitelistDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="company.com"
                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              />
              <Button variant="outline" onClick={addDomain}>
                {t('admin.security.add')}
              </Button>
            </div>
            {allowedDomains.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allowedDomains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                  >
                    {domain}
                    <button onClick={() => removeDomain(domain)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {allowedDomains.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('admin.security.noRestrictions')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Email Verification */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.security.emailVerification')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Toggle
              checked={emailVerificationRequired}
              onChange={setEmailVerificationRequired}
              label={t('admin.security.requireEmailVerification')}
              description={t('admin.security.requireEmailVerificationDescription')}
            />
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.security.passwordPolicy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">
                {t('admin.security.minPasswordLength')}
              </label>
              <Input
                type="number"
                min={4}
                max={128}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">{t('admin.security.characters')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Max Attachment Size */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.security.maxAttachmentSize')}</CardTitle>
            <CardDescription>
              {t('admin.security.maxAttachmentSizeDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">
                {t('admin.security.maxFileSize')}
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxAttachmentSizeMb}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxAttachmentSizeMb(Math.min(Math.max(v, 1), 100));
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">MB (max 100)</span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending ? t('common.saving') : t('admin.security.saveSecuritySettings')}
        </Button>
      </div>
    </div>
  );
}
