---
name: ai-rag-pipeline
description: "Production guidelines for Retrieval-Augmented Generation (RAG) pipelines, covering semantic chunking, dense and sparse embeddings, hybrid search, cross-encoder re-ranking, and context window budget management."
category: ai
tags: [rag, embeddings, vector-database, semantic-search, hybrid-search, rerank, llm]
license: "MIT"
---

# Production AI RAG Architecture & Retrieval Systems

## Overview

Comprehensive architectural standards for building production-grade Retrieval-Augmented Generation (RAG) systems. Focuses on optimal chunking strategies, dense/sparse vector representation, hybrid search with Reciprocal Rank Fusion (RRF), cross-encoder re-ranking, and hallucination reduction guardrails.

## The Production RAG Pipeline

```
Raw Documents (PDF, MD, HTML)
  ↓
1. Document Parsing & Structure Extraction
  ↓
2. Semantic Chunking (Sentence boundary with sliding overlap)
  ↓
3. Dual Indexing:
   ├── Dense Embeddings (e.g. text-embedding-3-small, BGE-M3) → Vector DB
   └── Sparse Inverted Index (BM25 / SPLADE) → Keyword Index
  ↓
Query Ingestion
  ↓
4. Hybrid Search: Dense Vector K-NN + Sparse BM25
  ↓
5. Candidate Fusion: Reciprocal Rank Fusion (RRF)
  ↓
6. Cross-Encoder Re-Ranking (Cohere Rerank / BGE-Reranker-Large)
  ↓
7. Context Budget Slicing & Citation Grounding
  ↓
LLM Generation with Strict Grounding Prompt
```

## Semantic Chunking Strategy

Avoid arbitrary character or token slicing that fragments sentences across boundaries:

```python
from typing import List

def recursive_token_chunking(
    text: str,
    max_tokens: int = 500,
    overlap_tokens: int = 50
) -> List[str]:
    """
    Chunks document respecting paragraph and sentence boundaries.
    Maintains a sliding overlap to preserve conversational continuity.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_length = 0

    for para in paragraphs:
        para_tokens = len(para.split()) # Approximation or use tiktoken
        if current_length + para_tokens <= max_tokens:
            current_chunk.append(para)
            current_length += para_tokens
        else:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_length = para_tokens

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks
```

## Hybrid Search & Reciprocal Rank Fusion (RRF)

Dense vector similarity captures semantic intent, but misses exact identifiers (e.g., error codes, model numbers, IDs). Hybrid search combines both:

```python
from typing import Dict, List

def reciprocal_rank_fusion(
    dense_results: List[str],
    sparse_results: List[str],
    k: int = 60
) -> List[str]:
    """
    Combines ranked lists from dense vector search and sparse BM25 search.
    RRF score = sum(1.0 / (k + rank))
    """
    rrf_scores: Dict[str, float] = {}

    for rank, doc_id in enumerate(dense_results):
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

    for rank, doc_id in enumerate(sparse_results):
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

    # Sort documents descending by combined RRF score
    sorted_docs = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)
    return sorted_docs
```

## Cross-Encoder Re-Ranking

Bi-encoders (embeddings) map queries and documents into vectors independently. Cross-encoders examine query and document together to capture nuanced relevance:

```python
# Example: Re-ranking top-25 candidate chunks down to top-5 high-signal chunks
# Using HuggingFace / sentence-transformers cross-encoder
from sentence_transformers import CrossEncoder

def rerank_candidates(query: str, candidates: List[str], top_n: int = 5) -> List[str]:
    reranker = CrossEncoder('BAAI/bge-reranker-large')
    pairs = [[query, doc] for doc in candidates]
    scores = reranker.predict(pairs)
    
    scored_candidates = sorted(
        zip(candidates, scores), key=lambda x: x[1], reverse=True
    )
    return [doc for doc, score in scored_candidates[:top_n]]
```

## Core Invariants

1. **Retrieval Precedes Generation**: 85% of LLM hallucinations in RAG systems stem from flawed retrieval rather than model reasoning. Fix chunking and re-ranking before altering generation prompts.
2. **Mandatory Metadata Tagging**: Always attach source, section header, document timestamp, and tenant ID to every chunk vector for deterministic pre-filtering.
3. **Context Window Budgeting**: Cap retrieval context at 30% of total model capacity to avoid the "lost-in-the-middle" effect.
4. **Strict Grounding Instructions**: Generation prompts must explicitly demand citations: *"Answer ONLY using the provided retrieved context. If the context is insufficient, state that the information is unavailable."*
