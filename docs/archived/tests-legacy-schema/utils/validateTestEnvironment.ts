/**
 * CRITICAL SAFETY MODULE
 * Prevents tests from running against production database
 */

const PRODUCTION_BLOCKLIST_PATTERNS: string[] = [
  'prod', 'production', 'live', '-prd-', '-prd.'
];

const ALLOWED_PATTERNS: string[] = [
  'localhost', '127.0.0.1', 'test', 'staging', 'dev', '-test-', '-test.', '-stg-', '-dev-'
];

export interface ValidationResult {
  isValid: boolean;
  url: string;
  reason: string;
  warnings: string[];
}

export function validateTestEnvironment(): ValidationResult {
  const url = process.env.SUPABASE_TEST_URL || '';
  const customBlocklist = process.env.TEST_PRODUCTION_BLOCKLIST?.split(',') || [];
  const allBlocklistPatterns = [...PRODUCTION_BLOCKLIST_PATTERNS, ...customBlocklist];
  const warnings: string[] = [];

  if (!url) {
    return { isValid: false, url: '(not set)', reason: 'SUPABASE_TEST_URL is not set', warnings };
  }

  const matchedBlockPattern = allBlocklistPatterns.find(p =>
    url.toLowerCase().includes(p.toLowerCase())
  );
  if (matchedBlockPattern) {
    return {
      isValid: false,
      url,
      reason: `URL contains blocked pattern: "${matchedBlockPattern}"`,
      warnings
    };
  }

  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  const matchedAllowed = ALLOWED_PATTERNS.find(p =>
    url.toLowerCase().includes(p.toLowerCase())
  );
  if (!isLocalhost && !matchedAllowed) {
    warnings.push(`URL lacks typical test indicators. Ensure this is not production.`);
  }

  if (!process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
    warnings.push('SUPABASE_TEST_SERVICE_ROLE_KEY not set. Admin tests will fail.');
  }

  if (!process.env.SUPABASE_TEST_ANON_KEY) {
    return { isValid: false, url, reason: 'SUPABASE_TEST_ANON_KEY is not set', warnings };
  }

  return { isValid: true, url, reason: 'Validation passed', warnings };
}

export function assertTestEnvironment(): void {
  const result = validateTestEnvironment();

  if (!result.isValid) {
    throw new Error([
      '',
      '╔══════════════════════════════════════════════════════════╗',
      '║  🚫 TEST ENVIRONMENT VALIDATION FAILED                   ║',
      '╠══════════════════════════════════════════════════════════╣',
      `║  URL: ${result.url.substring(0, 48).padEnd(48)}  ║`,
      `║  Reason: ${result.reason.substring(0, 44).padEnd(44)}  ║`,
      '╠══════════════════════════════════════════════════════════╣',
      '║  Tests BLOCKED to protect production data.               ║',
      '║  Use a test project or local Docker (supabase start).    ║',
      '╚══════════════════════════════════════════════════════════╝',
      ''
    ].join('\n'));
  }

  console.log(`✅ Test environment validated: ${result.url}`);
  result.warnings.forEach(w => console.log(`⚠️  ${w}`));
}

// Standalone execution
if (require.main === module || process.argv[1]?.includes('validateTestEnvironment')) {
  try { require('dotenv').config({ path: '.env.test' }); } catch {}

  const result = validateTestEnvironment();
  console.log('\n═══════════════════════════════════════════');
  console.log('  OPEN MIC DROP - Test Environment Check');
  console.log('═══════════════════════════════════════════\n');
  console.log(result.isValid ? '✅ STATUS: VALID' : '❌ STATUS: BLOCKED');
  console.log(`   URL: ${result.url}`);
  if (!result.isValid) console.log(`   Reason: ${result.reason}`);
  result.warnings.forEach(w => console.log(`⚠️  ${w}`));
  console.log('');
  process.exit(result.isValid ? 0 : 1);
}
