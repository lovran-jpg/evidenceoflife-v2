#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const targetDir = process.argv[2] || process.cwd();
const allowedLabels = new Set([1, 2, 3, "1", "2", "3"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile()) return [fullPath];
    return [];
  });
}

function decodeXmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stringsFromBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  const utf16le = buffer.toString("utf16le");
  return `${utf8}\n${utf16le}`;
}

function tryJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = decodeXmlEntities(value.trim());
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function findJsonNearAigc(text) {
  const candidates = [];
  for (const match of text.matchAll(/AIGC/gi)) {
    const start = Math.max(0, match.index - 500);
    const end = Math.min(text.length, match.index + 2000);
    const window = text.slice(start, end);
    const firstBrace = window.indexOf("{");
    const lastBrace = window.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const parsed = tryJson(window.slice(firstBrace, lastBrace + 1));
      if (parsed) candidates.push(parsed);
    }
  }
  return candidates;
}

function flattenValues(value, prefix = "") {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenValues(child, prefix ? `${prefix}.${key}` : key),
  );
}

function validateAigcObject(value) {
  const flattened = flattenValues(value);
  const fields = Object.fromEntries(flattened.map(([key, val]) => [key.toLowerCase(), val]));
  const labelEntry = flattened.find(([key]) => key.toLowerCase().endsWith("label"));
  const platformEntry = flattened.find(([key]) =>
    /platform|propagation|publisher|service|app|source/.test(key.toLowerCase()),
  );
  const contentEntry = flattened.find(([key]) =>
    /content.*id|contentid|id$|number|identifier|uuid/.test(key.toLowerCase()),
  );

  return {
    hasAigcKeyword: JSON.stringify(value).toUpperCase().includes("AIGC"),
    hasValidLabel: Boolean(labelEntry && allowedLabels.has(labelEntry[1])),
    label: labelEntry?.[1] ?? null,
    hasPlatformCode: Boolean(platformEntry && String(platformEntry[1]).trim()),
    platformCode: platformEntry?.[1] ?? null,
    hasContentId: Boolean(contentEntry && String(contentEntry[1]).trim()),
    contentId: contentEntry?.[1] ?? null,
    rawObject: value,
    fields,
  };
}

function findAigcEvidence(text) {
  const jsonCandidates = findJsonNearAigc(text).map(validateAigcObject);
  const lines = text
    .split(/\r?\n/)
    .filter((line) => /AIGC|AI\s*生成|人工智能|生成合成/i.test(line))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    hasAigcKeyword: /AIGC/i.test(text),
    hasVisibleAiDisclosureText: /AI\s*生成|人工智能生成|图片由AI生成|本文档由\s*AI\s*生成/i.test(text),
    jsonCandidates,
    matchingText: [...new Set(lines)],
  };
}

function readZipEntries(buffer) {
  const entries = new Map();
  let offset = buffer.length - 22;
  while (offset >= 0 && buffer.readUInt32LE(offset) !== 0x06054b50) offset -= 1;
  if (offset < 0) return entries;

  const centralDirectorySize = buffer.readUInt32LE(offset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(offset + 16);
  let cursor = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (cursor < end && buffer.readUInt32LE(cursor) === 0x02014b50) {
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data = compressed;
    if (method === 8) data = zlib.inflateRawSync(compressed);
    if (method === 0 || method === 8) entries.set(name, data);

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function inspectDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const entries = readZipEntries(buffer);
  const metadataEntries = [...entries.entries()].filter(([name]) =>
    /^docProps\/|customXml\//i.test(name),
  );
  const combined = metadataEntries
    .map(([name, data]) => `\n--- ${name} ---\n${data.toString("utf8")}`)
    .join("\n");

  return {
    type: "docx",
    metadataParts: metadataEntries.map(([name]) => name),
    ...findAigcEvidence(combined),
  };
}

function inspectPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = stringsFromBuffer(buffer);
  const infoKeys = [...text.matchAll(/\/([A-Za-z][A-Za-z0-9_-]*)\s*\(([^)]{0,500})\)/g)]
    .slice(0, 80)
    .map((match) => ({ key: match[1], value: match[2] }));
  const xmpMatches = [...text.matchAll(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi)].map((match) =>
    match[0].slice(0, 5000),
  );

  return {
    type: "pdf",
    infoKeys,
    xmpPacketCount: xmpMatches.length,
    ...findAigcEvidence(`${text}\n${xmpMatches.join("\n")}`),
  };
}

function readPngChunks(buffer) {
  const chunks = [];
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return chunks;
  let cursor = 8;
  while (cursor + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(cursor);
    const type = buffer.subarray(cursor + 4, cursor + 8).toString("ascii");
    const data = buffer.subarray(cursor + 8, cursor + 8 + length);
    chunks.push({ type, data });
    cursor += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function inspectPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunkTexts = readPngChunks(buffer)
    .flatMap(({ type, data }) => {
      if (type === "tEXt") return [`${type}:${data.toString("latin1")}`];
      if (type === "zTXt") {
        const nul = data.indexOf(0);
        if (nul > 0) {
          return [`${type}:${data.subarray(0, nul).toString("latin1")}=${zlib.inflateSync(data.subarray(nul + 2)).toString("utf8")}`];
        }
      }
      if (type === "iTXt") return [`${type}:${data.toString("utf8")}`];
      return [];
    })
    .join("\n");

  return {
    type: "png",
    metadataChunkTypes: readPngChunks(buffer).map(({ type }) => type),
    ...findAigcEvidence(`${chunkTexts}\n${stringsFromBuffer(buffer)}`),
  };
}

function inspectTextLike(filePath, type) {
  return {
    type,
    ...findAigcEvidence(fs.readFileSync(filePath, "utf8")),
  };
}

function inspectUnknown(filePath) {
  return {
    type: "binary",
    ...findAigcEvidence(stringsFromBuffer(fs.readFileSync(filePath))),
  };
}

function verdict(evidence) {
  const validCandidate = evidence.jsonCandidates?.find(
    (candidate) =>
      candidate.hasAigcKeyword &&
      candidate.hasValidLabel &&
      candidate.hasPlatformCode &&
      candidate.hasContentId,
  );

  if (validCandidate) return "PASS: found parseable AIGC JSON metadata with Label, platform code, and content id";
  if (evidence.hasAigcKeyword && evidence.jsonCandidates?.length) {
    return "FAIL: found AIGC JSON-like metadata, but required fields are incomplete or invalid";
  }
  if (evidence.hasAigcKeyword) return "FAIL: found AIGC keyword, but no parseable AIGC JSON metadata";
  if (evidence.hasVisibleAiDisclosureText) return "FAIL: found visible AI disclosure text, but no AIGC implicit metadata";
  return "FAIL: no AIGC implicit metadata evidence found";
}

const files = walk(targetDir).filter((file) => !path.basename(file).startsWith("~$"));
const inspected = files.map((file) => {
  const ext = path.extname(file).toLowerCase();
  let evidence;
  if (ext === ".docx") evidence = inspectDocx(file);
  else if (ext === ".pdf") evidence = inspectPdf(file);
  else if (ext === ".png") evidence = inspectPng(file);
  else if ([".py", ".js", ".ts", ".json", ".txt", ".md", ".xml"].includes(ext)) {
    evidence = inspectTextLike(file, ext.slice(1) || "text");
  } else {
    evidence = inspectUnknown(file);
  }

  return {
    file,
    relativePath: path.relative(targetDir, file),
    size: fs.statSync(file).size,
    verdict: verdict(evidence),
    evidence,
  };
});

const report = {
  targetDir,
  scannedAt: new Date().toISOString(),
  summary: {
    filesScanned: inspected.length,
    pass: inspected.filter((item) => item.verdict.startsWith("PASS")).length,
    fail: inspected.filter((item) => item.verdict.startsWith("FAIL")).length,
  },
  files: inspected,
};

console.log(JSON.stringify(report, null, 2));
