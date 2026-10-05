#!/usr/bin/env python3
"""Read-only context link, discoverability and source-anchor checks (stdlib only)."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

CONTEXT = Path(__file__).resolve().parents[1]
ROOT = CONTEXT.parent
errors = []
markdown = sorted(CONTEXT.rglob('*.md'))
graph = {path: set() for path in markdown}
link_count = 0


def prose(text):
    return re.sub(r'^```[^\n]*\n.*?^```\s*$', '', text, flags=re.M | re.S)


def anchors(path):
    result = set()
    seen = {}
    for heading in re.findall(r'^#{1,6}\s+(.+?)\s*#*$', prose(path.read_text()), re.M):
        slug = re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        result.add(slug if not count else f'{slug}-{count}')
    return result


for path in markdown + [ROOT / 'AGENTS.md']:
    if not path.is_file():
        errors.append(f'Missing entry point: {path.relative_to(ROOT)}')
        continue
    content = prose(path.read_text())
    for target in re.findall(r'\[[^\]\n]+\]\(([^)\n]+)\)', content):
        target = target.strip().strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc:
            continue
        link_count += 1
        dest = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
        if not dest.is_relative_to(ROOT):
            errors.append(f'{path.relative_to(ROOT)}: link escapes repository: {target}')
        elif not dest.exists():
            errors.append(f'{path.relative_to(ROOT)}: missing link: {target}')
        elif parsed.fragment and dest.suffix == '.md' and unquote(parsed.fragment) not in anchors(dest):
            errors.append(f'{path.relative_to(ROOT)}: missing heading: {target}')
        if path in graph and dest in graph:
            graph[path].add(dest)

reachable = set()
pending = [CONTEXT / 'README.md']
while pending:
    path = pending.pop()
    if path not in reachable:
        reachable.add(path)
        pending.extend(graph.get(path, set()) - reachable)
for path in set(markdown) - reachable:
    errors.append(f'Context document unreachable from README: {path.relative_to(CONTEXT)}')

manifest = json.loads((CONTEXT / 'sources.json').read_text())
for entry in manifest['sources']:
    path = (ROOT / entry['path']).resolve()
    if not path.is_relative_to(ROOT) or not path.exists():
        errors.append(f'Missing/outside source: {entry["path"]}')
        continue
    for symbol in entry.get('anchors', []):
        if not path.is_file() or symbol not in path.read_text(encoding='utf-8-sig'):
            errors.append(f'Missing source anchor: {entry["path"]}: {symbol}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'PASS: {len(markdown)} Markdown documents, {link_count} local links, '
      f'{len(manifest["sources"])} source entries; all context documents reachable.')
print('This checks structure and source anchors, not semantic accuracy or production readiness.')
