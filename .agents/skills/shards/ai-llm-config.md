# Micro-Skill: LLM Configuration & Multi-Provider Architecture

**Scope**: LLM provider integrations, structured generation, fallback strategies, and token streaming.

## Rules & Checklists
1. **Multi-Provider Fallback**:
   - Implement graceful failover: Primary provider (e.g. Anthropic/OpenAI) fails over to secondary on 429 (rate limit) or 5xx errors.
   - Configure exponential backoff with jitter on transient network failures.
2. **Structured Output Enforcement**:
   - Enforce schema conformity via JSON Schema / tool calling mode; validate raw LLM outputs with Zod before using.
   - Retry structured generation with repair prompt if initial parsing fails.
3. **SSE Token Streaming**:
   - Stream model completions via Server-Sent Events (SSE) for interactive chat experiences.
   - Attach `AbortSignal` to cancel generation immediately if the client disconnects or aborts, saving token costs.
4. **Token & Cost Observability**:
   - Record `prompt_tokens`, `completion_tokens`, total latency (ms), and cost estimate on every invocation.
   - Enforce max token completion limits (`max_tokens`) to prevent runaway infinite generation loops.
5. **Prompt Injection Guardrails**:
   - Wrap untrusted user input in explicit XML/Markdown tags (e.g. `<user_input>...</user_input>`).
   - Forbid user input from overriding core system instructions.
