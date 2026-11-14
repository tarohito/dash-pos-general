import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { AuthLoginResponse } from '../../types';
import { posApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { BrandLogo } from '../common/BrandLogo';

interface LoginPageProps {
  onLoginSuccess: (auth: AuthLoginResponse) => void;
}

interface DemoAccount {
  username: string;
  password: string;
  label: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'owner', password: 'owner123', label: 'Owner' },
  { username: 'kepala.jkt', password: 'cabang123', label: 'Kepala Cabang' },
  { username: 'kasir.jkt', password: 'kasir123', label: 'Kasir JKT' },
  { username: 'kasir.bdg', password: 'kasir123', label: 'Kasir BDG' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { showToast } = useToast();

  const submitLogin = async (loginId: string, loginPass: string) => {
    setErrorMsg(null);
    const cleanId = loginId.trim();
    if (!cleanId || !loginPass) {
      setErrorMsg('Username dan kata sandi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await posApi.login(cleanId, loginPass);
      showToast('success', `Selamat datang, ${result.user.fullName}.`);
      onLoginSuccess(result);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitLogin(identifier, password);
  };

  const handleQuickDemoLogin = (account: DemoAccount) => {
    setIdentifier(account.username);
    setPassword(account.password);
    void submitLogin(account.username, account.password);
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {/* Kolom Kiri: Branding Flat Minimalis */}
        <div className="md:col-span-5 bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-200 p-6 sm:p-8 text-zinc-900 flex flex-col justify-between">
          <div>
            <BrandLogo size="lg" />
          </div>

          <div className="my-8 md:my-0">
            <h1 className="text-2xl font-bold tracking-tight leading-snug text-zinc-950">
              Sistem Kasir POS
            </h1>
            <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
              Penjualan, Inventaris &amp; Multi-Outlet
            </p>
          </div>

          <p className="text-xs text-zinc-400 font-medium">
            &copy; {new Date().getFullYear()} Fruitylogic. All rights reserved.
          </p>
        </div>

        {/* Kolom Kanan: Form Login Simpel */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 mb-5">Masuk</h2>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-600" />
                <span className="font-medium leading-snug">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Username / Email
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="owner / kasir.jkt"
                  className="w-full h-10 px-3 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 text-zinc-900 placeholder:text-zinc-400 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="••••••••"
                    className="w-full h-10 pl-3 pr-10 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 text-zinc-900 placeholder:text-zinc-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 mt-1 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Akses Cepat Demo Minimalis */}
          <div className="mt-6 pt-4 border-t border-zinc-200">
            <p className="text-xs font-medium text-zinc-400 mb-2">Akses cepat demo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickDemoLogin(acc)}
                  className="px-2.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100 text-left transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="block text-xs font-semibold text-zinc-800 leading-tight">
                    {acc.label}
                  </span>
                  <span className="block text-xs font-mono text-zinc-400 mt-0.5 truncate">
                    @{acc.username}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
