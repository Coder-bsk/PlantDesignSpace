NOTE: this Python mailer needs a server that runs Python. GitHub Pages cannot run it, so for GitHub Pages use ../apps-script/ instead.

PLANT DESIGN SPACE MAILER (Python, sends from our Gmail account)

What it does
- The website posts each enquiry or cart request to this small Python service.
- It emails us a notice (Reply-To is the customer) and emails the customer an acknowledgement, both from plantdesignspace@gmail.com.
- No EmailJS and no third-party mail service. Only Python and Gmail.

1) Gmail setup (once)
   a. Sign in to the Gmail account, turn on 2-Step Verification (Google Account > Security).
   b. Google Account > Security > 2-Step Verification > App passwords. Create one named "Website mailer".
   c. Copy the 16-character password.

2) Install and configure (Python 3.9+)
   cd mailer
   pip install -r requirements.txt
   copy .env.example .env        (Windows)   or   cp .env.example .env
   Edit .env: paste the app password, set ALLOWED_ORIGINS to your website address.

3) Test
   python mailer.py --test your-own-email@example.com
   You should get the customer acknowledgement, and plantdesignspace@gmail.com gets a notice.

4) Run
   Local test:   python mailer.py                       (listens on port 8000)
   Windows live: waitress-serve --port=8000 mailer:app
   Linux live:   pip install gunicorn  then  gunicorn -w 2 -b 0.0.0.0:8000 mailer:app
   Put it behind HTTPS (a host such as Render, Railway, PythonAnywhere or your own server with nginx).
   Check that the host allows outgoing SMTP to smtp.gmail.com on port 587.
   Health check: open /health in the browser. "configured": true means the Gmail details were found.

5) Connect the website
   In ../app.js set  api:'https://YOUR-MAILER-ADDRESS/api/send'  in CFG.
   For local testing use  api:'http://localhost:8000/api/send'  and keep ALLOWED_ORIGINS=*.
   Until api is set, cart requests open the visitor's email app instead, and no acknowledgement is sent.

Notes
- Enquiries are recorded in the Google Form (gform in app.js). The mailer only sends the emails, so you may leave gform blank to use the mailer alone.
- Spam guard: hidden field check, 5 messages per visitor per 10 minutes, length limits, and checks for a valid email and a phone number with country code.
- Gmail limits sending (about 500 emails a day on a free account; each request uses 2). That is plenty for a site like this.
- If the notice to us fails the visitor sees an error. If only the acknowledgement fails (for example a mistyped customer address) the visitor still sees success and the problem is written to the log.
- Keep .env private. If the app password leaks, delete it in Google Account > App passwords and make a new one.
