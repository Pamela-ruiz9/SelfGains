import { inviteLink } from '../../../lib/connections';

interface Props {
  code: string | null;
  copied: boolean;
  onShare: () => void;
  onCopy: () => void;
}

export default function InviteLinkCard({ code, copied, onShare, onCopy }: Props) {
  return (
    <div className="card-brutal flex flex-col gap-3">
      <p className="label-brutal text-acid">Mi link de invitación</p>
      {code ? (
        <div className="flex flex-col gap-2">
          <p className="break-all font-mono text-sm text-paper">{inviteLink(code)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCopy} className="btn-brutal-sm">
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
            <button type="button" onClick={onShare} className="btn-brutal-sm opacity-60">
              Regenerar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onShare} className="btn-brutal-sm self-start">
          Generar mi link
        </button>
      )}
    </div>
  );
}
