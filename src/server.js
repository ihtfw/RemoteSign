import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import { signFile } from "./signService.js";
import fs from "fs";

dotenv.config();

const app = express();
const upload = multer({ dest: ".tmp" });

// In-memory FIFO queue for signing jobs
const queue = [];
let active = false;

async function processQueue() {
  if (active) return;
  const next = queue.shift();
  if (!next) return; // nothing to do
  active = true;
  const { req, res, filePath, originalName } = next;
  try {
    const signedBuffer = await signFile(filePath, originalName);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName}"`
    );
    res.send(signedBuffer);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Signing failed", detail: err.message });
    }
  } finally {
    fs.unlink(filePath, () => {});
    active = false;
    // Defer next tick to avoid deep recursion
    setImmediate(processQueue);
  }
}

const REQUIRED_ENV = ["AUTH_TOKEN", "PKCS11_CERT", "PKCS11_KEY", "SIGN_URL"];
REQUIRED_ENV.forEach((k) => {
  if (!process.env[k]) {
    console.warn(`[warn] Missing env var ${k}`);
  }
});

app.post("/sign", upload.single("file"), async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || authHeader !== `Bearer ${process.env.AUTH_TOKEN}`) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "file field required" });
    }

    const inputPath = req.file.path;
    const originalName = req.file.originalname;

    // Enqueue job
    queue.push({
      req,
      res,
      filePath: inputPath,
      originalName,
      enqueuedAt: Date.now(),
    });
    // Optional header to inform queue position
    res.setHeader(
      "X-Queue-Position",
      (queue.length - (active ? 0 : 1)).toString()
    );
    processQueue();
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error", detail: err.message });
    }
  }
});

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`sign service listening on ${port}`));
}

export default app;
