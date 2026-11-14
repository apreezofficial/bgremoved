import React from 'react';

interface P { size?: number; className?: string }
const mk = (children: React.ReactNode) => ({ size = 20, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {children}
  </svg>
);

export const AddBgIcon = mk(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" /></>);
export const RotateIcon = mk(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>);
export const FlipIcon = mk(<><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 20v2M12 14v2M12 8v2M12 2v2" /></>);
export const EraseIcon = mk(<><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7M5 11l9 9" /></>);
export const BrushIcon = mk(<><path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" /><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" /></>);
export const WandIcon = mk(<><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9" /></>);
export const CropIcon = mk(<><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" /></>);
export const PanIcon = mk(<><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></>);
export const ZoomIcon = mk(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /></>);
export const ZoomInIcon = ZoomIcon;
export const ZoomOutIcon = mk(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M8 11h6" /></>);
export const UndoIcon = mk(<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>);
export const RedoIcon = mk(<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></>);
export const CompareIcon = mk(<><path d="M12 3v18M8 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M16 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" /></>);
export const UploadImgIcon = mk(<><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21M14 19.5l3-3 3 3M17 22v-5.5" /><circle cx="9" cy="9" r="2" /></>);
export const DownloadIcon = mk(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></>);
export const ChevronLeftIcon = mk(<path d="m15 18-6-6 6-6" />);
export const ChevronRightIcon = mk(<path d="m9 18 6-6-6-6" />);
export const CloseIcon = mk(<path d="M18 6 6 18M6 6l12 12" />);
export const BanIcon = mk(<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>);
export const TrashIcon = mk(<><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>);
export const RotateCwIcon = mk(<><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>);
export const FlipVIcon = mk(<><path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M20 12h2M14 12h2M8 12h2M2 12h2" /></>);

export const ColorWheel = ({ size = 20 }: { size?: number }) => (
  <span className="block rounded-full" style={{ width: size, height: size, background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
);
