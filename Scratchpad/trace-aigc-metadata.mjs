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

function stripUserCommentEncodingPrefix(value) {
  if (!Buffer.isBuffer(value)) return value;
  const prefix = value.subarray(0, 8).toString("ascii");
  if (/^(ASCII|UNICODE|JIS)\0*/.test(prefix)) return value.subarray(8).toString("utf8");
  return value.toString("utf8");
}

function parseJsonCandidates(text) {
  const candidates = [];
  const decoded = decodeXmlEntities(text);

  for (const match of decoded.matchAll(/(?:"AIGC"|AIGC)\s*[:=]\s*(\{[\s\S]*?\})/gi)) {
    const wrapped = tryJson(`{"AIGC":${match[1]}}`);
    if (wrapped) candidates.push(wrapped);
  }

  for (const match of decoded.matchAll(/\{[\s\S]{0,5000}?"AIGC"[\s\S]{0,5000}?\}/gi)) {
    const parsed = tryJson(match[0]);
    if (parsed) candidates.push(parsed);
  }

  return candidates;
}

function findJsonNearAigc(text) {
  const candidates = parseJsonCandidates(text);
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
  const producerEntry = flattened.find(([key]) => key.toLowerCase().endsWith("contentproducer"));
  const propagatorEntry = flattened.find(([key]) => key.toLowerCase().endsWith("contentpropagator"));
  const platformEntry = flattened.find(([key]) =>
    /contentproducer|contentpropagator|platform|propagation|publisher|service|app|source/.test(
      key.toLowerCase(),
    ),
  );
  const produceIdEntry = flattened.find(([key]) => key.toLowerCase().endsWith("produceid"));
  const contentEntry = flattened.find(([key]) =>
    /produceid|content.*id|contentid|id$|number|identifier|uuid/.test(key.toLowerCase()),
  );

  return {
    hasAigcKeyword: JSON.stringify(value).toUpperCase().includes("AIGC"),
    hasValidLabel: Boolean(labelEntry && allowedLabels.has(labelEntry[1])),
    label: labelEntry?.[1] ?? null,
    hasContentProducer: Boolean(producerEntry && String(producerEntry[1]).trim()),
    contentProducer: producerEntry?.[1] ?? null,
    hasContentPropagator: Boolean(propagatorEntry && String(propagatorEntry[1]).trim()),
    contentPropagator: propagatorEntry?.[1] ?? null,
    hasProduceId: Boolean(produceIdEntry && String(produceIdEntry[1]).trim()),
    produceId: produceIdEntry?.[1] ?? null,
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

function readExifUserCommentFromJpeg(buffer) {
  if (buffer.readUInt16BE(0) !== 0xffd8) return null;
  let cursor = 2;

  while (cursor + 4 < buffer.length) {
    if (buffer[cursor] !== 0xff) break;
    const marker = buffer[cursor + 1];
    const length = buffer.readUInt16BE(cursor + 2);
    const segmentStart = cursor + 4;
    const segmentEnd = cursor + 2 + length;
    const segment = buffer.subarray(segmentStart, segmentEnd);

    if (marker === 0xe1 && segment.subarray(0, 6).toString("ascii") === "Exif\0\0") {
      const tiff = segment.subarray(6);
      const littleEndian = tiff.subarray(0, 2).toString("ascii") === "II";
      const readU16 = (offset) => (littleEndian ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset));
      const readU32 = (offset) => (littleEndian ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset));
      const ifd0 = readU32(4);
      const ifd0Count = readU16(ifd0);
      let exifIfdOffset = null;

      for (let i = 0; i < ifd0Count; i += 1) {
        const entry = ifd0 + 2 + i * 12;
        if (readU16(entry) === 0x8769) exifIfdOffset = readU32(entry + 8);
      }

      if (exifIfdOffset === null) return null;
      const exifCount = readU16(exifIfdOffset);
      for (let i = 0; i < exifCount; i += 1) {
        const entry = exifIfdOffset + 2 + i * 12;
        if (readU16(entry) !== 0x9286) continue;
        const count = readU32(entry + 4);
        const valueOffset = count <= 4 ? entry + 8 : readU32(entry + 8);
        return stripUserCommentEncodingPrefix(tiff.subarray(valueOffset, valueOffset + count));
      }
    }

    cursor = segmentEnd;
  }

  return null;
}

function inspectJpeg(filePath) {
  const buffer = fs.readFileSync(filePath);
  const userComment = readExifUserCommentFromJpeg(buffer);

  return {
    type: "jpeg",
    hasExifUserComment: Boolean(userComment),
    exifUserComment: userComment,
    ...findAigcEvidence(`${userComment || ""}\n${stringsFromBuffer(buffer)}`),
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
      (candidate.hasContentProducer || candidate.hasContentPropagator || candidate.hasPlatformCode) &&
      (candidate.hasProduceId || candidate.hasContentId),
  );

  if (validCandidate) {
    return "PASS: found parseable AIGC JSON metadata with Label, producer/propagator code, and ProduceID/content id";
  }
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
  else if ([".jpg", ".jpeg"].includes(ext)) evidence = inspectJpeg(file);
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
