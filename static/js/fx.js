/* CAVDOME visual effects: liquid nav, background contours, prep book, tilt, reveal, parallax. */
(function(){
"use strict";
const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark=()=>false;
const FX=window.FX={REDUCE};

/* ---------------- liquid nav (WebGL water, ported) ---------------- */
const PAD=14;
const VERT='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
const FRAG=`precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);vec3 irid=.5+.5*cos(6.2831*(vec3(.1,.35,.6)+fres*.6+p.x*.0028+uTime*.035));irid=mix(irid,vec3(.78,.9,.68),.6);
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.12+.07*uDark);vec3 c=vec3(.05,.17,.09)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);c=mix(vec3(1.),irid,.45*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);vec3 tint=mix(vec3(.86,.93,.78),vec3(.42,.72,.5),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);float da=dm*(.34+.14*body)*(1.-.3*uDark);vec3 dc=mix(tint,vec3(1.),body*.5);
 float la=rim*.26;vec3 lc=mix(vec3(.15,.42,.27),vec3(.32,.7,.46),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);gl_FragColor=vec4(c,a);}`;
function initGL(cv){let gl;try{gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:false})}catch(e){return null}if(!gl)return null;
  const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return gl.getShaderParameter(x,gl.COMPILE_STATUS)?x:null};
  const vs=sh(gl.VERTEX_SHADER,VERT),fs=sh(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return null;const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))return null;gl.useProgram(p);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);const u={};
  for(const n of['uRes','uDpr','uTime','uPill','uBlob','uSy','uRip','uMouse','uDark','uAmb'])u[n]=gl.getUniformLocation(p,n);return{gl,u}}
class LiquidNav{
  constructor(host,items,opts){
    this.items=items;this.cur=opts.active||0;this.onChange=opts.onChange||(()=>{});
    const nav=document.createElement('nav');nav.className='lnav';nav.setAttribute('aria-label',opts.label||'Main');
    nav.innerHTML='<span class="lnav-glass" aria-hidden="true"></span><canvas class="lnav-water" aria-hidden="true"></canvas><span class="lnav-drop" aria-hidden="true"></span>';
    this.btns=items.map((it,i)=>{const b=document.createElement('a');b.href='#'+it.hash;b.className='lnav-item';b.innerHTML='<span class="lnav-ico">'+it.icon+'</span><span>'+it.label+'</span>';
      b.addEventListener('click',e=>{e.preventDefault();this.select(i)});nav.appendChild(b);return b});
    host.appendChild(nav);this.nav=nav;this.cv=nav.querySelector('canvas');this.drop=nav.querySelector('.lnav-drop');
    const s=this.s={a:{x:0,v:0},b:{x:0,v:0},sy:{s:1,v:0},lead:0,lagFrom:0,sats:[],rips:[],t:{x:0,cy:0,q:0,r:20},q:0,mouse:{x:0,y:0,s:0,on:false},moving:false,split:false,ready:false,w:0,h:0,vis:true,raf:0,last:0,time:0,glc:initGL(this.cv)};
    nav.dataset.gl=s.glc?'on':'off';
    this.cv.addEventListener('webglcontextlost',e=>{e.preventDefault();s.glc=null;nav.dataset.gl='off'});
    nav.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const p=this.local(e);s.mouse.x=p.x;s.mouse.y=p.y;s.mouse.on=true;this.loop()});
    nav.addEventListener('pointerleave',()=>{s.mouse.on=false;this.loop()});
    nav.addEventListener('pointerdown',e=>{const p=this.local(e);this.ripple(p.x,p.y,.8)});
    nav.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();const n=(this.cur+(e.key==='ArrowRight'?1:-1)+items.length)%items.length;this.select(n);this.btns[n].focus()});
    let lw=-1;new ResizeObserver(()=>{const w=nav.offsetWidth;if(w!==lw){lw=w;s.ready=false;this.measure()}}).observe(nav);
    new IntersectionObserver(([en])=>{s.vis=en.isIntersecting;if(s.vis)this.loop()}).observe(nav);
    this.setActive(this.cur);document.fonts&&document.fonts.ready.then(()=>{s.ready=false;this.measure()});
  }
  local(e){const r=this.nav.getBoundingClientRect();return{x:e.clientX-r.left+PAD,y:e.clientY-r.top+PAD}}
  ripple(x,y,a){if(REDUCE)return;this.s.rips.push({x,y,age:0,amp:a});this.loop()}
  select(i){const ic=this.btns[i].querySelector('.lnav-ico');ic.classList.remove('fx');void ic.offsetWidth;ic.classList.add('fx');if(i!==this.cur){this.setActive(i);this.onChange(i,this.items[i])}}
  setActive(i){this.cur=i;this.btns.forEach((b,k)=>k===i?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));this.measure()}
  measure(){const s=this.s,el=this.btns[this.cur],nav=this.nav;if(!el||!nav.offsetWidth)return;s.w=nav.scrollWidth;s.h=nav.offsetHeight;const T=s.t;
    T.r=el.offsetHeight/2;T.q=Math.max(0,el.offsetWidth/2-T.r);T.cy=PAD+el.offsetTop+el.offsetHeight/2;const nx=PAD+el.offsetLeft+el.offsetWidth/2;
    if(!s.ready){s.a.x=s.b.x=nx;s.q=T.q;s.ready=true}else if(Math.abs(nx-T.x)>.5){s.lead=Math.abs(nx-s.a.x)<=Math.abs(nx-s.b.x)?0:1;s.lagFrom=performance.now()+70;s.moving=true;s.split=false}
    T.x=nx;const d=Math.min(devicePixelRatio||1,2),W=s.w+PAD*2,Hh=s.h+PAD*2;if(this.cv.width!==Math.round(W*d)||this.cv.height!==Math.round(Hh*d)){this.cv.width=Math.round(W*d);this.cv.height=Math.round(Hh*d);this.cv.style.width=W+'px';this.cv.style.height=Hh+'px'}this.loop()}
  step(dt,now){const s=this.s,T=s.t;s.time+=dt;s.q+=(T.q-s.q)*Math.min(1,dt*12);const B=[s.a,s.b];let still=true;
    if(REDUCE){s.a.x=s.b.x=T.x;s.sy.s=1;s.sats=[]}else{
      B.forEach((b,i)=>{const lead=i===s.lead,k=lead?210:72,c=lead?25:13,f=!lead&&now<s.lagFrom?.08:1;b.v+=(k*(T.x-b.x)-c*b.v)*dt*f;b.x+=b.v*dt;
        const lo=PAD+6+s.q+T.r-3,hi=PAD+s.w-6-s.q-T.r+3;if(b.x<lo||b.x>hi){s.sy.v-=Math.min(Math.abs(b.v),900)*.0016;b.x=Math.max(lo,Math.min(hi,b.x));b.v*=-.25}
        if(Math.abs(T.x-b.x)>.3||Math.abs(b.v)>3)still=false});
      const L=B[s.lead],syT=1-.2*Math.min(Math.abs(L.v)/1500,1);s.sy.v+=(280*(syT-s.sy.s)-9*s.sy.v)*dt;s.sy.s+=s.sy.v*dt;if(Math.abs(s.sy.s-1)>.002||Math.abs(s.sy.v)>.02)still=false;
      const sep=Math.abs(s.a.x-s.b.x),r=T.r*(1-.3*Math.min(sep/(2*(T.q+T.r)||1),1));
      if(!s.split&&s.moving&&sep-2*T.q-2*r>-6){s.split=true;const lo=B[1-s.lead],hi=B[s.lead];[.3,.5,.72].forEach((t,j)=>s.sats.push({x:lo.x+(hi.x-lo.x)*t,y:T.cy+(Math.random()-.5)*10,vx:(lo.v+hi.v)*.45,vy:(Math.random()-.5)*60,r:5+Math.random()*3-j*.5,k:70+Math.random()*90}))}
      s.sats=s.sats.filter(d=>{d.vx+=(d.k*(T.x-d.x)-9*d.vx)*dt;d.vy+=(90*(T.cy-d.y)-7*d.vy)*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.x=Math.max(PAD+8+d.r,Math.min(PAD+s.w-8-d.r,d.x));d.y=Math.max(T.cy-T.r+d.r,Math.min(T.cy+T.r-d.r,d.y));if(Math.abs(T.x-d.x)<T.q+T.r*.5)d.r-=dt*26;return d.r>.6});
      if(s.sats.length)still=false}
    if(s.moving&&still){s.moving=false;s.rips.push({x:T.x,y:T.cy,age:0,amp:s.split?1.2:.7})}
    s.rips.forEach(p=>p.age+=dt);s.rips=s.rips.filter(p=>p.age<2.4);s.mouse.s+=((s.mouse.on?1:0)-s.mouse.s)*Math.min(1,dt*7)}
  draw(){const s=this.s,T=s.t,sep=Math.abs(s.a.x-s.b.x),thin=Math.min(sep/(2*(s.q+T.r)||1),1),r=T.r*(1-.3*thin);
    if(s.glc){const{gl:g,u}=s.glc,d=Math.min(devicePixelRatio||1,2);g.viewport(0,0,g.drawingBufferWidth,g.drawingBufferHeight);g.uniform2f(u.uRes,s.w+PAD*2,s.h+PAD*2);g.uniform1f(u.uDpr,d);g.uniform1f(u.uTime,s.time);g.uniform4f(u.uPill,PAD,PAD,s.w,s.h);
      const bl=new Float32Array(24),sy=new Float32Array(6).fill(1),hd=s.lead===0?s.a:s.b,tl=s.lead===0?s.b:s.a;bl.set([hd.x,T.cy,s.q*(1-.25*thin),T.r*(1-.12*thin),tl.x,T.cy,s.q*(1-.8*thin),T.r*(1-.5*thin)],0);sy[0]=sy[1]=s.sy.s;
      s.sats.slice(0,4).forEach((d,i)=>bl.set([d.x,d.y,0,d.r],8+i*4));g.uniform4fv(u.uBlob,bl);g.uniform1fv(u.uSy,sy);const rp=new Float32Array(24);s.rips.slice(-6).forEach((p,i)=>rp.set([p.x,p.y,p.age,p.amp],i*4));g.uniform4fv(u.uRip,rp);
      g.uniform3f(u.uMouse,s.mouse.x,s.mouse.y,s.mouse.s);g.uniform1f(u.uDark,isDark()?1:0);g.uniform1f(u.uAmb,REDUCE?0:1);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.drawArrays(g.TRIANGLES,0,3)}
    else{const left=Math.min(s.a.x,s.b.x)-s.q-r-PAD;this.drop.style.width=(sep+2*(s.q+r))+'px';this.drop.style.transform='translateX('+left+'px) scaleY('+s.sy.s+')'}}
  loop(){const s=this.s;if(s.raf)return;s.last=performance.now();const tick=now=>{const dt=Math.min((now-s.last)/1000,1/30);s.last=now;this.step(dt,now);this.draw();
    const busy=s.moving||s.rips.length||s.sats.length||s.mouse.s>.01;s.raf=(s.vis&&this.nav.offsetWidth&&(!REDUCE||busy))?requestAnimationFrame(tick):0};s.raf=requestAnimationFrame(tick)}
}
FX.LiquidNav=LiquidNav;

/* ---------------- background: drifting contour lines ---------------- */
(function topo(){
  const cv=document.getElementById('topo');if(!cv)return;const ctx=cv.getContext('2d');let w,h,d,t=0,mx=.5,my=.5,raf=0,scrollY=0;
  function size(){d=Math.min(devicePixelRatio||1,2);w=cv.clientWidth;h=cv.clientHeight;cv.width=w*d;cv.height=h*d;ctx.setTransform(d,0,0,d,0,0)}
  addEventListener('resize',size);size();
  addEventListener('pointermove',e=>{mx=e.clientX/w;my=e.clientY/h},{passive:true});
  addEventListener('scroll',()=>{scrollY=window.scrollY},{passive:true});
  function frame(){ctx.clearRect(0,0,w,h);const lines=22,dark=isDark();
    for(let i=0;i<lines;i++){const base=(i/(lines-1))*h*1.2-h*.1-(scrollY*.08%40);ctx.beginPath();
      for(let x=-20;x<=w+20;x+=16){const nx=x/w;
        const y=base+Math.sin(nx*5+t*.35+i*.55)*22+Math.sin(nx*11-t*.22+i*.3)*9+Math.cos(nx*2.5+t*.15+i)*30
          -60*Math.exp(-((nx-mx)**2*18+((base/h)-my)**2*18));
        x===-20?ctx.moveTo(x,y):ctx.lineTo(x,y)}
      const a=i%4===0?.16:.07;ctx.strokeStyle=dark?'rgba(138,214,167,'+a+')':'rgba(37,102,68,'+a+')';ctx.lineWidth=i%4===0?1.3:1;ctx.stroke()}
    // floating dome arcs
    for(let k=0;k<3;k++){const cx=w*(.15+k*.35)+Math.sin(t*.1+k)*40,cy=h*(.85-k*.25)+Math.cos(t*.12+k*2)*30-scrollY*.05*(k+1)%h,R=90+k*50;
      ctx.beginPath();ctx.arc(cx,cy,R,Math.PI,0);ctx.strokeStyle=dark?'rgba(242,234,219,.07)':'rgba(23,58,42,.07)';ctx.lineWidth=1.5;ctx.stroke();
      ctx.beginPath();ctx.arc(cx,cy,R*.65,Math.PI,0);ctx.stroke()}
    t+=.016;if(!REDUCE)raf=requestAnimationFrame(frame)}
  frame();document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(!raf&&!REDUCE)frame()});
})();

/* cursor glow */
(function(){const g=document.getElementById('glow');if(!g||REDUCE)return;let x=0,y=0,tx=0,ty=0,on=false;
  addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;tx=e.clientX;ty=e.clientY;if(!on){on=true;document.body.classList.add('has-pointer');(function f(){x+=(tx-x)*.12;y+=(ty-y)*.12;g.style.transform='translate('+(x-260)+'px,'+(y-260)+'px)';requestAnimationFrame(f)})()}},{passive:true})})();

/* tilt + glare */
FX.tilt=function(root){(root||document).querySelectorAll('.tilt').forEach(el=>{if(el._tilt)return;el._tilt=1;
  el.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||REDUCE)return;const r=el.getBoundingClientRect(),px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
    el.style.setProperty('--ry',((px-.5)*10).toFixed(2)+'deg');el.style.setProperty('--rx',((.5-py)*8).toFixed(2)+'deg');el.style.setProperty('--gx',(px*100)+'%');el.style.setProperty('--gy',(py*100)+'%')});
  el.addEventListener('pointerleave',()=>{el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')})})};

/* reveal on scroll */
FX.reveal=function(){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('shown');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
  document.querySelectorAll('.reveal:not(.shown)').forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0&&!el.closest('[hidden]'))requestAnimationFrame(()=>el.classList.add('shown'));else io.observe(el)})};

/* button ripple + specular follow */
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.btn');if(!b||REDUCE)return;const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height),sp=document.createElement('span');
  sp.className='ripple';sp.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';b.appendChild(sp);setTimeout(()=>sp.remove(),700)});
document.addEventListener('pointermove',e=>{const b=e.target.closest&&e.target.closest('.btn');if(b){const r=b.getBoundingClientRect();b.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%')}},{passive:true});

/* hero stage parallax + typing demo */
FX.stage=function(){const st=document.getElementById('stage');if(!st)return;const layers=[...st.querySelectorAll('.layer')];
  if(!REDUCE)addEventListener('pointermove',e=>{const r=st.getBoundingClientRect();if(r.bottom<0)return;const px=(e.clientX/innerWidth-.5),py=(e.clientY/innerHeight-.5);
    layers.forEach(l=>{const d=+l.dataset.depth||10;l.style.transform='translate3d('+(-px*d)+'px,'+(-py*d)+'px,0) rotateY('+(px*4)+'deg) rotateX('+(-py*4)+'deg)'})},{passive:true});
  const claims=['data centers strain the power grid','tariffs raise consumer prices','AI displaces entry-level jobs','nuclear power cuts emissions'],typed=document.getElementById('typed'),src=document.getElementById('srcCount'),cut=document.getElementById('cutCount'),card=document.getElementById('heroCard');
  let ci=0;async function cycle(){const c=claims[ci++%claims.length];typed.textContent='';card.classList.remove('go');src.textContent='0';cut.textContent='0';
    for(let i=1;i<=c.length;i++){typed.textContent=c.slice(0,i);await wait(REDUCE?0:38)}
    for(let i=1;i<=12;i++){src.textContent=i;await wait(REDUCE?0:70)}
    cut.textContent='3';card.classList.add('go');await wait(5200);cycle()}
  setTimeout(cycle,700)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* tiny step visualisations */
FX.viz=function(){document.querySelectorAll('.viz-c').forEach(cv=>{const ctx=cv.getContext('2d'),kind=cv.dataset.viz;let t=0;
  function sz(){const d=Math.min(devicePixelRatio||1,2);cv.width=cv.clientWidth*d;cv.height=cv.clientHeight*d;ctx.setTransform(d,0,0,d,0,0)}cv.style.width='100%';cv.style.height='100%';sz();addEventListener('resize',sz);
  function f(){const w=cv.clientWidth,h=cv.clientHeight;ctx.clearRect(0,0,w,h);
    if(kind==='search'){for(let i=0;i<6;i++){const y=14+i*16,p=(Math.sin(t*1.5-i*.6)+1)/2;ctx.fillStyle='rgba(37,102,68,.12)';ctx.fillRect(16,y,w-32,8);ctx.fillStyle='rgba(51,132,90,.75)';ctx.fillRect(16,y,(w-32)*(.25+.75*p)*(1-i*.08),8)}}
    else if(kind==='read'){for(let i=0;i<5;i++){const x=18+i*((w-36)/5),bh=(Math.sin(t*1.2+i*1.3)+1.2)/2.2*(h-30);ctx.fillStyle=i===2?'#33845A':'rgba(37,102,68,.25)';ctx.beginPath();ctx.roundRect(x,h-14-bh,(w-36)/5-10,bh,6);ctx.fill()}}
    else{const lines=5;for(let i=0;i<lines;i++){const y=18+i*17;ctx.fillStyle='rgba(22,41,31,.14)';ctx.fillRect(16,y,w-32,6);const p=Math.min(1,Math.max(0,(t%5)-i*.5));if(i%2===0){ctx.fillStyle='#A6E58A';ctx.fillRect(16,y-3,(w-32)*.6*p,12)}ctx.fillStyle='#16291F';ctx.fillRect(16,y+7,(w-32)*.8*p,1.5)}}
    t+=.016;if(!REDUCE)requestAnimationFrame(f)}f()})};

/* ---------------- prep book (ported 3D journal carousel) ---------------- */
FX.book=function(spreads){const root=document.getElementById('book');if(!root)return;const stage=document.getElementById('bkStage'),scene=document.getElementById('bkScene'),label=document.getElementById('bkLabel'),n=spreads.length,items=[],pages=[];
  spreads.forEach((s,i)=>{const it=document.createElement('div');it.className='bk-item';it.dataset.i=i;it.setAttribute('role','group');it.setAttribute('aria-label',s.label+', '+(i+1)+' of '+n);
    ['l','r'].forEach(side=>{const pg=document.createElement('div');pg.className='bk-page';pg.dataset.side=side;pg.innerHTML='<div class="bk-sheet">'+s.html+'</div><div class="bk-gutter"></div><div class="bk-shade"></div>';it.appendChild(pg);pages.push(pg)});scene.appendChild(it);items.push(it)});
  const OPEN=5,SIDE=80,FOLD=174,cl=(v,a,b)=>v<a?a:v>b?b:v,asp=(w,h)=>w<640&&h>w?.86:1.3,sw=(w,h)=>w<=0||h<=0?0:Math.round(Math.min(w*(w<640?.86:.58),h*.92*asp(w,h),1020));
  const pose=(p,w)=>{const d=Math.abs(p),a=d<1?d:1,sg=p<0?-1:1,o=d>1?d-1:0,f=a*a,L=p>0?OPEN+(FOLD-OPEN)*f:OPEN+(SIDE-OPEN)*a,R=p<0?-(OPEN+(FOLD-OPEN)*f):-(OPEN+(SIDE-OPEN)*a),sh=g=>cl((Math.abs(g)-OPEN)/95,0,.62);
    return{x:sg*(a*w*.53+o*w*.055),z:-(a*w*.42+o*w*.06),L,R,sl:sh(L),sr:sh(R),op:cl(7.2-d,0,1),hid:d>7.2}};
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,easeOut=t=>1-Math.pow(1-t,3),dur=s=>s<=0?0:Math.round(560*Math.sqrt(Math.min(s,12)));
  let W=0,pos=0,target=0,tw=null,raf=0,drag=null,touched=false;
  const paint=()=>{if(!W)return;items.forEach((el,i)=>{const q=pose(i-pos,W);if(q.hid){el.style.visibility='hidden';return}el.style.visibility='visible';el.style.opacity=q.op;el.style.transform='translate3d('+q.x.toFixed(2)+'px,0,'+q.z.toFixed(2)+'px)';
    const l=pages[i*2],r=pages[i*2+1];l.style.transform='rotateY('+q.L.toFixed(2)+'deg)';l.style.setProperty('--bk-s',q.sl.toFixed(3));r.style.transform='rotateY('+q.R.toFixed(2)+'deg)';r.style.setProperty('--bk-s',q.sr.toFixed(3))})};
  const frame=t=>{raf=0;if(tw){const k=tw.d>0?cl((t-tw.t0)/tw.d,0,1):1;pos=tw.f+(tw.to-tw.f)*tw.e(k);if(k>=1){tw=null;items.forEach((el,i)=>el.classList.toggle('on',i===target))}}paint();if(tw)raf=requestAnimationFrame(frame)};
  const kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};
  const go=(to,e)=>{const nx=cl(to,0,n-1);if(nx!==target){target=nx;label.textContent=spreads[nx].label;items.forEach(el=>el.classList.remove('on'))}tw={f:pos,to:nx,t0:performance.now(),d:REDUCE?0:dur(Math.abs(nx-pos)),e:e||ease};kick()};
  new ResizeObserver(([en])=>{const{width:a,height:b}=en.contentRect;W=sw(a,b);root.style.setProperty('--bk-w',W+'px');root.style.setProperty('--bk-h',Math.round(W/asp(a,b))+'px');paint()}).observe(stage);
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;touched=true;tw=null;drag={id:e.pointerId,x:e.clientX,f:pos,lx:e.clientX,lt:e.timeStamp,v:0,m:false}});
  stage.addEventListener('pointermove',e=>{const d=drag;if(!d||d.id!==e.pointerId||!W)return;const dx=e.clientX-d.x;if(!d.m&&Math.abs(dx)>6){d.m=true;stage.dataset.drag='';stage.setPointerCapture(e.pointerId)}if(!d.m)return;
    const dt=Math.max(1,e.timeStamp-d.lt);d.v=d.v*.6+(-(e.clientX-d.lx)/(W*.42)/(dt/1000))*.4;d.lx=e.clientX;d.lt=e.timeStamp;pos=cl(d.f-dx/(W*.42),-.3,n-.7);kick()});
  const up=e=>{const d=drag;if(!d||d.id!==e.pointerId)return;drag=null;delete stage.dataset.drag;if(d.m){go(cl(Math.round(pos+cl(d.v*.18,-1.5,1.5)),0,n-1),easeOut);return}const h=e.target.closest('[data-i]');go(h?+h.dataset.i:target)};
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  root.addEventListener('keydown',e=>{const m={ArrowRight:1,ArrowLeft:-1};if(e.target!==root||!(e.key in m))return;e.preventDefault();touched=true;go(target+m[e.key])});
  document.getElementById('bkPrev').onclick=()=>{touched=true;go(target-1)};document.getElementById('bkNext').onclick=()=>{touched=true;go(target+1)};
  let vis=false;new IntersectionObserver(([en])=>{vis=en.isIntersecting}).observe(root);
  if(!REDUCE)setInterval(()=>{if(touched||!vis||document.hidden||drag)return;go(target>=n-1?0:target+1)},4300);
  label.textContent=spreads[0].label;go(1)};
})();
