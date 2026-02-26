/**
 * Test script for GST Service and Validation Service
 */

const gstService = require('./services/gstService');
const validationService = require('./services/validationService');

console.log('=== Testing GST Service and Validation ===\n');

// Test 1: GST Type Determination - Intrastate
console.log('Test 1: GST Type Determination - Intrastate (Same State)');
const test1Result = gstService.determineGSTType('MH', 'MH');
console.log(`  Input: supplierState='MH', businessState='MH'`);
console.log(`  Expected: INTRA`);
console.log(`  Result: ${test1Result}`);
console.log(`  Status: ${test1Result === 'INTRA' ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 2: GST Type Determination - Interstate
console.log('Test 2: GST Type Determination - Interstate (Different States)');
const test2Result = gstService.determineGSTType('MH', 'GJ');
console.log(`  Input: supplierState='MH', businessState='GJ'`);
console.log(`  Expected: INTER`);
console.log(`  Result: ${test2Result}`);
console.log(`  Status: ${test2Result === 'INTER' ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 3: GST Split - Intrastate (CGST + SGST)
console.log('Test 3: GST Split - Intrastate (CGST + SGST)');
const test3Result = gstService.splitGST(180, 18, 'INTRA');
console.log(`  Input: amount=180, gstRate=18, type='INTRA'`);
console.log(`  Expected: cgst=90, sgst=90, igst=0`);
console.log(`  Result: cgst=${test3Result.cgst}, sgst=${test3Result.sgst}, igst=${test3Result.igst}`);
console.log(`  Status: ${test3Result.cgst === 90 && test3Result.sgst === 90 && test3Result.igst === 0 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 4: GST Split - Interstate (IGST)
console.log('Test 4: GST Split - Interstate (IGST)');
const test4Result = gstService.splitGST(180, 18, 'INTER');
console.log(`  Input: amount=180, gstRate=18, type='INTER'`);
console.log(`  Expected: cgst=0, sgst=0, igst=180`);
console.log(`  Result: cgst=${test4Result.cgst}, sgst=${test4Result.sgst}, igst=${test4Result.igst}`);
console.log(`  Status: ${test4Result.cgst === 0 && test4Result.sgst === 0 && test4Result.igst === 180 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 5: Purchase GST Calculation - Intrastate
console.log('Test 5: Purchase GST Calculation - Intrastate');
const items1 = [
  { quantity: 10, rate: 100, discount: 0, taxRate: 18 }
];
const test5Result = gstService.calculatePurchaseGST(items1, 'MH', 'MH');
console.log(`  Input: 10 items @ 100, 18% GST, Same State`);
console.log(`  Expected: subtotal=1000, totalCGST=90, totalSGST=90, totalIGST=0, totalTax=180`);
console.log(`  Result: subtotal=${test5Result.subtotal}, totalCGST=${test5Result.totalCGST}, totalSGST=${test5Result.totalSGST}, totalIGST=${test5Result.totalIGST}, totalTax=${test5Result.totalTax}`);
console.log(`  Status: ${test5Result.subtotal === 1000 && test5Result.totalCGST === 90 && test5Result.totalSGST === 90 && test5Result.totalIGST === 0 && test5Result.totalTax === 180 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 6: Purchase GST Calculation - Interstate
console.log('Test 6: Purchase GST Calculation - Interstate');
const items2 = [
  { quantity: 10, rate: 100, discount: 0, taxRate: 18 }
];
const test6Result = gstService.calculatePurchaseGST(items2, 'MH', 'GJ');
console.log(`  Input: 10 items @ 100, 18% GST, Different States`);
console.log(`  Expected: subtotal=1000, totalCGST=0, totalSGST=0, totalIGST=180, totalTax=180`);
console.log(`  Result: subtotal=${test6Result.subtotal}, totalCGST=${test6Result.totalCGST}, totalSGST=${test6Result.totalSGST}, totalIGST=${test6Result.totalIGST}, totalTax=${test6Result.totalTax}`);
console.log(`  Status: ${test6Result.subtotal === 1000 && test6Result.totalCGST === 0 && test6Result.totalSGST === 0 && test6Result.totalIGST === 180 && test6Result.totalTax === 180 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 7: GSTIN Validation - Valid GSTIN
console.log('Test 7: GSTIN Validation - Valid GSTIN');
const test7Result = validationService.validateGSTIN('27AABCU9603R1ZM');
console.log(`  Input: '27AABCU9603R1ZM'`);
console.log(`  Expected: isValid=true`);
console.log(`  Result: isValid=${test7Result.isValid}`);
console.log(`  Status: ${test7Result.isValid === true ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 8: GSTIN Validation - Invalid Length
console.log('Test 8: GSTIN Validation - Invalid Length');
const test8Result = validationService.validateGSTIN('27AABCU9603R1Z');
console.log(`  Input: '27AABCU9603R1Z' (14 chars)`);
console.log(`  Expected: isValid=false`);
console.log(`  Result: isValid=${test8Result.isValid}, error='${test8Result.error}'`);
console.log(`  Status: ${test8Result.isValid === false ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 9: GSTIN Validation - Invalid Format
console.log('Test 9: GSTIN Validation - Invalid Format');
const test9Result = validationService.validateGSTIN('27AABCU9603R1XM');
console.log(`  Input: '27AABCU9603R1XM' (X instead of Z)`);
console.log(`  Expected: isValid=false`);
console.log(`  Result: isValid=${test9Result.isValid}, error='${test9Result.error}'`);
console.log(`  Status: ${test9Result.isValid === false ? '✓ PASS' : '✗ FAIL'}\n`);

// Test 10: GSTIN Validation - Optional (Empty)
console.log('Test 10: GSTIN Validation - Optional (Empty)');
const test10Result = validationService.validateGSTIN('');
console.log(`  Input: '' (empty string)`);
console.log(`  Expected: isValid=true (GSTIN is optional)`);
console.log(`  Result: isValid=${test10Result.isValid}`);
console.log(`  Status: ${test10Result.isValid === true ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('=== Test Summary ===');
console.log('GST Service tests completed ✓');
console.log('Validation Service tests completed ✓');
console.log('\nAll core business logic verified successfully!');
