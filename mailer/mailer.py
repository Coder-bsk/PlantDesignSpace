"""Plant design Space mailer.

Receives enquiries and cart requests from the website, then from OUR Gmail account:
  1. emails a notice to us (Reply-To is the customer), and
  2. emails an acknowledgement to the customer.

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


def build_messages(d):
    kind, name, email, phone = d['kind'], d['name'], d['email'], d['phone']
    topic, message = d['topic'], d['message']
    what = KINDS[kind]

    note = EmailMessage()
    note['From'] = formataddr((FROM_NAME + ' website', GMAIL_USER))
    note['To'] = NOTIFY_TO
    note['Reply-To'] = formataddr((name, email))
    note['Subject'] = '[Website] ' + topic
    note.set_content(f'New {kind} from the website\n\nName: {name}\nEmail: {email}\nPhone: {phone}\nTopic: {topic}\n\n{message}\n')

    text = (f'Hello {name},\n\nThank you for contacting Plant design Space. We have received {what} and will reply by email soon.\n\n'
            f'Here is what you sent us:\nTopic: {topic}\nPhone: {phone}\n\n{message}\n\n'
            f'Plant design Space\n{HOURS}\n{NOTIFY_TO}\n')
    body = html.escape(message).replace('\n', '<br>')
    page = (f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f3a;max-width:560px">'
            f'<p>Hello {html.escape(name)},</p>'
            f'<p>Thank you for contacting <b>Plant design Space</b>. We have received {what} and will reply by email soon.</p>'
            f'<p style="margin:18px 0 6px"><b>Here is what you sent us</b></p>'
            f'<p style="margin:0">Topic: {html.escape(topic)}<br>Phone: {html.escape(phone)}</p>'
            f'<p style="background:#f2f6ff;border-radius:8px;padding:12px 14px">{body}</p>'
            f'<p style="color:#5b6b82">Plant design Space<br>{HOURS}<br>{html.escape(NOTIFY_TO)}</p></div>')
    ack = EmailMessage()
    ack['From'] = formataddr((FROM_NAME, GMAIL_USER))
    ack['To'] = formataddr((name, email))
    ack['Reply-To'] = NOTIFY_TO
    ack['Subject'] = f'We received {what} | {FROM_NAME}'
    ack.set_content(text)
    ack.add_alternative(page, subtype='html')
    return note, ack


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
    }
    if d['kind'] not in KINDS:
        return jsonify(ok=False, error='Unknown request type.'), 400
    if not d['name'] or not d['message'] or not d['topic']:
        return jsonify(ok=False, error='Name, topic and message are required.'), 400
    if not EMAIL_RE.match(d['email']):
        return jsonify(ok=False, error='Enter a valid email address.'), 400
    if not PHONE_RE.match(d['phone']):
        return jsonify(ok=False, error='Enter your phone number with the country code, for example +91 98765 43210.'), 400
    note, ack = build_messages(d)
    try:
        deliver([note])                         # our notice first: this is the lead we must not lose
    except Exception:
        logging.exception('notice to us failed')
        return jsonify(ok=False, error='Could not send. Please email ' + NOTIFY_TO), 502
    acknowledged = True
    try:
        deliver([ack])
    except Exception:
        acknowledged = False
        logging.exception('acknowledgement to %s failed', d['email'])
    logging.info('%s from %s handled, acknowledged=%s', d['kind'], d['email'], acknowledged)
    return jsonify(ok=True, acknowledged=acknowledged)


if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--test':
        d = dict(kind='enquiry', name='Test Customer', email=sys.argv[2], phone='+917401721841', topic='Enquiry: test', message='This is a test message.')
        deliver(list(build_messages(d)))
        print('Test emails sent to', NOTIFY_TO, 'and', sys.argv[2])
    else:
        app.run(host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))
