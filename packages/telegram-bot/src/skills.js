import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Handles simple key: value and nested metadata block only.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const meta = {};
  const lines = match[1].split("\n");
  let currentKey = null;

  for (const line of lines) {
    const topLevel = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (topLevel) {
      const [, key, value] = topLevel;
      if (value) {
        meta[key] = value.trim();
      } else {
        meta[key] = {};
        currentKey = key;
      }
      continue;
    }

    const nested = line.match(/^\s{2}(\w[\w-]*):\s*(.*)/);
    if (nested && currentKey && typeof meta[currentKey] === "object") {
      meta[currentKey][nested[1]] = nested[2].trim();
    }
  }

  return meta;
}

/**
 * Extract "When to use" section examples from SKILL.md body.
 */
function parseWhenToUse(content) {
  const match = content.match(/## When to use\n\n([\s\S]*?)(?=\n## )/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").replace(/^[""]|[""]$/g, ""));
}

/**
 * Extract "What this skill does" section.
 */
function parseDescription(content) {
  const match = content.match(/## What this skill does\n\n([\s\S]*?)(?=\n## )/);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Load all SKILL.md files from the repo root directories.
 */
export async function loadSkills() {
  const skills = new Map();
  const entries = await readdir(REPO_ROOT, { withFileTypes: true });

  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "packages" && e.name !== "scripts" && e.name !== "docs" && e.name !== "python-packages");

  const results = await Promise.allSettled(
    dirs.map(async (dir) => {
      const skillPath = join(REPO_ROOT, dir.name, "SKILL.md");
      const content = await readFile(skillPath, "utf-8");
      return { dirName: dir.name, content };
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;

    const { dirName, content } = result.value;
    const meta = parseFrontmatter(content);
    if (!meta || !meta.name) continue;

    skills.set(meta.name, {
      name: meta.name,
      dirName,
      description: meta.description || "",
      category: meta.metadata?.category || "other",
      locale: meta.metadata?.locale || "ko-KR",
      longDescription: parseDescription(content),
      examples: parseWhenToUse(content),
    });
  }

  return skills;
}

/**
 * Search skills by keyword (matches name, description, examples).
 */
export function searchSkills(skills, query) {
  const q = query.toLowerCase();
  const results = [];

  for (const skill of skills.values()) {
    const haystack = [
      skill.name,
      skill.description,
      skill.longDescription || "",
      ...skill.examples,
    ]
      .join(" ")
      .toLowerCase();

    if (haystack.includes(q)) {
      results.push(skill);
    }
  }

  return results;
}

/**
 * Group skills by category.
 */
export function groupByCategory(skills) {
  const groups = new Map();
  for (const skill of skills.values()) {
    const cat = skill.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(skill);
  }
  return groups;
}

export { REPO_ROOT };
