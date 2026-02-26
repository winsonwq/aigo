import { useOpenCode } from "@/context/OpenCodeContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, ListRow, ListFooter } from "@/components/ui/list";
import { useSkills } from "@/hooks/useSkills";
import { useConfirmModal } from "@/components/ConfirmModal";
import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FolderOpen, FileArchive, Search, Loader2, Download, ExternalLink, Trash2 } from "lucide-react";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  searchSkillsShApi,
  type SearchResultItem,
  DEFAULT_SEARCH_QUERY,
  SKILLS_SH_PAGE_SIZE,
} from "@/api/skillsSh";
import { toast } from "@/components/ui/sonner";
import { useDispatch } from "react-redux";
import { fetchSkills, skillsSlice } from "@/store/slices/skillsSlice";

export function Skills() {
  const dispatch = useDispatch();
  const { confirm: confirmModal } = useConfirmModal();
  const { status } = useOpenCode();
  const { workspacePath } = useWorkspace();
  const { skills, isLoading, error, refetch } = useSkills(
    workspacePath ?? undefined
  );
  const [search, setSearch] = useState("");
  const isConnected = status === "connected";

  const [activeTab, setActiveTab] = useState("search");
  const [searchQuerySkillsSh, setSearchQuerySkillsSh] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** 当前列表对应的查询（用于「加载更多」） */
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const searchInitialLoadDoneRef = useRef(false);

  const [pasteSource, setPasteSource] = useState("");
  const [installLoading, setInstallLoading] = useState(false);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [installStage, setInstallStage] = useState<string>("");
  const [uninstallingName, setUninstallingName] = useState<string | null>(null);

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

  const isInstalled = useMemo(() => {
    const names = new Set(skills.map((s) => s.name.toLowerCase()));
    return (nameOrSkill: string) => names.has(nameOrSkill.toLowerCase());
  }, [skills]);

  /** 进入 Skills 页后延后拉取已安装列表，用于显示 tab「已安装 N」数字；连接建立后也拉取一次 */
  useEffect(() => {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      const t = setTimeout(() => {
        if (!cancelled) void refetch();
      }, 0);
      return () => clearTimeout(t);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [refetch]);

  /** OpenCode 连接上时拉取已安装列表（可能进页时尚未连接） */
  useEffect(() => {
    if (!isConnected) return;
    void refetch();
  }, [isConnected, refetch]);

  useEffect(() => {
    let cancelled = false;
    const unlistenPromise = listen<{ stage: string }>("install_skill_progress", (ev) => {
      if (cancelled) return;
      const stage = ev.payload?.stage ?? "";
      setInstallStage(stage === "cloning" ? "克隆/安装中…" : stage === "done" ? "校验…" : stage);
    });
    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => { if (typeof fn === "function") fn(); }).catch(() => {});
    };
  }, []);

  function getSkillRepoUrl(source: string): string {
    const s = source.trim();
    if (!s) return "https://skills.sh";
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.includes("/")) return `https://github.com/${s}`;
    return "https://skills.sh";
  }

  async function handleOpenInBrowser(source: string) {
    try {
      await openUrl(getSkillRepoUrl(source));
    } catch (e) {
      console.error("[Skills] openUrl failed:", e);
    }
  }

  async function handleOpenSkillFolder(location: string) {
    try {
      const path = location.startsWith("file://") ? location.slice(7) : location;
      await revealItemInDir(path);
    } catch (e) {
      console.error("[Skills] revealItemInDir failed:", e);
      toast.error("该技能目录不存在（可能已卸载）");
    }
  }

  /** 使用 skills.sh API 拉取一页（替换或追加） */
  const fetchSkillsShPage = useCallback(
    async (opts: { q: string; offset: number; append: boolean }) => {
      setSearchError(null);
      const res = await searchSkillsShApi({
        q: opts.q || DEFAULT_SEARCH_QUERY,
        limit: SKILLS_SH_PAGE_SIZE,
        offset: opts.offset,
      });
      if (opts.append) {
        setSearchResults((prev) => [...prev, ...res.items]);
      } else {
        setSearchResults(res.items);
      }
      setCurrentSearchQuery(opts.q || DEFAULT_SEARCH_QUERY);
      setHasMore(res.hasMore);
      return res;
    },
    []
  );

  /** 首帧后再请求搜索，避免 Tauri invoke 阻塞首帧（mount→首帧曾达 ~1s） */
  useEffect(() => {
    if (activeTab !== "search" || searchInitialLoadDoneRef.current) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        searchInitialLoadDoneRef.current = true;
        setSearchLoading(true);
        searchSkillsShApi({ q: DEFAULT_SEARCH_QUERY, limit: SKILLS_SH_PAGE_SIZE, offset: 0 })
          .then((res) => {
            setSearchResults(res.items);
            setCurrentSearchQuery(DEFAULT_SEARCH_QUERY);
            setHasMore(res.hasMore);
          })
          .catch((e) => setSearchError(e instanceof Error ? e.message : String(e)))
          .finally(() => setSearchLoading(false));
      }, 0);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [activeTab]);

  async function handleSearchSkillsSh() {
    const q = searchQuerySkillsSh.trim();
    setSearchLoading(true);
    setSearchResults([]);
    try {
      await fetchSkillsShPage({ q, offset: 0, append: false });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleLoadMore() {
    if (loadMoreLoading || !hasMore) return;
    setLoadMoreLoading(true);
    setSearchError(null);
    try {
      await fetchSkillsShPage({
        q: currentSearchQuery,
        offset: searchResults.length,
        append: true,
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadMoreLoading(false);
    }
  }

  async function handleInstallFromSource(source: string, key: string, skillName?: string) {
    setInstallingKey(key);
    setInstallStage("准备…");
    setInstallLoading(true);
    try {
      await invoke("install_skill_from_source", {
        source,
        skillName: skillName ?? null,
        target: "global",
        projectPath: undefined,
      });
      toast.success("安装成功");
      if (skillName) dispatch(skillsSlice.actions.clearRecentlyRemovedSkill(skillName));
      // 安装到全局，拉取全局列表并给 OpenCode 一点时间扫描新文件
      await new Promise((r) => setTimeout(r, 800));
      await dispatch(fetchSkills(undefined));
      await new Promise((r) => setTimeout(r, 300));
      await dispatch(fetchSkills(undefined));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallingKey(null);
      setInstallStage("");
      setInstallLoading(false);
    }
  }

  async function handleInstallFromZip() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
      title: "选择 Skill 的 zip 包",
    });
    if (!selected || typeof selected !== "string") return;
    setInstallLoading(true);
    try {
      const installedName = await invoke<string>("install_skill_from_zip", {
        zipPath: selected,
        target: "global",
        projectPath: undefined,
      });
      toast.success("安装成功");
      if (installedName) dispatch(skillsSlice.actions.clearRecentlyRemovedSkill(installedName));
      await new Promise((r) => setTimeout(r, 800));
      await dispatch(fetchSkills(undefined));
      await new Promise((r) => setTimeout(r, 300));
      await dispatch(fetchSkills(undefined));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setInstallLoading(false);
    }
  }

  async function handlePasteInstall() {
    const source = pasteSource.trim();
    if (!source) return;
    await handleInstallFromSource(source, `paste:${source}`);
  }

  /**
   * 卸载：确认 → 后端物理删除 → 乐观更新（removeSkill）→ 延迟后 refetch。
   * 列表唯一数据源为 API；recentlyRemovedNames 仅用于下一轮 fetch 过滤一次后即清空。
   */
  async function handleUninstall(skill: { name: string; location?: string }) {
    const confirmed = await confirmModal({
      title: "确认卸载",
      message: `确定要卸载「${skill.name}」吗？卸载后将从本机移除该技能。`,
      confirmLabel: "卸载",
      cancelLabel: "取消",
      variant: "destructive",
    });
    if (!confirmed) return;

    setUninstallingName(skill.name);
    try {
      const rawLocation = skill.location?.startsWith("file://")
        ? skill.location.slice(7)
        : skill.location;
      await invoke("uninstall_skill", {
        skillName: skill.name,
        projectPath: workspacePath ?? undefined,
        skillLocation: rawLocation ?? undefined,
      });
      toast.success("已卸载");
      // 乐观更新：立即从列表移除，避免被后续可能带缓存的 refetch 覆盖
      dispatch(skillsSlice.actions.removeSkill(skill.name));
      // 延迟再拉取一次，给 OpenCode 服务端时间同步文件系统变化
      await new Promise((r) => setTimeout(r, 400));
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUninstallingName(null);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-6">
      <h1 className="page-header mb-1.5 shrink-0">Skills 管理</h1>
      <p className="page-description mb-4 shrink-0">
        Skills 是可被 AI 调用的能力扩展（如搜索、读写文件等），以 SKILL.md 定义并安装在本地。默认安装到 home 下全局目录：~/.agents/skills。
      </p>
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 w-full">
        <TabsList className="w-full flex rounded-none bg-transparent p-0 h-auto border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <TabsTrigger
            value="search"
            className="cursor-pointer rounded-none border-b-2 border-transparent -mb-px px-5 py-3 text-sm font-medium transition-colors data-[state=active]:border-zinc-900 data-[state=active]:font-semibold data-[state=active]:text-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100 data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:text-zinc-700 dark:data-[state=inactive]:text-zinc-400 dark:data-[state=inactive]:hover:text-zinc-300"
          >
            搜索
          </TabsTrigger>
          <TabsTrigger
            value="installed"
            className="cursor-pointer rounded-none border-b-2 border-transparent -mb-px px-5 py-3 text-sm font-medium transition-colors data-[state=active]:border-zinc-900 data-[state=active]:font-semibold data-[state=active]:text-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100 data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:text-zinc-700 dark:data-[state=inactive]:text-zinc-400 dark:data-[state=inactive]:hover:text-zinc-300"
          >
            已安装 {skills.length}
          </TabsTrigger>
          <TabsTrigger
            value="other"
            className="cursor-pointer rounded-none border-b-2 border-transparent -mb-px px-5 py-3 text-sm font-medium transition-colors data-[state=active]:border-zinc-900 data-[state=active]:font-semibold data-[state=active]:text-zinc-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-zinc-100 dark:data-[state=active]:text-zinc-100 data-[state=inactive]:text-zinc-500 data-[state=inactive]:hover:text-zinc-700 dark:data-[state=inactive]:text-zinc-400 dark:data-[state=inactive]:hover:text-zinc-300"
          >
            其他
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex flex-col flex-1 min-h-0 mt-6">
          {/* 可滚动区域占满剩余空间，Load more 在滚动末尾 */}
          <section className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Input
                type="search"
                placeholder="搜索 skills.sh，输入关键词或留空显示热门"
                value={searchQuerySkillsSh}
                onChange={(e) => setSearchQuerySkillsSh(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearchSkillsSh()}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSearchSkillsSh()}
                disabled={searchLoading}
              >
                {searchLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <Search className="mr-1 size-4" />}
                {searchLoading ? "搜索中…" : "搜索"}
              </Button>
            </div>
            {searchError && (
              <p className="text-sm text-red-600 dark:text-red-400 shrink-0">{searchError}</p>
            )}
            <div className="flex-1 min-h-0 overflow-auto">
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="size-5 animate-spin mr-2" />
                  加载中…
                </div>
              ) : searchResults.length > 0 ? (
                <List>
                    {searchResults.map((item, i) => {
                      const key = `search:${item.source}${item.skillName ? `@${item.skillName}` : ""}`;
                      const displayName = item.skillName ?? item.source;
                      const busy = installingKey === key;
                      const installed = item.skillName ? isInstalled(item.skillName) : false;
                      return (
                        <ListRow key={`${key}-${i}`}>
                          <div className="min-w-0 flex-1 flex items-center gap-3">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={displayName}>
                              {displayName}
                            </span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate shrink-0 max-w-[40%]" title={item.source}>
                              {item.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {typeof item.installs === "number" && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                                {item.installs >= 10000
                                  ? `${(item.installs / 10000).toFixed(1)}万`
                                  : item.installs.toLocaleString()}
                              </span>
                            )}
                            {installed ? (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 w-12">已安装</span>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={installLoading || busy}
                                onClick={() => void handleInstallFromSource(item.source, key, item.skillName)}
                              >
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                                <span className="ml-1">{busy ? "安装中…" : "安装"}</span>
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => void handleOpenInBrowser(item.source)}
                              title="在系统默认浏览器中查看"
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          </div>
                        </ListRow>
                      );
                    })}
                    {hasMore && (
                      <ListFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleLoadMore()}
                          disabled={loadMoreLoading || searchLoading}
                        >
                          {loadMoreLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                          {loadMoreLoading ? "加载中…" : "加载更多"}
                        </Button>
                      </ListFooter>
                    )}
                  </List>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-8 px-4 text-center">
                  暂无结果。可输入关键词搜索，或在「其他」tab 中使用 URL / zip 安装。
                </p>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="other" className="mt-6">
          <section>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">URL 安装</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    placeholder="owner/repo 或完整 URL，如 vercel-labs/agent-skills"
                    value={pasteSource}
                    onChange={(e) => setPasteSource(e.target.value)}
                    className="max-w-md"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={installLoading || !pasteSource.trim()}
                    onClick={() => void handlePasteInstall()}
                  >
                    {installingKey?.startsWith("paste:") ? (
                      <Loader2 className="size-4 animate-spin mr-1" />
                    ) : (
                      <Download className="mr-1 size-4" />
                    )}
                    {installingKey?.startsWith("paste:") ? "安装中…" : "安装"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">离线安装</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={installLoading}
                    onClick={() => void handleInstallFromZip()}
                  >
                    <FileArchive className="mr-1 size-4" />
                    {installLoading ? "安装中…" : "选择 zip 安装"}
                  </Button>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">从本机选择 skill 的 zip 包安装</span>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          {isConnected && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input
                type="search"
                placeholder="按名称、描述或路径筛选…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await dispatch(fetchSkills(undefined));
                  await dispatch(fetchSkills(workspacePath ?? undefined));
                }}
                disabled={isLoading}
              >
                {isLoading ? "加载中…" : "刷新"}
              </Button>
            </div>
          )}
          {isLoading && skills.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">加载 Skills…</p>
          ) : skills.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无已安装的 skills。</p>
          ) : (
            <List>
              {filteredSkills.map((s) => (
                <ListRow key={s.name + (s.location || "")}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={s.name}>
                      {s.name}
                    </div>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {s.location && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="打开所在文件夹"
                        onClick={() => void handleOpenSkillFolder(s.location)}
                      >
                        <FolderOpen className="size-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                      title="卸载"
                      disabled={uninstallingName !== null}
                      onClick={() => void handleUninstall({ name: s.name, location: s.location })}
                    >
                      {uninstallingName === s.name ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </ListRow>
              ))}
            </List>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
