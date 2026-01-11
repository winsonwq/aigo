// Skills 加载 API
// 加载所有启用技能的元数据（启动时调用）

import { NextRequest, NextResponse } from "next/server";
import { loadSkillsMetadata } from "@/lib/skills/loader";

export async function POST(request: NextRequest) {
  try {
    console.log("[Skills Load API] Loading skills metadata...");

    const result = await loadSkillsMetadata();

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error.message,
          success: false,
        },
        { status: 500 }
      );
    }

    const skills = result.value;
    console.log(`[Skills Load API] Loaded ${skills.length} skills metadata`);

    return NextResponse.json({
      success: true,
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.metadata.name,
        description: skill.metadata.description,
        enabled: skill.enabled,
        // 只返回元数据，不返回指令内容
      })),
      count: skills.length,
    });
  } catch (error) {
    console.error("[Skills Load API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "加载技能元数据失败",
        success: false,
      },
      { status: 500 }
    );
  }
}
