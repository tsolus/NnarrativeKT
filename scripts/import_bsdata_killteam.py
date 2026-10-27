"""Génère data/sheets/killteams.json (fiches techniques des kill teams) depuis un clone de BSData/wh40k-killteam.

Usage : python3 scripts/import_bsdata_killteam.py CHEMIN_DU_CLONE
Pour chaque kill team de data/killteams.json : profils (APL, Mouvement, Sauvegarde, PV), mots-clés,
capacités, actions uniques, options d'armes ; équipements de faction et universels ; règles d'armes.
Les options d'armes viennent des règles officielles (data/sheets/loadouts-killteams.json) et les écarts
de profils constatés sont corrigés par data/sheets/corrections-killteams.json.
"""
import json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'wh40k-killteam')
OUT = Path('data/sheets/killteams.json')
EDITION = '2024 - '
# Noms de fichier BSData quand ils diffèrent du nom de la kill team.
FILES = {'Void-Dancer Troupe': 'Void-dancer Troupe'}
# Noms d'opérateurs de data/killteams.json qui diffèrent de BSData.
ALIASES = {'Ventrilokar': 'Ventriloquar'}


def ns(root):
    return root.tag.split('}')[0] + '}'


def clean(text):
    return re.sub(r'[ \t]+\n', '\n', (text or '').strip())


class Catalogue:
    def __init__(self, *roots):
        self.roots = roots
        self.by_id = {}
        for r in roots:
            T = ns(r)
            for el in r.iter():
                if el.get('id'):
                    self.by_id.setdefault(el.get('id'), el)
        self.T = ns(roots[0])

    def kids(self, el, tag):
        c = el.find(self.T + tag)
        return list(c) if c is not None else []

    def resolve(self, link):
        return self.by_id.get(link.get('targetId'))

    def entries(self, el):
        """Sous-entrées d'une entrée, liens résolus."""
        out = self.kids(el, 'selectionEntries')
        out += [t for t in (self.resolve(l) for l in self.kids(el, 'entryLinks')) if t is not None]
        return out

    def profiles(self, el, deep=True):
        """Profils d'une entrée (et de ses sous-entrées si deep), liens d'info résolus."""
        out = list(self.kids(el, 'profiles'))
        for l in self.kids(el, 'infoLinks'):
            t = self.resolve(l)
            if t is not None and t.tag == self.T + 'profile':
                out.append(t)
        if deep:
            for e in self.entries(el):
                out += self.profiles(e)
            for g in self.kids(el, 'selectionEntryGroups'):
                out += self.profiles(g)
        return out


def chars(T, p):
    return {c.get('name'): clean(c.text) for c in p.iter(T + 'characteristic')}


def weapon(T, p):
    c = chars(T, p)
    name = p.get('name')
    kind = 'melee' if name.startswith('⚔') else 'ranged'
    return {'name': name.lstrip('⚔⌖ ').strip(), 'type': kind, 'atk': c.get('ATK', ''), 'hit': c.get('HIT', ''),
            'dmg': c.get('DMG', ''), 'wr': c.get('WR', '') if c.get('WR', '-') != '-' else ''}


def text_profile(T, p):
    return {'name': p.get('name'), 'text': '\n'.join(v for v in chars(T, p).values() if v)}


def uniq(items, key=lambda x: json.dumps(x, sort_keys=True)):
    seen, out = set(), []
    for i in items:
        k = key(i)
        if k not in seen:
            seen.add(k)
            out.append(i)
    return out


def sheet_of(cat, model):
    T = cat.T
    groups = []

    def walk_groups(el):
        for g in cat.kids(el, 'selectionEntryGroups'):
            opts = []
            for e in cat.entries(g):
                ws = [weapon(T, p) for p in cat.profiles(e) if p.get('typeName') == 'Weapons']
                if ws:
                    opts.append({'name': e.get('name'), 'weapons': uniq(ws)})
            if opts:
                groups.append({'name': g.get('name'), 'options': opts})
            walk_groups(g)

    walk_groups(model)
    fixed = [p for p in cat.profiles(model, deep=False) if p.get('typeName') == 'Weapons']
    for e in cat.entries(model):
        fixed += [p for p in cat.profiles(e) if p.get('typeName') == 'Weapons']
    own = cat.profiles(model, deep=False)
    for e in cat.entries(model):
        own += [p for p in cat.profiles(e) if p.get('typeName') in ('Abilities', 'Unique Actions')]
    stats = next((chars(T, p) for p in own if p.get('typeName') == 'Operative'), {})
    keywords = [l.get('name') for l in cat.kids(model, 'categoryLinks')]
    return {
        'stats': {k: stats.get(k, '') for k in ('APL', 'Move', 'Save', 'Wounds')},
        'keywords': keywords,
        'abilities': uniq([text_profile(T, p) for p in own if p.get('typeName') == 'Abilities']),
        'actions': uniq([text_profile(T, p) for p in own if p.get('typeName') == 'Unique Actions']),
        'weaponGroups': groups,
        'weapons': uniq([weapon(T, p) for p in fixed]),
    }


def match(ours, models):
    """Modèles BSData correspondant à un opérateur de data/killteams.json."""
    name = ALIASES.get(ours, re.sub(r'\s*\(.*\)$', '', ours))
    for test in (lambda m: m == name, lambda m: m.endswith(' ' + name), lambda m: m.startswith(name + ' ')):
        found = [m for m in models if test(m)]
        if found:
            return found
    return []


def main():
    gst = ET.parse(SRC / f'{EDITION}Kill Team.gst').getroot()
    T = ns(gst)
    rules = {r.get('name'): clean(r.find(T + 'description').text) for r in gst.iter(T + 'rule')}
    universal = [text_profile(T, p) for p in gst.iter(T + 'profile') if p.get('typeName') == 'Equipment']
    universal = [{**e, 'name': re.sub(r'^\d+x ', '', e['name'])} for e in universal]
    kts = json.loads(Path('data/killteams.json').read_text())['killteams']
    out = {}
    missing = []
    corrections = json.loads(Path('data/sheets/corrections-killteams.json').read_text())['weapons']
    loadouts = json.loads(Path('data/sheets/loadouts-killteams.json').read_text())['operatives']
    for kt in kts:
        root = ET.parse(SRC / f"{EDITION}{FILES.get(kt['name'], kt['name'])}.cat").getroot()
        cat = Catalogue(root, gst)
        models = {e.get('name'): e for e in cat.kids(root, 'selectionEntries') if e.get('type') == 'model'}
        faction_rules = []
        for g in root.iter(T + 'infoGroup'):
            faction_rules += [{'name': r.get('name'), 'text': clean(r.find(T + 'description').text)} for r in g.iter(T + 'rule')]
        equipment = [text_profile(T, p) for p in root.iter(T + 'profile') if p.get('typeName') == 'Equipment']
        operatives = {}
        for op in kt['operatives']:
            found = match(op['name'], list(models))
            if not found:
                missing.append(f"{kt['name']} / {op['name']}")
                continue
            sheets = [sheet_of(cat, models[m]) for m in found]
            sheet = sheets[0]
            if len(found) > 1:  # « Warrior with … » : une fiche par équipement, fusionnées en une option d'armes
                prefix = re.sub(r'\s*\(.*\)$', '', op['name']) + ' with '
                sheet['weaponGroups'] = [{'name': 'Équipement', 'options': [
                    {'name': m[len(prefix):] if m.startswith(prefix) else m, 'weapons': s['weapons'] + [w for g in s['weaponGroups'] for o in g['options'] for w in o['weapons']]}
                    for m, s in zip(found, sheets)]}]
                sheet['weapons'] = []
            sheet['source'] = found[0] if len(found) == 1 else found
            operatives[op['name']] = sheet
        for fix in corrections:
            if fix['killteam'] != kt['name']:
                continue
            hits = [w for s in operatives.values() for w in s['weapons'] + [w for g in s['weaponGroups'] for o in g['options'] for w in o['weapons']] if w['name'] == fix['weapon']]
            if not hits:
                missing.append(f"correction sans effet : {kt['name']} / {fix['weapon']}")
            for w in hits:
                w.update(fix['set'])
        for lo in loadouts:
            if lo['killteam'] != kt['name']:
                continue
            sheet = operatives.get(lo['operative'])
            if sheet is None:
                missing.append(f"options : {kt['name']} / {lo['operative']} inconnu")
                continue
            pool = sheet['weapons'] + [w for g in sheet['weaponGroups'] for o in g['options'] for w in o['weapons']]

            def pick(name, op=lo['operative']):
                n = name.lower()
                found = uniq([w for w in pool if w['name'].lower() == n or w['name'].lower().startswith(n + ' (')])
                if not found:
                    missing.append(f"options : {kt['name']} / {op} : arme {name} introuvable")
                return found
            sheet['weapons'] = [w for n in lo['fixed'] for w in pick(n)]
            sheet['weaponGroups'] = [{'name': g['name'], 'options': [{'name': '; '.join(o), 'weapons': [w for n in o for w in pick(n)]} for o in g['options']]} for g in lo['groups']]
        out[kt['name']] = {'factionRules': uniq(faction_rules), 'equipment': uniq(equipment), 'operatives': operatives}
    doc = {
        '$comment': 'Généré par scripts/import_bsdata_killteam.py depuis BSData/wh40k-killteam (édition 2024). Ne pas éditer à la main.',
        'weaponRules': rules,
        'universalEquipment': uniq(universal, key=lambda e: e['name']),
        'killteams': out,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n')
    print(f'{sum(len(k["operatives"]) for k in out.values())} fiches écrites dans {OUT}')
    if missing:
        print('Sans fiche :', ', '.join(missing))


main()
