/**
 * Generate document number based on custom format
 * 
 * Supported placeholders:
 * {PREFIX} - Document prefix (e.g., INV, CN, DN)
 * {YYYY} - Full year (e.g., 2025)
 * {YY} - Short year (e.g., 25)
 * {YY+1} - Next year short (e.g., 26 for financial year 25-26)
 * {###} - Counter with 3 digits (e.g., 001, 218)
 * {####} - Counter with 4 digits (e.g., 0001, 0218)
 * {#####} - Counter with 5 digits
 * 
 * Examples:
 * Format: "{PREFIX}/{YY}-{YY+1}/{###}" with prefix "VE", counter 218 => "VE/25-26/218"
 * Format: "{PREFIX}-{YYYY}-{###}" with prefix "INV", counter 5 => "INV-2025-005"
 * Format: "{PREFIX}/{YYYY}/{####}" with prefix "CN", counter 42 => "CN/2025/0042"
 */
function generateDocumentNumber(format, prefix, counter) {
  const now = new Date();
  const fullYear = now.getFullYear();
  const shortYear = fullYear.toString().slice(-2);
  const nextShortYear = (parseInt(shortYear) + 1).toString().padStart(2, '0');
  
  let result = format;
  
  // Replace placeholders
  result = result.replace(/{PREFIX}/g, prefix);
  result = result.replace(/{YYYY}/g, fullYear.toString());
  result = result.replace(/{YY\+1}/g, nextShortYear);
  result = result.replace(/{YY}/g, shortYear);
  
  // Replace counter placeholders with appropriate padding
  result = result.replace(/{#####}/g, String(counter).padStart(5, '0'));
  result = result.replace(/{####}/g, String(counter).padStart(4, '0'));
  result = result.replace(/{###}/g, String(counter).padStart(3, '0'));
  result = result.replace(/{##}/g, String(counter).padStart(2, '0'));
  result = result.replace(/{#}/g, String(counter));
  
  return result;
}

module.exports = { generateDocumentNumber };
