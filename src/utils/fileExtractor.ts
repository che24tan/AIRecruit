import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Set worker path for pdfjs with robust CDN fallbacks matching version
const version = pdfjsLib.version || "4.0.379";
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function extractPdfTextFallback(arrayBuffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawStr = decoder.decode(arrayBuffer);

    // Extract text blocks inside PDF Tj / TJ operators
    const matches = rawStr.match(/\(([^()]{2,})\)\s*T[jJ]/g) || [];
    let text = matches
      .map((m) => m.replace(/^[\(\s]+|[\)\s]*T[jJ]$/g, ""))
      .join(" ");

    if (!text || text.length < 30) {
      // Extract readable ASCII string sequences
      const asciiMatches = rawStr.match(/[A-Za-z0-9\s,.@+\-()/]{4,}/g) || [];
      text = asciiMatches
        .filter((s) => !s.startsWith("PDF") && !s.includes("Font") && !s.includes("Stream") && !s.includes("obj"))
        .join(" ");
    }
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
  } catch {
    return "";
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  try {
    if (fileName.endsWith(".txt")) {
      const text = await file.text();
      return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
    } else if (fileName.endsWith(".docx")) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return (result.value || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
    } else if (fileName.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();

      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          fullText += pageText + "\n";
        }

        const cleaned = fullText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
        if (cleaned.length > 20) {
          return cleaned;
        }
      } catch (pdfErr) {
        console.warn("PDF.js worker/parse failed, using arrayBuffer decoder fallback:", pdfErr);
      }

      return extractPdfTextFallback(arrayBuffer);
    }
  } catch (err) {
    console.warn("Primary file extraction failed, attempting fallback:", err);
  }

  // Fallback for .doc and unknown file formats
  try {
    const raw = await file.text();
    return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
  } catch {
    return "";
  }
}

