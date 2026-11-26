/**
 * Plant design Space mailer (Google Apps Script).
 * Runs free inside Google, works with a website hosted on GitHub Pages.
 * For every enquiry or cart request it:
 *   1. emails a notice to NOTIFY_TO (Reply-To = the customer),
 *   2. emails an acknowledgement to the customer, from the Gmail account that owns this script,
 *   3. optionally logs the message in a Google Sheet (SHEET_ID).
 * Setup steps are in README.txt next to this file.
 */
const CONFIG = {
  NOTIFY_TO: 'plantdesignspace@gmail.com',
  FROM_NAME: 'Plant design Space',
  SHEET_ID: '',            // optional: id of a Google Sheet that should log every message
  DAILY_LIMIT: 40,         // max submissions per day (each one sends 2 emails)
  PER_EMAIL_DAILY: 3,      // max submissions per customer email per day
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
    if (!d.name || !d.topic || !d.message) throw new Error('Name, topic and message are required.');
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
    message: String(j.message || '').replace(/\r/g, '').trim().slice(0, 4000)
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

function send_(d) {
  const what = KINDS[d.kind];
  MailApp.sendEmail({
    to: CONFIG.NOTIFY_TO,
    replyTo: d.email,
    name: CONFIG.FROM_NAME + ' website',
    subject: '[Website] ' + d.topic,
    body: 'New ' + d.kind + ' from the website\n\nName: ' + d.name + '\nEmail: ' + d.email + '\nPhone: ' + d.phone +
          '\nTopic: ' + d.topic + '\n\n' + d.message + '\n'
  });
  const text = 'Hello ' + d.name + ',\n\nThank you for contacting ' + CONFIG.FROM_NAME + '. We have received ' + what +
    ' and will reply by email soon.\n\nHere is what you sent us:\nTopic: ' + d.topic + '\nPhone: ' + d.phone + '\n\n' +
    d.message + '\n\n' + CONFIG.FROM_NAME + '\n' + CONFIG.HOURS + '\n' + CONFIG.NOTIFY_TO + '\n';
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0b1f3a;max-width:560px">' +
    '<p>Hello ' + esc_(d.name) + ',</p>' +
    '<p>Thank you for contacting <b>' + esc_(CONFIG.FROM_NAME) + '</b>. We have received ' + what + ' and will reply by email soon.</p>' +
    '<p style="margin:18px 0 6px"><b>Here is what you sent us</b></p>' +
    '<p style="margin:0">Topic: ' + esc_(d.topic) + '<br>Phone: ' + esc_(d.phone) + '</p>' +
    '<p style="background:#f2f6ff;border-radius:8px;padding:12px 14px">' + esc_(d.message).replace(/\n/g, '<br>') + '</p>' +
    '<p style="color:#5b6b82">' + esc_(CONFIG.FROM_NAME) + '<br>' + CONFIG.HOURS + '<br>' + esc_(CONFIG.NOTIFY_TO) + '</p></div>';
  try {
    MailApp.sendEmail({
      to: d.email, replyTo: CONFIG.NOTIFY_TO, name: CONFIG.FROM_NAME,
      subject: 'We received ' + what + ' | ' + CONFIG.FROM_NAME, body: text, htmlBody: html
    });
  } catch (err) {
    console.error('Acknowledgement failed for ' + d.email + ': ' + err);   // our notice was already sent
  }
}

// Run this once from the editor (Run > testSend) to authorise the script and check the emails.
function testSend() {
  send_({ kind: 'enquiry', name: 'Test Customer', email: CONFIG.NOTIFY_TO, phone: '+917401721841',
          topic: 'Enquiry: test', message: 'This is a test message.' });
}
