import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const TIMESTAMP_URLS = [
  "http://time.certum.pl",
  "http://timestamp.digicert.com",
  "http://timestamp.comodoca.com",
];

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`exit ${code}: ${stderr || stdout}`));
    });
  });
}

export async function signFile(filePath, originalName) {
  const dryRun = !!process.env.DRY_RUN;
  const outFile = path.join(
    os.tmpdir(),
    `${Date.now()}-${Math.random().toString(36).slice(2)}-${originalName}`
  );
  if (dryRun) {
    // Simulate signing by copying
    await fs.promises.copyFile(filePath, outFile);
    const buf = await fs.promises.readFile(outFile);
    await fs.promises.unlink(outFile).catch(() => {});
    return buf;
  }

  const baseArgs = [
    "sign",
    "-provider",
    "/usr/lib/x86_64-linux-gnu/ossl-modules/pkcs11.so",
    "-pkcs11module",
    "/usr/lib/librtpkcs11ecp.so",
    "-pkcs11cert",
    process.env.PKCS11_CERT,
    "-key",
    process.env.PKCS11_KEY,
    "-h",
    "sha256",
    "-n",
    process.env.SIGN_NAME,
    "-i",
    process.env.SIGN_URL,
    "-in",
    filePath,
    "-out",
    outFile,
  ];

  let lastErr;
  for (const tsUrl of TIMESTAMP_URLS) {
    const args = [...baseArgs, "-ts", tsUrl];
    try {
      await runCmd("osslsigncode", args);
      const buf = await fs.promises.readFile(outFile);
      await fs.promises.unlink(outFile).catch(() => {});
      return buf;
    } catch (e) {
      lastErr = e;
      console.warn(`[sign] timestamp server failed ${tsUrl}: ${e.message}`);
    }
  }
  throw lastErr || new Error("Unknown signing failure");
}
