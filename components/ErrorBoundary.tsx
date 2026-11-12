import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from './Icons';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] w-full p-6 flex flex-col items-center justify-center text-center animate-fade-in">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-lg text-slate-800 dark:text-slate-100">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle size={26} />
            </div>
            <h3 className="text-base font-black mb-1">
              {this.props.fallbackTitle || 'حدث خطأ أثناء عرض هذا الجزء'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              {this.props.fallbackMessage || 'تعذر تحميل هذه الواجهة بسبب خطأ مؤقت. يمكنك إعادة المحاولة بأمان.'}
            </p>
            {this.state.error?.message && (
              <div className="p-2 mb-4 rounded-lg bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 text-[11px] font-mono text-left break-all max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw size={14} />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                <span>تحديث الصفحة كاملة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
