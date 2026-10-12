"""Prepare reversible publication flags; does not purge repository history."""
import argparse,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--maps',action='store_true');p.add_argument('--operators',action='store_true');p.add_argument('--all',action='store_true');p.add_argument('--reason',required=True);args=p.parse_args()
policy=json.loads((root/'content-policy.json').read_text())
if args.maps or args.all:policy['mapsEnabled']=False
if args.operators or args.all:policy['operatorsEnabled']=False
if args.all:policy['brandEnabled']=False
policy['notice']=args.reason[:500]
(root/'content-policy.json').write_text(json.dumps(policy,ensure_ascii=False,indent=2)+'\n')
print('Publication flags updated. Review, commit and publish; see docs/TAKEDOWN.md for repository copies and history.')
