import type { TaskTrackerItem, TaskTrackerPriority } from "@shared/types";

export const taskTrackerPriorityRank: Record<TaskTrackerPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type TaskTrackerCalendarGroup = {
  date: string;
  items: TaskTrackerItem[];
};

export function sortTaskTrackerItems(items: TaskTrackerItem[]): TaskTrackerItem[] {
  return [...items].sort(
    (a, b) =>
      a.scheduled_for.localeCompare(b.scheduled_for) ||
      taskTrackerPriorityRank[a.priority] - taskTrackerPriorityRank[b.priority] ||
      a.created_at.localeCompare(b.created_at) ||
      a.title.localeCompare(b.title),
  );
}

export function groupTaskTrackerItems(
  items: TaskTrackerItem[],
): TaskTrackerCalendarGroup[] {
  const groups = new Map<string, TaskTrackerItem[]>();
  for (const item of sortTaskTrackerItems(items)) {
    const group = groups.get(item.scheduled_for) ?? [];
    group.push(item);
    groups.set(item.scheduled_for, group);
  }
  return [...groups].map(([date, groupedItems]) => ({
    date,
    items: groupedItems,
  }));
}

export function formatTaskTrackerDate(date: string, today: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  const todayDate = new Date(`${today}T12:00:00`);
  const dayDifference = Math.round(
    (parsed.valueOf() - todayDate.valueOf()) / (24 * 60 * 60 * 1000),
  );
  if (dayDifference === 0) return "Today";
  if (dayDifference === 1) return "Tomorrow";
  if (dayDifference === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parsed);
}
