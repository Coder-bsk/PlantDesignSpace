/**
 * Plant design Space mailer (Google Apps Script).
 * Runs free inside Google, works with a website hosted on GitHub Pages.
 * For every enquiry or cart request it sends ONE email from the Gmail account that owns this script:
 *   To: the customer, Cc: NOTIFY_TO, subject "We received your tool request | Plant design Space".
 * The email repeats the customer's name, email, phone and message, so your Cc copy is your record.
 * It can also log the message in a Google Sheet (SHEET_ID).
 * Setup steps are in README.txt next to this file.
 */
const CONFIG = {
  NOTIFY_TO: 'plantdesignspace@gmail.com',
  FROM_NAME: 'Plant design Space',
  SHEET_ID: '',            // optional: id of a Google Sheet that should log every message
  DAILY_LIMIT: 40,         // max submissions per day (each one sends 2 emails)
  PER_EMAIL_DAILY: 3,      // max submissions per customer email per day
  WEBSITE: '',             // optional: your website address, shown in the email footer
  TAGLINE: 'Aveva consulting, training and digital solutions',
  HOURS: 'Mon-Fri, 08:00-17:30 IST',
  TZ: 'Asia/Kolkata'
};
const KINDS = { enquiry: 'your enquiry', cart: 'your tool request' };
const EMAIL_RE = /^[^@\s<>,;]{1,64}@[^@\s<>,;]{1,190}\.[^@\s<>,;]{2,}$/;
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

function doGet() {
  return json_({ ok: true, service: 'Plant design Space mailer' });
}

function doPost(e) {
  try {
    const j = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (j.website) return json_({ ok: true });                 // honeypot: real visitors leave it empty
    const d = clean_(j);
    if (!KINDS[d.kind]) throw new Error('Unknown request type.');
    if (!d.name || !d.topic || !(d.message || d.items.length)) throw new Error('Name, topic and message are required.');
    if (!EMAIL_RE.test(d.email)) throw new Error('Enter a valid email address.');
    if (!PHONE_RE.test(d.phone)) throw new Error('Enter your phone number with the country code.');
    if (!allow_(d.email)) throw new Error('Too many requests. Please try again tomorrow.');
    if (CONFIG.SHEET_ID) log_(d);
    send_(d);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function clean_(j) {
  const line = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return {
    kind: line(j.kind, 20),
    name: line(j.name, 100),
    email: line(j.email, 254),
    phone: line(j.phone, 40).replace(/[\s().-]/g, ''),
    topic: line(j.topic, 150),
    message: String(j.message || '').replace(/\r/g, '').trim().slice(0, 4000),
    items: items_(j.items)
  };
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Spam and quota guard: daily total, and per customer email per day.
function allow_(email) {
  const p = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    p.getKeys().forEach(function (k) {                          // forget counters from earlier days
      if (/^(t|e):\d{4}-\d{2}-\d{2}/.test(k) && k.indexOf(day) < 0) p.deleteProperty(k);
    });
    const tk = 't:' + day, ek = 'e:' + day + ':' + email.toLowerCase();
    const total = Number(p.getProperty(tk)) || 0, mine = Number(p.getProperty(ek)) || 0;
    if (total >= CONFIG.DAILY_LIMIT || mine >= CONFIG.PER_EMAIL_DAILY) return false;
    p.setProperty(tk, String(total + 1));
    p.setProperty(ek, String(mine + 1));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function log_(d) {
  const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(['Time', 'Type', 'Name', 'Email', 'Phone', 'Topic', 'Message']);
  sh.appendRow([new Date(), d.kind, d.name, d.email, d.phone, d.topic, d.message]);
}

// Cart items sent by the website: [{name, plan, cost}]. The total is always worked out here.
function items_(a) {
  return (Array.isArray(a) ? a : []).slice(0, 30).map(function (i) {
    const name = String((i && i.name) || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const plan = String((i && i.plan) || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    const cost = Number(i && i.cost);
    return name && isFinite(cost) && cost >= 0 && cost <= 1e8 ? { name: name, plan: plan, cost: Math.round(cost) } : null;
  }).filter(Boolean);
}

function inr_(n) {                                              // 123456 -> ₹1,23,456
  const s = String(Math.round(n));
  let last = s.slice(-3);
  const rest = s.slice(0, -3);
  if (rest) last = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last;
  return '\u20B9' + last;
}

function textTable_(items, total) {
  const rows = items.map(function (i, n) { return [String(n + 1), i.name, i.plan, inr_(i.cost)]; });
  const head = ['SI', 'Tool Name', 'Licence Type', 'Cost'];
  const all = [head].concat(rows, [['', 'Total cost', '', inr_(total)]]);
  const w = head.map(function (_, c) { return Math.max.apply(null, all.map(function (r) { return r[c].length; })); });
  const pad = function (s, n, right) { const sp = new Array(Math.max(0, n - s.length) + 1).join(' '); return right ? sp + s : s + sp; };
  const line = function (r) { return r.map(function (s, c) { return pad(s, w[c], c === 3); }).join('  '); };
  const sep = w.map(function (n) { return new Array(n + 1).join('-'); }).join('  ');
  return [line(head), sep].concat(rows.map(line), [sep, line(['', 'Total cost', '', inr_(total)])]).join('\n');
}

function htmlTable_(items, total) {
  const th = 'padding:8px 10px;border:1px solid #cfd9ec;background:#eaf0ff;font-weight:bold;text-align:left';
  const td = 'padding:8px 10px;border:1px solid #cfd9ec';
  let h = '<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;font-size:14px">' +
    '<tr><th style="' + th + ';width:44px">SI</th><th style="' + th + '">Tool Name</th><th style="' + th + '">Licence Type</th>' +
    '<th style="' + th + ';text-align:right">Cost</th></tr>';
  items.forEach(function (i, n) {
    h += '<tr><td style="' + td + '">' + (n + 1) + '</td><td style="' + td + '">' + esc_(i.name) + '</td><td style="' + td + '">' +
      esc_(i.plan) + '</td><td style="' + td + ';text-align:right">' + inr_(i.cost) + '</td></tr>';
  });
  h += '<tr><td colspan="3" style="' + td + ';background:#f6f8fd;font-weight:bold;text-align:right">Total cost</td>' +
    '<td style="' + td + ';background:#f6f8fd;font-weight:bold;text-align:right">' + inr_(total) + '</td></tr></table>' +
    '<p style="margin:8px 0 0;font-size:12px;color:#5b6b82">Prices are indicative. We confirm the final price by email.</p>';
  return h;
}

function send_(d) {
  const what = KINDS[d.kind];
  const has = d.items.length > 0;
  const total = d.items.reduce(function (s, i) { return s + i.cost; }, 0);
  let text = 'Hello ' + d.name + ',\n\nThank you for contacting ' + CONFIG.FROM_NAME + '. We have received ' + what +
    ' and will reply by email soon.\n\nHere is what you sent us:\nTopic: ' + d.topic + '\nEmail: ' + d.email + '\nPhone: ' + d.phone + '\n';
  if (has) text += '\nTools requested:\n' + textTable_(d.items, total) + '\n(Prices are indicative. We confirm the final price by email.)\n';
  if (d.message) text += '\n' + (has ? 'Note:\n' : '') + d.message + '\n';
  text += '\n--\n' + CONFIG.FROM_NAME + '\n' + CONFIG.TAGLINE + '\n' + CONFIG.NOTIFY_TO + '\n' +
    (CONFIG.WEBSITE ? CONFIG.WEBSITE + '\n' : '') + CONFIG.HOURS + '\n';
  let html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f3a;max-width:600px">' +
    '<p>Hello ' + esc_(d.name) + ',</p>' +
    '<p>Thank you for contacting <b>' + esc_(CONFIG.FROM_NAME) + '</b>. We have received ' + what + ' and will reply by email soon.</p>' +
    '<p style="margin:18px 0 6px"><b>Here is what you sent us</b></p>' +
    '<p style="margin:0">Topic: ' + esc_(d.topic) + '<br>Email: ' + esc_(d.email) + '<br>Phone: ' + esc_(d.phone) + '</p>';
  if (has) html += '<p style="margin:18px 0 8px"><b>Tools requested</b></p>' + htmlTable_(d.items, total);
  if (d.message) html += (has ? '<p style="margin:18px 0 6px"><b>Note</b></p>' : '') +
    '<p style="background:#f2f6ff;border-radius:8px;padding:12px 14px">' + esc_(d.message).replace(/\n/g, '<br>') + '</p>';
  html += '<div style="border-top:1px solid #dbe4f3;margin-top:26px"></div>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:14px"><tr>' +
    '<td style="vertical-align:top;padding-right:12px"><img src="cid:logo" width="44" height="44" alt="Plant design Space" style="display:block;border-radius:10px"></td>' +
    '<td style="vertical-align:top;font-size:13px;line-height:1.5;color:#5b6b82">' +
    '<b style="font-size:15px;color:#0b1f3a">' + esc_(CONFIG.FROM_NAME) + '</b><br>' + esc_(CONFIG.TAGLINE) + '<br>' + esc_(CONFIG.NOTIFY_TO) +
    (CONFIG.WEBSITE ? '<br>' + esc_(CONFIG.WEBSITE) : '') + '<br>' + CONFIG.HOURS + '</td></tr></table></div>';
  const mail = {
    to: d.email,
    name: CONFIG.FROM_NAME,
    subject: 'We received ' + what + ' | ' + CONFIG.FROM_NAME,
    body: text,
    htmlBody: html,
    inlineImages: { logo: Utilities.newBlob(Utilities.base64Decode(LOGO_PNG_BASE64), 'image/png', 'logo.png') }
  };
  if (d.email.toLowerCase() !== CONFIG.NOTIFY_TO.toLowerCase()) mail.cc = CONFIG.NOTIFY_TO;   // our copy
  MailApp.sendEmail(mail);   // customers who reply reach the Gmail account that sent this
}

// Run this once from the editor (Run > testSend) to authorise the script and check the emails.
function testSend() {
  send_({ kind: 'cart', name: 'Test Customer', email: CONFIG.NOTIFY_TO, phone: '+917401721841',
          topic: 'Tool request from Test Customer', message: 'This is a test note.',
          items: [{"name": "Bulk Rename utility", "plan": "Annual", "cost": 2000}, {"name": "ADP Drawing Utility", "plan": "Monthly", "cost": 500}] });
}

// Company logo (logo.png, 192 px) embedded in the email footer. To change it, replace this text with the base64 of a new PNG.
const LOGO_PNG_BASE64 = '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';
