# Micro-Skill: RAG Retrieval & Hybrid Search

**Scope**: Document chunking, hybrid keyword+vector search, and reranking pipelines.

## Rules & Checklists
1. **Semantic & Recursive Chunking**:
   - Chunk text respecting document structure (headers, paragraphs, code fences), not raw character splits.
   - Target chunk size: 400–800 tokens with 10–15% sliding window overlap to maintain contextual continuity.
2. **Hybrid Search (Keyword + Dense Vector)**:
   - Combine sparse lexical search (BM25 or PostgreSQL full-text) with dense vector cosine similarity.
   - Merge results using Reciprocal Rank Fusion (RRF) with default constant `k = 60`.
3. **Cross-Encoder Reranking**:
   - Retrieve top 20 candidates from hybrid search; pass them to a cross-encoder reranker (e.g. Cohere Rerank or BGE).
   - Inject only top 3–5 highest scoring chunks into the generation prompt.
4. **Citation & Provenance Tracking**:
   - Attach metadata (`sourceId`, `title`, `url`, `page`, `chunkIndex`) to every chunk.
   - Instruct generator LLM to cite sources inline (`[1]`, `[Source: DocName]`).
5. **Context Token Budgeting**:
   - Never exceed allocated context budget (e.g. 4,000 tokens) for retrieved documentation chunks.
