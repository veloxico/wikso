'use client';

import { useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload, File, Image, FileText as FileIcon } from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment, getDownloadUrl } from '@/hooks/useAttachments';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AttachmentsProps {
  pageId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileIcon;
  return File;
}

export function Attachments({ pageId }: AttachmentsProps) {
  const { data: attachments, isLoading } = useAttachments(pageId);
  const uploadAttachment = useUploadAttachment(pageId);
  const deleteAttachment = useDeleteAttachment(pageId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { t } = useTranslation();

  const handleUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      uploadAttachment.mutate(file);
    });
  };

  const handleDownload = async (attachmentId: string, filename: string) => {
    try {
      const url = await getDownloadUrl(attachmentId);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4" />
          {t('attachments.title')}
          {attachments && attachments.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{attachments.length}</span>
          )}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploadAttachment.isPending ? t('attachments.uploading') : t('attachments.upload')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
      >
        {dragOver ? t('attachments.dropFiles') : t('attachments.dragAndDrop')}
      </div>

      {/* File list */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {attachments && attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => {
            const Icon = getFileIcon(att.mimeType);
            return (
              <div key={att.id} className="flex items-center gap-3 rounded-md border border-border p-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{att.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(att.size)}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDownload(att.id, att.filename)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteAttachment.mutate(att.id)}
                    disabled={deleteAttachment.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
