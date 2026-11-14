import React from 'react';
import { GoogleIcon } from './GoogleIcon';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tak terduga saat memuat tampilan.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App ErrorBoundary caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto">
              <GoogleIcon name="warning" size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Terjadi Kesalahan Tampilan
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-relaxed">
                {this.state.errorMessage}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="h-9 px-4 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <GoogleIcon name="undo" size={14} className="shrink-0" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-9 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <GoogleIcon name="sync" size={14} className="shrink-0" />
                <span>Muat Ulang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
