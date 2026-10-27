import { useEffect } from 'preact/hooks';
import { campaign, modal, openModal, route, storeKind, toast, unreadable, type Route } from '../state/app';
import { InviteModal } from './modals/InviteModal';
import { JoinView } from './views/JoinView';
import { BandsView } from './views/BandsView';
import { BandView } from './views/BandView';
import { GamesView } from './views/GamesView';
import { RankingView } from './views/RankingView';
import { RulesView } from './views/RulesView';

const NAV: [Route['view'], string][] = [['bands', 'Bandes'], ['games', 'Parties'], ['ranking', 'Classement'], ['rules', 'Règles']];

export function App() {
  const r = route.value;
  const active = r.view === 'band' ? 'bands' : r.view;
  return (
    <>
      <header>
        <div class="hd">
          <h1>Kill Team · Campagne</h1>
          <nav>{NAV.map(([v, l]) => <button type="button" key={v} class={active === v ? 'on' : ''} onClick={() => (route.value = { view: v } as Route)}>{l}</button>)}</nav>
          {storeKind.value === 'local' && <span class="mode">Mode local : données gardées dans ce navigateur</span>}
          {campaign.value && <button type="button" class="invite" onClick={() => openModal(<InviteModal code={campaign.value!} />)}>Inviter</button>}
        </div>
      </header>
      {unreadable.value.length > 0 && (
        <div class="banner">Documents illisibles ignorés (ils restent dans la base) : {unreadable.value.join(' · ')}</div>
      )}
      <main>
        {storeKind.value === 'loading' ? <p class="muted">Chargement…</p>
          : storeKind.value === 'join' ? <JoinView />
          : r.view === 'band' ? <BandView id={r.id} tab={r.tab} />
          : r.view === 'games' ? <GamesView />
          : r.view === 'ranking' ? <RankingView />
          : r.view === 'rules' ? <RulesView />
          : <BandsView />}
      </main>
      {modal.value}
      <Toast />
    </>
  );
}

function Toast() {
  const t = toast.value;
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => { if (toast.value === t) toast.value = null; }, 2800);
    return () => clearTimeout(h);
  }, [t]);
  return <div class={`toast ${t ? 'on' : ''}`} role="status">{t?.text}</div>;
}
