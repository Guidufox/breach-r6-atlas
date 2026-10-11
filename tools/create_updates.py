"""Build reviewed R6Calls update packages; never overwrite installed map assets."""
from pathlib import Path
from urllib.request import urlopen, Request
import gzip, hashlib, json, re
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://www.r6calls.com/'
def fetch(path):
    with urlopen(Request(SOURCE+path,headers={'User-Agent':'Breach-R6-Atlas/1.2'}),timeout=120) as response:
        raw=response.read(96*1024*1024+1)
        if len(raw)>96*1024*1024: raise ValueError('Source file too large')
        return raw
def main():
    text=(ROOT/'data.js').read_text(encoding='utf-8');installed=json.loads(text.split('=',1)[1].strip().rstrip(';'))
    latest=json.loads(fetch('data/dataMap.json')); languages={lang:json.loads(fetch('language/'+lang+'.json')) for lang in ['es','pt-br']}
    out=ROOT/'updates';out.mkdir(exist_ok=True);catalog_path=out/'catalog.json'
    previous=json.loads(catalog_path.read_text()) if catalog_path.exists() else {'maps':[]}
    entries={item['id']:item for item in previous.get('maps',[]) if (out/item.get('file','')).is_file()}
    known={m['id']:m for m in installed['maps']};date=datetime.now(timezone.utc).isoformat()
    for m in latest['maps']:
        ident=m['id']
        if ident not in known or not re.fullmatch('[a-z]+',ident):continue
        if m['revision']<=max(known[ident]['revision'],entries.get(ident,{}).get('revision',0)):continue
        raw=fetch('img/maps/'+ident+'.svg')
        packet={'app':'breach-map-update','version':1,'source':SOURCE,'date':date,'map':m,'sourceSha256':hashlib.sha256(raw).hexdigest(),'svg':raw.decode('utf-8'),'languages':{lang:{'calls':d['calls'].get(ident,{}),'spawns':d['spawns'].get(ident,{}),'legend':d['legend']} for lang,d in languages.items()}}
        name=f'{ident}-r{m["revision"]}.json.gz'
        with gzip.open(out/name,'wb',compresslevel=9) as stream:stream.write(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
        entries[ident]={'id':ident,'revision':m['revision'],'file':name}
        print(ident,m['revision'],name)
    catalog_path.write_text(json.dumps({'app':'breach-update-catalog','version':1,'source':SOURCE,'date':date,'maps':list(entries.values())},indent=2),encoding='utf-8')
if __name__=='__main__':main()
