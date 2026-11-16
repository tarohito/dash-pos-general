import React, { useState, useRef } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { Tenant } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { compressAndCropSquareToWebP } from '../../utils/imageCompressor';
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
  editingTenant?: Tenant | null;
  onSaveTenant: (tenantData: Tenant, editId?: string) => Promise<void> | void;
}

export const RegisterTenantModal: React.FC<RegisterTenantModalProps> = ({
  isOpen,
  onClose,
  editingTenant = null,
  onSaveTenant,
}) => {
  const isEdit = Boolean(editingTenant);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<Tenant | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  React.useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsSuccess(false);
    setCreatedTenant(null);
    if (editingTenant) {
      setName(editingTenant.name || '');
      setCode(editingTenant.code || '');
      setBranchName(editingTenant.branchName || '');
      setCity(editingTenant.city || '');
      setAddress(editingTenant.address || '');
      setOwnerName('');
      setPhone(editingTenant.phone || '');
      setEmail(editingTenant.email || '');
      setLogoUrl(editingTenant.logoUrl || '');
    } else {
      setName('');
      setCode('');
      setBranchName('');
      setCity('');
      setAddress('');
      setOwnerName('');
      setPhone('');
      setEmail('');
      setLogoUrl('');
    }
  }, [isOpen, editingTenant]);

  const liveInitials = getTenantInitials(name);

  const handleLogoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      failValidation('Silakan pilih file gambar yang valid (JPG, PNG, atau WebP).');
      return;
    }
    setErrorMsg(null);
    setIsCompressingLogo(true);
    try {
      const result = await compressAndCropSquareToWebP(file, {
        targetSize: 512,
        quality: 0.82,
      });
      setLogoUrl(result.dataUrl);
      showToast('success', 'Logo outlet siap digunakan.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar logo.';
      failValidation(msg);
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
    const cleanCode = code.trim().toUpperCase();
    const cleanBranch = branchName.trim();
    const cleanPhone = phone.trim();
    const phoneDigits = cleanPhone.replace(/[^0-9]/g, '');
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 3) {
      failValidation('Nama bisnis / toko wajib diisi (minimal 3 karakter).');
      return;
    }
    if (isEdit && !cleanCode) {
      failValidation('Kode outlet wajib diisi.');
      return;
    }
    if (!cleanBranch || cleanBranch.length < 3) {
      failValidation('Nama cabang utama wajib diisi (minimal 3 karakter).');
      return;
    }
    if (cleanPhone && cleanPhone !== '-' && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
      failValidation('Format nomor WhatsApp / HP tidak sesuai (8–15 digit angka).');
      return;
    }
    if (cleanEmail && cleanEmail !== '-' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      failValidation('Format alamat email toko tidak sesuai.');
      return;
    }

    const initials = getTenantInitials(cleanName);
    const cleanSlug =
      editingTenant?.slug ||
      cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.logicpos.id';
    const resolvedCode = cleanCode || 'TEN-' + Math.floor(100 + Math.random() * 900);

    const tenantPayload: Tenant = editingTenant
      ? {
          ...editingTenant,
          name: cleanName,
          code: resolvedCode,
          branchName: cleanBranch,
          address: address.trim() || editingTenant.address || '-',
          city: city.trim() || editingTenant.city || 'Jakarta',
          phone: cleanPhone || '-',
          email: cleanEmail || '-',
          logoInitial: initials,
          logoUrl: logoUrl || '',
        }
      : {
          id: `tenant-${Date.now()}`,
          name: cleanName,
          code: resolvedCode,
          branchName: cleanBranch,
          address: address.trim() || `Jl. Utama Bisnis No. 1, ${city.trim() || 'Indonesia'}`,
          city: city.trim() || 'Jakarta',
          plan: 'Enterprise Multi-Tenant',
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
      await onSaveTenant(tenantPayload, editingTenant?.id);
      if (isEdit) {
        onClose();
      } else {
        setCreatedTenant(tenantPayload);
        setIsSuccess(true);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEdit
          ? 'Gagal memperbarui data outlet.'
          : 'Gagal mendaftarkan outlet baru.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    setIsSuccess(false);
    setCreatedTenant(null);
    setName('');
    setCode('');
    setBranchName('');
    setCity('');
    setAddress('');
    setOwnerName('');
    setPhone('');
    setEmail('');
    setLogoUrl('');
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={isSuccess && createdTenant ? handleFinish : onClose}
      size="2xl"
      title={isEdit ? 'Edit Outlet' : 'Tambah Outlet'}
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
              {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Outlet'}
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
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Selamat! Outlet Berhasil Terdaftar</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Outlet baru telah resmi ditambahkan dan langsung diaktifkan pada sistem POS Anda.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 text-left space-y-2.5 text-sm max-w-xl mx-auto">
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Kode Outlet:</span>
              <span className="font-mono font-bold text-zinc-950 text-right">{createdTenant.code}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500 font-medium shrink-0">Domain POS:</span>
              <span className="font-mono text-gray-700 truncate text-right">{createdTenant.slug}</span>
            </div>
          </div>
        </div>
      ) : (
        <form id="register-tenant-form" noValidate onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <GoogleIcon name="error" size={16} className="shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: IDENTITAS OUTLET & CABANG */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-200/70">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GoogleIcon name="storefront" size={15} />
              </div>
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                1. Identitas Outlet &amp; Cabang
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nama Bisnis / Toko <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Toko Maju Abadi"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nama Cabang Utama <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Cth: Cabang Mall Kelapa Gading"
                  value={branchName}
                  onChange={e => setBranchName(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Kota / Domisili Cabang
                </label>
                <input
                  type="text"
                  placeholder="Cth: Jakarta Utara"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              {isEdit ? (
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Kode Outlet <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Cth: TMS-01"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    className="w-full h-10 px-3.5 text-sm font-mono font-bold uppercase bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nama Pemilik / PIC
                  </label>
                  <input
                    type="text"
                    placeholder="Cth: Ibu Veronica"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: KONTAK & ALAMAT GERAI */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-200/70">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GoogleIcon name="location_on" size={15} />
              </div>
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                2. Kontak &amp; Alamat Outlet
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  No. WhatsApp / HP
                </label>
                <input
                  type="tel"
                  placeholder="0812-xxxx-xxxx"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-mono bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Email Toko
                </label>
                <input
                  type="email"
                  placeholder="admin@tokobaru.id"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Alamat Lengkap Gerai / Outlet
              </label>
              <input
                type="text"
                placeholder="Cth: Jl. Boulevard Raya Blok M No. 8, Mall Kelapa Gading Lt. Dasar"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full h-10 px-3.5 text-sm font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
          </div>

          {/* SECTION 3: FOTO / LOGO OUTLET */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-200/70">
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <GoogleIcon name="add_a_photo" size={15} />
              </div>
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                3. Foto / Logo Outlet
              </h4>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleLogoFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />

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
              className={`relative rounded-2xl border-2 border-dashed transition-all p-3 sm:p-4 ${
                isDraggingLogo
                  ? 'border-primary bg-primary-soft/40 ring-4 ring-primary/10'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              {isCompressingLogo ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-primary">
                  <GoogleIcon name="progress_activity" size={28} className="animate-spin" />
                  <span className="text-xs font-bold">Memproses gambar...</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Square Thumbnail */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 aspect-square shrink-0 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-2xs flex items-center justify-center">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Preview Foto / Logo Outlet"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-soft text-primary-text flex items-center justify-center font-bold text-2xl tracking-tight">
                        {liveInitials}
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 flex flex-col items-center sm:items-start gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="h-9 px-3.5 rounded-full bg-secondary-soft hover:bg-secondary/15 text-secondary-text border border-secondary-border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <GoogleIcon name="upload" size={14} />
                        <span>Pilih Foto Baru</span>
                      </button>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          aria-label="Hapus logo outlet"
                          title="Hapus logo outlet"
                          className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center justify-center cursor-pointer transition-colors active:scale-95 shrink-0"
                        >
                          <GoogleIcon name="delete" size={16} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 text-center sm:text-left leading-relaxed">
                      Format JPG atau PNG, atau seret gambar ke kotak ini.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      )}
    </ModalShell>
  );
};
