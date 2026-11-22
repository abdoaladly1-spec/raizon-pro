import React from 'react';

/**
 * Google Material Symbols Rounded Icon Component
 * Official Material Design 3 Icon Font Integration
 */
export const M3Icon = ({ 
  name, 
  size = 20, 
  className = "", 
  filled = false,
  style = {}
}: { 
  name: string; 
  size?: number; 
  className?: string; 
  filled?: boolean;
  style?: React.CSSProperties;
}) => (
  <span 
    className={`material-symbols-rounded select-none shrink-0 ${className}`}
    style={{ 
      fontSize: `${size}px`, 
      fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
      ...style 
    }}
    aria-hidden="true"
  >
    {name}
  </span>
);

export type M3ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'danger';

export interface M3ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: M3ButtonVariant;
  icon?: string;
  iconTrailing?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Material Design 3 Standard Button
 * Implements M3 pill-radius, state layers, and tonal palettes
 */
export const M3Button: React.FC<M3ButtonProps> = ({
  children,
  variant = 'filled',
  icon,
  iconTrailing,
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles: Record<M3ButtonVariant, string> = {
    filled: 'm3-btn-filled bg-primary-600 hover:bg-primary-700 text-white shadow-xs hover:shadow-sm focus-visible:ring-primary-500',
    tonal: 'm3-btn-tonal bg-primary-500/15 hover:bg-primary-500/25 text-primary-700 dark:text-primary-300 focus-visible:ring-primary-500',
    outlined: 'm3-btn-outlined border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 focus-visible:ring-slate-400',
    text: 'm3-btn-text hover:bg-primary-500/10 text-primary-600 dark:text-primary-400 focus-visible:ring-primary-500',
    elevated: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-white shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-700/80 focus-visible:ring-primary-500',
    danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs hover:shadow-sm focus-visible:ring-rose-500'
  };

  return (
    <button
      className={`m3-btn m3-state-layer ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : icon ? (
        <M3Icon name={icon} size={18} />
      ) : null}
      <span className="truncate leading-none">{children}</span>
      {iconTrailing && !loading && (
        <M3Icon name={iconTrailing} size={18} />
      )}
    </button>
  );
};

export interface M3CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'filled' | 'outlined';
  elevation?: 0 | 1 | 2 | 3;
}

/**
 * Material Design 3 Card Container
 * Features 24px/28px smooth corners and M3 surface hierarchy
 */
export const M3Card: React.FC<M3CardProps> = ({
  children,
  variant = 'elevated',
  elevation = 1,
  className = '',
  ...props
}) => {
  const variantClass = 
    variant === 'elevated' 
      ? 'bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 m3-elevation-1 hover:m3-elevation-2' 
      : variant === 'filled' 
      ? 'bg-slate-100 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800/80' 
      : 'bg-transparent border border-slate-300 dark:border-slate-700';

  return (
    <div 
      className={`rounded-[24px] p-5 sm:p-6 transition-all duration-200 ease-out ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface M3ChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

/**
 * Material Design 3 Filter / Assist Chip
 */
export const M3Chip: React.FC<M3ChipProps> = ({
  label,
  icon,
  selected = false,
  onClick,
  onRemove,
  className = ''
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`m3-chip m3-state-layer ${selected ? 'selected' : ''} ${className}`}
  >
    {selected ? (
      <M3Icon name="check" size={16} className="text-primary-600 dark:text-primary-400" />
    ) : icon ? (
      <M3Icon name={icon} size={16} />
    ) : null}
    <span className="truncate leading-none">{label}</span>
    {onRemove && (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ms-1 hover:text-rose-500 rounded-full p-0.5 flex items-center justify-center transition-colors"
      >
        <M3Icon name="close" size={14} />
      </span>
    )}
  </button>
);

export interface M3SegmentedOption {
  id: string;
  label: string;
  icon?: string;
}

export interface M3SegmentedButtonProps {
  options: M3SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Material Design 3 Segmented Button Group
 */
export const M3SegmentedButton: React.FC<M3SegmentedButtonProps> = ({
  options,
  value,
  onChange,
  className = ''
}) => (
  <div className={`inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 ${className}`}>
    {options.map((opt) => {
      const isSelected = opt.id === value;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
            isSelected
              ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-xs ring-1 ring-black/5 dark:ring-white/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {isSelected && <M3Icon name="check" size={14} />}
          {opt.icon && !isSelected && <M3Icon name={opt.icon} size={14} />}
          <span>{opt.label}</span>
        </button>
      );
    })}
  </div>
);

export interface M3TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
  error?: string;
  supportingText?: string;
}

/**
 * Material Design 3 Outlined Text Field
 */
export const M3TextField: React.FC<M3TextFieldProps> = ({
  label,
  icon,
  error,
  supportingText,
  className = '',
  disabled,
  ...props
}) => (
  <div className="w-full group">
    {label && (
      <label className={`block text-xs font-bold mb-1.5 transition-colors ${
        error ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300 group-focus-within:text-primary-600 dark:group-focus-within:text-primary-400'
      }`}>
        {label}
      </label>
    )}
    <div className="relative flex items-center">
      {icon && (
        <div className="absolute start-3 pointer-events-none text-slate-400 group-focus-within:text-primary-600 dark:group-focus-within:text-primary-400">
          <M3Icon name={icon} size={18} />
        </div>
      )}
      <input
        disabled={disabled}
        className={`w-full ${icon ? 'ps-9.5' : 'ps-3.5'} pe-3.5 py-2.5 rounded-xl text-sm border bg-white dark:bg-slate-800 outline-none transition-all duration-200 ${
          error
            ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
            : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
        } ${className}`}
        {...props}
      />
    </div>
    {error ? (
      <p className="text-xs text-rose-500 font-bold mt-1 flex items-center gap-1">
        <M3Icon name="error" size={14} />
        <span>{error}</span>
      </p>
    ) : supportingText ? (
      <p className="text-[11px] text-slate-400 mt-1">{supportingText}</p>
    ) : null}
  </div>
);

/**
 * Material Design 3 Floating Action Button (FAB)
 */
export const M3FAB: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label?: string }> = ({
  icon,
  label,
  className = '',
  ...props
}) => (
  <button
    type="button"
    className={`m3-fab m3-state-layer ${label ? 'rounded-2xl px-5' : 'rounded-2xl w-14 h-14 p-0'} ${className}`}
    {...props}
  >
    <M3Icon name={icon} size={24} />
    {label && <span className="leading-none">{label}</span>}
  </button>
);
