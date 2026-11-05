/* Shared deterministic CIELAB analysis engine, D65 sRGB. No network calls. */
(function(root){'use strict';
const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
function rgbToLab(rgb){const [r,g,b]=rgb.map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4),f=t=>t>216/24389?Math.cbrt(t):t*(24389/27)/116+16/116;const x=f((r*.4124564+g*.3575761+b*.1804375)/.95047),y=f(r*.2126729+g*.7151522+b*.072175),z=f((r*.0193339+g*.119192+b*.9503041)/1.08883);return [116*y-16,500*(x-y),200*(y-z)];}
function labToRgb([L,a,b]){const f=t=>t**3>216/24389?t**3:(116*t-16)/(24389/27),y=(L+16)/116,X=.95047*f(y+a/500),Y=f(y),Z=1.08883*f(y-b/200);return [X*3.2404542-Y*1.5371385-Z*.4985314,-X*.969266+Y*1.8760108+Z*.041556,X*.0556434-Y*.2040259+Z*1.0572252].map(v=>Math.round(clamp((v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)*255)));}
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const hex=rgb=>'#'+rgb.map(v=>Math.round(clamp(v)).toString(16).padStart(2,'0')).join('').toUpperCase();
const unhex=h=>/^#[0-9a-f]{6}$/i.test(h)?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):null;
function nearest(lab,cs){let j=0,d=Infinity;cs.forEach((c,i)=>{const q=distance(lab,c);if(q<d){j=i;d=q;}});return j;}
function analyze(data,width,height,k=6,region=null){
 if(data.length!==width*height*4||width<1||height<1)throw Error('图像尺寸无效');k=clamp(Math.round(k),2,12);
 let [x0,y0,x1,y1]=region||[0,0,width,height];x0=clamp(Math.floor(x0),0,width-1);y0=clamp(Math.floor(y0),0,height-1);x1=clamp(Math.ceil(x1),x0+1,width);y1=clamp(Math.ceil(y1),y0+1,height);
 const step=Math.max(1,Math.ceil(Math.sqrt((x1-x0)*(y1-y0)/16384))),bins=new Map(),hist=Array(32).fill(0);let sampleCount=0,total=0,sumL=0,sumL2=0,sumSat=0;
 for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){const i=(y*width+x)*4,w=data[i+3]/255;if(w<.02)continue;const rgb=[data[i],data[i+1],data[i+2]],key=(rgb[0]>>3)*1024+(rgb[1]>>3)*32+(rgb[2]>>3);let p=bins.get(key);if(!p){p={rgb:[0,0,0],w:0};bins.set(key,p);}for(let q=0;q<3;q++)p.rgb[q]+=rgb[q]*w;p.w+=w;
 const L=rgbToLab(rgb)[0],max=Math.max(...rgb)/255,min=Math.min(...rgb)/255,l=(max+min)/2;sumSat+=(max===min?0:(max-min)/(1-Math.abs(2*l-1)))*w;sumL+=L*w;sumL2+=L*L*w;hist[Math.min(31,Math.floor(L/100*32))]+=w;sampleCount++;total+=w;}
 if(!total)throw Error('这个区域完全透明，请换一个区域。');
 const ps=Array.from(bins.values()).map(p=>{const rgb=p.rgb.map(v=>v/p.w);return {rgb,lab:rgbToLab(rgb),w:p.w};}).sort((a,b)=>b.w-a.w||hex(a.rgb).localeCompare(hex(b.rgb)));
 let cs=[ps[0].lab.slice()];while(cs.length<Math.min(k,ps.length)){let best=-1,chosen=ps[0];for(const p of ps){const s=Math.min(...cs.map(c=>distance(p.lab,c)))*Math.sqrt(p.w);if(s>best){best=s;chosen=p;}}cs.push(chosen.lab.slice());}
 for(let iter=0;iter<24;iter++){const sums=cs.map(()=>({v:[0,0,0],w:0}));for(const p of ps){const s=sums[nearest(p.lab,cs)];s.w+=p.w;for(let q=0;q<3;q++)s.v[q]+=p.lab[q]*p.w;}let movement=0;cs=cs.map((c,i)=>{const n=sums[i].w?sums[i].v.map(v=>v/sums[i].w):c;movement+=distance(c,n);return n;});if(movement<.001)break;}
 const acc=cs.map(()=>({rgb:[0,0,0],lab:[0,0,0],w:0}));for(const p of ps){const s=acc[nearest(p.lab,cs)];s.w+=p.w;for(let q=0;q<3;q++){s.rgb[q]+=p.rgb[q]*p.w;s.lab[q]+=p.lab[q]*p.w;}}
 const colors=acc.filter(s=>s.w).map(s=>{const rgb=s.rgb.map(v=>Math.round(v/s.w));return {rgb,hex:hex(rgb),lab:s.lab.map(v=>v/s.w),weight:s.w/total};}).sort((a,b)=>b.weight-a.weight);
 return {version:1,colors,sampleCount,meanLightness:sumL/total,lightnessStd:Math.sqrt(Math.max(0,sumL2/total-(sumL/total)**2)),saturation:sumSat/total,histogram:hist.map(v=>v/total),region:[x0,y0,x1,y1],algorithm:'alpha-weighted deterministic CIELAB k-means / ΔE76'};
}
function recolor(data,palette,targets,mode='recolor'){const out=new Uint8ClampedArray(data),cs=palette.map(c=>c.lab),ts=targets.map(h=>rgbToLab(unhex(h))),cache=new Map();for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const key=data[i]*65536+data[i+1]*256+data[i+2];let rgb=cache.get(key);if(!rgb){const lab=rgbToLab([data[i],data[i+1],data[i+2]]);if(mode==='gray')rgb=labToRgb([lab[0],0,0]);else{const n=nearest(lab,cs);if(mode==='poster')rgb=unhex(targets[n]);else if(targets[n].toUpperCase()===palette[n].hex.toUpperCase())rgb=[data[i],data[i+1],data[i+2]];else rgb=labToRgb([clamp(lab[0]+(ts[n][0]-cs[n][0])*.35,0,100),lab[1]+ts[n][1]-cs[n][1],lab[2]+ts[n][2]-cs[n][2]]);}cache.set(key,rgb);}out[i]=rgb[0];out[i+1]=rgb[1];out[i+2]=rgb[2];}return out;}
const api={rgbToLab,labToRgb,distance,hex,unhex,analyze,recolor};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ColorLab=api;
})(typeof self!=='undefined'?self:globalThis);
