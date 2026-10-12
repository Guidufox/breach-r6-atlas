"""Package only static public assets; exclude desktop tools and source workflows."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];out=root/'_site'
if out.exists():shutil.rmtree(out)
out.mkdir()
for name in ['index.html','app.js','panels.js','collab-launcher.js','collab.js','collab-core.js','validation.js','operators.js','operators-data.js','trust.js','metrics.js','metrics-dashboard.js','metricas.html','social-card.png','content-policy.json','data.js','ui.js','features.js','advanced.js','style.css','icon.svg','icon.ico','r6-logo.png','LICENSE-R6MAPS.txt','FUENTES-NOMBRES.txt','CNAME']:
    file=root/name
    if file.is_file():shutil.copy2(file,out/name)
import json
policy=json.loads((root/'content-policy.json').read_text())
for name in ['maps','vendor','updates','assets']:
    if name=='maps' and not policy.get('mapsEnabled',True):continue
    if name=='assets' and not policy.get('operatorsEnabled',True):continue
    shutil.copytree(root/name,out/name)
if not policy.get('operatorsEnabled',True):
    for name in ['operators.js','operators-data.js']:(out/name).unlink(missing_ok=True)
if not policy.get('brandEnabled',True):(out/'r6-logo.png').unlink(missing_ok=True)
if not policy.get('mapsEnabled',True):shutil.rmtree(out/'updates',ignore_errors=True)
if not policy.get('operatorsEnabled',True):
    text=(out/'index.html').read_text().replace('data-tool="operator"','hidden data-tool="operator"').replace('id="operatorSettingsBtn"','hidden id="operatorSettingsBtn"');(out/'index.html').write_text(text)
(out/'.nojekyll').touch()
print('Public assets ready:',sum(1 for p in out.rglob('*') if p.is_file()))

# Callouts are loaded per map; the full original catalogue stays in the source repo.
import json, gzip
original=(root/'data.js').read_text(encoding='utf-8')
catalog=json.loads(original.split('=',1)[1].rstrip(';\n'))
for item in catalog['maps'] if policy.get('mapsEnabled',True) else []:
    labels=item['labels'];item['labelCount']=len(labels);item['labels']=[]
    (out/'maps'/(item['id']+'.labels.js')).write_text('window.R6_LABELS['+json.dumps(item['id'])+']='+json.dumps(labels,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
catalog['lazyLabels']=True
manifest='window.R6_LABELS={};window.R6_DATA='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n'
if policy.get('mapsEnabled',True):(out/'data.js').write_text(manifest,encoding='utf-8')
else:(out/'data.js').unlink(missing_ok=True)
print('Catalogue gzip bytes:',len(gzip.compress(original.encode())), '->',len(gzip.compress(manifest.encode())))

from build_seo import build
build()
