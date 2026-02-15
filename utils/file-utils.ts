export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt' || extension === 'md') {
    return await file.text();
  } else if (extension === 'pdf') {
    return await parsePdf(file);
  } else {
    throw new Error(`Unsupported file type: .${extension}`);
  }
}

async function parsePdf(file: File): Promise<string> {
  // Dynamic import to avoid loading the library on initial page load
  const pdfjsLib = await import('pdfjs-dist');
  const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

  // Set worker source for PDF.js dynamically
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  // Use the resolved pdfjs object
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }

  return fullText;
}