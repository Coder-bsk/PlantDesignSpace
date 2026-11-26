const CFG={
 email:'plantdesignspace@gmail.com',
 youtube:'https://www.youtube.com/',      // put your YouTube channel link here
 linkedin:'https://www.linkedin.com/',    // put your LinkedIn page link here
 whatsapp:'917401721841',                // WhatsApp number, country code first, digits only
 demo:'IdnGaT8-wOY',                      // default demo video (YouTube ID) shown on every tool page
 gform:{url:'',name:'',email:'',phone:'',topic:'',message:''}, // Google Form for enquiries (see README)
 api:''                                  // URL of the Python mailer, e.g. 'https://mail.example.com/api/send' (see mailer/README.txt)
};
const TOOLS=typeof SITE!=='undefined'?SITE.tools:[];
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const $=(s,r=document)=>r.querySelector(s),inr=n=>'₹'+n.toLocaleString('en-IN');
const cart={get(){try{return JSON.parse(localStorage.getItem('pds')||'{}')}catch(e){return{}}},
 set(c){try{localStorage.setItem('pds',JSON.stringify(c))}catch(e){}count()}};
function count(){const n=Object.keys(cart.get()).length,e=$('#cn'),h=$('#hc'),b=$('#cn2');if(e)e.textContent=n;if(b)b.textContent=n;if(h)h.hidden=!n}
async function send(p,kind){ // posts to the Python mailer (notice to us + acknowledgement to the customer); falls back to the visitor's email app
 if(!CFG.api){location.href='mailto:'+CFG.email+'?subject='+encodeURIComponent(p.subject)+'&body='+encodeURIComponent(p.message+(p.phone?'\nPhone: '+p.phone:'')+'\n\n'+p.name+' <'+p.email+'>');return 'mailto'}
 const r=await fetch(CFG.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:kind||'enquiry',name:p.name,email:p.email,phone:p.phone||'',topic:p.subject,message:p.message,website:''})});
 if(!r.ok){let m='';try{m=(await r.json()).error}catch(e){}throw new Error(m||'Could not send. Email us at '+CFG.email)}return 'sent'}
const phoneOk=v=>/^\+[1-9]\d{7,14}$/.test(String(v).replace(/[\s().-]/g,''));
async function enquire(p){ // enquiries are saved in the Google Form; the mailer sends the acknowledgement
 if(!phoneOk(p.phone))throw new Error('Enter your phone number with the country code, for example +91 98765 43210.');
 const g=CFG.gform,m={name:p.name,email:p.email,phone:p.phone,subject:'Enquiry: '+p.topic,message:p.message};
 if(!g.url){await send(m,'enquiry');return}
 const b=new URLSearchParams();for(const k of['name','email','phone','topic','message'])if(g[k])b.append(g[k],p[k]||'');
 await fetch(g.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b});
 if(CFG.api)try{await send(m,'enquiry')}catch(x){}}
const S=typeof SITE!=='undefined'?SITE:{tools:[],services:[],training:[]},R=window.ROOT||'',P=location.pathname,sec=(P.match(/\/(tools|services|training)\//)||[])[1]||(/checkout/.test(P)?'checkout':/contact/.test(P)?'contact':'home');
const A=(h,t,k)=>`<a href="${R}${h}" class="${sec==k?'on':''}">${t}</a>`;
const DD=(k,t,l)=>l.length?`<div class="dd"><a href="${R}${k}/index.html" class="${sec==k?'on':''}">${t} ▾</a><div>${l.map(c=>`<a href="${R}${c.url}">${c.name}</a>`).join('')}<a href="${R}${k}/index.html"><b>View all</b></a></div></div>`:'';
$('#hd').outerHTML=`<header><div class="wrap"><a class="logo" href="${R}index.html"><img src="${R}logo.svg" alt="" width="38" height="38"><span>Plant <i>design</i> Space</span></a><nav>${A('index.html','Home','home')}${DD('services','Consulting',S.services)}${DD('training','Training',S.training)}${S.tools.length?A('tools/index.html','Tools','tools')+A('checkout.html','Cart<span class="cartn" id="cn">0</span>','checkout'):''}<a class="btn sm" href="${R}contact.html">Send an enquiry</a></nav>${S.tools.length?`<a class="hcart" id="hc" href="${R}checkout.html" aria-label="Cart" hidden>🛒<b id="cn2">0</b></a>`:''}<button id="tg" aria-label="Toggle night mode"></button><button id="mb" aria-label="Menu" aria-expanded="false">☰</button></div></header>`;
$('#mb').onclick=()=>{const o=$('header nav').classList.toggle('open');$('#mb').setAttribute('aria-expanded',o);$('#mb').textContent=o?'✕':'☰'};
const setTh=t=>{document.documentElement.dataset.theme=t;try{localStorage.setItem('pds-theme',t)}catch(e){}const g=$('#tg');g.textContent=t=='dark'?'☀️':'🌙';g.setAttribute('aria-label',t=='dark'?'Switch to day mode':'Switch to night mode')};
$('#tg').onclick=()=>setTh(document.documentElement.dataset.theme=='dark'?'light':'dark');
{const g=$('#tg'),d=document.documentElement.dataset.theme=='dark';g.textContent=d?'☀️':'🌙';g.setAttribute('aria-label',d?'Switch to day mode':'Switch to night mode')}
const SV=[['training','Training'],['services','Consulting'],['tools','Tools']].filter(([k])=>S[k].length).map(([k,t])=>`<a href="${R}${k}/index.html">${t}</a>`).join('');
$('#ft').outerHTML=`<footer><div class="wrap"><div><div class="logo" style="color:#fff;margin-bottom:12px"><img src="${R}logo.svg" alt="" width="38" height="38"><span>Plant <i>design</i> Space</span></div><p>Project support, Aveva software support, training and digital solutions for plant design teams.</p><div class="soc"><a href="${CFG.youtube}" target="_blank" rel="noopener" aria-label="YouTube" title="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.27 5 12 5 12 5s-6.27 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.78 2 12 2 12s0 3.22.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.73 19 12 19 12 19s6.27 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.22 22 12 22 12s0-3.22-.4-4.8z"/><path fill="#f00" d="M10 15V9l5.2 3z"/></svg></a><a href="${CFG.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn" title="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0a66c2"/><path fill="#fff" d="M6.9 9.6h2.6V18H6.9zM8.2 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11 9.6h2.5v1.2h.04c.35-.66 1.2-1.36 2.47-1.36 2.64 0 3.13 1.74 3.13 4V18h-2.6v-3.9c0-.93-.02-2.13-1.3-2.13-1.3 0-1.5 1-1.5 2.06V18H11z"/></svg></a></div><a class="wa" href="https://wa.me/${CFG.whatsapp}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15l-.3-.18-3.1.82.83-3.02-.2-.31A8.1 8.1 0 0 1 12.04 3.8zm-3.1 4.1c-.2 0-.5.07-.76.35-.26.28-1 1-1 2.4s1.03 2.8 1.17 3c.14.2 2 3.2 4.95 4.35 2.45.97 2.95.78 3.48.73.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.2-.55-.34-.28-.15-1.7-.84-1.96-.93-.26-.1-.45-.14-.64.14-.19.29-.74.93-.9 1.12-.17.2-.33.22-.62.07-.29-.14-1.2-.44-2.3-1.42-.85-.76-1.42-1.7-1.6-1.98-.16-.29-.02-.44.12-.58.13-.13.29-.34.43-.5.14-.17.19-.29.29-.48.1-.2.05-.36-.02-.5-.07-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49z"/></svg>Chat on WhatsApp</a></div>${SV?`<div><h3>Services</h3>${SV}</div>`:''}<div class="fc"><h3>Contact</h3><p><b>Location:</b> No 60A, Sivapatham 3rd street, KK Thazhai, MMC, TamilNadu, Chennai-600051.</p><p><b>Call:</b> <a href="tel:+917401721841">+91 7401721841</a></p><p><b>Email:</b> <a href="mailto:${CFG.email}">${CFG.email}</a></p><p>Mon–Fri, 08:00–17:30 IST</p></div><small>© ${new Date().getFullYear()} Plant design Space. Aveva is a trademark of its owner; we are independent.</small></div></footer>`;
document.body.insertAdjacentHTML('beforeend',`<div id="md" role="dialog" aria-modal="true" aria-label="Request a new tool"><div class="panel"><h3>Request a new tool</h3><p>Tell us the task you repeat most. We'll reply with a scope and price.</p>
<form id="rf"><label class="f">Your name<input name="name" required></label><label class="f">Email<input name="email" type="email" required></label>
<label class="f">Phone with country code<input name="phone" type="tel" required placeholder="+91 98765 43210" autocomplete="tel" pattern="\+[0-9][0-9 \-]{7,20}" title="Start with + and the country code, for example +91 98765 43210"></label>
<label class="f">Aveva product<select name="product"><option>Aveva E3D</option><option>Aveva Unified Engineering</option><option>Aveva Admin</option><option>Aveva Diagrams</option><option>Other</option></select></label>
<label class="f">What should the tool do?<textarea name="message" rows="4" required></textarea></label>
<button class="btn">Send request</button> <button type="button" class="x" id="mc">Close</button><div class="msg" id="rm" role="status"></div></form></div></div>`);
document.addEventListener('click',e=>{if(e.target.closest('[data-rq]')){e.preventDefault();$('#md').classList.add('open');$('#rf input').focus()}});
$('#mc').onclick=()=>$('#md').classList.remove('open');
document.addEventListener('keydown',e=>{if(e.key=='Escape')$('#md').classList.remove('open')});
$('#rf').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),m=$('#rm');
 try{m.className='msg';m.textContent='Sending…';await enquire({...f,topic:'New tool request: '+f.product});
 m.className='msg ok';m.textContent='Thanks '+f.name+'. We will reply by email.';e.target.reset()}catch(x){m.className='msg er';m.textContent=x.message||('Could not send. Email us at '+CFG.email)}};
count();
