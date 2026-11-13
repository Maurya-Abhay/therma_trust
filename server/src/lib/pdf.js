import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export const BRAND = "#0F766E";
export const GREY = "#555555";
export const mm = (value) => (value * 72) / 25.4;

/** Start an A4 document; call `finish()` to get the bytes. */
export function createDocument({ title, author = "ThermaTrust", margin = mm(20) } = {}) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: mm(18), bottom: mm(18), left: margin, right: margin },
    info: { Title: title, Author: author },
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return {
    doc,
    finish() {
      doc.end();
      return finished;
    },
  };
}

export const qrPng = (text, size = 400) => QRCode.toBuffer(text, { type: "png", margin: 2, width: size });

export function heading(doc, text) {
  doc.moveDown(0.9).font("Helvetica-Bold").fontSize(12).fillColor(BRAND).text(text);
  doc.moveDown(0.4).fillColor("#000000");
}

const usableBottom = (doc) => doc.page.height - doc.page.margins.bottom;

/** A simple bordered table; rows are arrays of strings; the first column optionally bold. */
export function table(doc, { header, rows, widths, boldFirstColumn = false, fontSize = 9.5 }) {
  const padding = 5;
  const left = doc.page.margins.left;
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);

  const rowHeight = (cells, bold) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
    const heights = cells.map((cell, i) => doc.heightOfString(String(cell ?? ""), { width: widths[i] - padding * 2 }));
    return Math.max(...heights) + padding * 2;
  };

  const drawRow = (cells, { head = false, zebra = false } = {}) => {
    const height = rowHeight(cells, head || boldFirstColumn);
    if (doc.y + height > usableBottom(doc)) doc.addPage();
    const top = doc.y;
    if (head) doc.rect(left, top, totalWidth, height).fill(BRAND);
    else if (zebra) doc.rect(left, top, totalWidth, height).fill("#F3F8F8");
    doc.lineWidth(0.25).strokeColor("#D5E3E2").rect(left, top, totalWidth, height).stroke();

    let x = left;
    cells.forEach((cell, i) => {
      const bold = head || (boldFirstColumn && i === 0);
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(fontSize)
        .fillColor(head ? "#FFFFFF" : i === 0 && boldFirstColumn ? "#444444" : "#000000")
        .text(String(cell ?? ""), x + padding, top + padding, { width: widths[i] - padding * 2 });
      x += widths[i];
    });
    doc.y = top + height;
    doc.x = left;
  };

  if (header) drawRow(header, { head: true });
  rows.forEach((row, index) => drawRow(row, { zebra: index % 2 === 1 }));
  doc.fillColor("#000000").moveDown(0.3);
}
