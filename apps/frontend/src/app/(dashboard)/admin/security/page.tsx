'use client';

import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { useSystemSettings, useUpdateSettings } from '@/hooks/useSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState(6);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    if (settings) {
      setRegistrationEnabled(settings.registrationEnabled);
      setEmailVerificationRequired(settings.emailVerificationRequired);
      setPasswordMinLength(settings.passwordMinLength);
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
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Security & Access</h1>
      </div>

      <div className="space-y-6">
        {/* Registration Toggle */}
        <Card>
          <CardHeader>
            <CardTitle>Registration</CardTitle>
            <CardDescription>
              Control whether new users can self-register or only admins can add users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Toggle
              checked={registrationEnabled}
              onChange={setRegistrationEnabled}
              label="Allow public registration"
              description="When disabled, only admins can add users via the invite system."
            />
          </CardContent>
        </Card>

        {/* Email Domain Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle>Email Domain Whitelist</CardTitle>
            <CardDescription>
              Restrict registration to specific email domains. Leave empty to allow all domains.
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
                Add
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
                No restrictions — all email domains are allowed.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Email Verification */}
        <Card>
          <CardHeader>
            <CardTitle>Email Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <Toggle
              checked={emailVerificationRequired}
              onChange={setEmailVerificationRequired}
              label="Require email verification"
              description="Users must verify their email address before they can log in."
            />
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Password Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium whitespace-nowrap">
                Minimum password length:
              </label>
              <Input
                type="number"
                min={4}
                max={128}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">characters</span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateSettings.isPending} size="lg">
          {updateSettings.isPending ? 'Saving...' : 'Save Security Settings'}
        </Button>
      </div>
    </div>
  );
}
