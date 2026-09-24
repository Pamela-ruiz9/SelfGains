import type { FormEvent } from 'react';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  t: Dictionary['conexiones']['redeemCodeForm'];
}

export default function RedeemCodeForm({ value, onChange, onSubmit, t }: Props) {
  return (
    <form onSubmit={onSubmit} className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.placeholder}
          className="input-brutal"
        />
        <button type="submit" className="btn-brutal-sm shrink-0">
          {t.submit}
        </button>
      </div>
    </form>
  );
}
