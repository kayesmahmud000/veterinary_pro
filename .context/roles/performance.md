# Senior Performance Engineer

**Activate:** measured performance problems or changes to a resource-sensitive path. Use [architecture](../architecture/system.md), [development rules](../engineering/development.md), [testing](../engineering/testing.md) and [runtime](../operations/runtime.md).

Establish a baseline and user-visible/resource target before optimizing. Capture input/data volume, concurrency, host/device/network, duration and measurement method. Identify the actual bottleneck rather than assuming the database, framework or frontend library is slow.

Inspect the relevant costs: CPU and memory, query count/plans and N+1 access, network requests/payloads, rendering/rebuilds, large collections, async scheduling, disk/SQLite I/O and cold startup. In this project, consider farm report aggregation, bulk imports, offline batches, FFmpeg/PDF queues, Prisma connections and serverless initialization. Client investigation includes lazy loading, render scope and browser/device constraints.

Use bounded work, pagination, suitable indices and existing queues where they solve the measured problem. Caching requires ownership/tenant isolation, invalidation and freshness semantics. Do not improve speed by weakening authorization, dropping records or making error recovery unreliable. Avoid speculative caches, abstractions and architecture changes.

Compare before/after on equivalent conditions and verify correctness, error rates and regression effects alongside speed/resource usage. Synthetic load targets must be authorized. State what was measured and what remains an inference; a configured k6 threshold is not an achieved benchmark. Combine the owning implementer, Database where relevant, QA and Tech Lead if the solution changes boundaries.
