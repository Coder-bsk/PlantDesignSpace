const CFG={
 email:'plantdesignspace@gmail.com',
 rzpKey:'rzp_test_REPLACE_ME',            // Razorpay Key ID (never put the secret here)
 ejs:{service:'service_w3tneud',template:'template_ccoc7fm',user:'meL4y0r-PWk77LDW1'}     // EmailJS ids; leave blank to fall back to mailto
};
const TOOLS=typeof SITE!=='undefined'?SITE.tools:[];
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const PROMOS={NEW10:10,REF10:10};
const $=(s,r=document)=>r.querySelector(s),inr=n=>'₹'+n.toLocaleString('en-IN');
const cart={get(){try{return JSON.parse(localStorage.getItem('pds')||'{}')}catch(e){return{}}},
 set(c){try{localStorage.setItem('pds',JSON.stringify(c))}catch(e){}count()}};
function count(){const n=Object.keys(cart.get()).length,e=$('#cn'),h=$('#hc'),b=$('#cn2');if(e)e.textContent=n;if(b)b.textContent=n;if(h)h.hidden=!n}
async function send(p){ // acknowledgment to viewer + notification to us
 const e=CFG.ejs;
 if(!e.service){location.href='mailto:'+CFG.email+'?subject='+encodeURIComponent(p.subject)+'&body='+encodeURIComponent(p.message+'\n\n'+p.name+' <'+p.email+'>');return 'mailto'}
 const post=to=>fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({service_id:e.service,template_id:e.template,user_id:e.user,template_params:{...p,to_email:to}})}).then(r=>{if(!r.ok)throw 0});
 await post(CFG.email);await post(p.email);return 'sent'}
const S=typeof SITE!=='undefined'?SITE:{tools:[],services:[],training:[]},R=window.ROOT||'',P=location.pathname,sec=(P.match(/\/(tools|services|training)\//)||[])[1]||(/checkout/.test(P)?'checkout':/contact/.test(P)?'contact':'home');
const A=(h,t,k)=>`<a href="${R}${h}" class="${sec==k?'on':''}">${t}</a>`;
const DD=(k,t,l)=>l.length?`<div class="dd"><a href="${R}${k}/index.html" class="${sec==k?'on':''}">${t} ▾</a><div>${l.map(c=>`<a href="${R}${c.url}">${c.name}</a>`).join('')}<a href="${R}${k}/index.html"><b>View all</b></a></div></div>`:'';
$('#hd').outerHTML=`<header><div class="wrap"><a class="logo" href="${R}index.html"><img src="${R}logo.svg" alt="" width="38" height="38"><span>Plant <i>design</i> Space</span></a><nav>${A('index.html','Home','home')}${DD('services','Consulting',S.services)}${DD('training','Training',S.training)}${S.tools.length?A('tools/index.html','Tools','tools')+A('checkout.html','Cart<span class="cartn" id="cn">0</span>','checkout'):''}<a class="btn sm" href="${R}contact.html">Send an enquiry</a></nav>${S.tools.length?`<a class="hcart" id="hc" href="${R}checkout.html" aria-label="Cart" hidden>🛒<b id="cn2">0</b></a>`:''}<button id="tg" aria-label="Toggle night mode"></button><button id="mb" aria-label="Menu" aria-expanded="false">☰</button></div></header>`;
$('#mb').onclick=()=>{const o=$('header nav').classList.toggle('open');$('#mb').setAttribute('aria-expanded',o);$('#mb').textContent=o?'✕':'☰'};
const setTh=t=>{document.documentElement.dataset.theme=t;try{localStorage.setItem('pds-theme',t)}catch(e){}const g=$('#tg');g.textContent=t=='dark'?'☀️':'🌙';g.setAttribute('aria-label',t=='dark'?'Switch to day mode':'Switch to night mode')};
$('#tg').onclick=()=>setTh(document.documentElement.dataset.theme=='dark'?'light':'dark');
{const g=$('#tg'),d=document.documentElement.dataset.theme=='dark';g.textContent=d?'☀️':'🌙';g.setAttribute('aria-label',d?'Switch to day mode':'Switch to night mode')}
const SV=[['training','Training'],['services','Consulting'],['tools','Tools']].filter(([k])=>S[k].length).map(([k,t])=>`<a href="${R}${k}/index.html">${t}</a>`).join('');
$('#ft').outerHTML=`<footer><div class="wrap"><div><div class="logo" style="color:#fff;margin-bottom:12px"><img src="${R}logo.svg" alt="" width="38" height="38"><span>Plant <i>design</i> Space</span></div><p>Consulting, Aveva training and automation tools for plant design teams.</p></div>${SV?`<div><h3>Services</h3>${SV}</div>`:''}<div><h3>Get in touch</h3><a href="mailto:${CFG.email}">${CFG.email}</a><a href="${R}contact.html">Enquiry</a></div><small>© ${new Date().getFullYear()} Plant design Space. Aveva is a trademark of its owner; we are independent.</small></div></footer>`;
document.body.insertAdjacentHTML('beforeend',`<button class="btn y" id="rq">Request a new tool</button>
<div id="md" role="dialog" aria-modal="true" aria-label="Request a new tool"><div class="panel"><h3>Request a new tool</h3><p>Tell us the task you repeat most. We'll reply with a scope and price.</p>
<form id="rf"><label class="f">Your name<input name="name" required></label><label class="f">Email<input name="email" type="email" required></label>
<label class="f">Aveva product<select name="product"><option>Aveva E3D</option><option>Aveva Unified Engineering</option><option>Aveva Admin</option><option>Aveva Diagrams</option><option>Other</option></select></label>
<label class="f">What should the tool do?<textarea name="message" rows="4" required></textarea></label>
<button class="btn">Send request</button> <button type="button" class="x" id="mc">Close</button><div class="msg" id="rm" role="status"></div></form></div></div>`);
$('#rq').onclick=()=>{$('#md').classList.add('open');$('#rf input').focus()};
$('#mc').onclick=()=>$('#md').classList.remove('open');
document.addEventListener('keydown',e=>{if(e.key=='Escape')$('#md').classList.remove('open')});
$('#rf').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),m=$('#rm');
 try{m.className='msg';m.textContent='Sending…';await send({name:f.name,email:f.email,subject:'New tool request: '+f.product,message:f.message});
 m.className='msg ok';m.textContent='Thanks. A confirmation is on its way to '+f.email+'.';e.target.reset()}catch(x){m.className='msg er';m.textContent='Could not send. Email us at '+CFG.email}};
count();
