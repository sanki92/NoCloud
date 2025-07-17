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
