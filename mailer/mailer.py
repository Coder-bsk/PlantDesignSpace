"""Plant design Space mailer.

Receives enquiries and cart requests from the website, then from OUR Gmail account:
  one email, To the customer, Cc us: "We received your tool request | Plant design Space".

Run (dev):   python mailer.py
Run (Windows, live):  waitress-serve --port=8000 mailer:app
Run (Linux, live):    gunicorn -w 2 -b 0.0.0.0:8000 mailer:app
Test:        python mailer.py --test customer@example.com
"""
import html
import logging
import os
import re
import smtplib
import ssl
import sys
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from email.utils import formataddr

from flask import Flask, jsonify, request


def load_env(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')):
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))


load_env()
GMAIL_USER = os.environ.get('GMAIL_USER', '')
APP_PW = os.environ.get('GMAIL_APP_PASSWORD', '').replace(' ', '')
NOTIFY_TO = os.environ.get('NOTIFY_TO', GMAIL_USER)
FROM_NAME = os.environ.get('FROM_NAME', 'Plant design Space')
ORIGINS = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '*').split(',') if o.strip()]
LIMIT = int(os.environ.get('RATE_LIMIT', '5'))
WINDOW = int(os.environ.get('RATE_WINDOW_SECONDS', '600'))
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
HOURS = 'Mon-Fri, 08:00-17:30 IST'
TAGLINE = 'Aveva consulting, training and digital solutions'
WEBSITE = os.environ.get('WEBSITE', '')
LOGO = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logo.png'), 'rb').read()

KINDS = {'enquiry': 'your enquiry', 'cart': 'your tool request'}
EMAIL_RE = re.compile(r'^[^@\s<>,;]{1,64}@[^@\s<>,;]{1,190}\.[^@\s<>,;]{2,}$')
PHONE_RE = re.compile(r'^\+[1-9]\d{7,14}$')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
app = Flask(__name__)
hits = defaultdict(deque)


@app.after_request
def cors(resp):
    origin = request.headers.get('Origin', '')
    if '*' in ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = '*'
    elif origin in ORIGINS:
        resp.headers['Access-Control-Allow-Origin'] = origin
        resp.headers['Vary'] = 'Origin'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return resp


def one_line(s, n):
    return re.sub(r'\s+', ' ', str(s or '')).strip()[:n]


def limited(ip):
    now, q = time.time(), hits[ip]
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= LIMIT:
        return True
    q.append(now)
    return False


def clean_items(a):
    out = []
    for i in (a if isinstance(a, list) else [])[:30]:
        if not isinstance(i, dict):
            continue
        name, plan = one_line(i.get('name'), 100), one_line(i.get('plan'), 30)
        try:
            cost = round(float(i.get('cost')))
        except (TypeError, ValueError):
            continue
        if name and 0 <= cost <= 10 ** 8:
            out.append({'name': name, 'plan': plan, 'cost': cost})
    return out


def inr(n):                                    # 123456 -> Rs 1,23,456 (rupee sign)
    s = str(int(n))
    last, rest = s[-3:], s[:-3]
    while rest:
        last, rest = rest[-2:] + ',' + last, rest[:-2]
    return '\u20b9' + last


def text_table(items, total):
    head = ['SI', 'Tool Name', 'Licence Type', 'Cost']
    rows = [[str(n + 1), i['name'], i['plan'], inr(i['cost'])] for n, i in enumerate(items)]
    foot = ['', 'Total cost', '', inr(total)]
    w = [max(len(r[c]) for r in [head] + rows + [foot]) for c in range(4)]
    line = lambda r: '  '.join(s.rjust(w[c]) if c == 3 else s.ljust(w[c]) for c, s in enumerate(r))
    sep = '  '.join('-' * x for x in w)
    return '\n'.join([line(head), sep] + [line(r) for r in rows] + [sep, line(foot)])


def html_table(items, total):
    th = 'padding:8px 10px;border:1px solid #cfd9ec;background:#eaf0ff;font-weight:bold;text-align:left'
    td = 'padding:8px 10px;border:1px solid #cfd9ec'
    h = ('<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:14px">'
         f'<tr><th style="{th};width:44px">SI</th><th style="{th}">Tool Name</th><th style="{th}">Licence Type</th><th style="{th};text-align:right">Cost</th></tr>')
    for n, i in enumerate(items, 1):
        h += (f'<tr><td style="{td}">{n}</td><td style="{td}">{html.escape(i["name"])}</td><td style="{td}">{html.escape(i["plan"])}</td>'
              f'<td style="{td};text-align:right">{inr(i["cost"])}</td></tr>')
    h += (f'<tr><td colspan="3" style="{td};background:#f6f8fd;font-weight:bold;text-align:right">Total cost</td>'
          f'<td style="{td};background:#f6f8fd;font-weight:bold;text-align:right">{inr(total)}</td></tr></table>'
          '<p style="margin:8px 0 0;font-size:12px;color:#5b6b82">Prices are indicative. We confirm the final price by email.</p>')
    return h


def build_messages(d):
    kind, name, email, phone = d['kind'], d['name'], d['email'], d['phone']
    topic, message = d['topic'], d['message']
    what = KINDS[kind]

    items = d['items']
    total = sum(x['cost'] for x in items)
    text = (f'Hello {name},\n\nThank you for contacting Plant design Space. We have received {what} and will reply by email soon.\n\n'
            f'Here is what you sent us:\nTopic: {topic}\nEmail: {email}\nPhone: {phone}\n')
    if items:
        text += f'\nTools requested:\n{text_table(items, total)}\n(Prices are indicative. We confirm the final price by email.)\n'
    if message:
        text += '\n' + ('Note:\n' if items else '') + message + '\n'
    text += f'\n--\nPlant design Space\n{TAGLINE}\n{NOTIFY_TO}\n' + (WEBSITE + '\n' if WEBSITE else '') + HOURS + '\n'
    page = ('<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f3a;max-width:600px">'
            f'<p>Hello {html.escape(name)},</p>'
            f'<p>Thank you for contacting <b>Plant design Space</b>. We have received {what} and will reply by email soon.</p>'
            '<p style="margin:18px 0 6px"><b>Here is what you sent us</b></p>'
            f'<p style="margin:0">Topic: {html.escape(topic)}<br>Email: {html.escape(email)}<br>Phone: {html.escape(phone)}</p>')
    if items:
        page += '<p style="margin:18px 0 8px"><b>Tools requested</b></p>' + html_table(items, total)
    if message:
        page += ('<p style="margin:18px 0 6px"><b>Note</b></p>' if items else '') + \
                '<p style="background:#f2f6ff;border-radius:8px;padding:12px 14px">' + html.escape(message).replace('\n', '<br>') + '</p>'
    page += ('<div style="border-top:1px solid #dbe4f3;margin-top:26px"></div>'
             '<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:14px"><tr>'
             '<td style="vertical-align:top;padding-right:12px"><img src="cid:logo" width="44" height="44" alt="Plant design Space" style="display:block;border-radius:10px"></td>'
             '<td style="vertical-align:top;font-size:13px;line-height:1.5;color:#5b6b82">'
             f'<b style="font-size:15px;color:#0b1f3a">Plant design Space</b><br>{html.escape(TAGLINE)}<br>{html.escape(NOTIFY_TO)}'
             + (f'<br>{html.escape(WEBSITE)}' if WEBSITE else '') + f'<br>{HOURS}</td></tr></table></div>')
    ack = EmailMessage()
    ack['From'] = formataddr((FROM_NAME, GMAIL_USER))
    ack['To'] = formataddr((name, email))
    if email.lower() != NOTIFY_TO.lower():
        ack['Cc'] = NOTIFY_TO                   # our copy
    ack['Subject'] = f'We received {what} | {FROM_NAME}'
    ack.set_content(text)
    ack.add_alternative(page, subtype='html')
    ack.get_payload()[1].add_related(LOGO, 'image', 'png', cid='<logo>')
    return ack


def deliver(messages):
    ctx = ssl.create_default_context()
    if SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=25, context=ctx)
    else:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=25)
        server.starttls(context=ctx)
    with server:
        server.login(GMAIL_USER, APP_PW)
        for m in messages:
            server.send_message(m)


@app.route('/health')
def health():
    return jsonify(ok=True, configured=bool(GMAIL_USER and APP_PW))


@app.route('/api/send', methods=['POST', 'OPTIONS'])
def send():
    if request.method == 'OPTIONS':
        return '', 204
    if not (GMAIL_USER and APP_PW):
        return jsonify(ok=False, error='Mailer is not configured.'), 503
    j = request.get_json(silent=True) or {}
    if j.get('website'):                       # honeypot: real visitors leave this empty
        return jsonify(ok=True)
    ip = (request.headers.get('X-Forwarded-For', '').split(',')[0].strip() or request.remote_addr or '?')
    if limited(ip):
        return jsonify(ok=False, error='Too many requests. Please try again later.'), 429
    d = {
        'kind': one_line(j.get('kind'), 20),
        'name': one_line(j.get('name'), 100),
        'email': one_line(j.get('email'), 254),
        'phone': re.sub(r'[\s().-]', '', one_line(j.get('phone'), 40)),
        'topic': one_line(j.get('topic'), 150),
        'message': str(j.get('message') or '').replace('\r', '').strip()[:4000],
        'items': clean_items(j.get('items')),
    }
    if d['kind'] not in KINDS:
        return jsonify(ok=False, error='Unknown request type.'), 400
    if not d['name'] or not d['topic'] or not (d['message'] or d['items']):
        return jsonify(ok=False, error='Name, topic and message are required.'), 400
    if not EMAIL_RE.match(d['email']):
        return jsonify(ok=False, error='Enter a valid email address.'), 400
    if not PHONE_RE.match(d['phone']):
        return jsonify(ok=False, error='Enter your phone number with the country code, for example +91 98765 43210.'), 400
    msg = build_messages(d)
    try:
        deliver([msg])                          # one email: To the customer, Cc us
    except Exception:
        logging.exception('sending to %s failed', d['email'])
        return jsonify(ok=False, error='Could not send. Please email ' + NOTIFY_TO), 502
    logging.info('%s from %s handled', d['kind'], d['email'])
    return jsonify(ok=True)


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--test':
        d = dict(kind='cart', name='Test Customer', email=sys.argv[2], phone='+917401721841', topic='Tool request: test', message='This is a test note.', items=[{'name': 'Sample Tool', 'plan': 'Annual', 'cost': 5000}])
        deliver([build_messages(d)])
        print('Test email sent to', sys.argv[2], 'with Cc to', NOTIFY_TO)
    else:
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))
