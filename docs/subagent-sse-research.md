# Subagent 监听与展示：OpenCode / OpenWork 调研

本文档整理 OpenCode 服务端事件流与 OpenWork 的用法，说明 AIGO 如何在不依赖轮询的前提下监听并展示子任务（subagent/task）结果。

---

## 1. OpenCode 服务端事件（SSE）

### 1.1 端点与行为

- **全局**：`GET /global/event` — 所有事件的 SSE 流。
- **项目**：`GET /event?directory=...` — 该目录下所有会话的事件流。

文档说明：*First event is `server.connected`, then bus events.*  
即：**服务端向所有订阅者广播全部事件**，不做按 session 过滤。

### 1.2 客户端必须自己按 session 过滤

来自 [anomalyco/opencode#9650](https://github.com/anomalyco/opencode/issues/9650) 与源码：

- `packages/opencode/src/server/server.ts`：`Bus.subscribeAll()` 把**所有**事件写入 SSE，无 sessionID 过滤。
- 内部逻辑（如 `packages/opencode/src/tool/task.ts`）在客户端按 session 过滤：

  ```ts
  Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
    if (evt.properties.part.sessionID !== session.id) return  // 客户端过滤
    // ...
  })
  ```

结论：**单次订阅会收到所有会话的事件**，客户端需根据 `event.properties.part.sessionID` 或 `event.properties.sessionID` 判断是否属于自己的会话。

### 1.3 子任务（Task tool）与事件

- [anomalyco/opencode#6573](https://github.com/anomalyco/opencode/issues/6573)：Task 工具拉起 subagent 时，**同一订阅会收到父子会话的事件**；`message.part.updated` 的 `part.sessionID` 可能是**子会话 ID**。
- TUI 能正常工作的原因：同进程、共享内存状态，`SessionPrompt.loop()` 能直接跟踪子会话完成并更新父会话状态。
- 纯 REST/SSE 客户端：若只根据「当前会话 ID」过滤，会忽略子会话的 `message.part.updated` / `session.idle`，从而不知道子任务何时结束。

---

## 2. AIGO 当前策略（不轮询）

### 2.1 订阅与 refetch

- 仅对**当前主会话**建一条 SSE 订阅：`useSessionMessages(mainSessionId)` → `client.event.subscribe()`。
- 对 **任意** `message.part.updated` 与 `session.idle` 都触发**主会话**的 `fetchMessages(mainSessionId)`（不再按 `ev.properties.sessionID === mainSessionId` 才刷新）。

这样：

- 子任务结束时，只要总线上有任意 part 更新或 session idle，主会话都会重新拉取。
- 若服务端在子任务完成时**把结果写回主会话对应 message 的 tool part**（如 `state.output`），则这次 refetch 后主会话消息会带上最新 part，右侧面板用「live part」即可展示。

### 2.2 依赖的服务端行为

子任务结果能否在 AIGO 里显示，取决于：

1. **主会话的 message 是否被更新**：子任务完成后，OpenCode 是否把 tool 的 output 写回**主会话**中对应那条 assistant message 的 part（例如 `state.output` / `state.result` 等）。
2. **是否发出事件**：主会话或子会话在 part 更新 / session idle 时是否会发出 `message.part.updated` / `session.idle`，以触发我们的 refetch。

若服务端只更新子会话的 message、不回写主会话的 tool part，则仅靠「订阅全局事件 + 只 refetch 主会话」无法拿到子任务输出，需要服务端或协议支持（例如回写主会话 part，或暴露子会话 ID 让客户端再拉子会话消息）。

### 2.3 为何不用轮询

- 与 OpenCode / OpenWork 的设计一致：**事件驱动**，用 SSE 通知变化再拉取。
- 轮询增加无效请求、延迟和复杂度；且若服务端不更新主会话 part，轮询也无法得到子任务结果。
- 若未来 OpenCode 支持按 session 过滤（如 [FEATURE: Support sessionID filter for SSE #9650](https://github.com/anomalyco/opencode/issues/9650)），可改为只订阅主会话（及需要的子会话），逻辑更清晰，但当前「任意事件 → refetch 主会话」已是最小、可维护的做法。

---

## 3. OpenWork 的参考做法

根据项目内 [openwork-reference.md](./openwork-reference.md)：

- **实时流式**：通过 **SSE** / `client.event.subscribe()` 做 live streaming。
- **会话/消息**：除 HTTP API 外，可选 **SQLite 直读**（`~/.opencode/opencode.db`），直接读 `sessions`、`messages`（含 `parts` JSON），用于列表、搜索、离线展示。

即：OpenWork 也是用 **SSE 驱动刷新**；若用 SQLite，可以自己读库拿到最新 parts，不依赖服务端是否把子任务结果回写到主会话的 HTTP API 响应里。AIGO 当前仅用 HTTP API，未读 SQLite，因此完全依赖「服务端更新主会话 message + 通过事件触发 refetch」。

---

## 4. 小结与建议

| 项目         | 说明 |
|--------------|------|
| **SSE 行为** | OpenCode 全量广播，无 session 过滤；客户端需自过滤；子任务事件会混在同一流里。 |
| **AIGO 做法** | 单订阅 + 任意 `message.part.updated` / `session.idle` 都 refetch 主会话；右侧面板用从当前 `messages` 解析出的 live part 展示，避免陈旧引用。 |
| **不采用轮询** | 与 OpenCode/OpenWork 的事件驱动方式一致，避免无效轮询。 |
| **若仍无输出** | 需确认 OpenCode 在子任务完成时是否更新**主会话**对应 message 的 tool part；可关注 [#9650](https://github.com/anomalyco/opencode/issues/9650)、[#6573](https://github.com/anomalyco/opencode/issues/6573) 等进展。 |

可选后续优化（取决于 OpenCode 能力与需求）：

- 若服务端支持按 sessionID 过滤 SSE：改为只订阅当前主会话（及必要时子会话），减少无关事件。
- 若提供「子会话 ID」并在 part 中返回：可对子会话再调 `session.messages(subagentSessionId)` 并单独展示子会话消息流。
