import React, { useState } from 'react';
import { GoogleIcon } from '../common/GoogleIcon';
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
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      <div
        aria-hidden="true"
        className="main-container-top-gradient pointer-events-none absolute inset-x-0 top-0 h-56 sm:h-72 z-0"
      />
      <div className="relative z-10 w-full max-w-[940px] grid grid-cols-1 md:grid-cols-12 bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-[0_8px_30px_-10px_rgba(15,23,42,0.08)]">
        {/* Kolom Kiri: Branding Warna Brand & Ilustrasi POS */}
        <div className="md:col-span-6 bg-gradient-to-br from-primary via-primary to-primary-hover p-6 sm:p-8 text-white flex flex-col justify-between gap-6">
          <div>
            <div className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white shadow-sm">
              <BrandLogo size="lg" />
            </div>
          </div>

          <div className="my-2 flex flex-col items-center md:items-start gap-5">
            <div className="w-full max-w-[280px] sm:max-w-[330px] md:max-w-[390px] mx-auto flex items-center justify-center">
              <img
                src="/assets/login-pos-illustration.webp"
                alt="Ilustrasi Perangkat Kasir POS LogicPOS"
                width={960}
                height={741}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain select-none drop-shadow-[0_16px_28px_rgba(15,23,42,0.28)]"
              />
            </div>

            <div className="w-full text-center md:text-left">
              <h1 className="text-2xl font-bold tracking-tight leading-snug text-white">
                Sistem Kasir POS
              </h1>
              <p className="text-xs sm:text-sm text-white/85 mt-1.5 leading-relaxed">
                Penjualan, Inventaris &amp; Multi-Outlet
              </p>
            </div>
          </div>

          <p className="text-xs text-white/75 font-medium text-center md:text-left">
            &copy; {new Date().getFullYear()} Fruitylogic. All rights reserved.
          </p>
        </div>

        {/* Kolom Kanan: Form Login Simpel */}
        <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-center bg-white">
          <div className="w-full max-w-sm mx-auto">
            <h2 className="text-xl font-bold text-zinc-950 text-center mb-5">Masuk</h2>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <GoogleIcon name="error" size={15} className="shrink-0 text-red-600" />
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
                  className="w-full h-10 px-3.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-zinc-900 placeholder:text-zinc-400 transition-colors"
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
                    className="w-full h-10 pl-3.5 pr-10 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-zinc-900 placeholder:text-zinc-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 aspect-square rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    {showPassword ? <GoogleIcon name="visibility_off" size={16} /> : <GoogleIcon name="visibility" size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 mt-1 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-full transition-colors inline-flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <GoogleIcon name="progress_activity" size={16} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon name="login" size={16} />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </form>

            {/* Akses Cepat Demo Minimalis */}
            <div className="mt-6 pt-4 border-t border-zinc-200">
              <p className="text-xs font-medium text-zinc-400 text-center mb-2.5">Akses cepat demo</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.username}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleQuickDemoLogin(acc)}
                    className="px-2.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-zinc-100 text-center transition-colors cursor-pointer disabled:opacity-50"
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
    </div>
  );
};
