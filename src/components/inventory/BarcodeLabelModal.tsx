import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Product } from '../../types';
import { BarcodeLabelFormat } from '../../utils/barcode';
import { JewelryBarcodeTag } from '../common/JewelryBarcodeTag';
import { NumericInput } from '../common/NumericInput';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface BarcodeLabelModalProps {
  product: Product | null;
  onClose: () => void;
}

const FORMAT_OPTIONS: Array<{
  id: BarcodeLabelFormat;
  label: string;
  desc: string;
}> = [
  {
    id: 'hybrid',
    label: 'Code 128 + QR (Hybrid)',
    desc: 'Standar terbaik: barcode linear + QR 2D sekaligus',
  },
  {
    id: 'butterfly',
    label: 'Tag Kupu-Kupu (Gantung)',
    desc: 'Label lipat khusus produk gantung & aksesoris',
  },
  {
    id: 'code128',
    label: 'Code 128 Linear',
    desc: 'Barcode garis standar untuk scanner laser/USB',
  },
  {
    id: 'qr',
    label: 'QR Code Mini',
    desc: 'Tag kotak ringkas untuk kamera & scanner 2D',
  },
];

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ product, onClose }) => {
  const [format, setFormat] = useState<BarcodeLabelFormat>('hybrid');
  const [copies, setCopies] = useState<number>(1);

  useEffect(() => {
    if (product) {
      setCopies(Math.max(1, Math.min(product.stok || 1, 10)));
    }
  }, [product]);

  useEffect(() => {
    const cleanupPrint = () => {
      document.body.classList.remove('printing-barcode');
    };
    window.addEventListener('afterprint', cleanupPrint);
    return () => {
      window.removeEventListener('afterprint', cleanupPrint);
      document.body.classList.remove('printing-barcode');
    };
  }, []);

  if (!product) return null;

  const safeCopies = Math.max(1, Math.min(copies || 1, 60));

  const handlePrint = () => {
    document.body.classList.add('printing-barcode');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-barcode');
    }, 500);
  };

  return (
    <>
      <ModalShell
        isOpen={Boolean(product)}
        onClose={onClose}
        size="xl"
        title="Cetak Barcode"
        footer={
          <div className={MODAL_FOOTER_END_CLASS}>
            <button
              type="button"
              onClick={handlePrint}
              className={`${MODAL_BTN_PRIMARY_CLASS} gap-1.5`}
            >
              <GoogleIcon name="print" size={15} className="shrink-0" />
              <span>Cetak {safeCopies} Label</span>
            </button>
          </div>
        }
      >
        <div className="space-y-5">
            {/* Format Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-2">
                Pilih Standar Format Label
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FORMAT_OPTIONS.map(opt => {
                  const active = format === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormat(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        active
                          ? 'border-primary bg-primary-soft ring-1 ring-primary'
                          : 'border-zinc-200 hover:border-zinc-300 bg-white'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 ${
                          active ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {opt.id === 'qr' ? (
                          <GoogleIcon name="qr_code_2" size={15} />
                        ) : opt.id === 'code128' ? (
                          <GoogleIcon name="barcode" size={15} />
                        ) : (
                          <GoogleIcon name="layers" size={15} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-950 leading-tight">
                          {opt.label}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Copies Input */}
            <div className="flex flex-wrap items-end justify-between gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
              <div className="w-36">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Jumlah Label Cetak
                </label>
                <NumericInput
                  value={copies}
                  onChange={val => setCopies(Math.max(1, Math.min(val || 1, 60)))}
                  min={1}
                  max={60}
                  suffix="pcs"
                  className="w-full h-10 px-3.5 text-sm font-bold font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCopies(1)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-zinc-200 hover:border-zinc-400 rounded-lg text-zinc-700 cursor-pointer"
                >
                  1 Label
                </button>
                {product.stok > 0 && (
                  <button
                    type="button"
                    onClick={() => setCopies(Math.min(product.stok, 60))}
                    className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-zinc-200 hover:border-zinc-400 rounded-lg text-zinc-900 cursor-pointer"
                  >
                    Sesuai Stok ({Math.min(product.stok, 60)})
                  </button>
                )}
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <p className="text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
                Pratinjau Label (Siap Scan Code 128 / QR)
              </p>
              <div className="bg-gray-100 border border-dashed border-gray-300 rounded-lg p-5 flex items-center justify-center">
                <JewelryBarcodeTag product={product} format={format} />
              </div>
            </div>
        </div>
      </ModalShell>

      {/* Hidden Printable Barcode Sheet */}
      <div id="printable-barcode-sheet" className="print-only">
        <div className="flex flex-wrap gap-3 p-2">
          {Array.from({ length: safeCopies }).map((_, idx) => (
            <div key={idx} className="break-inside-avoid">
              <JewelryBarcodeTag product={product} format={format} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
