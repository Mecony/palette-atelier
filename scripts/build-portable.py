"""Build a reproducible single HTML with inline styles/scripts/art and Blob Worker."""
from pathlib import Path
import base64,json,re
root=Path(__file__).resolve().parents[1]
d=root/'dist'
html=(d/'index.html').read_text()
art='data:image/jpeg;base64,'+base64.b64encode((d/'assets/forest.jpg').read_bytes()).decode()
favicon='data:image/svg+xml;base64,'+base64.b64encode((d/'assets/favicon.svg').read_bytes()).decode()
engine=(d/'engine.js').read_text()
worker=engine+'\n'+(d/'worker.js').read_text().replace("importScripts('engine.js');",'')
app=(d/'app.js').read_text().replace("new Worker('worker.js')","new Worker(URL.createObjectURL(new Blob(["+json.dumps(worker,ensure_ascii=False)+"],{type:'text/javascript'})))")
app=app.replace("'assets/forest.jpg'",'SAMPLE_IMAGE')
html=html.replace('assets/forest.jpg',art).replace('assets/favicon.svg',favicon)
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(d/'style.css').read_text()+'</style>')
html=html.replace('<script src="engine.js"></script>','<script>'+engine+'</script>')
html=html.replace('<script src="app.js"></script>','<script>const SAMPLE_IMAGE='+json.dumps(art)+';\n'+app+'</script>')
(root/'index.html').write_text(html)
(root/'.nojekyll').touch()
print('Built index.html ('+str(len(html.encode()))+' bytes)')
