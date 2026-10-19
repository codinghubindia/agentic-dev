# AI Sub-Role: RAG Pipeline Engineering

Consolidated from `rag-pipeline-worker`.

## Responsibilities & Standards
- Build end-to-end Retrieval-Augmented Generation pipelines: document ingestion, recursive chunking, embedding generation, semantic retrieval, reranking, and synthesis.

## RAG Checklist
- [ ] Document Chunking: Chunk by semantic boundaries (headers, paragraphs, functions) using sliding window (e.g. 512 tokens with 10% overlap).
- [ ] Embedding Quality: Use high-dimension embeddings (text-embedding-3-small/large, Cohere embed-v3) with cosine similarity.
- [ ] Hybrid Search: Combine dense semantic search with sparse keyword search (BM25) for high-precision domain acronyms.
- [ ] Reranking: Apply cross-encoder reranker (Cohere Rerank, BGE-reranker) to top 20 candidates, keeping top 3-5 for generation.
- [ ] Grounding & Citation: Prompts enforce strict adherence to retrieved context with inline citation references (`[Source: document.pdf, p. 12]`).
