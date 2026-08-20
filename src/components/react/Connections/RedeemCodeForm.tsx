import type { FormEvent } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function RedeemCodeForm({ value, onChange, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">Conectarme con un código</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="AB3F9K"
          className="input-brutal"
        />
        <button type="submit" className="btn-brutal-sm shrink-0">
          Conectar
        </button>
      </div>
    </form>
  );
}
