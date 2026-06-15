export interface ParsedProduct {
  name: string;
  caption: string;
  media_url: string;
  media_type: string;
}

export function parseCsvToProducts(csvText: string): ParsedProduct[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  // Split by newlines, respecting quotes
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      // Skip \n if it was \r\n
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => {
    let clean = h.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
      clean = clean.substring(1, clean.length - 1).replace(/""/g, '"');
    }
    return clean.toLowerCase();
  });

  const results: ParsedProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: any = {};
    headers.forEach((header, index) => {
      let val = values[index] !== undefined ? values[index].trim() : '';
      // Remove surrounding quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).replace(/""/g, '"');
      }
      row[header] = val;
    });

    if (!row.name) {
      continue; // Skip rows without name (required)
    }

    let mediaType = row.media_type || 'text';
    const validMediaTypes = ['text', 'image', 'video', 'audio', 'document'];
    if (!validMediaTypes.includes(mediaType.toLowerCase())) {
      mediaType = 'text';
    }

    results.push({
      name: row.name,
      caption: row.caption || '',
      media_url: row.media_url || '',
      media_type: mediaType.toLowerCase(),
    });
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
