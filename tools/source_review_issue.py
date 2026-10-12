"""Notify the project owner when weekly source review needs human attention."""
import json,os
from pathlib import Path
from urllib.request import Request,urlopen
status=json.loads((Path(__file__).resolve().parents[1]/'updates/status.json').read_text())
if status.get('sourceStatus')=='ok' and not status.get('pending'):raise SystemExit(0)
repo=os.environ['GH_REPO'];title='Revisar vigencia de mapas y callouts de la temporada'
headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
def request(path,data=None):
 with urlopen(Request('https://api.github.com/repos/'+repo+path,data=json.dumps(data).encode() if data is not None else None,headers=headers),timeout=30) as response:return json.load(response)
issues=request('/issues?state=open&per_page=100')
if any(issue.get('title')==title for issue in issues):print('A review issue is already open');raise SystemExit(0)
body='Responsable: @Guidufox. La consulta automática requiere revisión humana. No se han instalado mapas ni modificado dibujos.\n\n'+('La fuente no pudo consultarse.' if status.get('sourceStatus')!='ok' else '\n'.join('- '+item['id']+': r'+str(item['installed'])+' → r'+str(item['available']) for item in status['pending']))+'\n\nSeguir docs/MAINTENANCE.md y comprobar las notas oficiales de la temporada.'
result=request('/issues',{'title':title,'body':body,'assignees':['Guidufox']});print('Review issue created:',result['number'])
