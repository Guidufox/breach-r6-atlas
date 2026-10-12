"""Import only official operator badges; no portraits, videos or remote runtime assets."""
from pathlib import Path
from html.parser import HTMLParser
import re,json,urllib.request,concurrent.futures,io,base64
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
class Cards(HTMLParser):
    def __init__(self):super().__init__();self.card=None;self.records=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a' and 'oplist__card' in a.get('class','').split():
            hit=re.search(r'/operators/([a-z-]+)$',a.get('href',''))
            if hit:self.card={'id':hit[1]}
        if tag=='img' and self.card:
            if a.get('class')=='oplist__card__img':self.card['name']=a.get('alt','')
            if a.get('class')=='oplist__card__icon':self.card['source']=a.get('src','')
    def handle_endtag(self,tag):
        if tag=='a' and self.card:
            if self.card.get('source') and self.card.get('name'):self.records.append(self.card)
            self.card=None
parser=Cards();parser.feed(urllib.request.urlopen('https://www.ubisoft.com/es-es/game/rainbow-six/siege/game-info/operators',timeout=30).read().decode())
records=sorted({r['id']:r for r in parser.records}.values(),key=lambda r:r['name'].casefold())
assert len(records)>70 and any(r['id']=='osa' for r in records)
output=ROOT/'assets/operators';output.mkdir(parents=True,exist_ok=True)
def download(record):
    raw=urllib.request.urlopen(record['source'],timeout=45).read()
    image=Image.open(io.BytesIO(raw)).convert('RGBA');image.thumbnail((96,96),Image.Resampling.LANCZOS)
    stream=io.BytesIO();image.save(stream,'WEBP',lossless=True,method=6)
    url='data:image/webp;base64,'+base64.b64encode(stream.getvalue()).decode()
    (output/(record['id']+'.js')).write_text('window.R6_OPERATOR_IMAGES=window.R6_OPERATOR_IMAGES||{};window.R6_OPERATOR_IMAGES['+json.dumps(record['id'])+']='+json.dumps(url)+';\n')
    return len(stream.getvalue())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:sizes=list(pool.map(download,records))
(ROOT/'operators-data.js').write_text('window.R6_OPERATORS='+json.dumps([{'id':r['id'],'name':r['name']} for r in records],ensure_ascii=False,separators=(',',':'))+';\n')
(output/'sources.json').write_text(json.dumps({'retrieved':'2026-10-11','sourcePage':'https://www.ubisoft.com/es-es/game/rainbow-six/siege/game-info/operators','rights':'Operator badges and names are property of their respective owners, including Ubisoft and, where applicable, third-party licensors. Not covered by the application MIT license. No commercial permission is asserted.','operators':records},ensure_ascii=False,indent=2)+'\n')
print(f'{len(records)} official badges; total {sum(sizes):,} bytes; median {sorted(sizes)[len(sizes)//2]:,} bytes; loaded individually on demand')
