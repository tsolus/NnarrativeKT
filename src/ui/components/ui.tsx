import type { ComponentChildren, JSX } from 'preact';
import { closeModal } from '../../state/app';

// Petits composants réutilisés par tous les écrans.

type BtnProps = JSX.HTMLAttributes<HTMLButtonElement> & { variant?: 'pri' | 'danger'; small?: boolean; disabled?: boolean };
export function Btn({ variant, small, class: cls, ...p }: BtnProps) {
  return <button type="button" class={['btn', variant, small && 'sm', cls].filter(Boolean).join(' ')} {...p} />;
}

export const Tag = ({ tone, children }: { tone?: 'gold' | 'red' | 'ok'; children: ComponentChildren }) => <span class={`tag ${tone ?? ''}`}>{children}</span>;

export const Chip = ({ children, onRemove, title }: { children: ComponentChildren; onRemove?: () => void; title?: string }) => (
  <span class="chip" title={title}>{children}{onRemove && <button type="button" aria-label="Retirer" onClick={onRemove}>×</button>}</span>
);

export const Stat = ({ value, label }: { value: ComponentChildren; label: string }) => (
  <div class="stat"><b>{value}</b><span>{label}</span></div>
);

export function Notes({ items, okText }: { items: string[]; okText: string }) {
  return items.length
    ? <div class="warn"><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></div>
    : <div class="good">{okText}</div>;
}

export function Stepper({ value, onChange, label }: { value: number; onChange: (delta: number) => void; label: string }) {
  return (
    <span class="row" style="gap:4px">
      <Btn small aria-label={`${label} −1`} onClick={() => onChange(-1)}>−</Btn><b>{value}</b><Btn small aria-label={`${label} +1`} onClick={() => onChange(1)}>+</Btn>
    </span>
  );
}

export function Select<T extends string>({ value, options, onChange, ...p }: { value: T; options: (T | [T, string])[]; onChange: (v: T) => void } & Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  return (
    <select value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)} {...p}>
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
    </select>
  );
}

/** Champ texte qui n'enregistre qu'en quittant le champ (évite une écriture par frappe). */
export function TextField({ value, onCommit, ...p }: { value: string; onCommit: (v: string) => void } & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value'>) {
  return <input type="text" value={value} onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v !== value) onCommit(v); }} {...p} />;
}
export function NumberField({ value, onCommit, ...p }: { value: number; onCommit: (v: number) => void } & Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'value'>) {
  return <input type="number" value={value} onChange={(e) => { const v = Number((e.target as HTMLInputElement).value) || 0; if (v !== value) onCommit(v); }} {...p} />;
}

export function Modal({ title, children, footer }: { title: string; children: ComponentChildren; footer?: ComponentChildren }) {
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div class="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <div style="margin-top:10px">{children}</div>
        <div class="row" style="margin-top:14px">{footer ?? <><span class="sp" /><Btn onClick={closeModal}>Fermer</Btn></>}</div>
      </div>
    </div>
  );
}

export interface Choice { label: string; variant?: 'pri' | 'danger'; run: () => void }
export function Confirm({ title, text, choices }: { title: string; text: string; choices: Choice[] }) {
  return (
    <Modal title={title} footer={<><span class="sp" /><Btn onClick={closeModal}>Annuler</Btn>{choices.map((c) => <Btn key={c.label} variant={c.variant} onClick={() => { closeModal(); c.run(); }}>{c.label}</Btn>)}</>}>
      <p style="margin:0">{text}</p>
    </Modal>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div class="tw"><table>
      <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
