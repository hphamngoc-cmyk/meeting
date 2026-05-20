
/**
 * Parses any localized numeric string back to a standard JavaScript numeric string (e.g. "1234.5")
 */
export function parseValue(str: string): string {
  if (!str) return '';
  
  let s = str.trim();
  if (s === '') return '';

  const isNegative = s.startsWith('-');
  if (isNegative) {
    s = s.slice(1);
  }

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  let clean = '';
  if (hasDot && hasComma) {
    if (lastDot > lastComma) {
      // English format: e.g., 1,234.56
      clean = s.replace(/,/g, '');
    } else {
      // Vietnamese format: e.g., 1.234,56
      clean = s.replace(/\./g, '').replace(/,/g, '.');
    }
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts[parts.length - 1].length === 3 && parts.length === 2 && parseFloat(parts[0]) >= 1) {
      // 1.000 or 5.250 - dot is thousands separator
      clean = s.replace(/\./g, '');
    } else {
      // 6.8, 6.81, 0.123 - dot is decimal separator
      clean = s;
    }
  } else if (hasComma) {
    // Comma is decimal separator: e.g. 6,81 or 6,8
    clean = s.replace(/,/g, '.');
  } else {
    clean = s;
  }
  
  return isNegative ? '-' + clean : clean;
}

/**
 * Formats a string or number into a thousands-separated string with standard rounding to 1 decimal place (Vietnamese style: 6,8)
 */
export function formatValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  
  const cleanStr = parseValue(val.toString());
  const num = parseFloat(cleanStr);
  
  if (isNaN(num)) {
    return val.toString();
  }
  
  // Round to 1 decimal place
  const roundedNum = Math.round(num * 10) / 10;
  
  return roundedNum.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  });
}

