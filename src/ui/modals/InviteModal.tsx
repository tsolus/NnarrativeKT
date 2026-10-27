import { useState } from 'preact/hooks';
import { closeModal, leaveCampaign } from '../../state/app';
import { inviteLink } from '../../state/campaign';
import { Btn, Modal } from '../components/ui';

export function InviteModal({ code }: { code: string }) {
  const link = inviteLink(code);
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false));
  return (
    <Modal title="Inviter des joueurs" footer={<>
      <Btn small onClick={() => { closeModal(); leaveCampaign(); }}>Changer de campagne</Btn>
      <span class="sp" />
      <Btn onClick={closeModal}>Fermer</Btn>
    </>}>
      <p class="small">Envoie ce lien à chaque joueur : il ouvre directement cette campagne, sans compte. Toute personne qui a le lien peut la modifier.</p>
      <div class="row">
        <input type="text" class="sp" readOnly aria-label="Lien d'invitation" value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} />
        <Btn variant="pri" onClick={copy}>{copied ? 'Copié' : 'Copier'}</Btn>
      </div>
      <p class="tiny muted">Code de campagne : <b>{code}</b></p>
    </Modal>
  );
}
