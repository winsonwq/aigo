/**
 * Built-in catalog of skills from skills.sh for one-click install.
 * Structure: id, source (owner/repo), optional skillName, name, description, sourceLabel.
 * Optional resources for large files (e.g. Whisper models) for future download progress.
 */
export type CatalogSkillResource = {
  url: string;
  destPath: string;
};

export type CatalogSkillItem = {
  id: string;
  source: string;
  skillName?: string;
  name: string;
  description: string;
  sourceLabel: string;
  resources?: CatalogSkillResource[];
};

export const skillsCatalog: CatalogSkillItem[] = [
  {
    id: "find-skills",
    source: "vercel-labs/skills",
    skillName: "find-skills",
    name: "find-skills",
    description: "Helps users discover and install agent skills when they ask questions like 'how do I do X' or 'find a skill for X'.",
    sourceLabel: "skills.sh",
  },
  {
    id: "vercel-react-best-practices",
    source: "vercel-labs/agent-skills",
    skillName: "vercel-react-best-practices",
    name: "vercel-react-best-practices",
    description: "Vercel React best practices for agent-driven development.",
    sourceLabel: "skills.sh",
  },
  {
    id: "web-design-guidelines",
    source: "vercel-labs/agent-skills",
    skillName: "web-design-guidelines",
    name: "web-design-guidelines",
    description: "Web design guidelines for consistent, accessible UI.",
    sourceLabel: "skills.sh",
  },
  {
    id: "frontend-design",
    source: "anthropics/skills",
    skillName: "frontend-design",
    name: "frontend-design",
    description: "Frontend design patterns and practices.",
    sourceLabel: "skills.sh",
  },
  {
    id: "skill-creator",
    source: "anthropics/skills",
    skillName: "skill-creator",
    name: "skill-creator",
    description: "Guide for creating effective skills that extend agent capabilities.",
    sourceLabel: "skills.sh",
  },
  {
    id: "agent-browser",
    source: "vercel-labs/agent-browser",
    skillName: "agent-browser",
    name: "agent-browser",
    description: "Browser automation and page interaction for agents.",
    sourceLabel: "skills.sh",
  },
  {
    id: "git-commit",
    source: "anthropics/skills",
    skillName: "git-commit",
    name: "git-commit",
    description: "Execute git commit with conventional commit message analysis and intelligent staging.",
    sourceLabel: "skills.sh",
  },
];
