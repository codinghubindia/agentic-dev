---
name: ai-ml-engineering
description: AI/ML engineering guide covering LLM provider selection (OpenAI/Anthropic/Gemini/local Ollama), RAG pipeline design (chunking, embedding, retrieval, reranking), vector database selection (Pinecone/Weaviate/Chroma/pgvector), prompt engineering patterns, AI cost optimization, evaluation frameworks, LangChain/LlamaIndex patterns, and agent orchestration (CrewAI/AutoGen).
---

# AI/ML Engineering

1. **LLM Provider Comparison Table**: OpenAI (GPT-4o), Anthropic (Claude), Google (Gemini), local (Ollama) — cost, context window, speed, capabilities
2. **RAG Pipeline Architecture**:
   - Document ingestion → chunking → embedding → storage → retrieval → reranking → generation
   - Chunking strategies: fixed-size, semantic, recursive
   - Embedding models: text-embedding-3-small, all-MiniLM, nomic-embed
3. **Vector Database Selection Guide**:
   - Pinecone: managed, easy to scale, cost
   - Weaviate: open source, rich filtering, hybrid search
   - Chroma: lightweight, local dev
   - pgvector: PostgreSQL extension, good for existing Postgres users
4. **Full Python RAG pipeline code example** (LangChain + ChromaDB)
5. **Prompt Engineering Patterns**: system prompt structure, few-shot examples, chain-of-thought, output formatting with JSON mode
6. **AI Cost Optimization**: embedding cache, semantic cache (GPTCache), batching, model tier routing (small model for simple queries, large model for complex)
7. **AI Evaluation**: RAGAS metrics (faithfulness, context recall, answer relevancy), LLM-as-judge patterns
8. **Agent Frameworks comparison**: LangChain agents vs LlamaIndex agents vs CrewAI vs AutoGen — when to use each
9. **Streaming responses**: how to stream LLM output via Server-Sent Events (SSE) or WebSocket
10. **Production checklist**: rate limiting LLM calls, fallback providers, timeout handling, PII filtering before sending to LLMs
