/**
 * 附件路径本地持久化：OpenCode 只存消息文本，不存本地文件路径。
 * 用 localStorage 按 sessionId + messageId 存路径，reload 后仍可「用系统默认打开」。
 */

const STORAGE_KEY = "aigo.attachmentPaths";

export type AttachmentPathsMap = Record<string, Record<string, string[]>>;

function read(): AttachmentPathsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttachmentPathsMap;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: AttachmentPathsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/** 取某条用户消息的持久化路径 */
export function getAttachmentPaths(
  sessionId: string,
  messageId: string
): string[] | undefined {
  const map = read();
  const bySession = map[sessionId];
  if (!bySession || typeof bySession !== "object") return undefined;
  const paths = bySession[messageId];
  return Array.isArray(paths) && paths.length > 0 ? paths : undefined;
}

/** 写入某条用户消息的路径（合并进当前 map 后写回） */
export function setAttachmentPaths(
  sessionId: string,
  messageId: string,
  paths: string[]
): void {
  if (!paths.length) return;
  const map = read();
  if (!map[sessionId]) map[sessionId] = {};
  map[sessionId][messageId] = paths;
  write(map);
}

/** 拉取消息后：从持久化里补全每条用户消息的 attachmentPaths（若当前没有） */
export function mergePersistedPathsIntoMessages(
  sessionId: string,
  messages: Array<{ info: { id: string; role: string; attachmentPaths?: string[] } }>
): typeof messages {
  const map = read();
  const bySession = map[sessionId];
  if (!bySession || typeof bySession !== "object") return messages;
  return messages.map((msg) => {
    if (msg.info.role !== "user") return msg;
    if (msg.info.attachmentPaths?.length) return msg;
    const paths = bySession[msg.info.id];
    if (!Array.isArray(paths) || paths.length === 0) return msg;
    return {
      ...msg,
      info: { ...msg.info, attachmentPaths: paths },
    };
  });
}

/** 将当前消息列表中带 attachmentPaths 的用户消息写入持久化 */
export function persistAttachmentPaths(
  sessionId: string,
  messages: Array<{ info: { id: string; role: string; attachmentPaths?: string[] } }>
): void {
  const map = read();
  for (const msg of messages) {
    if (msg.info.role !== "user" || !msg.info.attachmentPaths?.length) continue;
    if (!map[sessionId]) map[sessionId] = {};
    map[sessionId][msg.info.id] = msg.info.attachmentPaths;
  }
  write(map);
}
