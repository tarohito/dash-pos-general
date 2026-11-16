import React, { useState, useEffect } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
import { useToast } from '../../contexts/ToastContext';
import { CategoryItem } from '../../types';
import {
  ModalShell,
  MODAL_FOOTER_END_CLASS,
  MODAL_BTN_SECONDARY_CLASS,
  MODAL_BTN_PRIMARY_CLASS,
} from '../common/ModalShell';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: CategoryItem | string | null;
  onSaveCategory: (categoryName: string, oldName?: string) => Promise<void> | void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  editingCategory,
  onSaveCategory,
}) => {
  const editingName =
    typeof editingCategory === 'string'
      ? editingCategory
      : editingCategory?.name || '';

  const [categoryName, setCategoryName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setCategoryName(editingName);
      setErrorMsg(null);
    }
  }, [isOpen, editingName]);

  const failValidation = (msg: string) => {
    setErrorMsg(msg);
    showToast('error', msg, 'Validasi Form Kategori');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      failValidation('Nama kategori wajib diisi.');
      return;
    }
    if (trimmed.length < 2) {
      failValidation('Nama kategori minimal 2 karakter.');
      return;
    }
    if (editingName && trimmed === editingName) {
      failValidation('Nama kategori baru tidak boleh sama dengan nama sebelumnya.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onSaveCategory(trimmed, editingName || undefined);
      setCategoryName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan kategori.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={editingName ? 'Edit Kategori' : 'Tambah Kategori'}
      disableEscapeClose={isSubmitting}
      footer={
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
            form="category-form"
            disabled={isSubmitting}
            className={MODAL_BTN_PRIMARY_CLASS}
          >
            {isSubmitting ? 'Menyimpan...' : editingName ? 'Simpan Perubahan' : 'Simpan Kategori'}
          </button>
        </div>
      }
    >
      <form id="category-form" noValidate onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <GoogleIcon name="error" size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
            Nama Kategori Produk
          </label>
          <input
            type="text"
            required
            autoFocus
            value={categoryName}
            onChange={e => setCategoryName(e.target.value)}
            placeholder="Cth: Parfum, Skincare, Elektronik, Fashion, Makanan..."
            className="w-full h-10 px-3.5 text-sm font-medium bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            {editingName
              ? 'Perubahan nama kategori akan otomatis diperbarui pada seluruh produk terkait.'
              : 'Kategori baru akan langsung tersedia di etalase kasir dan formulir produk.'}
          </p>
        </div>
      </form>
    </ModalShell>
  );
};
