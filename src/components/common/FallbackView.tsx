import React from'react';
import { Settings2 } from'lucide-react';

interface FallbackViewProps {
  title: string;
  onBackToPos: () => void;
}

export const FallbackView: React.FC<FallbackViewProps> = ({ title, onBackToPos }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <div className="bg-white p-12 rounded-2xl border border-zinc-200 flex flex-col items-center text-center max-w-md">
        <div className="w-20 h-20 bg-zinc-100 border border-zinc-200/80 rounded-full flex items-center justify-center mb-6">
          <Settings2 size={32} className="text-zinc-800" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-zinc-950 leading-tight mb-2">{title}</h2>
        <p className="text-zinc-500 text-sm">
          Halaman modul <span className="font-semibold text-zinc-700">{title}</span> saat ini siap digunakan atau
          kembali ke Kasir POS.
        </p>
        <button
          type="button"
          onClick={onBackToPos}
          className="mt-8 px-6 py-2.5 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Kembali ke Kasir POS (Penjualan)
        </button>
      </div>
    </div>
  );
};
