import { useState } from 'preact/hooks';
import { openCampaign } from '../../state/app';
import { newCampaignCode, parseCampaign } from '../../state/campaign';
import { Btn } from '../components/ui';

// Accueil de l'appli en ligne quand ce navigateur ne connaît pas encore de campagne.
export function JoinView() {
  const [input, setInput] = useState('');
  const code = parseCampaign(input);
  return (
    <div class="grid">
      <div class="panel">
        <h2 class="mb">Rejoindre une campagne</h2>
        <p class="small muted">Colle le lien d'invitation reçu (ou son code). Aucun compte n'est nécessaire.</p>
        <div class="row">
          <input type="text" class="sp" aria-label="Lien ou code de campagne" placeholder="https://…#c=… ou code" value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && code) void openCampaign(code); }} />
          <Btn variant="pri" disabled={!code} onClick={() => code && void openCampaign(code)}>Rejoindre</Btn>
        </div>
        {input.trim() !== '' && !code && <p class="tiny muted">Ce lien ne contient pas de code de campagne.</p>}
      </div>
      <div class="panel">
        <h2 class="mb">Lancer une nouvelle campagne</h2>
        <p class="small muted">Crée une campagne vide, puis envoie le lien d'invitation à tes joueurs (bouton « Inviter » en haut).</p>
        <Btn onClick={() => void openCampaign(newCampaignCode())}>Nouvelle campagne</Btn>
      </div>
    </div>
  );
}
