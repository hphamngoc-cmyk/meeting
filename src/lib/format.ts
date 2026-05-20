
/**
 * Formats a string or number into a thousands-separated string (Vietnamese style: 1.000.000)
 */
export function formatValue(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === '') return '';
  
  // Convert to string and remove existing separators to be safe
  const str = val.toString().replace(/\./g, '').replace(/,/g, '');
  
  // Check if it's numeric
  if (isNaN(Number(str))) return str;
  
  return Number(str).toLocaleString('vi-VN');
}

/**
 * Parses a numeric string with separators back to a clean string of digits
 */
export function parseValue(str: string): string {
  // Remove all non-digit characters except decimals if needed
  // But for simple "thousands", we just remove dots and commas
  return str.replace(/\./g, '');
}
