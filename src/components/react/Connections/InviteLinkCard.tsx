import { inviteLink } from '../../../lib/connections';
import type { Dictionary } from '../../../i18n/es';

interface Props {
  code: string | null;
  copied: boolean;
  onShare: () => void;
  onCopy: () => void;
  t: Dictionary['conexiones']['inviteLinkCard'];
}

export default function InviteLinkCard({ code, copied, onShare, onCopy, t }: Props) {
  return (
    <div className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">{t.title}</p>
      {code ? (
        <div className="flex flex-col gap-2">
          <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCopy} className="btn-brutal-sm">
              {copied ? t.copied : t.copy}
            </button>
            <button type="button" onClick={onShare} className="btn-brutal-sm opacity-60">
              {t.regenerate}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onShare} className="btn-brutal-sm self-start">
          {t.generate}
        </button>
      )}
    </div>
  );
}
