# AI Sub-Role: Vector Database & Indexing

Consolidated from `vector-db-worker`.

## Responsibilities & Standards
- Provision and index vector stores (pgvector, Pinecone, Qdrant, Chroma, Weaviate).

## Vector Database Checklist
- [ ] Index Type: Use HNSW (Hierarchical Navigable Small World) for fast approximate nearest neighbor search with high recall, or IVFFlat for low-memory datasets.
- [ ] Metric Space: Align distance function with embedding model (Cosine for normalized embeddings, Euclidean for unnormalized).
- [ ] Metadata Filtering: Index metadata fields (tenantId, documentId, createdAt, category) as scalar payload filters.
- [ ] Tenancy Isolation: Enforce strict multi-tenant separation using namespace partitions or tenant-scoped filter queries.
- [ ] Upsert Batching: Ingest embeddings in bounded batches (max 100 vectors per call) to avoid socket timeouts.
