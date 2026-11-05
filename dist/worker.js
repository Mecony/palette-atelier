importScripts('engine.js');
self.onmessage=({data:m})=>{try{const result=m.type==='analyze'?ColorLab.analyze(m.pixels,m.width,m.height,m.k,m.region):ColorLab.recolor(m.pixels,m.palette,m.targets,m.mode);self.postMessage({id:m.id,result},result instanceof Uint8ClampedArray?[result.buffer]:[]);}catch(e){self.postMessage({id:m.id,error:e.message});}};
