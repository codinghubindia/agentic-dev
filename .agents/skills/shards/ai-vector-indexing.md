# Micro-Skill: Vector Indexing & Embeddings

**Scope**: Vector database configuration, indexing strategies, and batch embedding pipelines.

## Rules & Checklists
1. **Index Algorithm & Metrics**:
   - Prefer HNSW (Hierarchical Navigable Small World) for production sub-10ms ANN query latency.
   - Use Cosine Similarity for normalized embedding vectors (e.g. OpenAI text-embedding-3, Cohere embed-v3).
   - Tune `ef_search` (e.g. 64) and `m` (e.g. 16) based on latency vs recall trade-offs.
2. **Multi-Tenant Metadata Filtering**:
   - Always enforce metadata filtering on `tenantId` and access permissions alongside vector similarity.
   - Index metadata fields (e.g. `tenant_id`, `created_at`) to enable efficient pre-filtered vector queries.
3. **Batch Upserts & Rate Limits**:
   - Chunk embedding generation into batches of 100–250 texts to respect provider rate limits.
   - Implement exponential retry on embedding API `429` rate-limit responses.
4. **Model Versioning**:
   - Track embedding model name and dimensionality (e.g. `text-embedding-3-small:1536`) in the database metadata.
   - Never mix embeddings from different models in the same vector index.
5. **Idempotent Upserting**:
   - Use deterministic vector IDs (`${documentId}:${chunkIndex}`) so re-indexing an updated document overwrites cleanly.
