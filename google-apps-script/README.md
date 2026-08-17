# BoltAp — Google Drive weekly backup

BoltAp can push a full data backup (`.xlsx`, one sheet per table) into your shared
Google Drive folder **boltap_Vercel_Backup** automatically once a week, and on
demand from Settings.

Because a phone/web app can't write to Drive on its own, a tiny **Google Apps
Script web app** does it for you. It runs as your own Google account, so it needs
no Google Cloud project, OAuth client, or API key.

## Setup (about 2 minutes, once)

1. Open <https://script.google.com> → **New project**.
2. Delete the sample code, paste all of [`BoltApBackup.gs`](./BoltApBackup.gs), **Save**.
3. **Deploy → New deployment → Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   Click **Deploy**, then **Authorize access** (choose your account → Allow).
4. Copy the **Web app URL** (ends in `/exec`).
5. In BoltAp: **Settings → Google Drive Backup**
   - Paste the URL, tap **Save Drive Settings**
   - Tick **Auto-backup every week**
   - Tap **Backup to Drive now** to test — a file should appear in the folder.

The target folder id is `1FZKaziDD_5Cztb5q1jOIXPGQqFo_QIlx`
(<https://drive.google.com/drive/folders/1FZKaziDD_5Cztb5q1jOIXPGQqFo_QIlx>).

## Notes

- The weekly upload runs when you open the app and 7+ days have passed since the
  last successful backup. The date of the last backup is shown in Settings.
- Backups are timestamped, e.g. `BoltAp_Backup_weekly_2026-08-17-09-30-00.xlsx`,
  so nothing is overwritten.
- If a network warning ever shows but the file still lands in Drive, that's a
  known Apps Script quirk (the upload succeeded; only the reply was blocked).
  Check the folder to confirm.
- Re-deploy only when you edit the script: **Manage deployments → Edit → Version:
  New version → Deploy**. The `/exec` URL stays the same.
