const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("exceljs");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");

const MAX_FILE_CHARS = 20_000;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".log", ".json"]);
const DOCUMENT_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ".pdf", ".docx", ".xlsx"]);

async function extractDocumentText(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!DOCUMENT_EXTENSIONS.has(extension)) throw new Error("This file type is not supported.");
  const stats = await fs.lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("Only regular files can be opened.");
  if (stats.size > MAX_DOCUMENT_BYTES) throw new Error("Choose a document smaller than 10 MB.");

  let content;
  if (TEXT_EXTENSIONS.has(extension)) {
    content = await fs.readFile(filePath, "utf8");
  } else {
    const buffer = await fs.readFile(filePath);
    if (extension === ".pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        content = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (extension === ".docx") {
      content = (await mammoth.extractRawText({ buffer })).value;
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      content = workbook.worksheets.map((worksheet) => {
        const rows = [worksheet.name];
        worksheet.eachRow((row) => {
          rows.push(row.values.slice(1).map((value) => {
            if (value == null) return "";
            if (typeof value === "object") {
              if ("text" in value) return String(value.text);
              if ("result" in value) return String(value.result ?? "");
              if ("richText" in value) return value.richText.map((part) => part.text).join("");
              return "";
            }
            return String(value);
          }).join("\t"));
        });
        return rows.join("\n");
      }).join("\n\n");
    }
  }
  if (content.length > MAX_FILE_CHARS) {
    throw new Error(`This document exceeds the ${MAX_FILE_CHARS.toLocaleString()} character limit.`);
  }
  return content;
}

module.exports = { DOCUMENT_EXTENSIONS, TEXT_EXTENSIONS, MAX_DOCUMENT_BYTES, MAX_FILE_CHARS, extractDocumentText };
