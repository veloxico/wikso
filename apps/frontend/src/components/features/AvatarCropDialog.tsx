'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropped: (blob: Blob) => void;
  isUploading?: boolean;
}

const VIEWPORT_SIZE = 256; // Circular viewport diameter
const CANVAS_SIZE = 512;   // Output image resolution

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageFile,
  onCropped,
  isUploading,
}: AvatarCropDialogProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;
    setImageLoaded(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });

    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Draw preview
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = VIEWPORT_SIZE;
    canvas.height = VIEWPORT_SIZE;

    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Calculate scaled image dimensions to cover the viewport
    const imgAspect = img.width / img.height;
    let drawW: number, drawH: number;
    if (imgAspect > 1) {
      drawH = VIEWPORT_SIZE * zoom;
      drawW = drawH * imgAspect;
    } else {
      drawW = VIEWPORT_SIZE * zoom;
      drawH = drawW / imgAspect;
    }

    const drawX = (VIEWPORT_SIZE - drawW) / 2 + offset.x;
    const drawY = (VIEWPORT_SIZE - drawH) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Draw circle border
    ctx.beginPath();
    ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [zoom, offset]);

  useEffect(() => {
    if (imageLoaded) draw();
  }, [imageLoaded, draw]);

  // Mouse / touch handlers for dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(3, Math.max(1, prev - e.deltaY * 0.002)));
  }, []);

  // Crop and export
  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CANVAS_SIZE;
    exportCanvas.height = CANVAS_SIZE;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Clip to circle
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Scale offset/zoom from viewport to export size
    const scale = CANVAS_SIZE / VIEWPORT_SIZE;
    const imgAspect = img.width / img.height;
    let drawW: number, drawH: number;
    if (imgAspect > 1) {
      drawH = CANVAS_SIZE * zoom;
      drawW = drawH * imgAspect;
    } else {
      drawW = CANVAS_SIZE * zoom;
      drawH = drawW / imgAspect;
    }

    const drawX = (CANVAS_SIZE - drawW) / 2 + offset.x * scale;
    const drawY = (CANVAS_SIZE - drawH) / 2 + offset.y * scale;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    exportCanvas.toBlob(
      (blob) => {
        if (blob) onCropped(blob);
      },
      'image/jpeg',
      0.9,
    );
  }, [zoom, offset, onCropped]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile.cropAvatar') || 'Crop Avatar'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Preview canvas */}
          <div
            ref={containerRef}
            className="relative rounded-full overflow-hidden bg-muted cursor-grab active:cursor-grabbing"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onWheel={handleWheel}
          >
            <canvas
              ref={canvasRef}
              width={VIEWPORT_SIZE}
              height={VIEWPORT_SIZE}
              className="block"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('profile.cropHint') || 'Drag to reposition. Scroll or use slider to zoom.'}
          </p>

          {/* Zoom control */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-2 accent-primary cursor-pointer"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCrop} disabled={!imageLoaded || isUploading} className="gap-2">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? (t('common.uploading') || 'Uploading...') : (t('profile.saveAvatar') || 'Save Avatar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
