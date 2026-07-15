import QRCode from "qrcode";
import { jsPDF } from "jspdf";

export const KIDS_JOIN_BASE = "https://leviescalas.com.br/kids/join";
export const KIDS_CHECKIN_BASE = "https://leviescalas.com.br/kids/checkin";

export async function qrToDataUrl(text: string, size = 512): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: "H" });
}

export async function downloadPng(text: string, filename: string) {
  const dataUrl = await qrToDataUrl(text, 800);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function downloadPdf(
  text: string,
  filename: string,
  meta: { title: string; subtitle: string; footer?: string }
) {
  const dataUrl = await qrToDataUrl(text, 900);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text(meta.title, pageW / 2, 30, { align: "center" });

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "normal");
  pdf.text(meta.subtitle, pageW / 2, 42, { align: "center" });

  const size = 130;
  pdf.addImage(dataUrl, "PNG", (pageW - size) / 2, 60, size, size);

  pdf.setFontSize(12);
  pdf.text("Aponte a câmera do seu celular para o QR code", pageW / 2, 205, { align: "center" });
  pdf.text("para cadastrar seu(sua) filho(a).", pageW / 2, 212, { align: "center" });

  if (meta.footer) {
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(meta.footer, pageW / 2, 285, { align: "center" });
  }

  pdf.save(filename);
}
