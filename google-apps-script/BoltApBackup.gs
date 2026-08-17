/**
 * BoltAp → Google Drive backup receiver.
 *
 * This tiny web app receives a backup workbook from the BoltAp app and saves it
 * as an .xlsx into your shared Drive folder (boltap_Vercel_Backup). It runs as
 * YOU, so it can write to your Drive — no Google Cloud project or API key needed.
 *
 * ── Setup (once) ────────────────────────────────────────────────────────────
 *  1. Go to https://script.google.com  →  New project.
 *  2. Delete the sample code and paste ALL of this file. Save (Ctrl/Cmd+S).
 *  3. Deploy  →  New deployment  →  (gear) Web app.
 *       - Execute as:      Me
 *       - Who has access:  Anyone
 *     Deploy, then Authorize access (pick your Google account, Allow).
 *  4. Copy the "Web app URL" (it ends in /exec).
 *  5. In BoltAp: Settings → Google Drive Backup → paste the URL → Save,
 *     tick "Auto-backup every week", then "Backup to Drive now" to test.
 *
 * Backups appear in the folder below. Re-deploy (Manage deployments → Edit →
 * Version: New) only if you change this code.
 */

// The shared folder backups are saved into (boltap_Vercel_Backup).
// The app also sends this id, but this is the fallback / default.
var FOLDER_ID = '1FZKaziDD_5Cztb5q1jOIXPGQqFo_QIlx';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var folder = DriveApp.getFolderById(body.folderId || FOLDER_ID);
    var mime = body.mimeType ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    var name = body.filename || ('BoltAp_Backup_' + new Date().toISOString() + '.xlsx');
    var blob = Utilities.newBlob(Utilities.base64Decode(body.dataBase64), mime, name);
    var file = folder.createFile(blob);
    return json({ ok: true, id: file.getId(), url: file.getUrl(), name: name });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// A plain GET just confirms the deployment is live (open the URL in a browser).
function doGet() {
  return json({ ok: true, service: 'BoltAp Drive Backup', ready: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
