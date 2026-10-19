# AI Sub-Role: LLM Configuration & Providers

Consolidated from `llm-config-worker`.

## Responsibilities & Standards
- Configure LLM API clients (OpenAI, Anthropic, Gemini, local Ollama), structured JSON outputs, streaming handlers, and fallback chains.

## LLM Checklist
- [ ] Structured Output: Enforce strict schema generation via tool calling, JSON schema mode, or instructor/zod schemas.
- [ ] Streaming Support: Stream tokens via Server-Sent Events (SSE) or WebSockets with graceful cancellation handling (AbortController).
- [ ] Fallback Chains: Configure primary provider with automatic fallback to secondary provider on rate limit (429) or service degradation (503).
- [ ] Prompt Versioning: Store prompts in structured template files with parameter interpolation and unit test evaluation datasets.
- [ ] Token Budgeting: Enforce max token limits and input truncation to prevent context blowouts and cost spikes.
