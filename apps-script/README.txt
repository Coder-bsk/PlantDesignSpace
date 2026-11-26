GOOGLE APPS SCRIPT MAILER (best option for a website on GitHub Pages)

GitHub Pages can only host static files, so it cannot run Python. This script runs free inside your Google
account instead. It sends the notice to you and the acknowledgement to the customer from your own Gmail, with no
server, no app password and no third-party service.

Setup (about 10 minutes)
1. Sign in to plantdesignspace@gmail.com. Go to script.google.com and click New project.
2. Delete the sample code, open Code.gs from this folder, copy everything and paste it in. Name the project "Website mailer".
3. Check the CONFIG block at the top (NOTIFY_TO is already your Gmail). Optional: to keep a log of every message,
   create a Google Sheet, copy its id from the address (the long text between /d/ and /edit) and put it in SHEET_ID.
4. Click Save. In the function drop-down choose testSend and click Run. Google asks for permission:
   Review permissions > choose your account > "Google hasn't verified this app" > Advanced > Go to Website mailer (unsafe) > Allow.
   This warning is normal for your own script. You should now receive two test emails.
5. Click Deploy > New deployment. Click the gear icon, choose Web app. Set:
     Execute as: Me
     Who has access: Anyone
   Click Deploy and copy the Web app URL (it ends with /exec).
6. Open the URL in a browser. You should see {"ok":true,"service":"Plant design Space mailer"}.
7. In the website's app.js set  api:'PASTE THE WEB APP URL HERE'  inside CFG, run python build.py if you changed pages,
   then commit and push to GitHub Pages.
8. Send a test enquiry and a test cart request from the live site. Check that the acknowledgement arrives at the
   customer address and the notice arrives at plantdesignspace@gmail.com.

If you change Code.gs later: Deploy > Manage deployments > pencil icon > Version: New version > Deploy. The URL stays the same.

Good to know
- Spam guard: hidden-field check, 40 submissions a day in total, 3 per customer email per day, valid email and phone with country code.
  Change DAILY_LIMIT and PER_EMAIL_DAILY in CONFIG if needed.
- A free Gmail account can send roughly 100 emails a day through Apps Script, and each submission sends 2.
  Google Workspace accounts have a much higher limit.
- The website cannot read the script's reply (browser rule for Google scripts), so visitors always see "sent" once the
  request leaves their browser. The form already checks the email and phone first. Errors are visible in Apps Script > Executions.
- The web app URL is public, but it can only send these two fixed emails, within the limits above.
- With SHEET_ID set you no longer need the Google Form: leave gform blank in app.js and the sheet is your enquiry record.
