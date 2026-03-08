'use client';

import { Mail, CheckCircle2, XCircle, Send } from 'lucide-react';
import { useEmailStatus, useTestEmail } from '@/hooks/useAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminEmailPage() {
  const { data: emailStatus, isLoading } = useEmailStatus();
  const testEmail = useTestEmail();

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Email Configuration</h1>
      </div>

      <div className="space-y-6">
        {/* SMTP Status */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-4 text-lg font-semibold">SMTP Status</h2>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded bg-muted" />
                <div className="h-12 animate-pulse rounded bg-muted" />
              </div>
            ) : emailStatus ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                  {emailStatus.configured ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">
                      {emailStatus.configured ? 'SMTP Configured' : 'SMTP Not Configured'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {emailStatus.configured
                        ? 'Email service is ready to send messages.'
                        : 'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.'}
                    </p>
                  </div>
                </div>

                {emailStatus.configured && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Host</p>
                        <p className="text-sm font-mono">{emailStatus.host || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Port</p>
                        <p className="text-sm font-mono">{emailStatus.port || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">From</p>
                        <p className="text-sm font-mono">{emailStatus.from || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load email status.</p>
            )}
          </CardContent>
        </Card>

        {/* Test Email */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-lg font-semibold">Send Test Email</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Send a test email to your admin email address to verify the SMTP configuration.
            </p>
            <Button
              onClick={() => testEmail.mutate()}
              disabled={testEmail.isPending || !emailStatus?.configured}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {testEmail.isPending ? 'Sending...' : 'Send Test Email'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
