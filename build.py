#!/usr/bin/env python3
"""Plant design Space site builder (no dependencies).

Run:  python build.py
It scans tools/, services/ and training/ for page files (every *.html except index.html),
reads the <script id="pds-meta"> block in each, then regenerates:
  site-data.js (menus, cart prices), index.html (main page),
  tools/index.html, services/index.html, training/index.html.
A section with no pages is left out of the main page, menu and footer.
"""
import glob, html, json, os, re, sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
SECTIONS = ['training', 'services', 'tools']
BTN = {'training': 'View courses', 'services': 'Explore consulting', 'tools': 'Browse tools'}
e = html.escape
BOOT = '<script>try{var t=localStorage.getItem("pds-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}catch(e){}</script>'


def head(title, desc, root):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="{root}logo.svg" type="image/svg+xml">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{e(title)} | Plant design Space</title>'
            f'<meta name="description" content="{e(desc)}">\n<link rel="preconnect" href="https://fonts.googleapis.com">'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">'
            f'<link rel="stylesheet" href="{root}style.css">' + BOOT + '</head><body><div id="hd"></div>\n')


def foot(root):
    return (f'<div id="ft"></div>\n<script>var ROOT="{root}"</script><script src="{root}site-data.js"></script>'
            f'<script src="{root}app.js"></script>\n')


def read_meta(path):
    m = re.search(r'<script type="application/json" id="pds-meta">(.*?)</script>', open(path, encoding='utf-8').read(), re.S)
    return json.loads(m.group(1)) if m else None


def scan():
    site = {}
    for s in SECTIONS:
        items = []
        for f in glob.glob(os.path.join(HERE, s, '*.html')):
            n = os.path.basename(f)
            if n == 'index.html':
                continue
            m = read_meta(f)
            if not m:
                print('  skipped (no pds-meta block):', s + '/' + n)
                continue
            m['url'] = f'{s}/{n}'
            m.setdefault('order', 99)
            m.setdefault('summary', '')
            m.setdefault('topic', m['name'])
            items.append(m)
        site[s] = sorted(items, key=lambda x: (x['order'], x['name']))
    return site


def write(rel, text):
    p = os.path.join(HERE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text)


def part(n):
    return open(os.path.join(HERE, '_parts', n), encoding='utf-8').read()


def rows(items, strip):
    out = ''
    for m in items:
        link = os.path.basename(m['url']) if strip else m['url']
        enq = ('../' if strip else '') + 'contact.html?topic=' + quote(m['topic'], safe='')
        out += (f'<div class="r"><h3>{e(m["name"])}</h3><p>{e(m["summary"])}</p>'
                f'<div class="row2"><a class="btn sm" href="{link}">Details</a><a class="btn sm alt" href="{enq}">Enquire</a></div></div>')
    return out


def thumb(m, root):
    i = m.get('img')
    inner = f'<img src="{root}{i}" alt="{e(m["name"])} preview" loading="lazy">' if i else '<span>GIF preview<br>coming soon</span>'
    return f'<div class="thumb">{inner}</div>'


def section_index(sec, items, title, lead, desc):
    return (head(title, desc, '../') + f'<section class="pg"><div class="wrap"><h1>{e(title)}</h1><p class="lead">{e(lead)}</p>'
            f'<div class="rows" style="margin-top:28px">{rows(items, True)}</div></div></section>\n' + foot('../'))


def tools_index(items):
    return (head('Automation tools', 'PML and add-in automation tools for Aveva E3D, Admin and Unified Engineering.', '../') +
            '<section class="pg"><div class="wrap"><h1>Automation tools</h1><p class="lead">Pick a plan for each tool. Each tool can be added to your cart once.</p>\n'
            '<div class="bar"><label for="pf">Product</label><select id="pf"></select><a class="btn y sm" href="../checkout.html">Go to cart</a></div><div class="grid" id="grid"></div></div></section>\n'
            + foot('../') + '''<script>
const pf=$('#pf');['All',...new Set(TOOLS.map(t=>t.product))].forEach(p=>pf.add(new Option(p,p)));
const thumb=t=>`<div class="thumb">${t.img?`<img src="${ROOT+t.img}" alt="${t.name} preview" loading="lazy">`:'<span>GIF preview<br>coming soon</span>'}</div>`;
function draw(){const c=cart.get();$('#grid').innerHTML=TOOLS.filter(t=>pf.value=='All'||t.product==pf.value).map(t=>{const k=t.name,sel=c[k]||'Annual';return `<article class="tool ${c[k]?'in':''}" data-k="${k}">${thumb(t)}<h3><a href="${ROOT+t.url}" style="color:inherit;text-decoration:none">${k}</a></h3><small>${t.product} · ${t.module} · ${t.cat} · v${t.ver}</small>
<label class="f" style="margin:0">Plan<select class="pl">${Object.entries(t.price).map(([p,v])=>`<option value="${p}" ${p==sel?'selected':''}>${p} · ${inr(v)}</option>`).join('')}</select></label>
<div style="display:flex;gap:8px;margin-top:auto"><a class="btn sm alt" href="${ROOT+t.url}">Details</a><button class="btn sm ${c[k]?'alt':''}" style="margin:0">${c[k]?'Remove from cart':'Add to cart'}</button></div></article>`}).join('')}
pf.onchange=draw;
$('#grid').onclick=e=>{const b=e.target.closest('button');if(!b)return;const a=b.closest('.tool'),k=a.dataset.k,c=cart.get();if(c[k])delete c[k];else c[k]=a.querySelector('select').value;cart.set(c);draw()};
$('#grid').onchange=e=>{const a=e.target.closest('.tool'),k=a.dataset.k,c=cart.get();if(c[k]){c[k]=e.target.value;cart.set(c)}};
draw();
</script></body></html>
''')


def main_page(site):
    avail = [s for s in SECTIONS if site[s]]
    btns = ''
    if avail:
        btns = f'<a class="btn" href="{avail[0]}/index.html">{BTN[avail[0]]}</a>'
    btns += '<a class="btn alt" href="#enquiry">Send an enquiry</a>'
    about_btn = f'<a class="btn alt" href="{avail[0]}/index.html">{BTN[avail[0]]}</a>' if avail else ''
    stats = ''
    for s, lab in (('training', 'Training courses'), ('services', 'Consulting services'), ('tools', 'Automation tools')):
        if site[s]:
            stats += f'<div><b>{len(site[s])}</b>{lab}</div>'
    if site['tools']:
        stats += '<div><b>3</b>Ways to buy a tool</div>'
    out = head('Aveva consulting and training', 'Consulting, Aveva training and PML automation tools for plant design teams.', '')
    out += part('hero.html').replace('{{HERO_BTNS}}', btns)
    if stats:
        out += f'<section><div class="wrap"><div class="stats">{stats}</div></div></section>\n'
    out += part('about.html').replace('{{ABOUT_BTN}}', about_btn)
    spec = {
        'training': ('Training', 'Courses taught by working designers', 'Course dates and fees are shared on enquiry.', 'All training courses'),
        'services': ('Consulting', 'Consulting that plugs into your team', 'Experienced engineers who deliver in your project standards.', 'All consulting services'),
        'tools': ('Tools', 'Our latest tools', '', 'Explore all tools'),
    }
    n = 0
    for s in avail:
        kick, h2, lead, more = spec[s]
        cards = ''
        for m in site[s][:3] if s == 'tools' else site[s]:
            if s == 'tools':
                cards += (f'<a class="card" href="{m["url"]}">{thumb(m, "")}<h3>{e(m["name"])}</h3><small class="mut">{e(m["product"])} · {e(m["module"])} · {e(m["cat"])}</small>'
                          '<span class="go">View tool →</span></a>')
            else:
                cards += (f'<a class="card" href="{m["url"]}"><h3>{e(m["name"])}</h3><p>{e(m["summary"])}</p><span class="go">Learn more →</span></a>')
        cls = ' class="alt"' if n % 2 else ''
        lead_html = '<p class="mut">' + lead + '</p>' if lead else ''
        out += (f'<section{cls}><div class="wrap"><span class="kick">{kick}</span><h2>{h2}</h2>{lead_html}'
                f'<div class="cards" style="margin-top:24px">{cards}</div><p style="margin-top:24px"><a class="btn" href="{s}/index.html">{more}</a></p></div></section>\n')
        n += 1
    out += part('cta.html') + '<div id="ft"></div>\n<script>var ROOT=""</script><script src="site-data.js"></script><script src="app.js"></script>\n'
    out += '<script>\n' + part('main.js') + '\n</script></body></html>\n'
    return out


def build():
    site = scan()
    data = {s: [{k: v for k, v in m.items()} for m in site[s]] for s in SECTIONS}
    write('site-data.js', 'const SITE=' + json.dumps(data, ensure_ascii=False) + ';\n')
    write('index.html', main_page(site))
    pages = {
        'training': ('Training', 'Taught by working designers. Course dates and fees are shared on enquiry.', 'Aveva E3D, Admin, PML, Diagrams, Engineering and Unified Engineering training.'),
        'services': ('Consulting', 'Experienced engineers who plug into your project team and deliver in your standards.', 'Oil and gas engineering, Aveva E3D, digital twin and manpower consulting.'),
    }
    for s in SECTIONS:
        idx = os.path.join(HERE, s, 'index.html')
        if not site[s]:
            if os.path.exists(idx):
                os.remove(idx)
            continue
        write(f'{s}/index.html', tools_index(site[s]) if s == 'tools' else section_index(s, site[s], *pages[s][:2], pages[s][2]))
    print('Built:', ', '.join(f'{len(site[s])} {s}' for s in SECTIONS))


if __name__ == '__main__':
    build()
