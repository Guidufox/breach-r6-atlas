"""Weekly version check: never install changed maps automatically."""
from pathlib import Path
from urllib.request import urlopen,Request
from datetime import datetime,timezone
import json
root=Path(__file__).resolve().parents[1];out=root/'updates/status.json';now=datetime.now(timezone.utc).isoformat()
installed=json.loads((root/'data.js').read_text().split('=',1)[1].rstrip(';\n'))
known={m['id']:m for m in installed['maps']}
previous=json.loads(out.read_text()) if out.exists() else {}
try:
 with urlopen(Request('https://www.r6calls.com/data/dataMap.json',headers={'User-Agent':'Flamingo-Strat-source-check/1.0'}),timeout=30) as response:
  raw=response.read(2*1024*1024+1)
  if len(raw)>2*1024*1024:raise ValueError('Metadata too large')
  latest=json.loads(raw)
 if not isinstance(latest.get('maps'),list):raise ValueError('Invalid map list')
 pending=[{'id':m['id'],'installed':known[m['id']]['revision'],'available':m['revision']} for m in latest['maps'] if m.get('id') in known and isinstance(m.get('revision'),int) and m['revision']>known[m['id']]['revision']]
 result={'checkedAt':now,'lastSuccess':now,'sourceStatus':'ok','source':'https://www.r6calls.com/data/dataMap.json','pending':pending,'reviewOwner':'Guidufox','scope':'Version metadata only; not a certification of map geometry, callout correctness or gameplay changes.'}
except Exception as error:
 result={**previous,'checkedAt':now,'sourceStatus':'error','reviewOwner':'Guidufox','error':type(error).__name__}
out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Source status:',result['sourceStatus'],'pending:',len(result.get('pending',[])))
