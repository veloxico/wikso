'use client';

import { useRef, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';
import { Excalidraw, exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import { Check, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ExcalidrawCanvasProps {
  initialData: string;
  onSave: (data: string, previewSvg: string) => void;
  onCancel: () => void;
  darkMode: boolean;
}

function parseInitialData(json: string): ExcalidrawInitialDataState {
  try {
    const raw = JSON.parse(json);
    if (raw && (raw.elements || raw.appState || raw.files)) {
      return {
        elements: raw.elements || [],
        appState: {
          ...(raw.appState || {}),
          collaborators: new Map(),
        },
        files: raw.files || undefined,
      };
    }
  } catch {
    // Invalid JSON — fall through to default
  }
  return { elements: [], appState: { collaborators: new Map() } };
}

export default function ExcalidrawCanvas({ initialData, onSave, onCancel, darkMode }: ExcalidrawCanvasProps) {
  const { t } = useTranslation();
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const parsedData = parseInitialData(initialData);

  const handleSave = useCallback(async () => {
    const api = excalidrawAPIRef.current;
    if (!api) return;

    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();

    const sceneData = JSON.stringify({
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridSize: appState.gridSize,
      },
      files,
    });

    // Generate SVG preview
    try {
      const svgElement = await exportToSvg({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: false,
          exportBackground: true,
        },
        files,
      });
      const svgString = svgElement?.outerHTML || '';
      onSave(sceneData, svgString);
    } catch {
      // If SVG export fails, save without preview
      onSave(sceneData, '');
    }
  }, [onSave]);

  return (
    <div className="excalidraw-canvas-wrapper">
      <div className="excalidraw-canvas-toolbar">
        <button type="button" className="excalidraw-btn excalidraw-btn-save" onClick={handleSave}>
          <Check size={14} />
          <span>{t('editor.drawingDone')}</span>
        </button>
        <button type="button" className="excalidraw-btn" onClick={onCancel}>
          <X size={14} />
          <span>{t('editor.drawingCancel')}</span>
        </button>
      </div>
      <div className="excalidraw-canvas-area">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawAPIRef.current = api; }}
          initialData={parsedData}
          theme={darkMode ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
            },
          }}
        />
      </div>
    </div>
  );
}
