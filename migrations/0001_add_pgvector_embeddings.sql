-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add timestamp to track when embedding was last calculated
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding_updated_at timestamp;

-- Create index for faster vector similarity searches
-- Using HNSW (Hierarchical Navigable Small World) algorithm for approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS products_embedding_idx ON products
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add a GIN index on product names and descriptions for hybrid search
CREATE INDEX IF NOT EXISTS products_name_gin_idx ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS products_description_gin_idx ON products USING gin(to_tsvector('english', COALESCE(description, '')));

-- Add comment to document the embedding dimension
COMMENT ON COLUMN products.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic search';
