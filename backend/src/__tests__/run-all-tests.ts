/**
 * Comprehensive API Test Runner
 * Runs all API tests and generates detailed reports
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResult {
  testSuite: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  errors: string[];
}

interface TestSummary {
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalDuration: number;
  results: TestResult[];
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

/**
 * Get all test files in the API directory
 */
function getTestFiles(): string[] {
  const testDir = path.join(__dirname, 'api');
  const files = fs.readdirSync(testDir);
  return files.filter(file => file.endsWith('.test.ts')).map(file => path.join(testDir, file));
}

/**
 * Run a single test file and parse results
 */
function runTestFile(testFile: string): TestResult {
  const testName = path.basename(testFile, '.test.ts');
  console.log(`\n🧪 Running ${testName} tests...`);
  
  const startTime = Date.now();
  let output = '';
  let errors: string[] = [];
  
  try {
    output = execSync(`npm test -- ${testFile} --verbose --no-coverage`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../../../'),
      timeout: 120000, // 2 minutes timeout per test file
    });
  } catch (error: any) {
    output = error.stdout || '';
    errors.push(error.message);
  }
  
  const duration = Date.now() - startTime;
  
  // Parse Jest output to extract test counts
  const passedMatch = output.match(/(\d+) passed/);
  const failedMatch = output.match(/(\d+) failed/);
  const totalMatch = output.match(/Tests:\s+(\d+)/);
  
  const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
  const total = totalMatch ? parseInt(totalMatch[1]) : passed + failed;
  
  // Extract error details
  const errorLines = output.split('\n').filter(line => 
    line.includes('FAIL') || 
    line.includes('Error:') || 
    line.includes('Expected:') ||
    line.includes('Received:')
  );
  
  errors.push(...errorLines);
  
  return {
    testSuite: testName,
    passed,
    failed,
    total,
    duration,
    errors: errors.filter(Boolean),
  };
}

/**
 * Run all tests and generate comprehensive report
 */
async function runAllTests(): Promise<TestSummary> {
  console.log('🚀 Starting comprehensive API test suite...\n');
  
  const testFiles = getTestFiles();
  const results: TestResult[] = [];
  
  console.log(`Found ${testFiles.length} test suites:`);
  testFiles.forEach(file => {
    console.log(`  - ${path.basename(file, '.test.ts')}`);
  });
  
  // Run each test file
  for (const testFile of testFiles) {
    const result = runTestFile(testFile);
    results.push(result);
    
    // Print immediate results
    if (result.failed === 0) {
      console.log(`✅ ${result.testSuite}: ${result.passed}/${result.total} passed (${result.duration}ms)`);
    } else {
      console.log(`❌ ${result.testSuite}: ${result.passed}/${result.total} passed, ${result.failed} failed (${result.duration}ms)`);
    }
  }
  
  // Run coverage report
  console.log('\n📊 Generating coverage report...');
  let coverage;
  try {
    const coverageOutput = execSync('npm run test:coverage -- --testPathPattern=api --silent', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../../../'),
      timeout: 180000, // 3 minutes for coverage
    });
    
    // Parse coverage from output
    const coverageMatch = coverageOutput.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4]),
      };
    }
  } catch (error) {
    console.log('⚠️  Coverage report generation failed');
  }
  
  // Calculate totals
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  return {
    totalSuites: results.length,
    totalTests,
    totalPassed,
    totalFailed,
    totalDuration,
    results,
    coverage,
  };
}

/**
 * Generate detailed test report
 */
function generateReport(summary: TestSummary): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE API TEST REPORT');
  console.log('='.repeat(80));
  
  // Overall summary
  console.log('\n📊 OVERALL SUMMARY:');
  console.log(`  Test Suites: ${summary.totalSuites}`);
  console.log(`  Total Tests: ${summary.totalTests}`);
  console.log(`  Passed: ${summary.totalPassed} (${((summary.totalPassed / summary.totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${summary.totalFailed} (${((summary.totalFailed / summary.totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);
  
  // Coverage summary
  if (summary.coverage) {
    console.log('\n📈 CODE COVERAGE:');
    console.log(`  Statements: ${summary.coverage.statements}%`);
    console.log(`  Branches: ${summary.coverage.branches}%`);
    console.log(`  Functions: ${summary.coverage.functions}%`);
    console.log(`  Lines: ${summary.coverage.lines}%`);
  }
  
  // Detailed results
  console.log('\n📝 DETAILED RESULTS:');
  summary.results.forEach(result => {
    const status = result.failed === 0 ? '✅' : '❌';
    const percentage = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0.0';
    
    console.log(`\n  ${status} ${result.testSuite.toUpperCase()}`);
    console.log(`     Tests: ${result.passed}/${result.total} passed (${percentage}%)`);
    console.log(`     Duration: ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      console.log(`     Errors:`);
      result.errors.slice(0, 3).forEach(error => {
        console.log(`       - ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
      });
      if (result.errors.length > 3) {
        console.log(`       ... and ${result.errors.length - 3} more errors`);
      }
    }
  });
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  
  const failedSuites = summary.results.filter(r => r.failed > 0);
  if (failedSuites.length > 0) {
    console.log('  🔧 Fix failing tests in:');
    failedSuites.forEach(suite => {
      console.log(`     - ${suite.testSuite} (${suite.failed} failures)`);
    });
  }
  
  if (summary.coverage && summary.coverage.lines < 80) {
    console.log('  📈 Improve test coverage (currently below 80%)');
  }
  
  const slowSuites = summary.results.filter(r => r.duration > 10000);
  if (slowSuites.length > 0) {
    console.log('  ⚡ Optimize slow test suites:');
    slowSuites.forEach(suite => {
      console.log(`     - ${suite.testSuite} (${(suite.duration / 1000).toFixed(2)}s)`);
    });
  }
  
  // Final status
  console.log('\n' + '='.repeat(80));
  if (summary.totalFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! Your API is working correctly.');
  } else {
    console.log(`⚠️  ${summary.totalFailed} TESTS FAILED. Please review and fix the issues above.`);
  }
  console.log('='.repeat(80));
}

/**
 * Save report to file
 */
function saveReportToFile(summary: TestSummary): void {
  const reportPath = path.join(__dirname, '../../../test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      testDatabase: process.env.DATABASE_URL,
    },
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const summary = await runAllTests();
    generateReport(summary);
    saveReportToFile(summary);
    
    // Exit with appropriate code
    process.exit(summary.totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { runAllTests, generateReport };