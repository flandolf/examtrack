import { describe, expect, test } from "bun:test"
import { analyseAttempt, analyseScore, buildAttemptBenchmarks, buildSubjectBenchmarks, buildVcaaYearInsights, computeDistributionStats, findAttemptReferenceForYear, formatExamTitle, getAttemptPoints, isAppData, matchesAttemptReference, migrateAppData, removeAttempt, validateAttempt, type AssessmentReference, type ExamAttempt } from "../src/lib/exam-data"
import { parseAppDataFile } from "../src/lib/storage"
import { buildTimetableCalendar, suggestTimetableForAttempt, type Timetable, type TimetableEntry } from "../src/lib/timetable"

const reference: AssessmentReference = {
  id: "METHODS:2025:GA-2",
  studyCode: "METHODS",
  studyName: "Mathematical Methods",
  displayName: "Mathematical Methods",
  year: 2025,
  gaCode: "GA 2",
  name: "WRITTEN EXAMINATION 1",
  maxScore: 80,
  sourceUrl: "https://example.test",
  gradeBands: [
    { grade: "C", minScore: 0, maxScore: 39, count: 40, percentage: 40, sortOrder: 0 },
    { grade: "B", minScore: 40, maxScore: 59, count: 30, percentage: 30, sortOrder: 1 },
    { grade: "A", minScore: 60, maxScore: 80, count: 30, percentage: 30, sortOrder: 2 },
  ],
}

const attempt: ExamAttempt = {
  id: "attempt-1",
  subject: "Mathematical Methods",
  provider: "VCAA",
  title: "VCAA 2025 Mathematical Methods",
  examYear: 2025,
  paper: "Exam 1",
  completedAt: "2026-07-11",
  rawScore: 32,
  rawMax: 40,
  referenceId: reference.id,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
}

describe("exam analysis", () => {
  test("derives exam titles from provider, year, and subject", () => {
    expect(formatExamTitle("VCAA", 2025, "Mathematical Methods")).toBe("VCAA 2025 Mathematical Methods")
  })

  test("uses the selected VCAA comparison year instead of the attempt year", () => {
    const reference2024 = { ...reference, id: "METHODS:2024:GA-2", year: 2024 }
    expect(findAttemptReferenceForYear(attempt, [reference, reference2024], 2024)).toBe(reference2024)
    expect(findAttemptReferenceForYear(attempt, [reference], 2024)).toBeUndefined()
  })

  test("scales raw marks and estimates a percentile inside the official band", () => {
    const result = analyseAttempt(attempt, reference)
    expect(result.scaledScore).toBe(64)
    expect(result.percentage).toBe(80)
    expect(result.grade).toBe("A")
    expect(result.percentile).toBeCloseTo(76, 0)
    expect(analyseScore(39.6, reference)).toEqual({ grade: "B", percentile: 40 })
  })

  test("validates score boundaries", () => {
    expect(validateAttempt({ rawScore: 41, rawMax: 40 })).toBe("Mark cannot exceed the maximum.")
    expect(validateAttempt({ rawScore: 40, rawMax: 40 })).toBeNull()
  })

  test("builds chart points and cascades attempt deletion", () => {
    const second = { ...attempt, id: "attempt-2", rawScore: 20 }
    expect(getAttemptPoints([attempt, second], reference)).toHaveLength(2)
    expect(getAttemptPoints([attempt], { ...reference, id: "METHODS:2024:GA-2", year: 2024 })).toHaveLength(1)
    expect(getAttemptPoints([{ ...attempt, paper: "Exam 2" }], reference)).toHaveLength(0)
    expect(getAttemptPoints([{ ...attempt, subject: "Specialist Mathematics" }], reference)).toHaveLength(0)
    expect(matchesAttemptReference({ ...attempt, referenceId: null }, reference)).toBe(true)
    const data = {
      schemaVersion: 1 as const,
      attempts: [attempt, second],
      mistakes: [{
        id: "mistake-1",
        attemptId: attempt.id,
        question: "1a",
        category: "Concept" as const,
        explanation: "Error",
        correction: "Fix",
        resolved: false,
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
      }],
    }
    expect(removeAttempt(data, attempt.id)).toEqual({ schemaVersion: 1, attempts: [second], mistakes: [] })
  })

  test("estimates the median from cumulative grade-band percentages", () => {
    expect(computeDistributionStats(reference).median).toBeCloseTo(46.33, 2)
  })

  test("builds year insights with official cohort and A+ cutoff data", () => {
    const insights = buildVcaaYearInsights([
      reference,
      { ...reference, id: "METHODS:2024:GA-2", year: 2024 },
    ], 80)
    expect(insights.map((item) => item.year)).toEqual([2024, 2025])
    expect(insights[1]).toMatchObject({ cohortSize: 100, grade: "A", percentile: 76 })
    expect(insights[1].aPlusCutoffPercentage).toBeNull()
  })

  test("builds shared VCAA attempt and subject benchmarks", () => {
    const withAPlus = {
      ...reference,
      gradeBands: [
        ...reference.gradeBands,
        { grade: "A+", minScore: 72, maxScore: 80, count: 10, percentage: 10, sortOrder: 3 },
      ],
    }
    const second = { ...attempt, id: "attempt-2", rawScore: 30, completedAt: "2026-07-12" }
    const attemptBenchmarks = buildAttemptBenchmarks([attempt, second], [withAPlus])
    expect(attemptBenchmarks).toHaveLength(2)
    expect(attemptBenchmarks[0]).toMatchObject({ percentage: 80, aPlusCutoffPercentage: 90, gapToAPlus: -10 })

    expect(buildSubjectBenchmarks([attempt, second], [withAPlus])).toEqual([
      expect.objectContaining({
        subject: "Mathematical Methods",
        attemptCount: 2,
        linkedCount: 2,
        averageMark: 77.5,
        bestMark: 80,
        latestMark: 75,
        aPlusCutoffPercentage: 90,
      }),
    ])
  })

  test("rejects malformed imports", () => {
    expect(() => parseAppDataFile('{"schemaVersion":2}')).toThrow("valid ExamTrack")
    const data = {
      schemaVersion: 2 as const,
      attempts: [attempt],
      mistakes: [],
      trackedExamIds: [],
    }
    expect(isAppData(data)).toBe(true)
    expect(parseAppDataFile(JSON.stringify(data))).toEqual(data)
  })

  test("migrates v1 AppData to v2 with empty trackedExamIds", () => {
    const v1 = {
      schemaVersion: 1 as const,
      attempts: [attempt],
      mistakes: [],
    }
    const migrated = migrateAppData(v1)
    expect(migrated?.schemaVersion).toBe(2)
    expect(migrated?.trackedExamIds).toEqual([])
    expect(migrated?.attempts).toHaveLength(1)
  })

  test("rejects v2 AppData missing trackedExamIds and back-fills via migration", () => {
    const v2Incomplete = {
      schemaVersion: 2,
      attempts: [attempt],
      mistakes: [],
    }
    expect(isAppData(v2Incomplete)).toBe(false)
    const migrated = migrateAppData(v2Incomplete)
    expect(migrated?.trackedExamIds).toEqual([])
  })

  test("accepts v2 AppData with a non-empty trackedExamIds array", () => {
    const v2 = {
      schemaVersion: 2 as const,
      attempts: [attempt],
      mistakes: [],
      trackedExamIds: ["2026-11-05-mathematical-methods-exam-1"],
    }
    expect(isAppData(v2)).toBe(true)
  })

  test("accepts old mistakes without question text and validates new question text", () => {
    const mistake = {
      id: "mistake-1",
      attemptId: attempt.id,
      question: "Question 4b",
      category: "Concept" as const,
      explanation: "Missed the chain rule",
      correction: "Apply the chain rule",
      resolved: false,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    }
    const data = { schemaVersion: 2 as const, attempts: [attempt], mistakes: [mistake], trackedExamIds: [] }

    expect(isAppData(data)).toBe(true)
    expect(isAppData({ ...data, mistakes: [{ ...mistake, questionText: "Differentiate $e^{2x}$." }] })).toBe(true)
    expect(isAppData({ ...data, mistakes: [{ ...mistake, questionText: 42 }] })).toBe(false)
  })
})

const methods1: TimetableEntry = {
  id: "2026-11-05-mathematical-methods-exam-1",
  date: "2026-11-05",
  dateEnd: null,
  startTime: "09:00",
  endTime: "10:15",
  readingMinutes: 15,
  subject: "Mathematical Methods",
  paper: "Examination 1",
  component: "written",
}
const methods2: TimetableEntry = {
  id: "2026-11-06-mathematical-methods-exam-2",
  date: "2026-11-06",
  dateEnd: null,
  startTime: "11:45",
  endTime: "14:00",
  readingMinutes: 15,
  subject: "Mathematical Methods",
  paper: "Examination 2",
  component: "written",
}
const english: TimetableEntry = {
  id: "2026-10-27-english",
  date: "2026-10-27",
  dateEnd: null,
  startTime: "09:00",
  endTime: "12:15",
  readingMinutes: 15,
  subject: "English",
  paper: null,
  component: "written",
}
const musicPerformanceRange: TimetableEntry = {
  id: "2026-10-05-music-repertoire-performance",
  date: "2026-10-05",
  dateEnd: "2026-11-01",
  startTime: null,
  endTime: null,
  readingMinutes: null,
  subject: "Music",
  paper: "Repertoire Performance examination",
  component: "performance",
  scheduledNote: "By advice slip from Monday 27 July",
}
const musicWritten: TimetableEntry = {
  id: "2026-11-17-music-repertoire-performance-written",
  date: "2026-11-17",
  dateEnd: null,
  startTime: "09:00",
  endTime: "10:15",
  readingMinutes: 15,
  subject: "Music",
  paper: "Repertoire Performance written examination",
  component: "written",
}

const fixtureTimetable: Timetable = {
  year: 2026,
  sourceUrl: "https://example.test/timetable",
  compiledFromOfficialPublication: "Test fixture",
  exams: [methods1, methods2, english, musicPerformanceRange, musicWritten],
}

describe("suggestTimetableForAttempt", () => {
  test("suggests every official paper for a practiced subject", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "Mathematical Methods", paper: "Exam 1" },
      fixtureTimetable,
      [],
    )
    expect(suggestions.map((entry) => entry.id)).toEqual([methods1.id, methods2.id])
  })

  test("does not confuse a practice paper label with the official exam being tracked", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "Mathematical Methods", paper: "Exam 2" },
      fixtureTimetable,
      [],
    )
    expect(suggestions.map((entry) => entry.id)).toEqual([methods1.id, methods2.id])
  })

  test("includes a single-paper subject like English", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "English", paper: "" },
      fixtureTimetable,
      [],
    )
    expect(suggestions.map((entry) => entry.id)).toEqual([english.id])
  })

  test("suggests every paper for the subject when the attempt has no paper", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "Music", paper: "" },
      fixtureTimetable,
      [],
    )
    expect(suggestions.map((entry) => entry.id).sort()).toEqual(
      [musicPerformanceRange.id, musicWritten.id].sort(),
    )
  })

  test("excludes entries the student is already tracking", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "Mathematical Methods", paper: "Exam 1" },
      fixtureTimetable,
      [methods2.id],
    )
    expect(suggestions.map((entry) => entry.id)).toEqual([methods1.id])
  })

  test("returns nothing when the subject isn't on the timetable", () => {
    const suggestions = suggestTimetableForAttempt(
      { subject: "School Internal", paper: "Trial" },
      fixtureTimetable,
      [],
    )
    expect(suggestions).toEqual([])
  })

  test("returns suggestions sorted by date then start time", () => {
    const outOfOrder: Timetable = {
      ...fixtureTimetable,
      exams: [methods2, methods1, musicWritten, musicPerformanceRange, english],
    }
    const suggestions = suggestTimetableForAttempt(
      { subject: "Mathematical Methods", paper: "" },
      outOfOrder,
      [],
    )
    expect(suggestions.map((entry) => entry.id)).toEqual([methods1.id, methods2.id])
  })
})

test("exports tracked VCE exams as timed and all-day calendar events", () => {
  const calendar = buildTimetableCalendar(
    [methods1, musicPerformanceRange],
    fixtureTimetable.sourceUrl,
    new Date("2026-07-12T00:00:00.000Z"),
  )
  expect(calendar).toContain("DTSTART;TZID=Australia/Melbourne:20261105T090000")
  expect(calendar).toContain("DTEND;TZID=Australia/Melbourne:20261105T101500")
  expect(calendar).toContain("DTSTART;VALUE=DATE:20261005")
  expect(calendar).toContain("DTEND;VALUE=DATE:20261102")
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2)
})
