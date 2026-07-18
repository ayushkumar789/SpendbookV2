import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { formatCurrencyPdf, formatDate, methodLabel } from "@/lib/helpers";
import type { Book, PaymentMethod, Transaction } from "@/types";

interface ExportContext {
  book: Book;
  transactions: Transaction[];
  methods: PaymentMethod[];
  rangeLabel: string;
}

function totals(transactions: Transaction[]): { cashIn: number; cashOut: number; net: number } {
  let cashIn = 0;
  let cashOut = 0;
  for (const t of transactions) {
    if (t.type === "in") cashIn += Number(t.amount);
    else if (t.type === "out") cashOut += Number(t.amount);
    // self transfers don't change the totals
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

export function exportBookPdf({ book, transactions, methods, rangeLabel }: ExportContext): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Header band
  doc.setFillColor(34, 26, 17);
  doc.rect(0, 0, pageW, 96, "F");
  doc.setTextColor(232, 148, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SpendBook", margin, 42);
  doc.setTextColor(247, 242, 233);
  doc.setFontSize(14);
  doc.text(book.name, margin, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(176, 164, 141);
  doc.text(rangeLabel, margin, 82);
  y = 96 + 32;

  // Summary
  const t = totals(transactions);
  doc.setTextColor(34, 26, 17);
  const summary: Array<[string, string]> = [
    ["Cash In", formatCurrencyPdf(t.cashIn)],
    ["Cash Out", formatCurrencyPdf(t.cashOut)],
    ["Net Balance", formatCurrencyPdf(t.net)],
  ];
  const colW = (pageW - margin * 2) / 3;
  summary.forEach(([label, value], i) => {
    const x = margin + i * colW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(122, 111, 92);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(34, 26, 17);
    doc.text(value, x, y + 18);
  });
  y += 48;

  // Table
  const cols: Array<{ label: string; w: number }> = [
    { label: "Date", w: 66 },
    { label: "Type", w: 40 },
    { label: "Category", w: 108 },
    { label: "Amount", w: 92 },
    { label: "Method", w: 118 },
    { label: "Note", w: pageW - margin * 2 - 424 },
  ];

  const drawHead = (): void => {
    doc.setFillColor(239, 232, 218);
    doc.rect(margin, y - 12, pageW - margin * 2, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(107, 96, 80);
    let x = margin + 6;
    for (const c of cols) {
      doc.text(c.label.toUpperCase(), x, y + 2);
      x += c.w;
    }
    y += 24;
  };

  drawHead();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const txn of transactions) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin + 12;
      drawHead();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    let x = margin + 6;
    const txnType = txn.type as string;
    const cells = [
      formatDate(txn.date, "dd/MM/yyyy"),
      txnType === "in" ? "IN" : txnType === "transfer" ? "TRF" : "OUT",
      txn.category,
      `${txnType === "in" ? "+" : txnType === "transfer" ? "" : "-"}${formatCurrencyPdf(Number(txn.amount))}`,
      methodLabel(txn.payment_method_id, methods),
      txn.note ?? "",
    ];
    const typeColor: [number, number, number] =
      txnType === "in" ? [27, 158, 116] : txnType === "transfer" ? [10, 135, 160] : [217, 67, 92];
    cells.forEach((cell, i) => {
      if (i === 1) {
        doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
        doc.setFont("helvetica", "bold");
      } else if (i === 3) {
        doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
        doc.setFont("helvetica", "normal");
      } else {
        doc.setTextColor(34, 26, 17);
        doc.setFont("helvetica", "normal");
      }
      const clipped = doc.splitTextToSize(cell, cols[i].w - 10)[0] ?? "";
      doc.text(String(clipped), x, y);
      x += cols[i].w;
    });
    doc.setDrawColor(234, 225, 207);
    doc.line(margin, y + 6, pageW - margin, y + 6);
    y += 18;
  }

  doc.save(`${book.name.replace(/[^\w\d]+/g, "-")}-spendbook.pdf`);
}

export function exportBookExcel({ book, transactions, methods, rangeLabel }: ExportContext): void {
  const t = totals(transactions);
  const header = [
    ["SpendBook — " + book.name],
    ["Range", rangeLabel],
    ["Cash In", t.cashIn],
    ["Cash Out", t.cashOut],
    ["Net Balance", t.net],
    [],
    ["Date", "Type", "Category", "Amount (INR)", "Payment Method", "Note"],
  ];
  const rows = transactions.map((txn) => {
    const txnType = txn.type as string;
    return [
      formatDate(txn.date, "dd/MM/yyyy"),
      txnType === "in" ? "Cash In" : txnType === "transfer" ? "Transfer" : "Cash Out",
      txn.category,
      // transfers are net-zero: recorded at face value, not signed
      txnType === "out" ? -Number(txn.amount) : Number(txn.amount),
      methodLabel(txn.payment_method_id, methods),
      txn.note ?? "",
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  XLSX.writeFile(wb, `${book.name.replace(/[^\w\d]+/g, "-")}-spendbook.xlsx`);
}
