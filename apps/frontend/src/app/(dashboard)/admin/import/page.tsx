'use client';

import { useState, useCallback } from 'react';
import { Upload, FileArchive, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useStartImport, useImportStatus } from '@/hooks/useImport';

const PHASES = [
  'extracting',
  'parsing',
  'spaces',
  'pages',
  'attachments',
  'fixing-refs',
  'comments',
  'tags',
  'done',
] as const;

export default function AdminImportPage() {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const startImport = useStartImport();
  const { data: status } = useImportStatus(jobId);

  const handleFile = useCallback((file: File) => {
    if (file.name.endsWith('.zip')) {
      setSelectedFile(file);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await startImport.mutateAsync(selectedFile);
    setJobId(result.jobId);
  };

  const isDone = status?.phase === 'done';
  const isError = status?.phase === 'error';
  const isRunning = jobId && !isDone && !isError;

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Upload className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('admin.import.title')}</h1>
      </div>

      <div className="space-y-6">
        {/* Upload Zone */}
        {!jobId && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-2 text-lg font-semibold">{t('admin.import.uploadTitle')}</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('admin.import.uploadDescription')}
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <FileArchive className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">
                  {selectedFile ? selectedFile.name : t('admin.import.dropzone')}
                </p>
                {selectedFile && (
                  <p className="mb-4 text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                )}
                {!selectedFile && (
                  <p className="text-xs text-muted-foreground">{t('admin.import.dropzoneHint')}</p>
                )}
                <input
                  type="file"
                  accept=".zip"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>

              {selectedFile && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleUpload}
                    disabled={startImport.isPending}
                    className="gap-2"
                  >
                    {startImport.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('common.uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {t('admin.import.startImport')}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {jobId && status && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-lg font-semibold">
                {isDone
                  ? t('admin.import.complete')
                  : isError
                    ? t('admin.import.failed')
                    : t('admin.import.inProgress')}
              </h2>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{status.message || status.phase}</span>
                  <span className="font-medium">{status.percent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isError ? 'bg-destructive' : isDone ? 'bg-green-500' : 'bg-primary'
                    }`}
                    style={{ width: `${status.percent}%` }}
                  />
                </div>
              </div>

              {/* Phase indicators */}
              <div className="mb-6 flex flex-wrap gap-2">
                {PHASES.map((phase) => {
                  const currentIdx = PHASES.indexOf(status.phase as any);
                  const phaseIdx = PHASES.indexOf(phase);
                  const isActive = status.phase === phase;
                  const isCompleted = phaseIdx < currentIdx || isDone;

                  return (
                    <div
                      key={phase}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        isActive && !isDone && !isError
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted && !isActive ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : isActive && !isDone ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {t(`admin.import.phase.${phase}`)}
                    </div>
                  );
                })}
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  { label: t('admin.import.counter.spaces'), value: status.counts.spaces },
                  { label: t('admin.import.counter.pages'), value: status.counts.pages },
                  { label: t('admin.import.counter.attachments'), value: status.counts.attachments },
                  { label: t('admin.import.counter.comments'), value: status.counts.comments },
                  { label: t('admin.import.counter.tags'), value: status.counts.tags },
                ].map((counter) => (
                  <div key={counter.label} className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold">{counter.value}</p>
                    <p className="text-xs text-muted-foreground">{counter.label}</p>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {status.errors.length > 0 && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                    <XCircle className="h-4 w-4" />
                    {t('admin.import.errors')} ({status.errors.length})
                  </h3>
                  <div className="max-h-40 overflow-y-auto">
                    {status.errors.slice(0, 50).map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {err}
                      </p>
                    ))}
                    {status.errors.length > 50 && (
                      <p className="text-xs text-muted-foreground">
                        ...{t('admin.import.andMore', { count: status.errors.length - 50 })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Done actions */}
              {isDone && (
                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => window.location.href = '/spaces'}
                    className="gap-2"
                  >
                    {t('admin.import.goToSpaces')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Error retry */}
              {isError && (
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setJobId(null);
                      setSelectedFile(null);
                    }}
                  >
                    {t('common.tryAgain')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-2 text-lg font-semibold">{t('admin.import.helpTitle')}</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t('admin.import.helpStep1')}</p>
              <p>{t('admin.import.helpStep2')}</p>
              <p>{t('admin.import.helpStep3')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
