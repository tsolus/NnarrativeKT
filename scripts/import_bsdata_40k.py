"""Génère public/sheets-40k/ (fiches techniques des unités 40k, un fichier par catalogue) depuis un clone de BSData/wh40k-10e.

Usage : python3 scripts/import_bsdata_40k.py CHEMIN_DU_CLONE
Couvre les unités de data/sources/points_40k.csv (même catalogue, même nom). Les fichiers sont chargés à la demande par l'appli.
"""
import json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'wh40k-10e')
OUT = Path('public/sheets-40k')
SKIP = {'Crusade'}  # options de Croisade : hors sujet pour une fiche Kill Team
WEAPONS = ('Ranged Weapons', 'Melee Weapons')


def clean(text):
    return re.sub(r'[ \t]+\n', '\n', (text or '').strip())


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


roots = {p.stem: ET.parse(p).getroot() for p in sorted(SRC.glob('*.cat'))}
gst = ET.parse(SRC / 'Warhammer 40,000.gst').getroot()
T = gst.tag.split('}')[0] + '}'
T_CAT = next(iter(roots.values())).tag.split('}')[0] + '}'
by_id = {}
for r in [gst, *roots.values()]:
    for el in r.iter():
        if el.get('id'):
            by_id.setdefault(el.get('id'), el)


def tag(el):
    return el.tag.split('}')[1]


def kids(el, name):
    for t in (T, T_CAT):
        c = el.find(t + name)
        if c is not None:
            return list(c)
    return []


def entries(el):
    out = [e for e in kids(el, 'selectionEntries') if e.get('name') not in SKIP]
    for l in kids(el, 'entryLinks'):
        if l.get('name') in SKIP:
            continue
        t = by_id.get(l.get('targetId'))
        if t is not None:
            out.append(t)
    return out


def groups(el):
    out = [g for g in kids(el, 'selectionEntryGroups') if g.get('name') not in SKIP]
    return out


def profiles(el, deep, seen=None):
    seen = seen if seen is not None else set()
    if id(el) in seen:
        return []
    seen.add(id(el))
    out = list(kids(el, 'profiles'))
    for l in kids(el, 'infoLinks'):
        t = by_id.get(l.get('targetId'))
        if t is not None and tag(t) == 'profile':
            out.append(t)
    if deep:
        for e in entries(el):
            out += profiles(e, True, seen)
        for g in groups(el):
            out += profiles(g, True, seen)
    return out


def chars(p):
    return {c.get('name'): clean(c.text) for c in p.iter() if tag(c) == 'characteristic'}


def weapon(p):
    c = chars(p)
    w = {'name': p.get('name').lstrip('➤ ').strip(), 'type': 'melee' if p.get('typeName') == 'Melee Weapons' else 'ranged'}
    w.update({k.lower(): c.get(k, '') for k in ('Range', 'A', 'BS', 'WS', 'S', 'AP', 'D')})
    w['skill'] = w.pop('ws') or w.pop('bs', '') if w['type'] == 'melee' else w.pop('bs')
    w.pop('ws', None)
    w.pop('bs', None)
    kw = c.get('Keywords', '-')
    w['keywords'] = '' if kw == '-' else kw
    return w


def uniq(items):
    seen, out = set(), []
    for i in items:
        k = json.dumps(i, sort_keys=True)
        if k not in seen:
            seen.add(k)
            out.append(i)
    return out


def models_of(unit):
    """Entrées « model » de l'unité (l'unité elle-même pour un personnage seul)."""
    if unit.get('type') == 'model':
        return [unit]
    found = []

    def walk(el):
        for e in entries(el) + [x for g in groups(el) for x in [g]]:
            if tag(e) == 'selectionEntry' and e.get('type') == 'model':
                found.append(e)
            else:
                walk(e)
    walk(unit)
    return found


def rule_text(rule):
    d = rule.find(T + 'description') if rule.find(T + 'description') is not None else rule.find(T_CAT + 'description')
    return clean(d.text if d is not None else '')


def sheet_of(unit):
    models = {}
    for m in models_of(unit):
        ps = profiles(m, True)
        stat = next((p for p in ps if p.get('typeName') == 'Unit'), None)
        key = stat.get('name') if stat is not None else m.get('name')
        mdl = models.setdefault(key, {'name': key, 'stats': {k: v for k, v in chars(stat).items()} if stat is not None else {}, 'options': []})
        ws = uniq([weapon(p) for p in ps if p.get('typeName') in WEAPONS])
        if ws:
            mdl['options'].append({'name': m.get('name'), 'weapons': ws})
    own = profiles(unit, False)
    for e in entries(unit):
        if e.get('type') == 'upgrade':
            own += [p for p in profiles(e, False) if p.get('typeName') == 'Abilities']
    abilities = [{'name': p.get('name'), 'text': '\n'.join(v for v in chars(p).values() if v)} for p in own if p.get('typeName') == 'Abilities']
    core = []
    for l in kids(unit, 'infoLinks'):
        t = by_id.get(l.get('targetId'))
        if t is not None and tag(t) == 'rule':
            core.append(l.get('name') or t.get('name'))
    keywords = [l.get('name') for l in kids(unit, 'categoryLinks')]
    for mdl in models.values():  # une option par entrée suffit si plusieurs entrées ont exactement les mêmes armes
        mdl['options'] = [o for i, o in enumerate(mdl['options']) if o['weapons'] not in [x['weapons'] for x in mdl['options'][:i]]]
    return {'models': list(models.values()), 'abilities': uniq(abilities), 'rules': core,
            'keywords': [k for k in keywords if not k.startswith('Faction: ')], 'faction': [k[9:] for k in keywords if k.startswith('Faction: ')]}


def main():
    rules = {r.get('name'): rule_text(r) for r in gst.iter(T + 'rule')}
    for r in roots.values():
        for x in r.iter():
            if tag(x) == 'rule' and x.get('name') not in rules:
                rules[x.get('name')] = rule_text(x)
    csv = Path('data/sources/points_40k.csv').read_text(encoding='utf-8-sig').splitlines()[1:]
    wanted = {}
    for line in csv:
        c = line.split(';')
        wanted.setdefault(c[0], set()).add(c[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.json'):
        old.unlink()
    index, missing, total = {}, [], 0  # index : nom d'unité → fichiers qui la décrivent
    for cat, names in sorted(wanted.items()):
        root = roots.get(cat)
        if root is None:
            missing += [f'{cat} / *']
            continue
        units = {}
        for e in root.iter():
            if tag(e) == 'selectionEntry' and e.get('name') in names and e.get('type') in ('unit', 'model') and e.get('name') not in units:
                units[e.get('name')] = sheet_of(e)
        missing += [f'{cat} / {n}' for n in sorted(names - set(units))]
        used = {k for u in units.values() for m in u['models'] for o in m['options'] for w in o['weapons'] for k in [w['keywords']]}
        used |= {r for u in units.values() for r in u['rules']}
        refs = {}
        for name, text in rules.items():
            if text and any(name.rstrip('-') in s for s in used):
                refs[name] = text
        file = slug(cat) + '.json'
        (OUT / file).write_text(json.dumps({'rules': refs, 'units': units}, ensure_ascii=False, separators=(',', ':')))
        for n in units:
            index.setdefault(n, []).append(file)
        total += len(units)
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print(f'{total} fiches 40k écrites dans {OUT}/ ({len(list(OUT.glob("*.json"))) - 1} fichiers)')
    if missing:
        print(f'{len(missing)} sans fiche :', ', '.join(missing[:30]))


main()
