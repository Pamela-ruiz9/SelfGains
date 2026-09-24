import type { FormEvent } from 'react';
import type { SearchResult } from '../../../lib/connectionRequests';
import Avatar from '../Shared/Avatar';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  results: SearchResult[];
  searching: boolean;
  hasSearched: boolean;
  onSendRequest: (userId: string) => void;
  onAcceptFromSearch: (userId: string, requestId: string) => void;
  t: Dictionary['conexiones']['userSearch'];
  avatarT: Dictionary['sync']['avatar'];
}

export default function UserSearch({
  query,
  onQueryChange,
  onSubmit,
  results,
  searching,
  hasSearched,
  onSendRequest,
  onAcceptFromSearch,
  t,
  avatarT,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t.placeholder}
          className="input-brutal"
        />
        <button type="submit" disabled={searching} className="btn-brutal-sm shrink-0">
          {searching ? t.searching : t.submit}
        </button>
      </div>
      {hasSearched && results.length === 0 && (
        <p className="font-mono text-sm text-paper-dim">{t.noResults}</p>
      )}
      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.userId} className="card-brutal flex items-center gap-4">
              <Avatar avatarUrl={r.avatarUrl} displayName={r.displayName} isTrainer={r.isTrainer} t={avatarT} />
              <p className="flex-1 font-display text-xl text-paper">{r.displayName ?? t.unnamedUser}</p>
              {r.status === 'connected' && (
                <p className="font-mono text-xs text-paper-dim">{t.alreadyConnected}</p>
              )}
              {r.status === 'request-sent' && (
                <p className="font-mono text-xs text-paper-dim">{t.requestSent}</p>
              )}
              {r.status === 'request-received' && r.requestId && (
                <button
                  type="button"
                  onClick={() => onAcceptFromSearch(r.userId, r.requestId!)}
                  className="btn-brutal-sm"
                >
                  {t.accept}
                </button>
              )}
              {r.status === 'none' && (
                <button type="button" onClick={() => onSendRequest(r.userId)} className="btn-brutal-sm">
                  {t.connect}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
