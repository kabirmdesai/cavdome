/* CAVDOME app logic: routing, card cutting, highlights only, library, flow, timers, break calculator. */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
const store={get(k,d){try{const v=localStorage.getItem('cavdome.'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('cavdome.'+k,JSON.stringify(v))}catch(e){}}};
let tt;const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600)};
const I=d=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
async function api(path,body){const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});let d={};try{d=await r.json()}catch(e){}if(!r.ok&&!d.error)d.error='The server answered '+r.status+'.';return d}

/* ---------------- routing ---------------- */
const VIEWS={home:'home',cut:'cards',read:'cards',flow:'flow',library:'library',tools:'tools'};
const TABS=['cut','read'];
const mainNav=new FX.LiquidNav($('#mainNav'),[
  {label:'Home',hash:'home',icon:I('<path d="M3 18a9 9 0 0 1 18 0"/><path d="M2 18h20"/>')},
  {label:'Cards',hash:'cut',icon:I('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>')},
  {label:'Flow',hash:'flow',icon:I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>')},
  {label:'Library',hash:'library',icon:I('<path d="M4 5h4v15H4zM10 5h4v15h-4zM16 6l3.5-1 3 14-3.5 1z"/>')},
  {label:'Tools',hash:'tools',icon:I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>')}],
  {label:'Main',onChange:(i,it)=>{location.hash=it.hash}});
const tabNav=new FX.LiquidNav($('#tabNav'),[
  {label:'Card Cut',hash:'cut',icon:I('<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.6 20 18M8.2 16.4 20 6"/>')},
  {label:'Highlights Only',hash:'read',icon:I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h4"/>')}],
  {label:'Card tools',onChange:(i,it)=>{location.hash=it.hash}});
let curView=null,curTab=null;
function applyRoute(){
  let h=location.hash.slice(1).split('?')[0]||'home';if(!VIEWS[h])h='home';const v=VIEWS[h];
  if(v!==curView){$$('.view').forEach(el=>{const on=el.dataset.view===v;el.hidden=!on;if(on&&!document.startViewTransition){el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter')}});curView=v;window.scrollTo({top:0,behavior:'instant'});if(v==='library')renderLib()}
  mainNav.setActive(['home','cards','flow','library','tools'].indexOf(v));
  if(v==='cards'&&h!==curTab){$$('.panel').forEach(p=>{const on=p.dataset.tab===h;p.hidden=!on;if(on){p.classList.remove('enter');void p.offsetWidth;p.classList.add('enter')}});curTab=h;tabNav.setActive(TABS.indexOf(h))}
  requestAnimationFrame(()=>{tabNav.s.ready=false;tabNav.measure();mainNav.measure();FX.reveal()});
}
function route(){if(document.startViewTransition&&!FX.REDUCE&&curView!==null){const h=location.hash.slice(1)||'home';if(VIEWS[h]&&VIEWS[h]!==curView){document.startViewTransition(applyRoute);return}}applyRoute()}
addEventListener('hashchange',route);

/* ---------------- home content ---------------- */
$('#marq').innerHTML=(s=>s+s)(['Card Cut','any link','Highlights Only','read copies','Flow','Speech Timer','every round','Break Calculator','Card Library','Policy · LD · PF'].map(x=>'<span>'+x+'</span>').join(''));
const REVIEWS=[
  ['Policy debater','I dropped our 1AC into Highlights Only and had a clean read copy for my partner before the round started.'],
  ['LD debater','The cites come out complete. Author, quals and date are already there, which used to take me forever.'],
  ['PF coach','My novices flow on it during practice rounds and the timer presets match our event exactly.'],
  ['Public Forum debater','Card Cut pulled the author\'s qualifications off the page so I didn\'t have to dig for them.'],
  ['College policy debater','Copying straight into Verbatim keeps the underlining and highlights where I want them.'],
  ['LD coach','The break calculator settled our argument about whether 4-2 clears at a 32 team break.'],
  ['Policy debater','Flowing on my laptop while my partner runs prep time in the next tab beats paper.'],
  ['PF debater','I save cards to the library all week and download one speech doc the night before.']];
const rv=(r,i)=>'<figure class="rv glass"><div class="stars">★★★★★</div><q>'+esc(r[1])+'</q><figcaption class="who"><span class="av">'+'ABCDEFGHJK'[i%10]+'</span><span>Sample reviewer<small>'+esc(r[0])+'</small></span></figcaption></figure>';
const half=Math.ceil(REVIEWS.length/2),r1=REVIEWS.slice(0,half).map(rv).join(''),r2=REVIEWS.slice(half).map((r,i)=>rv(r,i+half)).join('');
$('#reviews').innerHTML='<div class="rv-track">'+r1+r1+'</div><div class="rv-track rev">'+r2+r2+'</div>';
const FAQ=[
  ['What does Card Cut do with a link?','It opens the article, reads the text and fills in the author, qualifications, publication, date and URL. If you type the argument, it picks the passage that proves it, writes a tag and marks the underlining and highlighting.'],
  ['What does Highlights Only keep?','The tags, the evidence names and every highlighted word, in order and exactly as written. Nothing else from the PDF comes through.'],
  ['Which PDFs work with Highlights Only?','PDFs saved from Word or Verbatim, and PDFs highlighted in a viewer like Preview or Acrobat. A scan or photo of paper has no text inside it, so it can\'t be read.'],
  ['Why did a site get skipped?','Some publishers block automated readers. If that happens, copy the article text into Card Cut and the cite fields still fill in.'],
  ['Will the cards paste into Verbatim?','Yes. Copy card keeps underlining, highlighting and shrunk text as formatting, so Word and Verbatim keep it when you paste.'],
  ['Where is my flow and library saved?','In your browser on this device. Download a speech doc from the Library page to keep a copy anywhere else.']];
$('#faq').innerHTML=FAQ.map((q,i)=>'<div class="qa'+(i===0?' open':'')+'"><button type="button" aria-expanded="'+(i===0)+'">'+esc(q[0])+'<i></i></button><div class="a"><div><p>'+esc(q[1])+'</p></div></div></div>').join('');
$('#faq').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const q=b.parentElement,o=!q.classList.contains('open');q.classList.toggle('open',o);b.setAttribute('aria-expanded',o)});
$('#heroForm').addEventListener('submit',e=>{e.preventDefault();const q=$('#heroQ').value.trim();location.hash='cut';if(!q){setTimeout(()=>$('#cUrl').focus(),400);return}$('#cUrl').value=q;setTimeout(()=>$('#btnCut').click(),400)});

/* prep book spreads */
const DTXT='<span class="u h">If there is no struggle there is no progress.</span> <span class="s">Those who profess to favor freedom and yet</span> <span class="u">deprecate agitation are men who want crops without plowing up the ground</span><span class="s">; they want rain without thunder and lightning.</span> <span class="u h">Power concedes nothing without a demand.</span> <span class="u">It never did and it never will.</span>';
FX.book([
 {label:'Cover',html:'<div class="sh" style="left:7%;top:14%;width:36%;text-align:center"><svg viewBox="0 0 120 70" style="width:46%;color:#256644" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M12 60a48 48 0 0 1 96 0"/><path d="M34 60a26 26 0 0 1 52 0" opacity=".5"/><path d="M4 60h112"/></svg><div style="font:900 7em/.9 var(--f-display);letter-spacing:.06em;color:#173A2A;margin-top:.15em">CAVDOME</div><div class="bmono" style="margin-top:1.2em">Prep book · cards · flows · tools</div></div><div class="sh bnote" style="left:58%;top:16%;width:32%;transform:rotate(2.5deg)"><b>Open me</b><span>Each spread is one part of getting ready for a round.</span></div><div class="sh bhand" style="left:60%;top:66%;width:30%;transform:rotate(-3deg)">drag the page to turn it</div>'},
 {label:'Cutting a card',html:'<div class="sh slip tape sweep" style="left:5%;top:9%;width:40%;transform:rotate(-1.4deg)"><div class="t">Progress depends on sustained pressure from the people who want change.</div><div class="c"><b>Douglass, 1857</b> [Frederick Douglass, abolitionist and orator; "West India Emancipation," speech at Canandaigua, New York, August 3, 1857]</div><p>'+DTXT+'</p></div><div class="sh bhand" style="left:56%;top:10%;width:36%">1. Tag the claim in your words</div><div class="sh bhand" style="left:56%;top:26%;width:36%">2. Cite who, when and where</div><div class="sh bhand" style="left:56%;top:42%;width:36%">3. Underline the warrant</div><div class="sh bhand" style="left:56%;top:58%;width:36%">4. Highlight what you read aloud</div><div class="sh bnote" style="left:60%;top:74%;width:28%;transform:rotate(-2deg)"><b>Shrink the rest</b><span>Context stays on the page.</span></div>'},
 {label:'Flowing the round',html:'<div class="sh flowmini" style="left:5%;top:9%;width:40%"><div><h5>1AC</h5><p>Adv 1 grid</p><p>Adv 2 warming</p><p>Plan</p></div><div><h5>1NC</h5><p>DA politics</p><p>CP states</p><p class="x">Case no impact</p></div><div><h5>2AC</h5><p>N/U on DA</p><p>Perm do both</p><p>Extend Adv 1</p></div><div><h5>Block</h5><p>Link ext</p><p class="x">Perm severs</p><p>?</p></div></div><div class="sh bnote" style="left:57%;top:12%;width:33%;transform:rotate(1.8deg)"><b>Answer everything</b><span>The empty box on your flow is the card you still need.</span></div><div class="sh bhand" style="left:58%;top:60%;width:32%;transform:rotate(-2deg)">cut a card for the question mark</div>'},
 {label:'Writing a block',html:'<div class="sh slip" style="left:6%;top:11%;width:38%;transform:rotate(1deg)"><div class="bmono" style="margin-bottom:1em">Block · answers to their card</div><div class="bhand" style="font-size:2.6em;line-height:1.25">1. Non-unique<br>2. No link<br>3. Link turn<br>4. Impact defense</div></div><div class="sh bnote" style="left:56%;top:14%;width:34%;transform:rotate(-2deg)"><b>One card per number</b><span>Cut each answer in Card Cut and save it to the library.</span></div>'},
 {label:'Before the round',html:'<div class="sh slip tape" style="left:7%;top:12%;width:36%;transform:rotate(-1deg)"><div class="bmono" style="margin-bottom:1em">Round checklist</div><div class="bhand" style="font-size:2.5em;line-height:1.3">Make a read copy of the case<br>Set the speech timer<br>Download the speech doc</div></div><div class="sh bnote" style="left:57%;top:18%;width:32%;transform:rotate(2deg)"><b>Walk in ready</b><span>Everything you need lives in the Tools and Library pages.</span></div>'}]);

/* ---------------- card rendering ---------------- */
const HL={g:'#A6E58A',y:'#FFEE6E',c:'#86E4EE'};
const FONTS={calibri:"Carlito, Calibri, Arial, sans-serif",times:"Tinos, 'Times New Roman', serif",arial:"Arimo, Arial, sans-serif"};
const prefs=Object.assign({hl:'g',cite:'comma',font:'calibri'},store.get('prefs',{}));
function bodyHTML(body,ul,hl,shrink){const n=body.length,u=new Uint8Array(n),h=new Uint8Array(n);(ul||[]).forEach(([a,b])=>u.fill(1,a,b));(hl||[]).forEach(([a,b])=>{h.fill(1,a,b);u.fill(1,a,b)});
  const segs=[];let last=0;body.replace(/\n+/g,(m,i)=>{segs.push([last,i]);last=i+m.length;return m});segs.push([last,n]);
  return segs.filter(([a,b])=>body.slice(a,b).trim()).map(([a,b])=>{let s='',i=a;while(i<b){const ku=u[i],kh=h[i];let j=i+1;while(j<b&&u[j]===ku&&h[j]===kh)j++;const t=esc(body.slice(i,j));
    s+=kh?'<span style="text-decoration:underline;font-weight:bold;background-color:'+HL[prefs.hl]+'">'+t+'</span>':ku?'<span style="text-decoration:underline">'+t+'</span>':(shrink?'<span style="font-size:8pt">'+t+'</span>':t);i=j}return'<p>'+s+'</p>'}).join('')}
function citeShort(c){const y=String(c.year||'');return prefs.cite==='short'?[c.last,y.slice(-2)].filter(Boolean).join(' '):[c.last,y].filter(Boolean).join(', ')}
function citeLong(c){const p=[],who=[c.author,c.quals].filter(Boolean).join(', ');if(who)p.push(who);const t=[];if(c.title)t.push('“'+c.title+',”');if(c.pub)t.push(c.pub);if(c.date)t.push(c.date);if(t.length)p.push(t.join(' '));if(c.url)p.push(c.url);p.push('accessed '+(c.accessed||today()));return'['+p.join('; ')+']'}
function exportHTML(card){return'<div style="font-family:'+FONTS[prefs.font]+';font-size:11pt;color:#000"><p style="margin:0 0 3pt;font-size:13pt;font-weight:bold">'+esc(card.tag)+'</p><p style="margin:0 0 6pt"><b style="font-size:13pt">'+esc(citeShort(card.cite))+'</b> '+esc(citeLong(card.cite))+'</p>'+card.html.replace(/<p>/g,'<p style="margin:0 0 6pt">')+'</div>'}
function copyHTML(html,text){const fb=()=>{const d=document.createElement('div');d.contentEditable='true';d.style.cssText='position:fixed;left:-9999px;top:0';d.innerHTML=html;document.body.appendChild(d);const r=document.createRange();r.selectNodeContents(d);const s=getSelection();s.removeAllRanges();s.addRange(r);let ok=false;try{ok=document.execCommand('copy')}catch(e){}s.removeAllRanges();d.remove();toast(ok?'Copied with formatting':'Copy blocked. Select the card and press Ctrl+C.')};
  try{if(navigator.clipboard&&window.ClipboardItem)navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]).then(()=>toast('Copied with formatting'),fb);else fb()}catch(e){fb()}}
/* ---------------- card cut editor ---------------- */
const F=['last','year','author','quals','title','pub','date','url','accessed'];
const readCite=()=>{const o={};F.forEach(k=>o[k]=$('#f-'+k).value.trim());return o};
function renderCite(){const c=readCite(),s=citeShort(c);$('#cardCite').innerHTML=(s?'<b>'+esc(s)+'</b> ':'')+(s||c.author||c.url?esc(citeLong(c)):'')}
F.forEach(k=>$('#f-'+k).addEventListener('input',renderCite));$('#f-accessed').value=today();
function applyPrefs(){$('#paper').style.fontFamily=FONTS[prefs.font];$('#fontSel').value=prefs.font;$('#citeStyle').value=prefs.cite;$$('.sw').forEach(b=>b.setAttribute('aria-pressed',b.dataset.hl===prefs.hl?'true':'false'));renderCite()}
applyPrefs();
$('#fontSel').onchange=e=>{prefs.font=e.target.value;store.set('prefs',prefs);applyPrefs()};$('#citeStyle').onchange=e=>{prefs.cite=e.target.value;store.set('prefs',prefs);applyPrefs()};
const body=$('#cardBody');
function loadEditor(c){F.forEach(k=>$('#f-'+k).value=(c.cite&&c.cite[k])||'');if(!$('#f-accessed').value)$('#f-accessed').value=today();$('#cardTag').textContent=c.tag||'';body.innerHTML=c.html||'';renderCite();const p=$('#paper');p.classList.remove('flash');void p.offsetWidth;p.classList.add('flash')}
const st=(m,k)=>{const s=$('#cutStatus');s.className='status'+(k?' '+k:'');s.textContent=m};
$('#btnCut').onclick=async()=>{const url=$('#cUrl').value.trim(),text=$('#cText').value.trim(),claim=$('#cClaim').value.trim();if(!url&&!text){st('Paste a link or the article text.','err');return}
  const btn=$('#btnCut');btn.classList.add('busy');st(url?'Opening the article…':'Cutting the text…');
  const d=await api('/api/cut',url?{url,claim}:{text,claim});btn.classList.remove('busy');if(d.error){st(d.error,'err');return}
  if(d.fulltext)$('#cText').value=d.fulltext;const cite=d.cite||Object.assign(readCite(),{accessed:readCite().accessed||today()});
  loadEditor({tag:d.tag,cite,html:bodyHTML(d.body,d.underline,d.highlight,false)});if(d.cite)$('#citeBox').open=true;st('Card cut. Adjust anything with the toolbar.','ok')};
$('#btnHand').onclick=()=>{const t=$('#cText').value.trim();if(!t){st('Paste the article text first.','err');return}body.innerHTML=t.split(/\n+/).filter(Boolean).map(p=>'<p>'+esc(p)+'</p>').join('');st('Text is in the card. Select and mark it.','ok')};
$('#btnNew').onclick=()=>{F.forEach(k=>$('#f-'+k).value='');$('#f-accessed').value=today();$('#cardTag').textContent='';body.innerHTML='';['cUrl','cClaim','cText'].forEach(i=>$('#'+i).value='');renderCite();st('')};
const inBody=()=>{const s=getSelection();return s.rangeCount&&body.contains(s.anchorNode)&&!s.isCollapsed};
const ex=(c,v)=>{try{document.execCommand('styleWithCSS',false,true)}catch(e){}document.execCommand(c,false,v)};
function underlined(n){let el=n.parentElement;while(el&&el!==body){if(el.tagName==='U'||(el.style.textDecorationLine||el.style.textDecoration||'').includes('underline'))return true;el=el.parentElement}return false}
function shrink(on){if(on){const w=document.createTreeWalker(body,NodeFilter.SHOW_TEXT),l=[];while(w.nextNode()){const n=w.currentNode;if(n.nodeValue.trim()&&!underlined(n))l.push(n)}l.forEach(n=>{const p=n.parentElement;if(p!==body&&p.tagName==='SPAN'&&p.childNodes.length===1)p.style.fontSize='8pt';else{const s=document.createElement('span');s.style.fontSize='8pt';n.replaceWith(s);s.appendChild(n)}})}
  else body.querySelectorAll('span').forEach(s=>{if(s.style.fontSize==='8pt')s.style.fontSize=''});$('[data-cmd="shrink"]').setAttribute('aria-pressed',on)}
function cmd(c){if(c==='shrink')return shrink($('[data-cmd="shrink"]').getAttribute('aria-pressed')!=='true');
  if(c==='condense'){const ps=$$('p',body);if(ps.length>1){ps.slice(1).forEach(p=>{ps[0].append(' ');while(p.firstChild)ps[0].appendChild(p.firstChild);p.remove()})}return}
  if(!inBody())return toast('Select text in the card first.');if(c==='hl')ex('hiliteColor',HL[prefs.hl]);else if(c==='u')ex('underline');else if(c==='b')ex('bold');else if(c==='clear')ex('removeFormat')}
$$('#toolbar .tb,#toolbar .sw').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));
$$('#toolbar .tb').forEach(b=>b.onclick=()=>cmd(b.dataset.cmd));
$$('#toolbar .sw').forEach(b=>b.onclick=()=>{prefs.hl=b.dataset.hl;store.set('prefs',prefs);applyPrefs();if(inBody())cmd('hl')});
$('#sizeSel').onchange=e=>{const pt=e.target.value;e.target.value='';if(!pt)return;if(!inBody())return toast('Select text in the card first.');try{document.execCommand('styleWithCSS',false,false)}catch(x){}document.execCommand('fontSize',false,'7');body.querySelectorAll('font[size="7"]').forEach(f=>{const s=document.createElement('span');s.style.fontSize=pt+'pt';while(f.firstChild)s.appendChild(f.firstChild);f.replaceWith(s)})};
body.addEventListener('keydown',e=>{const m={F9:'u',F10:'b',F11:'hl',F12:'clear'}[e.key];if(m){e.preventDefault();cmd(m)}});
[body,$('#cardTag')].forEach(el=>el.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text/plain'))}));
const editorCard=()=>({tag:$('#cardTag').innerText.trim(),cite:readCite(),html:body.innerHTML.trim()});
$('#btnCopy').onclick=()=>{const c=editorCard();if(!body.innerText.trim())return toast('The card is empty.');copyHTML(exportHTML(c),c.tag+'\n'+citeShort(c.cite)+' '+citeLong(c.cite)+'\n'+body.innerText)};
$('#btnSave').onclick=()=>{if(!body.innerText.trim())return toast('Cut a card before saving.');saveCard(editorCard())};

/* ---------------- highlights only (PDF read copy) ---------------- */
const PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfReady=null;
function loadPdfJs(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);if(pdfReady)return pdfReady;
  pdfReady=new Promise((ok,no)=>{const sc=document.createElement('script');sc.src=PDFJS+'pdf.min.js';sc.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';ok(window.pdfjsLib)};sc.onerror=()=>{pdfReady=null;no(new Error('load'))};document.head.appendChild(sc)});return pdfReady}
const hoSt=(m,k)=>{const s=$('#hoStatus');s.className='status'+(k?' '+k:'');s.textContent=m};
const hoBar=f=>{const b=$('#hoBar');if(f==null){b.hidden=true;return}b.hidden=false;b.firstElementChild.style.width=Math.round(f*100)+'%'};
const mctx=document.createElement('canvas').getContext('2d');
/* a pixel counts as highlight when it is clearly colored (not white, gray or black) */
const colored=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx>=130&&mx-mn>=40};
async function readPage(lib,page){
  const S=2,vp=page.getViewport({scale:S}),cv=document.createElement('canvas');cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
  const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:ctx,viewport:vp,intent:document.hidden?'print':'display'}).promise; /* display draws every viewer highlight; print skips requestAnimationFrame so a hidden tab still finishes */
  const tc=await page.getTextContent(),px=ctx.getImageData(0,0,cv.width,cv.height).data,W=cv.width,H=cv.height;
  const fontInfo={};const font=id=>{if(id in fontInfo)return fontInfo[id];let f=null;try{if(page.commonObjs.has(id))f=page.commonObjs.get(id)}catch(e){}
    const nm=((f&&f.name)||'')+' '+(((tc.styles[id]||{}).fontFamily)||'');return fontInfo[id]={bold:!!(f&&(f.bold||f.black))||/bold|black|heavy|semibold|demi/i.test(nm),fam:(tc.styles[id]||{}).fontFamily||'sans-serif'}};
  const lines=[];let cur=null;
  for(const it of tc.items){if(!('str' in it)){continue}
    const tx=lib.Util.transform(vp.transform,it.transform),fh=Math.hypot(tx[2],tx[3]);
    if(!it.str.length||fh<1){if(it.hasEOL&&cur)cur.eol=true;continue}
    if(Math.abs(tx[1])>0.01*fh||Math.abs(tx[2])>0.01*fh){if(it.hasEOL&&cur)cur.eol=true;continue} /* skip rotated text */
    const x0=tx[4],base=tx[5],w=it.width*S,f=font(it.fontName);
    if(!cur||cur.eol||Math.abs(base-cur.base)>fh*.5||x0<cur.x1-fh*2){cur={base,size:fh/S,x1:x0,chars:[],eol:false};lines.push(cur)}
    else if(x0-cur.x1>fh*.15&&cur.chars.length&&!/\s/.test(cur.chars[cur.chars.length-1].c)&&!/^\s/.test(it.str))cur.chars.push({c:' ',hl:null,b:f.bold});
    /* per-character x ranges, proportional to measured glyph widths */
    mctx.font='100px '+f.fam;const ws=[...it.str].map(c=>Math.max(mctx.measureText(c).width,1)),tot=ws.reduce((a,b)=>a+b,0);
    const y0=Math.max(0,Math.floor(base-fh*.72)),y1=Math.min(H-1,Math.ceil(base+fh*.12));let x=x0;
    [...it.str].forEach((c,k)=>{const cw=w*ws[k]/tot,a=Math.max(0,Math.floor(x+cw*.15)),b=Math.min(W-1,Math.ceil(x+cw*.85));x+=cw;
      let hl=null;if(!/\s/.test(c)){let n=0,on=0;for(let yy=y0;yy<=y1;yy++)for(let xx=a;xx<=b;xx++){const o=(yy*W+xx)*4;n++;if(colored(px[o],px[o+1],px[o+2]))on++}hl=n?on/n>=.3:false}
      cur.chars.push({c,hl,b:f.bold})});
    cur.x1=x0+w;cur.size=Math.max(cur.size,fh/S);if(it.hasEOL)cur.eol=true}
  cv.width=cv.height=0;
  return lines.map(l=>{const words=[];let wd=null;l.chars.forEach(ch=>{if(/\s/.test(ch.c)){wd=null;return}if(!wd){wd={cs:[]};words.push(wd)}wd.cs.push(ch)});
    words.forEach(w=>{const cs=w.cs,n=cs.length,h=cs.filter(c=>c.hl).length;w.t=cs.map(c=>c.c).join('');w.bold=cs.filter(c=>c.b).length*2>n;w.hl=h>0&&h*2>=n;w.ht=w.t;
      /* drop punctuation at either end of a highlighted word when that punctuation itself was not highlighted */
      if(w.hl){let i=0,j=n;const P=c=>!/[\p{L}\p{N}]/u.test(c.c);while(i<j&&P(cs[i])&&!cs[i].hl)i++;while(j>i&&P(cs[j-1])&&!cs[j-1].hl)j--;w.ht=cs.slice(i,j).map(c=>c.c).join('')||w.t}});
    return{size:l.size,words}}).filter(l=>l.words.length)}
const YEAR=/(^|\D)(\d{2}|(19|20)\d{2})(\D|$)|\bet al\b|\bn\.?d\.?(\W|$)/i;
function structure(lines){
  const allBold=l=>l.words.every(w=>w.bold)&&!l.words.some(w=>w.hl);
  const citeRun=(l,next)=>{let k=0;while(k<l.words.length&&l.words[k].bold&&!l.words[k].hl)k++;if(!k||k>8)return 0;const run=l.words.slice(0,k).map(w=>w.t).join(' ');
    if(!YEAR.test(run)||!/[A-Z]/.test(run))return 0;if(k<l.words.length)return k;
    return next&&next.words.length&&!next.words[0].bold?k:0};
  const cites=[];lines.forEach((l,i)=>{const k=citeRun(l,lines[i+1]);if(k)cites.push({i,k})});
  const cards=[],used=new Set(cites.map(c=>c.i));
  cites.forEach(c=>{const tag=[];let j=c.i-1;const ref=j>=0?lines[j].size:0;
    while(j>=0&&tag.length<4&&!used.has(j)&&allBold(lines[j])&&Math.abs(lines[j].size-ref)<=ref*.15){tag.unshift(j);used.add(j);j--}
    cards.push({start:tag.length?tag[0]:c.i,tag,cite:c})});
  const hlText=(a,b)=>{const out=[];for(let i=a;i<b;i++){if(used.has(i))continue;lines[i].words.forEach(w=>{if(w.hl)out.push(w.ht)})}return out.join(' ')};
  const blocks=[];const first=cards.length?cards[0].start:lines.length;const pre=hlText(0,first);if(pre)blocks.push({tag:'',name:'',body:pre});
  cards.forEach((c,n)=>{const end=n+1<cards.length?cards[n+1].start:lines.length;
    blocks.push({tag:c.tag.map(i=>lines[i].words.map(w=>w.t).join(' ')).join(' '),name:lines[c.cite.i].words.slice(0,c.cite.k).map(w=>w.t).join(' '),body:hlText(c.cite.i+1,end)})});
  return blocks}
let hoBlocks=[];
function hoHTML(forExport){const F=forExport?'font-family:'+FONTS[prefs.font]+';':'';return hoBlocks.map(b=>(b.tag?'<p class="ho-tag" style="'+F+'margin:0 0 2pt;font-size:13pt;font-weight:bold">'+esc(b.tag)+'</p>':'')+(b.name?'<p class="ho-cite" style="'+F+'margin:0 0 4pt;font-size:13pt;font-weight:bold">'+esc(b.name)+'</p>':'')+(b.body?'<p class="ho-body" style="'+F+'margin:0 0 16pt;font-size:11pt">'+esc(b.body)+'</p>':'')).join('')}
const hoText=()=>hoBlocks.map(b=>[b.tag,b.name,b.body].filter(Boolean).join('\n')).join('\n\n');
async function hoRun(file){if(!file)return;if(!/pdf$/i.test(file.type)&&!/\.pdf$/i.test(file.name)){hoSt('That file isn\'t a PDF.','err');return}
  $('#hoName').textContent=file.name;$('#hoOut').innerHTML='';hoBlocks=[];hoSt('Opening the PDF…');hoBar(0);
  let lib;try{lib=await loadPdfJs()}catch(e){hoBar(null);hoSt('Couldn\'t load the PDF reader. Check your connection and try again.','err');return}
  let doc;try{doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise}catch(e){hoBar(null);hoSt(/password/i.test(e&&e.name||'')?'That PDF is password protected.':'That PDF couldn\'t be opened.','err');return}
  const all=[];for(let p=1;p<=doc.numPages;p++){hoSt('Reading page '+p+' of '+doc.numPages+'…');const page=await doc.getPage(p);all.push(...await readPage(lib,page));page.cleanup();hoBar(p/doc.numPages)}
  doc.destroy();hoBar(null);
  if(!all.length){hoSt('No text found. A scanned or photographed PDF has no text inside it to read.','err');return}
  hoBlocks=structure(all).filter(b=>b.body||b.tag||b.name);const nh=hoBlocks.filter(b=>b.body).length;
  if(!all.some(l=>l.words.some(w=>w.hl))){hoSt('No highlighting found in this PDF.','err');$('#hoOut').innerHTML=hoHTML(false);return}
  $('#hoOut').innerHTML=hoHTML(false);const nc=hoBlocks.filter(b=>b.name).length;hoSt('Done. '+nc+' card'+(nc===1?'':'s')+' found.','ok');const p=$('#hoOut').closest('.paper');p.classList.remove('flash');void p.offsetWidth;p.classList.add('flash')}
$('#hoFile').addEventListener('change',e=>{hoRun(e.target.files[0]);e.target.value=''});
const hoDrop=$('#hoDrop');['dragenter','dragover'].forEach(ev=>hoDrop.addEventListener(ev,e=>{e.preventDefault();hoDrop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>hoDrop.addEventListener(ev,e=>{e.preventDefault();hoDrop.classList.remove('over')}));
hoDrop.addEventListener('drop',e=>hoRun(e.dataTransfer.files[0]));
$('#hoOut').style.fontFamily=FONTS[prefs.font];
$('#hoCopy').onclick=()=>{if(!hoBlocks.length)return toast('Upload a PDF first.');copyHTML('<div style="color:#000">'+hoHTML(true)+'</div>',hoText())};
$('#hoDoc').onclick=()=>{if(!hoBlocks.length)return toast('Upload a PDF first.');const html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>CAVDOME read copy</title></head><body>'+hoHTML(true)+'</body></html>';
  const nm=($('#hoName').textContent||'case').replace(/\.pdf$/i,'');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'application/msword'}));a.download=nm+' (read copy).doc';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};

/* ---------------- library ---------------- */
function saveCard(c){const lib=store.get('lib',[]);lib.unshift(Object.assign({id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),saved:new Date().toISOString()},c));store.set('lib',lib);toast('Saved to your library')}
function renderLib(){const q=($('#libQ').value||'').toLowerCase(),lib=store.get('lib',[]),g=$('#libGrid');
  const list=lib.filter(c=>!q||(c.tag+' '+JSON.stringify(c.cite)+' '+c.html.replace(/<[^>]+>/g,' ')).toLowerCase().includes(q));
  if(!lib.length){g.innerHTML='<div class="empty" style="grid-column:1/-1">'+I('<path d="M4 5h4v15H4zM10 5h4v15h-4zM16 6l3.5-1 3 14-3.5 1z"/>')+'<p>No saved cards yet. Save cards from Card Cut and they collect here.</p><a class="btn sm" href="#cut">Cut a card</a></div>';return}
  g.innerHTML=list.map(c=>'<article class="lcard glass" data-id="'+c.id+'"><b>'+esc(c.tag||'Untitled card')+'</b><span class="cs">'+esc(citeShort(c.cite||{}))+'</span><div class="pv">'+esc(c.html.replace(/<[^>]+>/g,' ').trim())+'</div><div class="row"><button class="btn xs" data-act="open" type="button">Edit</button><button class="btn xs ghost" data-act="copy" type="button">Copy</button><button class="btn xs ghost" data-act="del" type="button">Delete</button></div></article>').join('')||'<div class="empty" style="grid-column:1/-1">No cards match that filter.</div>'}
$('#libQ').addEventListener('input',renderLib);
$('#libGrid').addEventListener('click',e=>{const b=e.target.closest('[data-act]'),a=e.target.closest('.lcard');if(!a)return;const lib=store.get('lib',[]),c=lib.find(x=>x.id===a.dataset.id);if(!c)return;const act=b?b.dataset.act:'open';
  if(act==='copy')copyHTML(exportHTML(c),c.tag);else if(act==='del'){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Sure?';setTimeout(()=>{b.dataset.armed='';b.textContent='Delete'},2500);return}store.set('lib',lib.filter(x=>x.id!==c.id));renderLib()}
  else{location.hash='cut';setTimeout(()=>loadEditor(c),250)}});
$('#libDoc').onclick=()=>{const lib=store.get('lib',[]);if(!lib.length)return toast('Save some cards first.');
  const html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>CAVDOME speech doc</title></head><body>'+lib.map(exportHTML).join('<p>&nbsp;</p>')+'</body></html>';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'application/msword'}));a.download='cavdome-speech-doc-'+new Date().toISOString().slice(0,10)+'.doc';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};

/* ---------------- flow ---------------- */
const FLOWCOLS={policy:['1AC','1NC','2AC','Block','1AR','2NR','2AR'],ld:['AC','NC','1AR','NR','2AR'],pf:['A Constructive','B Constructive','A Rebuttal','B Rebuttal','A Summary','B Summary','A Final Focus','B Final Focus']};
let flow=store.get('flow',{fmt:'policy',sheets:[{name:'Case',cols:{}}],cur:0});
function saveFlow(){store.set('flow',flow)}
function renderFlow(){$('#flowFmt').value=flow.fmt;const sh=flow.sheets[flow.cur]||flow.sheets[0];
  $('#sheets').innerHTML=flow.sheets.map((s,i)=>'<button class="sheet-tab" role="tab" aria-selected="'+(i===flow.cur)+'" data-i="'+i+'" type="button">'+esc(s.name)+'</button>').join('');
  $('#flowgrid').innerHTML=FLOWCOLS[flow.fmt].map((c,i)=>{const side=flow.fmt==='pf'?(c.startsWith('A')?'aff':'neg'):(i%2===0?'aff':'neg');return'<div class="fcol '+side+'"><h4>'+esc(c)+'<span>'+(side==='aff'?(flow.fmt==='pf'?'A':'Aff'):(flow.fmt==='pf'?'B':'Neg'))+'</span></h4><div class="fbody" contenteditable="true" data-col="'+esc(c)+'" spellcheck="false">'+esc(sh.cols[c]||'')+'</div></div>'}).join('')}
$('#flowgrid').addEventListener('input',e=>{const b=e.target.closest('.fbody');if(!b)return;flow.sheets[flow.cur].cols[b.dataset.col]=b.innerText;saveFlow()});
$('#sheets').addEventListener('click',e=>{const b=e.target.closest('.sheet-tab');if(!b)return;flow.cur=+b.dataset.i;saveFlow();renderFlow()});
$('#sheets').addEventListener('dblclick',e=>{const b=e.target.closest('.sheet-tab');if(!b)return;b.contentEditable='true';b.focus();b.onblur=()=>{b.contentEditable='false';flow.sheets[+b.dataset.i].name=b.innerText.trim()||'Sheet';saveFlow()}});
$('#addSheet').onclick=()=>{flow.sheets.push({name:'Sheet '+(flow.sheets.length+1),cols:{}});flow.cur=flow.sheets.length-1;saveFlow();renderFlow();toast('Double-click a sheet name to rename it')};
$('#clearFlow').onclick=e=>{const b=e.currentTarget;if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Sure?';setTimeout(()=>{b.dataset.armed='';b.textContent='Clear sheet'},2500);return}flow.sheets[flow.cur].cols={};saveFlow();renderFlow()};
$('#copyFlow').onclick=()=>{const sh=flow.sheets[flow.cur];const t=FLOWCOLS[flow.fmt].map(c=>c.toUpperCase()+'\n'+(sh.cols[c]||'')).join('\n\n');navigator.clipboard?navigator.clipboard.writeText(t).then(()=>toast('Flow copied'),()=>toast('Copy blocked')):toast('Copy blocked')};
$('#flowFmt').onchange=e=>{flow.fmt=e.target.value;saveFlow();renderFlow()};
renderFlow();

/* ---------------- timers ---------------- */
const FMT={policy:{prep:480,sp:[['1AC',480],['CX',180],['1NC',480],['CX',180],['2AC',480],['CX',180],['2NC',480],['CX',180],['1NR',300],['1AR',300],['2NR',300],['2AR',300]]},
  ld:{prep:240,sp:[['AC',360],['CX',180],['NC',420],['CX',180],['1AR',240],['NR',360],['2AR',180]]},
  pf:{prep:180,sp:[['Constructive A',240],['Constructive B',240],['Crossfire',180],['Rebuttal A',240],['Rebuttal B',240],['Crossfire',180],['Summary A',180],['Summary B',180],['Grand Crossfire',180],['Final Focus A',120],['Final Focus B',120]]}};
const fmtT=s=>{const n=s<0,a=Math.abs(Math.round(s));return(n?'+':'')+Math.floor(a/60)+':'+String(a%60).padStart(2,'0')};
let T={fmt:'policy',i:0,total:480,left:480,run:false,last:0},prep={A:480,N:480,run:null};const CIRC=527.8;let actx;
function beep(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;g.gain.setValueAtTime(.0001,actx.currentTime);g.gain.exponentialRampToValueAtTime(.25,actx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.6);o.connect(g).connect(actx.destination);o.start();o.stop(actx.currentTime+.65)}catch(e){}}
function drawT(){$('#tRead').textContent=fmtT(T.left);$('#tName').textContent=FMT[T.fmt].sp[T.i][0];$('#dialBar').style.strokeDashoffset=CIRC*(1-Math.max(0,T.left)/T.total);
  const d=$('#dial');d.classList.toggle('warn',T.left<=30&&T.left>0);d.classList.toggle('over',T.left<=0);$('#tGo').textContent=T.run?'Pause':'Start';
  $('#prepA b').textContent=fmtT(prep.A);$('#prepN b').textContent=fmtT(prep.N);$('#prepA').classList.toggle('run',prep.run==='A');$('#prepN').classList.toggle('run',prep.run==='N')}
function setFmt(f){T.fmt=f;T.i=0;T.total=T.left=FMT[f].sp[0][1];T.run=false;prep={A:FMT[f].prep,N:FMT[f].prep,run:null};
  $('#speeches').innerHTML=FMT[f].sp.map((s,i)=>'<button class="sp" type="button" data-i="'+i+'" aria-pressed="'+(i===0)+'">'+esc(s[0])+'<small>'+fmtT(s[1])+'</small></button>').join('');drawT()}
$('#tFmt').onchange=e=>setFmt(e.target.value);
$('#speeches').addEventListener('click',e=>{const b=e.target.closest('.sp');if(!b)return;T.i=+b.dataset.i;T.total=T.left=FMT[T.fmt].sp[T.i][1];T.run=false;$$('.sp').forEach(x=>x.setAttribute('aria-pressed',x===b));drawT()});
$('#tGo').onclick=()=>{T.run=!T.run;T.last=performance.now();drawT()};$('#tReset').onclick=()=>{T.run=false;T.left=T.total;drawT()};
$('#tPlus').onclick=()=>{T.left+=10;drawT()};$('#tMinus').onclick=()=>{T.left=Math.max(0,T.left-10);drawT()};
$('#prepA').onclick=()=>{prep.run=prep.run==='A'?null:'A';T.last=performance.now();drawT()};$('#prepN').onclick=()=>{prep.run=prep.run==='N'?null:'N';T.last=performance.now();drawT()};
setInterval(()=>{const now=performance.now(),dt=(now-(T.last||now))/1000;T.last=now;let ch=false;
  if(T.run){const was=T.left;T.left-=dt;if(was>0&&T.left<=0)beep();ch=true}
  if(prep.run){const k=prep.run;prep[k]=Math.max(0,prep[k]-dt);if(prep[k]===0){prep.run=null;beep()}ch=true}if(ch)drawT()},200);
setFmt('policy');

/* ---------------- break calculator ---------------- */
function binom(n,k){let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r}
function breakCalc(){const N=Math.max(2,+$('#bcN').value||0),R=Math.min(12,Math.max(1,+$('#bcR').value||1)),B=+$('#bcB').value;let cum=0,rows=[],mx=0;
  for(let w=R;w>=0;w--){const c=N*binom(R,w)/Math.pow(2,R);mx=Math.max(mx,c);const before=cum;cum+=c;let s,lab;
    if(cum<=B+.0001){s='ok';lab='clears'}else if(before<B){s='bub';lab=Math.round(B-before)+' of '+Math.round(c)+' break'}else{s='out';lab='out'}rows.push({w,l:R-w,c,s,lab})}
  $('#bcBars').innerHTML=rows.map(r=>'<div class="brow"><span class="rec">'+r.w+'-'+r.l+'</span><div class="trk"><div class="fill '+r.s+'" style="width:'+Math.max(4,r.c/mx*100)+'%">'+r.c.toFixed(1)+'</div></div><span class="lab">'+r.lab+'</span></div>').join('')}
['bcN','bcR','bcB'].forEach(i=>$('#'+i).addEventListener('input',breakCalc));breakCalc();

/* ---------------- boot ---------------- */
applyRoute();FX.tilt();FX.stage();FX.viz();FX.reveal();
})();
