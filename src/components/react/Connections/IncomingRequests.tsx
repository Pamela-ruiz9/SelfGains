import type { IncomingRequest } from '../../../lib/connectionRequests';
import Avatar from '../Shared/Avatar';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  requests: IncomingRequest[];
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  t: Dictionary['conexiones']['incomingRequests'];
}

export default function IncomingRequests({ requests, onAccept, onReject, t }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      {requests.length === 0 ? (
        <p className="font-mono text-sm text-paper-dim">{t.empty}</p>
      ) : (
        requests.map((req) => (
          <div key={req.requestId} className="card-brutal flex items-center gap-4">
            <Avatar avatarUrl={req.avatarUrl} displayName={req.displayName} isTrainer={req.isTrainer} />
            <p className="flex-1 font-display text-xl text-paper">{req.displayName ?? t.unnamedUser}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => onAccept(req.requestId)} className="btn-brutal-sm">
                {t.accept}
              </button>
              <button
                type="button"
                onClick={() => onReject(req.requestId)}
                className="rounded-control border border-blood bg-transparent px-2 py-1 font-mono text-xs uppercase tracking-wide text-blood transition duration-150 hover:bg-blood hover:text-paper active:scale-95"
              >
                {t.reject}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
