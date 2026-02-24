#!/usr/bin/env node
/**
 * Download OpenCode CLI binary for current platform and place in src-tauri/binaries/
 * for Tauri sidecar. Aligned with OpenWork (different-ai/openwork) prepare-sidecar:
 * same GitHub releases URL pattern, same target triple -> asset mapping, prefer baseline for x64.
 *
 * Usage: node scripts/download-opencode.mjs [version]
 * Version: CLI arg, or OPENCODE_VERSION env, or package.json "opencodeVersion", or default 1.2.10.
 * Use "latest" to fetch from GitHub API.
 */
import { execSync } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BINARIES_DIR = path.join(ROOT, "src-tauri", "binaries");
const OPENCODE_REPO = process.env.OPENCODE_GITHUB_REPO?.trim() || "anomalyco/opencode";

// Version: argv > env > package.json opencodeVersion > default
function getVersion() {
  const fromArg = process.argv[2];
  if (fromArg) return fromArg.replace(/^v/, "");
  if (process.env.OPENCODE_VERSION?.trim()) return process.env.OPENCODE_VERSION.trim().replace(/^v/, "");
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    if (pkg.opencodeVersion) return String(pkg.opencodeVersion).trim().replace(/^v/, "");
  } catch {}
  return "1.2.10";
}

async function fetchLatestVersion() {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.github.com/repos/${OPENCODE_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tag = data?.tag_name;
    return typeof tag === "string" ? tag.replace(/^v/, "") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Tauri target triple -> OpenCode release asset (matches OpenWork prepare-sidecar mapping)
// x64 uses baseline for broader CPU compatibility (no AVX2 required)
const TARGET_TO_ASSET = {
  "aarch64-apple-darwin": "opencode-darwin-arm64.zip",
  "x86_64-apple-darwin": "opencode-darwin-x64-baseline.zip",
  "x86_64-unknown-linux-gnu": "opencode-linux-x64-baseline.tar.gz",
  "aarch64-unknown-linux-gnu": "opencode-linux-arm64.tar.gz",
  "x86_64-pc-windows-msvc": "opencode-windows-x64-baseline.zip",
  "aarch64-pc-windows-msvc": "opencode-windows-arm64.zip",
};

function getTargetTriple() {
  if (process.env.TAURI_ENV_TARGET_TRIPLE?.trim()) return process.env.TAURI_ENV_TARGET_TRIPLE.trim();
  if (process.env.CARGO_CFG_TARGET_TRIPLE?.trim()) return process.env.CARGO_CFG_TARGET_TRIPLE.trim();
  try {
    const out = execSync("rustc --print host-tuple", { encoding: "utf8" }).trim();
    if (out) return out;
  } catch {
    // older rustc may not support --print host-tuple; fallback to platform inference (same as OpenWork)
  }
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  if (process.platform === "linux") {
    return process.arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu";
  }
  if (process.platform === "win32") {
    return process.arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
  }
  console.error("Could not determine target triple (set TAURI_ENV_TARGET_TRIPLE or install rustc)");
  process.exit(1);
}

const FORCE = process.argv.includes("--force") || process.env.OPENCODE_SIDECAR_FORCE_BUILD === "1";

function download(url, destFileName) {
  return new Promise((resolve, reject) => {
    const file = path.join(BINARIES_DIR, destFileName);
    const stream = fs.createWriteStream(file);
    https
      .get(url, { redirect: "follow" }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          stream.destroy();
          fs.unlink(file, () => {});
          download(res.headers.location, destFileName).then(resolve).catch(reject);
          return;
        }
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve(file);
        });
      })
      .on("error", (err) => {
        stream.destroy();
        fs.unlink(file, () => {});
        reject(err);
      });
  });
}

function extractZip(zipPath, outDir) {
  execSync(`unzip -o -q "${zipPath}" -d "${outDir}"`, { stdio: "inherit" });
}

function extractTarGz(tarPath, outDir) {
  execSync(`tar -xzf "${tarPath}" -C "${outDir}"`, { stdio: "inherit" });
}

async function main() {
  let version = getVersion();
  if (version.toLowerCase() === "latest") {
    const latest = await fetchLatestVersion();
    if (!latest) {
      console.error("Could not fetch latest OpenCode version from GitHub. Set OPENCODE_VERSION to a specific version.");
      process.exit(1);
    }
    version = latest;
  }

  const target = getTargetTriple();
  const asset = TARGET_TO_ASSET[target];
  if (!asset) {
    console.error(`Unsupported target for OpenCode sidecar: ${target}`);
    console.error("Supported:", Object.keys(TARGET_TO_ASSET).join(", "));
    process.exit(1);
  }

  const baseUrl = `https://github.com/${OPENCODE_REPO}/releases/download/v${version}`;
  const url = `${baseUrl}/${asset}`;
  if (!fs.existsSync(BINARIES_DIR)) {
    fs.mkdirSync(BINARIES_DIR, { recursive: true });
  }

  const isWindows = target.includes("windows");
  const outName = `opencode-${target}${isWindows ? ".exe" : ""}`;
  const outPath = path.join(BINARIES_DIR, outName);
  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`Sidecar already exists: ${outPath}`);
    return;
  }

  console.log(`Downloading OpenCode v${version} for ${target}...`);
  const archivePath = await download(url, asset);
  const extractDir = path.join(BINARIES_DIR, "extract");
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  if (asset.endsWith(".zip")) {
    extractZip(archivePath, extractDir);
  } else {
    extractTarGz(archivePath, extractDir);
  }

  const binaryName = isWindows ? "opencode.exe" : "opencode";
  let src = path.join(extractDir, binaryName);
  if (!fs.existsSync(src)) {
    const first = fs.readdirSync(extractDir)[0];
    if (first) src = path.join(extractDir, first, binaryName) || path.join(extractDir, first);
  }
  if (!fs.existsSync(src)) {
    console.error("Extracted binary not found. Contents:", fs.readdirSync(extractDir));
    process.exit(1);
  }
  fs.renameSync(src, outPath);
  if (!isWindows) {
    fs.chmodSync(outPath, 0o755);
  }
  fs.unlinkSync(archivePath);
  fs.rmSync(extractDir, { recursive: true });
  console.log(`Done: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
