#!/usr/bin/env tsx
/**
 * Pre-calculate embeddings for all products
 *
 * This script generates OpenAI embeddings for all products that don't have them yet.
 * It processes products in batches to avoid rate limits and memory issues.
 *
 * Usage: npm run generate-embeddings
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import OpenAI from 'openai';

neonConfig.webSocketConstructor = ws;

const BATCH_SIZE = 50; // Process 50 products at a time
const RATE_LIMIT_DELAY = 1000; // Wait 1 second between batches

interface Product {
  id: number;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
}

async function generateEmbeddings() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    console.log('🔄 Starting embedding generation...\n');

    // Get count of products without embeddings
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE embedding IS NULL'
    );
    const totalProducts = parseInt(countResult.rows[0].count);

    if (totalProducts === 0) {
      console.log('✅ All products already have embeddings!');
      return;
    }

    console.log(`📊 Found ${totalProducts} products without embeddings\n`);

    let processed = 0;
    let offset = 0;

    while (offset < totalProducts) {
      // Fetch batch of products without embeddings
      const result = await pool.query<Product>(
        'SELECT id, name, description, brand, model FROM products WHERE embedding IS NULL LIMIT $1 OFFSET $2',
        [BATCH_SIZE, offset]
      );

      const products = result.rows;

      if (products.length === 0) {
        break;
      }

      console.log(`🔄 Processing batch: ${processed + 1} to ${processed + products.length} of ${totalProducts}`);

      // Generate embeddings for this batch
      for (const product of products) {
        try {
          // Create searchable text from product fields
          const searchableText = [
            product.name,
            product.description,
            product.brand,
            product.model
          ]
            .filter(Boolean)
            .join(' ')
            .trim();

          if (!searchableText) {
            console.log(`⚠️  Skipping product ${product.id}: No searchable text`);
            continue;
          }

          // Generate embedding
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: searchableText
          });

          const embedding = response.data[0].embedding;

          // Convert embedding array to pgvector format
          const vectorString = `[${embedding.join(',')}]`;

          // Update product with embedding
          await pool.query(
            'UPDATE products SET embedding = $1, embedding_updated_at = NOW() WHERE id = $2',
            [vectorString, product.id]
          );

          processed++;
          console.log(`✅ Generated embedding for product ${product.id}: "${product.name.substring(0, 50)}${product.name.length > 50 ? '...' : ''}"`);

        } catch (error) {
          console.error(`❌ Failed to generate embedding for product ${product.id}:`, error);
          // Continue with next product
        }
      }

      offset += BATCH_SIZE;

      // Rate limit: wait between batches
      if (offset < totalProducts) {
        console.log(`⏳ Waiting ${RATE_LIMIT_DELAY}ms before next batch...\n`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }

    console.log(`\n✨ Embedding generation complete! Processed ${processed} products.`);

    // Create statistics
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embeddings,
        COUNT(*) - COUNT(embedding) as without_embeddings
      FROM products
    `);

    const stats = statsResult.rows[0];
    console.log('\n📊 Product Statistics:');
    console.log(`   Total products: ${stats.total}`);
    console.log(`   With embeddings: ${stats.with_embeddings}`);
    console.log(`   Without embeddings: ${stats.without_embeddings}`);

  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

generateEmbeddings().catch(error => {
  console.error(error);
  process.exit(1);
});
