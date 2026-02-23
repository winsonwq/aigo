import { useOpenCode } from "@/context/OpenCodeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSkills } from "@/hooks/useSkills";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, FileArchive } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function Skills() {
  const { status } = useOpenCode();
  const { skills, isLoading, error, refetch } = useSkills();
  const [search, setSearch] = useState("");
  const isConnected = status === "connected";

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.trim().toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.location && s.location.toLowerCase().includes(q))
    );
  }, [skills, search]);

  async function handleOpenSkillFolder(location: string) {
    try {
      const path = location.startsWith("file://") ? location.slice(7) : location;
      await revealItemInDir(path);
    } catch (e) {
      console.error("[Skills] revealItemInDir failed:", e);
    }
  }

  const [installError, setInstallError] = useState<string | null>(null);
  const [installLoading, setInstallLoading] = useState(false);

  async function handleInstallFromZip() {
    setInstallError(null);
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
      title: "选择 Skill 的 zip 包",
    });
    if (!selected || typeof selected !== "string") return;
    setInstallLoading(true);
    try {
      await invoke("install_skill_from_zip", {
        zipPath: selected,
        target: "global",
        projectPath: undefined,
      });
      await refetch();
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="page-header mb-4">
        Skills 管理
      </h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        当前会被 OpenCode 检索到的 skills（来自 .opencode/skills、.claude/skills、~/.config/opencode/skills 等）。支持从 zip 安装；zip 内需包含 SKILL.md 且含 name、description 的 YAML frontmatter。
      </p>
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {installError && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{installError}</p>
      )}
      {isConnected && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="按名称、描述或路径搜索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            {isLoading ? "加载中…" : "刷新"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleInstallFromZip()}
            disabled={installLoading}
          >
            <FileArchive className="mr-1 size-4" />
            {installLoading ? "安装中…" : "从 zip 安装"}
          </Button>
        </div>
      )}
      {isLoading && skills.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">加载 Skills…</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          暂无 skills。
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredSkills.map((s) => (
            <Card
              key={s.name + (s.location || "")}
              className="rounded-lg border-0 bg-white dark:bg-zinc-900"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {s.name}
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {s.description}
                      </p>
                    )}
                  </div>
                  {s.location && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="打开所在文件夹"
                      onClick={() => void handleOpenSkillFolder(s.location)}
                      className="shrink-0"
                    >
                      <FolderOpen className="size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
