#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, isoNow, parseArgs, readJson, relativePortable, requireArg, slug } from "./lib/common.mjs";

async function loadOperations(directory) {
  const operations = [];
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return operations;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    operations.push(await readJson(path.join(directory, entry.name)));
  }
  return operations;
}

function emphasize(text, prerequisite, template) {
  let result = text;
  for (const phrase of prerequisite.criticalPhrases ?? []) {
    const markup = String(template.criticalStateEmphasis ?? "**{{text}}**").replace("{{text}}", phrase);
    result = result.replaceAll(phrase, markup);
  }
  return result;
}

function operationMarkdown(operation, variant, template, copiedImages) {
  const headings = template.headings;
  const anchor = operation.manualAnchor ?? slug(operation.id);
  const lines = [`<a id="${anchor}"></a>`, `### ${operation.title}`, ""];
  let scenario = operation.scenario.trim();
  const prerequisites = operation.prerequisites ?? [];
  if (prerequisites.length) {
    const text = prerequisites.map((item) => emphasize(item.text, item, template)).join("；");
    scenario = `${scenario.replace(/[。；;]$/, "")}；前提是${text}。`;
  }
  lines.push(`${headings.scenario}：${scenario}`, "", `${headings.result}：${operation.result.trim()}`, "", `#### ${headings.screenshots}`, "");
  for (const image of copiedImages) lines.push(`<img src="${image}" alt="${operation.title}" width="${template.imageWidth ?? 760}">`, "");
  if (template.includeBusinessErrors !== false && (operation.businessErrors ?? []).length) {
    lines.push(`#### ${headings.errors}`, "", "| 错误信息 | 产生原因 |", "| --- | --- |");
    for (const error of operation.businessErrors) lines.push(`| ${error.message} | ${error.cause} |`);
    lines.push("");
  }
  return lines.join("\n");
}

const args = parseArgs();
const project = path.resolve(requireArg(args, "project"));
const manualRoot = path.join(project, ".product-manual");
const outputRoot = path.resolve(args.output ?? path.join(project, "docs", "product-manual"));
const projectConfig = await readJson(path.join(manualRoot, "config", "project.json"));
const template = await readJson(path.join(manualRoot, "config", "template.json"));
const inventory = await readJson(path.join(manualRoot, "project-inventory.json"), {});
const operations = await loadOperations(path.join(project, ".product-manual-plan", "operations"));
const moduleOrder = new Map((projectConfig.moduleOrder ?? []).map((id, index) => [id, index]));
const enabledPlatforms = projectConfig.platforms ?? [];
const rendered = [];

for (const platform of enabledPlatforms) {
  const platformOperations = operations.filter((operation) => operation.platformVariants?.[platform] && operation.publication !== "excluded");
  platformOperations.sort((left, right) => {
    const moduleDifference = (moduleOrder.get(left.moduleId) ?? 9999) - (moduleOrder.get(right.moduleId) ?? 9999);
    return moduleDifference || String(left.title).localeCompare(String(right.title), projectConfig.defaultLanguage ?? "zh-CN");
  });
  const platformOutput = path.join(outputRoot, platform);
  const sequenceOutput = path.join(platformOutput, "images", "sequences");
  await ensureDir(sequenceOutput);
  const moduleGroups = new Map();
  for (const operation of platformOperations) {
    if (!moduleGroups.has(operation.moduleId)) moduleGroups.set(operation.moduleId, { name: operation.moduleName, operations: [] });
    moduleGroups.get(operation.moduleId).operations.push(operation);
  }
  const lines = [
    "---",
    `app_version: "${projectConfig.appVersion ?? "unknown"}"`,
    `source_commit: "${projectConfig.sourceCommit ?? "unknown"}"`,
    `verification_environment: "${projectConfig.verificationEnvironment ?? "unspecified"}"`,
    `generated_at: "${isoNow()}"`,
    "document_status: \"draft-generated\"",
    "---",
    "",
    `# ${template.title}（${template.platformLabels?.[platform] ?? platform}）`,
    "",
    "## 目录",
    ""
  ];
  for (const [, group] of moduleGroups) lines.push(`- [${group.name}](#${slug(group.name)})`);
  lines.push("");
  for (const [, group] of moduleGroups) {
    lines.push(`## ${group.name}`, "");
    let currentNode = null;
    for (const operation of group.operations) {
      if (template.includeBusinessNodes !== false && operation.businessNodeName && operation.businessNodeName !== currentNode) {
        currentNode = operation.businessNodeName;
        lines.push(`### ${currentNode}`, "");
      }
      const variant = operation.platformVariants[platform];
      const imageReferences = [];
      for (const sourcePath of variant.sequenceImages ?? []) {
        const absoluteSource = path.resolve(project, sourcePath);
        const filename = path.basename(absoluteSource);
        const destination = path.join(sequenceOutput, filename);
        if (absoluteSource !== destination) await fs.copyFile(absoluteSource, destination);
        imageReferences.push(`images/sequences/${filename}`);
      }
      let markdown = operationMarkdown(operation, variant, template, imageReferences);
      if (template.includeBusinessNodes !== false && currentNode) markdown = markdown.replace(/^### /m, "#### ").replace(/^#### 操作步骤截图/m, "##### 操作步骤截图").replace(/^#### 异常说明/m, "##### 异常说明");
      lines.push(markdown);
    }
  }
  const target = path.join(platformOutput, "user-manual.md");
  await fs.writeFile(target, `${lines.join("\n").trim()}\n`, "utf8");
  rendered.push({ platform, target, operations: platformOperations.length });
}

const indexLines = [`# ${template.title}`, ""];
for (const item of rendered) indexLines.push(`- [${template.platformLabels?.[item.platform] ?? item.platform}](./${item.platform}/user-manual.md)`);
indexLines.push("", `生成时间：${isoNow()}`, "");
await ensureDir(outputRoot);
await fs.writeFile(path.join(outputRoot, "index.md"), indexLines.join("\n"), "utf8");

process.stdout.write(`${JSON.stringify({ outputRoot, rendered, inventoryGeneratedAt: inventory.generatedAt ?? null }, null, 2)}\n`);
