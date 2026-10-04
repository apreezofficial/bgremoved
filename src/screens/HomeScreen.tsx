import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { pickImage } from '../lib/imagePicker';
import { removeBackground } from '../lib/removerClient';
import { getAllRecents, deleteRecentItem, saveRecentItem } from '../lib/storage';
import { PhotoIcon, CameraIcon, TrashIcon, SparklesIcon } from '../components/Icons';
import { RecentItem } from '../types';

export const HomeScreen: React.FC = () => {
  const {
    recents,
    setRecents,
    removeRecent,
    setImages,
    setScreen,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
  } = useAppStore();

  useEffect(() => {
    // Load local on-device recents on mount
    getAllRecents().then((items) => {
      setRecents(items);
    });
  }, [setRecents]);

  const handlePick = async (source: 'photos' | 'camera') => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;

      setIsProcessing(true);
      setProgress({
        stage: 'loading_model',
        percent: 10,
        message: 'Initializing on-device AI...',
      });

      const img = new Image();
      img.onload = async () => {
        try {
          const { blob, width, height } = await removeBackground(img, (p) => {
            setProgress(p);
          });

          const cutoutUrl = URL.createObjectURL(blob);

          // Save to local recents
          const recentItem: RecentItem = {
            id: 'rec_' + Date.now(),
            timestamp: Date.now(),
            thumbnailDataUrl: cutoutUrl,
            originalDataUrl: picked.dataUrl,
            resultDataUrl: cutoutUrl,
            width,
            height,
          };
          await saveRecentItem(recentItem);
          setRecents([recentItem, ...recents]);

          setImages(picked.dataUrl, cutoutUrl, width, height);
          setIsProcessing(false);
          setScreen('editor');
        } catch (err: any) {
          console.error('Removal failed', err);
          alert('Background removal failed: ' + (err.message || 'Unknown error'));
          setIsProcessing(false);
        }
      };
      img.src = picked.dataUrl;
    } catch (err: any) {
      console.error('Pick image error', err);
      setIsProcessing(false);
    }
  };

  const handleOpenRecent = (item: RecentItem) => {
    setImages(item.originalDataUrl, item.resultDataUrl, item.width, item.height);
    setScreen('editor');
  };

  const handleDeleteRecent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteRecentItem(id);
    removeRecent(id);
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg text-fg select-none overflow-y-auto px-6 py-8 safe-top safe-bottom">
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-8 pt-2">
        <div>
          <span className="text-xs font-mono tracking-widest text-accent uppercase font-bold">100% Offline AI</span>
          <h1 className="text-3xl font-bold tracking-tightest text-fg mt-1">bgremoved</h1>
        </div>
        <div className="flex items-center space-x-1 px-2.5 py-1 rounded-btn bg-surface border border-border">
          <span className="w-2 h-2 rounded-full bg-accent inline-block mr-1.5" />
          <span className="text-xs font-mono text-muted">ON-DEVICE</span>
        </div>
      </div>

      {/* Primary Action Hero */}
      <div className="flex flex-col space-y-3 mb-10">
        <button
          onClick={() => handlePick('photos')}
          disabled={isProcessing}
          className="w-full flex items-center justify-center space-x-3 bg-accent text-accent-fg py-4 px-6 rounded-btn font-semibold text-base tracking-tight hover:bg-accent-hover active:scale-[0.99] transition-all duration-fast disabled:opacity-50"
        >
          <PhotoIcon size={22} className="text-accent-fg" />
          <span>Pick image</span>
        </button>

        <button
          onClick={() => handlePick('camera')}
          disabled={isProcessing}
          className="w-full flex items-center justify-center space-x-3 bg-surface hover:bg-card border border-border text-fg py-3.5 px-6 rounded-btn font-medium text-base tracking-tight active:scale-[0.99] transition-all duration-fast disabled:opacity-50"
        >
          <CameraIcon size={20} className="text-muted" />
          <span>Take photo</span>
        </button>
      </div>

      {/* Processing Modal Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-none flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-card border border-border rounded-btn p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-btn bg-surface border border-border flex items-center justify-center mb-4 text-accent">
              <SparklesIcon size={24} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-fg mb-1">Removing Background</h3>
            <p className="text-xs font-mono text-muted mb-6">{progress.message || 'Processing on-device...'}</p>

            {/* Flat Progress Bar */}
            <div className="w-full bg-surface border border-border rounded-btn h-3 overflow-hidden p-0.5 mb-3">
              <div
                className="bg-accent h-full rounded-sm transition-all duration-fast"
                style={{ width: `${Math.max(5, progress.percent)}%` }}
              />
            </div>

            <div className="flex justify-between w-full text-xs font-mono text-muted">
              <span>AIRPLANE MODE READY</span>
              <span>{progress.percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Recents Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted font-mono">
            Past Edits ({recents.length})
          </h2>
        </div>

        {recents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-btn bg-surface/40 my-4 min-h-[180px]">
            <p className="text-sm text-muted font-medium mb-1">No past edits yet</p>
            <p className="text-xs text-muted/70">Pick or take an image above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recents.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenRecent(item)}
                className="group relative aspect-square bg-card border border-border rounded-btn overflow-hidden cursor-pointer hover:border-accent/60 transition-colors"
              >
                {/* Checkerboard bg underneath */}
                <div className="absolute inset-0 bg-checkerboard opacity-60" />
                <img
                  src={item.thumbnailDataUrl}
                  alt="Recent cutout"
                  className="relative z-10 w-full h-full object-contain p-2"
                />
                <button
                  onClick={(e) => handleDeleteRecent(e, item.id)}
                  aria-label="Delete"
                  className="absolute top-2 right-2 z-20 p-1.5 rounded-btn bg-bg/80 border border-border text-muted hover:text-danger hover:border-danger transition-colors"
                >
                  <TrashIcon size={14} />
                </button>
                <div className="absolute bottom-0 inset-x-0 z-20 bg-bg/90 border-t border-border px-2 py-1 flex items-center justify-between text-[10px] font-mono text-muted">
                  <span>{item.width}×{item.height}</span>
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
