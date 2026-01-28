/**
 * Quick dry-run test for Direct Retailer Search
 *
 * Run with: npx tsx scripts/test-direct-search.ts
 */

import { directRetailerSearchService } from '../server/services/direct-retailer-search';

async function main() {
  const query = process.argv[2] || 'AirPods Pro';

  console.log('🔍 Direct Retailer Search - Dry Run Test');
  console.log('========================================');
  console.log(`Query: "${query}"`);
  console.log(`Max results per retailer: 3`);
  console.log('');

  console.log('⏳ Searching Canadian retailers (this may take 30-60 seconds)...');
  console.log('');

  const startTime = Date.now();

  try {
    // Search all retailers
    const results = await directRetailerSearchService.searchAllRetailers(query, 3);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Search completed in ${elapsed}s`);
    console.log('');

    // Display results
    for (const result of results) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🏪 ${result.retailer} (${result.domain})`);
      console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);

      if (!result.success) {
        console.log(`   Error: ${result.error}`);
        continue;
      }

      console.log(`   Products found: ${result.products.length}`);
      console.log('');

      for (const product of result.products) {
        const priceStr = product.price ? `C$${product.price.toFixed(2)}` : 'Price N/A';
        console.log(`   📦 ${product.title.substring(0, 60)}${product.title.length > 60 ? '...' : ''}`);
        console.log(`      💰 ${priceStr}`);
        console.log(`      🔗 ${product.url.substring(0, 70)}...`);
        console.log('');
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const totalProducts = results.reduce((sum, r) => sum + r.products.length, 0);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('📊 Summary');
    console.log(`   Retailers searched: ${results.length}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Total products found: ${totalProducts}`);
    console.log(`   Time elapsed: ${elapsed}s`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
