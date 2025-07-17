import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use("/file", express.static(path.join(__dirname, "uploads")));

const storage = multer.memoryStorage();
const upload = multer({ storage });

const adapter = new JSONFile("db.json");
const db = new Low(adapter, { files: [] });
await db.read();

db.data.files = db.data.files.filter((f) => {
  const exists = fs.existsSync(f.path);
  if (!exists) console.log(`Removed orphan DB entry: ${f.path}`);
  return exists;
});
await db.write();

app.post("/upload", authenticate, upload.single("media"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file uploaded.");

  const folderDate =
    req.body?.createdAt || new Date().toISOString().split("T")[0];
  const folder = path.join(__dirname, "uploads", folderDate);
  fs.mkdirSync(folder, { recursive: true });

  const filename = `${nanoid(6)}-${file.originalname}`;
  const filepath = path.join(folder, filename);

  const isDuplicate = db.data.files.some((f) => {
    const exists = fs.existsSync(f.path);
    return exists && f.original === file.originalname && f.size === file.size;
  });

  if (isDuplicate) {
    console.log(`Skipping duplicate: ${file.originalname}`);
    return res.status(200).send("Duplicate skipped");
  }

  fs.writeFileSync(filepath, file.buffer);

  db.data.files.push({
    id: nanoid(),
    original: file.originalname,
    path: filepath,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  });

  await db.write();
  console.log(`Uploaded: ${file.originalname} → ${filepath}`);
  res.send("File uploaded");
});

app.get("/gallery", async (req, res) => {
  await db.read();
  const files = db.data.files.sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  // Group by uploaded date (formatted)
  const grouped = files.reduce((acc, file) => {
    const date = new Date(file.uploadedAt);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }); // e.g., "Mon, Jul 15, 2024"

    acc[formattedDate] = acc[formattedDate] || [];
    acc[formattedDate].push(file);
    return acc;
  }, {});

  const fileSections = Object.entries(grouped).map(([date, files]) => {
    const cards = files
      .map((file) => {
        const relPath = path
          .relative(path.join(__dirname, "uploads"), file.path)
          .replace(/\\/g, "/");
        const fileUrl = `/file/${relPath}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.original);
        const isVideo = /\.(mp4|mov|m4v|hevc|heic)$/i.test(file.original);

        return `
        <div class="card" onclick="openPreview('${fileUrl}', '${file.original}', ${isImage})">
          ${isImage ? `<img src="${fileUrl}" loading="lazy" />` : ""}
          ${isVideo ? `<video src="${fileUrl}" muted playsinline></video>` : ""}
        </div>
      `;
      })
      .join("");

    return `
      <div class="section">
        <div class="section-date">${date}</div>
        <div class="grid">${cards}</div>
      </div>
    `;
  }).join("\n");

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Gallery</title>
      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #0f0f0f, #1e1e2f);
          color: #f1f1f1;
          padding: 16px;
        }

        h1 {
          text-align: center;
          margin-bottom: 32px;
          font-size: 2rem;
          background: linear-gradient(to right, #facc15, #f472b6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .section {
          margin-bottom: 32px;
        }

        .section-date {
          font-size: 15px;
          font-weight: 500;
          color: #aaa;
          margin: 12px 6px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(48%, 1fr));
          gap: 8px;
        }

        .card {
          aspect-ratio: 1 / 1;
          border-radius: 8px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: transform 0.2s;
          cursor: pointer;
        }

        .card:hover {
          transform: scale(1.02);
        }

        .card img,
        .card video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .preview-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.85);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .preview-overlay.active {
          display: flex;
        }

        .preview-content {
          max-width: 90%;
          max-height: 90%;
          position: relative;
        }

        .preview-content img,
        .preview-content video {
          max-width: 100%;
          max-height: 100%;
          border-radius: 12px;
          box-shadow: 0 0 24px rgba(255, 255, 255, 0.1);
        }

        .close-btn {
          position: absolute;
          top: -32px;
          right: 0;
          font-size: 28px;
          color: white;
          cursor: pointer;
        }

        @media (min-width: 600px) {
          .grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          }
        }
      </style>
    </head>
    <body>
      ${fileSections}

      <div class="preview-overlay" id="previewOverlay" onclick="closePreview()">
        <div class="preview-content" onclick="event.stopPropagation()">
          <span class="close-btn" onclick="closePreview()">&times;</span>
          <div id="previewMedia"></div>
        </div>
      </div>

      <script>
        function openPreview(url, name, isImage) {
          const container = document.getElementById("previewMedia");
          container.innerHTML = isImage
            ? \`<img src="\${url}" alt="\${name}" />\`
            : \`<video controls autoplay src="\${url}"></video>\`;
          document.getElementById("previewOverlay").classList.add("active");
        }

        function closePreview() {
          document.getElementById("previewOverlay").classList.remove("active");
        }
      </script>
    </body>
    </html>
  `);
});

function authenticate(req, res, next) {
  const token = req.headers["authorization"];
  if (token !== `Bearer ${process.env.UPLOAD_TOKEN}`) {
    return res.status(401).send("Unauthorized");
  }
  next();
}

app.get("/", (req, res) => {
  res.send("Media backup server is running.");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
