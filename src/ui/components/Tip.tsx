import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Text } from '../../data/sheets';
import { lookup, splitRules, type Glossary } from '../../domain/sheets';

// Infobulles des mots-clés : survol à la souris, focus au clavier, toucher sur mobile.
// Une seule bulle pour toute la page, en position fixe et gardée dans l'écran.

const open = signal<{ def: Text; x: number; y: number; below: boolean } | null>(null);

function show(e: Event, def: Text) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const below = r.top < 180;
  open.value = { def, x: r.left + r.width / 2, y: below ? r.bottom : r.top, below };
}
const hide = () => { open.value = null; };

export function Tip({ def, children }: { def: Text; children: ComponentChildren }) {
  return (
    <span class="tip" tabIndex={0} role="button" aria-label={`${def.name} : ${def.text}`}
      onMouseEnter={(e) => show(e, def)} onMouseLeave={hide} onFocus={(e) => show(e, def)} onBlur={hide}
      onClick={(e) => { e.stopPropagation(); open.value?.def === def ? hide() : show(e, def); }}>
      {children}
    </span>
  );
}

export function TipLayer() {
  useEffect(() => {
    document.addEventListener('click', hide);
    window.addEventListener('scroll', hide, true);
    return () => { document.removeEventListener('click', hide); window.removeEventListener('scroll', hide, true); };
  }, []);
  const t = open.value;
  if (!t) return null;
  const w = Math.min(340, window.innerWidth - 32);
  const left = Math.max(16, Math.min(t.x - w / 2, window.innerWidth - w - 16));
  const style = `left:${left}px;width:${w}px;${t.below ? `top:${t.y + 8}px` : `bottom:${window.innerHeight - t.y + 8}px`}`;
  return (
    <div class="tip-box" role="tooltip" style={style}>
      <b>{t.def.name}</b>
      <Rich text={t.def.text} />
    </div>
  );
}

/** Texte avec **gras** et retours à la ligne ; les règles connues du glossaire deviennent des infobulles. */
export function Rich({ text, g }: { text: string; g?: Glossary }) {
  const re = g && g.size ? patternOf(g) : null;
  return (
    <span class="rich">
      {text.split('\n').map((line, i) => (
        <span key={i} class="ln">
          {line.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).map((part, j) =>
            part.startsWith('**') ? <b key={j}>{part.slice(2, -2)}</b>
              : part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <i key={j}>{part.slice(1, -1)}</i>
              : re && g ? linkRules(part, re, g, j) : part)}
        </span>
      ))}
    </span>
  );
}

const patterns = new WeakMap<Glossary, RegExp>();
function patternOf(g: Glossary): RegExp {
  let re = patterns.get(g);
  if (!re) {
    const names = [...g.values()].map((t) => t.name).filter((n) => n.length > 3).sort((a, b) => b.length - a.length);
    const alts = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ x\\\+$/, ' \\d\\+').replace(/ x$/, ' [\\d"]+').replace(/-$/, '-\\w+(?: \\d\\+)?'));
    re = new RegExp(`\\b(${alts.join('|')})(?![\\w-])`, 'g');
    patterns.set(g, re);
  }
  return re;
}

function linkRules(s: string, re: RegExp, g: Glossary, key: number) {
  const out: ComponentChildren[] = [];
  let last = 0;
  for (const m of s.matchAll(re)) {
    const def = lookup(g, m[0]);
    if (!def) continue;
    out.push(s.slice(last, m.index), <Tip key={`${key}-${m.index}`} def={def}>{m[0]}</Tip>);
    last = m.index! + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}

/** Liste de règles d'arme (« Range 8", Lethal 5+ ») avec une infobulle par règle connue. */
export function WeaponRules({ value, g }: { value: string; g: Glossary }) {
  const items = splitRules(value);
  if (!items.length) return <span class="muted">–</span>;
  return (
    <>
      {items.map((it, i) => {
        const def = lookup(g, it);
        return <span key={i}>{i > 0 && ', '}{def ? <Tip def={def}>{it}</Tip> : it}</span>;
      })}
    </>
  );
}
