// Skills 激活 API
// 激活技能，加载完整的指令内容

import { NextRequest, NextResponse } from "next/server";
import { activateSkill } from "@/lib/skills/loader";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skillId } = body;

    if (!skillId) {
      return NextResponse.json(
        { error: "技能 ID 是必需的", success: false },
        { status: 400 }
      );
    }

    console.log(`[Skills Activate API] Activating skill: ${skillId}`);

    const result = await activateSkill(skillId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error.message,
          success: false,
        },
        { status: 500 }
      );
    }

    const skill = result.value;
    console.log(`[Skills Activate API] Skill activated: ${skill.metadata.name}`);

    return NextResponse.json({
      success: true,
      skill: {
        id: skill.id,
        name: skill.metadata.name,
        description: skill.metadata.description,
        instructions: skill.instructions,
        metadata: skill.metadata,
      },
    });
  } catch (error) {
    console.error("[Skills Activate API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "激活技能失败",
        success: false,
      },
      { status: 500 }
    );
  }
}
