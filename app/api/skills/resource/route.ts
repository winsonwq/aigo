// Skills 资源加载 API
// 按需加载技能资源（scripts、references、assets）

import { NextRequest, NextResponse } from "next/server";
import { loadSkillResource } from "@/lib/skills/loader";
import type { SkillResourceType } from "@/lib/skills/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skillId, resourceType, resourcePath } = body;

    if (!skillId || !resourceType || !resourcePath) {
      return NextResponse.json(
        {
          error: "技能 ID、资源类型和资源路径都是必需的",
          success: false,
        },
        { status: 400 }
      );
    }

    // 验证资源类型
    const validTypes: SkillResourceType[] = ["scripts", "references", "assets"];
    if (!validTypes.includes(resourceType as SkillResourceType)) {
      return NextResponse.json(
        {
          error: `无效的资源类型: ${resourceType}。有效类型: ${validTypes.join(", ")}`,
          success: false,
        },
        { status: 400 }
      );
    }

    console.log(
      `[Skills Resource API] Loading resource: ${skillId}/${resourceType}/${resourcePath}`
    );

    const result = await loadSkillResource(
      skillId,
      resourceType as SkillResourceType,
      resourcePath
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error.message,
          success: false,
        },
        { status: 500 }
      );
    }

    const resource = result.value;
    console.log(
      `[Skills Resource API] Resource loaded: ${resource.type}/${resource.path}`
    );

    return NextResponse.json({
      success: true,
      resource: {
        type: resource.type,
        path: resource.path,
        content:
          resource.content instanceof Buffer
            ? resource.content.toString("utf-8")
            : resource.content,
      },
    });
  } catch (error) {
    console.error("[Skills Resource API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "加载技能资源失败",
        success: false,
      },
      { status: 500 }
    );
  }
}
