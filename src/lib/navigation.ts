import {
  BookOpenText,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  LibraryBig,
  NotebookPen,
  Settings2,
} from "lucide-react"

import type { AppView } from "@/lib/app-view"

export const APP_NAVIGATION = [
  { id: "dashboard" as const, label: "Dashboard", description: "Overview and exam results", icon: ChartNoAxesCombined },
  { id: "sacs" as const, label: "SACs", description: "Plan, time, and record SACs", icon: ClipboardCheck },
  { id: "library" as const, label: "Exam library", description: "Find official VCAA papers", icon: BookOpenText },
  { id: "timer" as const, label: "Exam timer", description: "Run a timed practice paper", icon: Clock3 },
  { id: "mistakes" as const, label: "Mistakes", description: "Review your revision queue", icon: NotebookPen },
  { id: "predictor" as const, label: "Study score", description: "Estimate study scores and ATAR", icon: Calculator },
  { id: "vcaa" as const, label: "VCAA data", description: "Explore official grade distributions", icon: LibraryBig },
]

export const SETTINGS_ITEM = {
  id: "settings" as const,
  label: "Settings",
  description: "Subjects, difficulty, and sync",
  icon: Settings2,
}

export const ALL_NAVIGATION = [...APP_NAVIGATION, SETTINGS_ITEM]

export function getViewLabel(view: AppView) {
  return ALL_NAVIGATION.find((item) => item.id === view)?.label ?? "ExamTrack"
}
