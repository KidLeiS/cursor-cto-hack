import type { TaskTrackerItem } from "@shared/types";

function taskSection(
  item: TaskTrackerItem,
  documentationUpdate: string,
): string {
  const due = item.due_on ? `\n- Due: ${item.due_on}` : "";
  return [
    `<!-- task-tracker:${item.id}:start -->`,
    `## ${item.title}`,
    "",
    `- Priority: ${item.priority}`,
    `- Scheduled: ${item.scheduled_for}${due}`,
    "",
    documentationUpdate.trim(),
    `<!-- task-tracker:${item.id}:end -->`,
  ].join("\n");
}

export function upsertTaskDocumentationSection(
  markdown: string,
  item: TaskTrackerItem,
  documentationUpdate = item.documentation_update,
): string {
  const section = taskSection(item, documentationUpdate);
  const start = `<!-- task-tracker:${item.id}:start -->`;
  const end = `<!-- task-tracker:${item.id}:end -->`;
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex >= 0 && endIndex >= startIndex) {
    return [
      markdown.slice(0, startIndex).trimEnd(),
      section,
      markdown.slice(endIndex + end.length).trimStart(),
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return [markdown.trimEnd(), section].filter(Boolean).join("\n\n");
}
