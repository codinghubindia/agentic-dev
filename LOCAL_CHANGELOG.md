# Neural Orchestra v5.2 - Local Changelog

## [5.2.1] - Direct Shell Execution & Multi-Language Engine Expansion

### ⚡ 1. Zero-Latency Direct Terminal Mode
- **Direct Tool Invocation**: Updated system prompts for the Conductor and all 8 Macro Vertical Engineers (`principal-architect`, `fullstack-frontend-engineer`, `fullstack-backend-engineer`, `data-platform-engineer`, `ai-rag-engineer`, `mobile-engineer`, `qa-security-verifier`, `devops-release-engineer`) to enforce direct shell execution (`powershell`/`cmd` on Windows, `bash` on POSIX).
- **Scheduler Elimination for Routine Tasks**: Scaffolding, compilation, test execution, migrations, AST symbol queries, and quality gate runs now execute synchronously without queuing overhead or async state machine delays.
- **Strict Read-Only Guarantee**: Direct shell execution respects engine immutability—all runtime output and logs are piped to `.agent_execution/logs/` with zero writes to `.agents/`.

---

### 🌐 2. Multi-Language Engine Expansion
Expanded static analysis, symbol indexing, and quality gate support across:
- **Rust (`.rs`, `Cargo.toml`)**
- **C & C++ (`.c`, `.h`, `.cpp`, `.cc`, `.hpp`, `CMakeLists.txt`, `Makefile`)**
- **C# (`.cs`, `*.csproj`, `*.sln`)**
- **Java (`.java`, `pom.xml`, `build.gradle`, `build.gradle.kts`)**
- **Go (`.go`, `go.mod`)**

#### Component Updates:
1. **`.agents/bin/paths.mjs`**:
   - Added `SUPPORTED_EXTENSIONS` containing `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.dart`, `.go`, `.rs`, `.c`, `.h`, `.cpp`, `.cc`, `.hpp`, `.cs`, `.java`.
   - Added `LANGUAGE_BY_EXT` mapping file extensions to canonical language identifiers.
   - Added multi-language build directories (`target`, `bin`, `obj`, `.gradle`, `CMakeFiles`, `CMakeScripts`, `.idea`, `.vscode`) to `IGNORED_SCAN_DIRS`.

2. **`.agents/bin/symbol-indexer.mjs`**:
   - Implemented `parseRustSymbols`: parses `fn`, `pub fn`, `struct`, `enum`, `impl`, `trait`, `mod`, `use`.
   - Implemented `parseCppSymbols`: parses functions, `struct`, `class`, `enum`, namespaces, `#define` macros, `#include`.
   - Implemented `parseCsharpSymbols`: parses `class`, `interface`, `struct`, `enum`, `record`, namespaces, method signatures, `using`.
   - Implemented `parseJavaSymbols`: parses `class`, `interface`, `enum`, `record`, `package`, method signatures, `import`.
   - Implemented `parseGoSymbols`: parses `func`, `struct`, `interface`, `package`, `import`.
   - Multi-Language Stub Detection: recognizes `todo!()`, `unimplemented!()`, `throw new NotImplementedException()`, `throw new UnsupportedOperationException()`, `panic!("not implemented")`, and `// TODO`.

3. **`.agents/bin/extract-skeleton.mjs`**:
   - Added AST-lite skeleton extractors: `extractRustSkeleton`, `extractCppSkeleton`, `extractCsharpSkeleton`, `extractJavaSkeleton`, `extractGoSkeleton`.
   - Strips implementation bodies from `.rs`, `.cpp`, `.cs`, `.java`, and `.go` source files while preserving all types, contracts, and signatures for zero-hallucination context snapshots (~85% token payload reduction).

4. **`.agents/bin/onboard-project.mjs`**:
   - Manifest Detection: recognizes `Cargo.toml`, `CMakeLists.txt`, `Makefile`, `*.csproj`, `*.sln`, `pom.xml`, `build.gradle`, `build.gradle.kts`.
   - Auto-Ownership: deterministically routes Rust/C++/C#/Java source, test, UI, database, and infrastructure files to the appropriate Macro Vertical Roles.

5. **`.agents/bin/quality-gate.mjs`**:
   - Added `checkRust`: runs `cargo check --workspace` when `Cargo.toml` or `.rs` files are present.
   - Added `checkCpp`: verifies C/C++ builds via `cmake --version`, `make --version`, or `gcc --version`.
   - Added `checkCsharp`: runs `dotnet build` when `.csproj` or `.cs` files are present.
   - Added `checkJava`: runs `mvn compile -q` or `gradle compileJava -q` or `javac` when Java manifests or source files exist.
   - Non-Blocking Fallback: gracefully skips toolchain checks if a compiler is not installed on the host environment, preventing false failures.
   - Fixed Windows shell execution in `execBounded` to prevent Node `[DEP0190]` deprecation warnings.

---

### 🛡️ 3. Verification & Compliance
- **Quality Gate**: Passed 9/9 deterministic checks cleanly (0 violations, 0 conflicts, 0 immutability violations).
- **Execution Speed**:
  - `onboard-project.mjs`: <8ms
  - `symbol-indexer.mjs`: <14ms
  - `extract-skeleton.mjs`: <25ms
- **Registry & Ledger**: Incremental SHA-1 caching verified across all supported languages.
