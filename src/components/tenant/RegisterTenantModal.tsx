import React, { useState, useRef } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Tenant } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { compressAndCropSquareToWebP, formatBytes } from '../../utils/imageCompressor';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

function getTenantInitials(rawName: string): string {
  const words = rawName
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase() || 'LP';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase() || 'LP';
  }
  return 'LP';
}

interface RegisterTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTenant: (newTenant: Tenant) => Promise<void> | void;
}

export const RegisterTenantModal: React.FC<RegisterTenantModalProps> = ({
  isOpen,
  onClose,
  onSaveTenant,
}) => {
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Tenant['plan']>('Enterprise Multi-Tenant');
  const [logoUrl, setLogoUrl] = useState('');
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [logoCompressionInfo, setLogoCompressionInfo] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<Tenant | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const liveInitials = getTenantInitials(name);

  const handleLogoFile = async (file: File) => {
    setErrorMsg(null);
    setIsCompressingLogo(true);
    try {
      const result = await compressAndCropSquareToWebP(file, {
        targetSize: 512,
        quality: 0.82,
      });
      setLogoUrl(result.dataUrl);
      setLogoCompressionInfo(
        `WebP 1:1 (${result.width}×${result.height}) • ${formatBytes(result.originalSizeBytes)} → ${formatBytes(result.sizeBytes)}`
      );
      showToast('success', 'Logo outlet dikompres otomatis ke WebP 1:1.', 'Logo Siap');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar logo.';
      showToast('error', msg);
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const failValidation = (msg: string) => {
    setErrorMsg(msg);
    showToast('error', msg, 'Validasi Form Outlet');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanBranch = branchName.trim();
    const cleanPhone = phone.trim();
    const phoneDigits = cleanPhone.replace(/[^0-9]/g, '');
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 3) {
      failValidation('Nama bisnis / toko wajib diisi (minimal 3 karakter).');
      return;
    }
    if (!cleanBranch || cleanBranch.length < 3) {
      failValidation('Nama cabang utama wajib diisi (minimal 3 karakter).');
      return;
    }
    if (cleanPhone && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
      failValidation('Format nomor WhatsApp / HP tidak sesuai (8–15 digit angka).');
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      failValidation('Format alamat email toko tidak sesuai.');
      return;
    }

    const initials = getTenantInitials(cleanName);

    const cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.logicpos.id';
    const code = 'TEN-' + Math.floor(100 + Math.random() * 900);

    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: cleanName,
      code,
      branchName: cleanBranch,
      address: address.trim() || `Jl. Utama Bisnis No. 1, ${city.trim() || 'Indonesia'}`,
      city: city.trim() || 'Jakarta',
      plan,
      cashierCount: 2,
      productCount: 0,
      phone: cleanPhone || '0812-0000-0000',
      email: cleanEmail || `kontak@${cleanSlug}`,
      slug: cleanSlug,
      logoInitial: initials,
      logoUrl: logoUrl || '',
      databaseSchema: `tenant_db_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`,
      status: 'Aktif',
    };

    setIsSubmitting(true);
    try {
      await onSaveTenant(newTenant);
      setCreatedTenant(newTenant);
      setIsSuccess(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mendaftarkan tenant baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setIsSuccess(false);
    setCreatedTenant(null);
    setName('');
    setBranchName('');
    setCity('');
    setAddress('');
    setOwnerName('');
    setPhone('');
    setEmail('');
    setLogoUrl('');
    setLogoCompressionInfo(null);
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={isSuccess && createdTenant ? handleFinish : onClose}
      size="md"
      title="Tambah Outlet"
      disableEscapeClose={isSubmitting}
      footer={
        isSuccess && createdTenant ? (
          <div className={MODAL_FOOTER_END_CLASS}>
            <button
              type="button"
              onClick={handleFinish}
              className={MODAL_BTN_PRIMARY_CLASS}
            >
              Mulai Gunakan Outlet Ini
            </button>
          </div>
        ) : (
          <div className={MODAL_FOOTER_END_CLASS}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={MODAL_BTN_SECONDARY_CLASS}
            >
              Batal
            </button>
            <button
              type="submit"
              form="register-tenant-form"
              disabled={isSubmitting}
              className={MODAL_BTN_PRIMARY_CLASS}
            >
              {isSubmitting ? 'Mendaftarkan...' : 'Daftarkan Tenant'}
            </button>
          </div>
        )
      }
    >
      {isSuccess && createdTenant ? (
        <div className="py-2 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <GoogleIcon name="check_circle" size={36} />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Selamat! Tenant Berhasil Terdaftar</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Bisnis Anda telah resmi bergabung ke dalam cloud multi-tenant LogicPOS. Sistem kini aktif untuk tenant ini.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-left space-y-2.5 text-sm">
            <div className="flex items-center gap-3 pb-2.5 border-b border-zinc-200/80">
              {createdTenant.logoUrl ? (
                <img
                  src={createdTenant.logoUrl}
                  alt={createdTenant.name}
                  className="w-12 h-12 aspect-square rounded-xl object-cover border border-zinc-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 aspect-square rounded-xl bg-primary-soft text-primary-text border border-primary-border flex items-center justify-center font-bold text-base shrink-0">
                  {createdTenant.logoInitial}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-zinc-950 truncate">{createdTenant.name}</p>
                <p className="text-xs text-zinc-500 truncate">{createdTenant.branchName}</p>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Kode Tenant:</span>
              <span className="font-mono font-bold text-zinc-950">{createdTenant.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Domain POS:</span>
              <span className="font-mono text-gray-700">{createdTenant.slug}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Paket Kemitraan:</span>
              <span className="font-semibold text-emerald-700">{createdTenant.plan}</span>
            </div>
          </div>
        </div>
      ) : (
        <form id="register-tenant-form" noValidate onSubmit={handleSubmit} className="space-y-3.5 text-sm">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <GoogleIcon name="error" size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Optional 1:1 WebP Logo Upload + Auto-Initials Preview */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDraggingLogo(true);
              }}
              onDragLeave={() => setIsDraggingLogo(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDraggingLogo(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleLogoFile(file);
              }}
              className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center gap-3.5 ${
                isDraggingLogo
                  ? 'border-primary bg-primary-soft/40'
                  : 'border-zinc-200 bg-zinc-50/70'
              }`}
            >
              <div className="relative w-16 h-16 aspect-square rounded-2xl overflow-hidden shrink-0 border border-zinc-200 bg-white flex items-center justify-center shadow-xs">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Preview logo outlet"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary-soft text-primary-text flex items-center justify-center font-bold text-xl tracking-tight">
                    {liveInitials}
                  </div>
                )}
                {isCompressingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <GoogleIcon name="progress_activity" size={20} className="animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-zinc-900 text-sm">
                    Foto / Logo Outlet (1:1)
                  </span>
                  <span className="px-1.5 py-0.5 text-xs font-semibold bg-zinc-200/70 text-zinc-700 rounded-md">
                    Opsional
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-snug">
                  {logoCompressionInfo
                    ? logoCompressionInfo
                    : `Auto-kompres WebP 1:1. Jika tidak diisi, otomatis pakai inisial "${liveInitials}".`}
                </p>
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleLogoFile(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={isCompressingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="h-8 px-3 text-xs font-semibold text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <GoogleIcon name="add_photo_alternate" size={14} className="text-primary" />
                    <span>{logoUrl ? 'Ganti Logo' : 'Upload Foto / Logo'}</span>
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoCompressionInfo(null);
                      }}
                      className="h-8 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <GoogleIcon name="close" size={14} />
                      <span>Pakai Inisial ({liveInitials})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">
                Nama Bisnis / Toko <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Cth: Toko Maju Abadi"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-semibold transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">
                  Nama Cabang Pertama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Cabang Mall Kelapa Gading"
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-medium transition-colors"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">Kota / Domisili Cabang</label>
                <input
                  type="text"
                  placeholder="Cth: Jakarta Utara"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-medium transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">Alamat Lengkap Gerai / Outlet</label>
              <input
                type="text"
                placeholder="Cth: Jl. Boulevard Raya Blok M No. 8, Mall Kelapa Gading Lt. Dasar"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-medium transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">Nama Pemilik / PIC</label>
                <input
                  type="text"
                  placeholder="Cth: Ibu Veronica"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-medium transition-colors"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">No. WhatsApp / HP</label>
                <input
                  type="tel"
                  placeholder="0812-xxxx-xxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-mono transition-colors"
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">Email Toko</label>
                <input
                  type="email"
                  placeholder="admin@tokobaru.id"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 px-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white text-sm font-medium transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1.5 text-xs">Pilihan Paket Layanan LogicPOS</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'Enterprise Multi-Tenant' as const,
                    title: 'Enterprise Multi-Tenant',
                    desc: 'Database terisolasi, unlimited cabang & kasir, analitik terpusat',
                    popular: true,
                  },
                  {
                    id: 'Pro Multi-Outlet' as const,
                    title: 'Pro Multi-Outlet',
                    desc: 'Mendukung hingga 5 cabang terintegrasi & sinkronisasi stok',
                    popular: false,
                  },
                ].map(item => (
                  <label
                    key={item.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      plan === item.id
                        ? 'border-primary ring-1 ring-primary bg-primary-soft text-primary-text font-bold'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{item.title}</span>
                      <input
                        type="radio"
                        name="plan"
                        checked={plan === item.id}
                        onChange={() => setPlan(item.id)}
                        className="w-4 h-4 accent-zinc-900 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 font-normal leading-relaxed">{item.desc}</p>
                  </label>
                ))}
              </div>
            </div>

        </form>
      )}
    </ModalShell>
  );
};
