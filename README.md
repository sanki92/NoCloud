# iPhone Auto Photo Backup (No iCloud, No Subscriptions)

A fully automated iPhone photo backup system using Shortcuts, a lightweight local server, and Tailscale. Runs daily with **zero clicks**, skips duplicates, and uploads straight to your own machine.

---

## Requirements

- iPhone with the **Shortcuts** app
- A laptop/server (macOS, Windows, or Linux)
- [Tailscale](https://tailscale.com) (free for personal use)
- A simple HTTP server running on your machine (`/upload` endpoint)
- Basic understanding of file paths and networking

---

## How It Works

1. **`FindPhotosSinceLastBackup`**  
   Finds all new photos on your iPhone since the last successful upload.

2. **`UploadPhotosToServer`**  
   Sends those photos to your laptop via a POST request.

3. **`RunDailyBackup`**  
   Orchestrates the process and stores the last upload date.

No manual selection. No storage limits. No recurring fees.

---

## Setting Up the Shortcuts

### 1. `FindPhotosSinceLastBackup`

Finds all photos created **after your last successful upload**.

#### Logic:
- Load `LastUploadDate.txt` from `/Shortcuts` folder
- Parse it as a date
- Filter all photos where `Creation Date > LastUploadDate`
- Sort: `Oldest First`
- Output as list

---

### 2. `UploadPhotosToServer`

Uploads each photo to your local/private server.

#### Logic:
- Input: List of photos
- Loop through each:
  - Extract `Creation Date`
  - Format it as needed (for folders or filenames)
  - Send HTTP `POST` to:  
    `http://<your-server>:3000/upload`  
- Done.

> Note: Your server must handle file uploads at `/upload`.

---

### 3. `RunDailyBackup`

Automates the entire process.

#### Logic:
- Run `FindPhotosSinceLastBackup`
- For each photo, run `UploadPhotosToServer`
- Save current date to `LastUploadDate.txt`
- Show a "Backup Complete" notification

---

## Setting Up Tailscale

Tailscale connects your devices securely across networks (like a personal VPN).

#### Steps:
1. Install Tailscale on both iPhone and Laptop
2. Sign in with the **same account**
3. Get your laptop’s Tailscale address  
   e.g. `my-laptop.tailnet123.ts.net`
4. Use this domain in your shortcut's upload URL:  
   `http://my-laptop.tailnet123.ts.net:3000/upload`
5. Ensure your server listens on port `3000` and accepts incoming POSTs

> No port forwarding. No static IPs. No fuss.

---

## What You Get

- ✔️ Fully automatic daily photo backups
- ✔️ Skips duplicates with a custom JSON DB
- ✔️ Saves photos into date-based folders
- ✔️ Works over the internet via Tailscale
- ✔️ iCloud-free, cost-free, and private

---

## Roadmap (Optional Improvements)

- [x] Queue photos when server is unreachable
- [x] Add retry logic or alerts for failed uploads
- [x] Build a `/gallery` frontend to browse photos
- [x] Auto-delete from phone after backup? (maybe)

---

## Questions?

Feel free to open an issue or drop a comment if you try it out.  
This started as a quick weekend hack—happy to see it evolve.

---

> Built because ₹200/month for iCloud felt like a scam.
