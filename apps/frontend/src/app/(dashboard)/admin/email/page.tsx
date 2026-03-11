'use client';

import { useState, useEffect } from 'react';
import { Mail, CheckCircle2, XCircle, Send, Save, Trash2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import {
  useEmailStatus,
  useEmailProviders,
  useEmailConfig,
  useSaveEmailConfig,
  useDeleteEmailConfig,
  useTestEmail,
} from '@/hooks/useAdmin';
import type { ProviderFieldDefinition } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

export default function AdminEmailPage() {
  const { t } = useTranslation();
  const { data: emailStatus, isLoading: statusLoading } = useEmailStatus();
  const { data: providers } = useEmailProviders();
  const { data: emailConfig, isLoading: configLoading } = useEmailConfig();
  const saveConfig = useSaveEmailConfig();
  const deleteConfig = useDeleteEmailConfig();
  const testEmail = useTestEmail();

  const [selectedProvider, setSelectedProvider] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Load current config into form
  useEffect(() => {
    if (emailConfig) {
      setSelectedProvider(emailConfig.provider || '');
      setConfigValues(emailConfig.config || {});
      setFromAddress(emailConfig.fromAddress || '');
      setFromName(emailConfig.fromName || '');
    }
  }, [emailConfig]);

  const currentProviderInfo = providers?.find((p) => p.type === selectedProvider);

  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    setConfigValues({});
    setShowPasswords({});
  };

  const handleFieldChange = (name: string, value: any) => {
    setConfigValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!selectedProvider) return;
    saveConfig.mutate({
      provider: selectedProvider,
      config: configValues,
      fromAddress,
      fromName,
    });
  };

  const handleDelete = () => {
    deleteConfig.mutate(undefined, {
      onSuccess: () => {
        setSelectedProvider('');
        setConfigValues({});
        setFromAddress('');
        setFromName('');
      },
    });
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const renderField = (field: ProviderFieldDefinition) => {
    const value = configValues[field.name] || '';

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.name} className="space-y-2">
          <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
          <Select value={value} onValueChange={(v) => handleFieldChange(field.name, v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === 'password') {
      return (
        <div key={field.name} className="space-y-2">
          <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
          <div className="relative">
            <Input
              type={showPasswords[field.name] ? 'text' : 'password'}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility(field.name)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPasswords[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={field.name} className="space-y-2">
        <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => handleFieldChange(field.name, e.target.value)}
          placeholder={field.placeholder}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.email.title')}</h1>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">{t('admin.email.smtpStatus')}</h2>
            {statusLoading ? (
              <div className="h-12 animate-pulse rounded bg-muted" />
            ) : emailStatus ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                {emailStatus.configured ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="font-medium">
                    {emailStatus.configured ? t('admin.email.smtpConfigured') : t('admin.email.smtpNotConfigured')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {emailStatus.configured
                      ? `${emailStatus.provider} — ${emailStatus.fromAddress}`
                      : t('admin.email.smtpSetup')}
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Provider Configuration */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">{t('admin.email.providerConfig')}</h2>

            {configLoading ? (
              <div className="space-y-3">
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Provider Selector */}
                <div className="space-y-2">
                  <Label>{t('admin.email.selectProvider')}</Label>
                  <Select value={selectedProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('admin.email.chooseProvider')} />
                    </SelectTrigger>
                    <SelectContent>
                      {providers?.map((p) => (
                        <SelectItem key={p.type} value={p.type}>
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-2 text-muted-foreground">— {p.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Fields */}
                {currentProviderInfo && (
                  <>
                    {/* Documentation Link */}
                    {currentProviderInfo.docsUrl && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
                        <ExternalLink className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="text-muted-foreground">{t('admin.email.docsHint')}</span>
                        <a
                          href={currentProviderInfo.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                        >
                          {currentProviderInfo.name} {t('admin.email.documentation')}
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {currentProviderInfo.fields.map(renderField)}
                    </div>

                    {/* From Address / Name */}
                    <div className="border-t border-border pt-4">
                      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('admin.email.senderInfo')}</h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('admin.email.fromAddress')}</Label>
                          <Input
                            type="email"
                            value={fromAddress}
                            onChange={(e) => setFromAddress(e.target.value)}
                            placeholder="noreply@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('admin.email.fromName')}</Label>
                          <Input
                            type="text"
                            value={fromName}
                            onChange={(e) => setFromName(e.target.value)}
                            placeholder="Wikso"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                      <Button
                        onClick={handleSave}
                        disabled={saveConfig.isPending || !selectedProvider}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {saveConfig.isPending ? t('common.saving') : t('admin.email.saveConfig')}
                      </Button>
                      {emailConfig?.provider && (
                        <Button
                          variant="outline"
                          onClick={handleDelete}
                          disabled={deleteConfig.isPending}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('admin.email.clearConfig')}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-lg font-semibold">{t('admin.email.sendTestEmail')}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('admin.email.testEmailDescription')}
            </p>
            <Button
              onClick={() => testEmail.mutate()}
              disabled={testEmail.isPending || !emailStatus?.configured}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {testEmail.isPending ? t('common.sending') : t('admin.email.sendTestEmail')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
