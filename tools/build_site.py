"""Package only static public assets; exclude desktop tools and source workflows."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];out=root/'_site'
if out.exists():shutil.rmtree(out)
out.mkdir()
for name in ['index.html','app.js','panels.js','collab-launcher.js','collab.js','collab-core.js','data.js','ui.js','features.js','advanced.js','style.css','icon.svg','icon.ico','r6-logo.png','LICENSE-R6MAPS.txt','FUENTES-NOMBRES.txt','CNAME']:
    file=root/name
    if file.is_file():shutil.copy2(file,out/name)
for name in ['maps','vendor','updates']:shutil.copytree(root/name,out/name)
(out/'.nojekyll').touch()
print('Public assets ready:',sum(1 for p in out.rglob('*') if p.is_file()))
