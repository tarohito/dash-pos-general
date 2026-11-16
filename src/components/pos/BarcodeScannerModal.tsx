import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Product } from '../../types';
import { formatIDR } from '../../utils/formatters';
import { posApi } from '../../services/api';
import { extractBarcodeValue } from '../../utils/barcode';
import { useToast } from '../../contexts/ToastContext';
import { ModalShell, MODAL_BTN_PRIMARY_CLASS } from '../common/ModalShell';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCode: (code: string) => Promise<Product | null>;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  scanCount: number;
  totalCartQty: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanCode,
  isSoundEnabled,
  onToggleSound,
  scanCount,
  totalCartQty,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [sampleProducts, setSampleProducts] = useState<Product[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'not-found'>('idle');
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { showToast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastDecodedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    if (isOpen) {
      setInputVal('');
      setScanStatus('idle');
      setCameraError(null);
      const timer = setTimeout(() => inputRef.current?.focus(), 80);

      const controller = new AbortController();
      setIsLoadingSamples(true);
      posApi
        .getProducts({ page: 1, pageSize: 24 }, controller.signal)
        .then(res => {
          setSampleProducts(res.items);
          setTotalAvailable(res.totalAllProducts);
          setIsLoadingSamples(false);
        })
        .catch(err => {
          if ((err as Error).name !== 'AbortError') {
            showToast('error', err instanceof Error ? err.message : 'Gagal memuat daftar SKU.');
          }
          setIsLoadingSamples(false);
        });

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    } else {
      setIsCameraActive(false);
      setCameraError(null);
      setLastScannedProduct(null);
    }
  }, [isOpen]);

  const handleProcessScan = useCallback(
    async (codeToScan: string) => {
      const cleaned = extractBarcodeValue(codeToScan);
      if (!cleaned) {
        showToast('warning', 'Masukkan atau scan kode barcode / SKU produk terlebih dahulu.');
        inputRef.current?.focus();
        return;
      }
      if (isScanning) return;

      setIsScanning(true);
      try {
        const matched = await onScanCode(cleaned);
        if (matched) {
          setLastScannedProduct(matched);
          setScanStatus('success');
          setInputVal('');
          setTimeout(() => {
            setScanStatus('idle');
          }, 2200);
        } else {
          setScanStatus('not-found');
          setTimeout(() => {
            setScanStatus('idle');
          }, 2500);
        }
      } finally {
        setIsScanning(false);
        inputRef.current?.focus();
      }
    },
    [isScanning, onScanCode, showToast]
  );

  // Live Multi-Format Camera Decoder (Code 128, QR Code, EAN-13, Code 39, DataMatrix)
  useEffect(() => {
    let cancelled = false;

    const stopScanner = () => {
      if (scannerControlsRef.current) {
        try {
          scannerControlsRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
        scannerControlsRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };

    if (!isOpen || !isCameraActive) {
      stopScanner();
      return;
    }

    setCameraError(null);
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.CODE_39,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.UPC_A,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 180,
      delayBetweenScanSuccess: 1200,
    });

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoEl,
        result => {
          if (cancelled || !result) return;
          const rawText = result.getText();
          const extracted = extractBarcodeValue(rawText);
          if (!extracted) return;

          const now = Date.now();
          if (
            lastDecodedRef.current.code === extracted &&
            now - lastDecodedRef.current.time < 1600
          ) {
            return;
          }
          lastDecodedRef.current = { code: extracted, time: now };
          void handleProcessScan(extracted);
        }
      )
      .then(controls => {
        if (cancelled) {
          controls.stop();
        } else {
          scannerControlsRef.current = controls;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            'Kamera tidak tersedia atau izin kamera ditolak. Gunakan scanner fisik USB atau ketik SKU.'
          );
          setIsCameraActive(false);
        }
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isOpen, isCameraActive, handleProcessScan]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleProcessScan(inputVal);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Scan Barcode"
      headerActions={
        <button
          type="button"
          onClick={onToggleSound}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isSoundEnabled
              ? 'bg-primary text-white border-primary'
              : 'bg-zinc-100 text-zinc-400 border-zinc-200'
          }`}
          title={isSoundEnabled ? 'Suara beep aktif' : 'Suara beep nonaktif'}
          aria-label={isSoundEnabled ? 'Suara beep aktif' : 'Suara beep nonaktif'}
        >
          {isSoundEnabled ? <GoogleIcon name="volume_up" size={16} /> : <GoogleIcon name="volume_off" size={16} />}
        </button>
      }
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-sm text-zinc-600">
            Keranjang saat ini:{' '}
            <span className="font-bold text-zinc-950 font-mono">{totalCartQty} item</span>
            {scanCount > 0 && (
              <span className="text-zinc-400 text-xs ml-1.5 font-mono">({scanCount}x di-scan sesi ini)</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            Selesai Scan
          </button>
        </div>
      }
    >
      <div className="space-y-4">
          {/* Main Input Field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
              Kode Barcode (Code 128 / QR / SKU)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <GoogleIcon name="barcode_scanner" size={17}
                 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan atau masukkan SKU (contoh: PF-001 / SK-002)..."
                  value={inputVal}
                  onChange={e => {
                    const val = e.target.value;
                    setInputVal(val);
                    const matched = sampleProducts.find(
                      p => p.sku.toLowerCase() === val.trim().toLowerCase()
                    );
                    if (matched) {
                      void handleProcessScan(val);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 pl-9 pr-3.5 text-sm font-mono font-semibold rounded-xl border border-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white transition-colors"
                />
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => void handleProcessScan(inputVal)}
                className="h-10 px-4 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center"
              >
                {isScanning ? 'Memproses...' : 'Scan'}
              </button>

              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
                  isCameraActive
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
                title={isCameraActive ? 'Matikan Kamera' : 'Nyalakan Kamera Scanner'}
              >
                <GoogleIcon name="photo_camera" size={16} />
              </button>
            </div>
          </div>

          {cameraError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <GoogleIcon name="error" size={15} className="shrink-0 text-amber-600" />
              <span>{cameraError}</span>
            </div>
          )}

          {isCameraActive && (
            <div className="relative w-full h-48 bg-black rounded-xl overflow-hidden border border-zinc-200">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-28 border-2 border-white/90 rounded-lg bg-white/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-white animate-laser" />
                  <p className="text-xs text-white font-medium bg-black/65 px-2.5 py-1 rounded">
                    Arahkan ke Code 128 / QR Code
                  </p>
                </div>
              </div>
            </div>
          )}

          {scanStatus === 'success' && lastScannedProduct && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <GoogleIcon name="check_circle" size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900 truncate">
                    {lastScannedProduct.name}
                  </p>
                  <p className="text-xs text-emerald-700 font-mono">
                    SKU: {lastScannedProduct.sku} • {formatIDR(lastScannedProduct.harga)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-white px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                +1 Masuk Keranjang
              </span>
            </div>
          )}

          {scanStatus === 'not-found' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2.5 text-red-800 text-xs font-semibold animate-in fade-in duration-150">
              <GoogleIcon name="error" size={16} className="text-red-600 shrink-0" />
              <span>SKU barcode tidak ditemukan dalam katalog produk.</span>
            </div>
          )}

          {scanStatus === 'idle' && lastScannedProduct && (
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={lastScannedProduct.image}
                  alt={lastScannedProduct.name}
                  className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase">Scan Terakhir</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {lastScannedProduct.name}
                  </p>
                </div>
              </div>
              <span className="text-sm font-bold font-mono text-zinc-950 shrink-0">
                {formatIDR(lastScannedProduct.harga)}
              </span>
            </div>
          )}

          {/* Quick SKU Test Chips */}
          <div className="pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                Klik Cepat untuk Simulasi Scan:
              </span>
              <span className="text-xs text-zinc-400 font-medium font-mono">
                {totalAvailable} SKU tersedia
              </span>
            </div>

            {isLoadingSamples ? (
              <div className="py-6 flex items-center justify-center text-xs text-zinc-400 gap-2">
                <GoogleIcon name="progress_activity" size={14} className="animate-spin text-primary" />
                <span>Memuat daftar SKU...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {sampleProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void handleProcessScan(p.sku)}
                    className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-400 rounded-lg text-left transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-zinc-800 bg-zinc-200/70 px-1.5 py-0.5 rounded">
                        {p.sku}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 truncate group-hover:text-zinc-950">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold font-mono text-zinc-500 shrink-0">
                      {p.berat.toFixed(2)}g
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
      </div>
    </ModalShell>
  );
};
