export type ExamType = "expertise" | "experience";
export type BlockCode = "CODING" | "ROBOTICS" | "ART" | "PROCESS";
export type LevelTag = "B" | "A" | "I";

export interface ExamSetRecord {
  id: number;
  subject_id: number;
  set_code: string;
  set_name: string;
  question_count?: number;
  total_points: number;
  passing_score: number;
  status: "active" | "inactive";
  valid_from: string | null;
  valid_to: string | null;
  exam_type: ExamType;
  block_code: string;
  subject_code: string;
  subject_name: string;
}

export interface SubjectConfig {
  id: string;
  examType: ExamType;
  blockCode: BlockCode;
  label: string;
  matchKeys: string[];
  durationMinutes?: number;
  levelTags?: LevelTag[];
}

export const SUBJECT_CONFIGS: SubjectConfig[] = [
  { id: "cod-scratch", examType: "expertise", blockCode: "CODING", label: "[COD] Scratch (S)", matchKeys: ["[COD] Scratch"], durationMinutes: 120 },
  { id: "cod-gamemaker", examType: "expertise", blockCode: "CODING", label: "[COD] GameMaker (G)", matchKeys: ["[COD] GameMaker"], durationMinutes: 120 },
  { id: "cod-python", examType: "expertise", blockCode: "CODING", label: "[COD] Python (PT)", matchKeys: ["[COD] Python"], durationMinutes: 120 },
  { id: "cod-web", examType: "expertise", blockCode: "CODING", label: "[COD] Web (JS)", matchKeys: ["[COD] Web"], durationMinutes: 120 },
  {
    id: "cod-cs",
    examType: "expertise",
    blockCode: "CODING",
    label: "[COD] Computer Science (CS)",
    matchKeys: ["[COD] ComputerScience", "[COD] Computer Science"],
    durationMinutes: 120,
  },

  {
    id: "rob-lego-4plus",
    examType: "expertise",
    blockCode: "ROBOTICS",
    label: "[ROB] Lego 4+",
    matchKeys: ["[ROB] Lego Spike", "[ROB] LegoSpike", "[ROB] Lego"],
    durationMinutes: 120,
    levelTags: ["B", "A", "I"],
  },
  {
    id: "rob-vex-go",
    examType: "expertise",
    blockCode: "ROBOTICS",
    label: "[ROB] Vex Go",
    matchKeys: ["[ROB] Vex Go", "[ROB] VexGo", "[ROB] Vex Go N1", "[ROB] VexGo N1", "[ROB] Vex Go N2", "[ROB] VexGo N2"],
    durationMinutes: 120,
    levelTags: ["B", "A", "I"],
  },
  {
    id: "rob-vex-iq",
    examType: "expertise",
    blockCode: "ROBOTICS",
    label: "[ROB] Vex IQ",
    matchKeys: ["[ROB] Vex IQ", "[ROB] VexIQ", "[ROB] Vex IQ N3", "[ROB] VexIQ N3"],
    durationMinutes: 120,
    levelTags: ["B", "A", "I"],
  },

  {
    id: "art-all",
    examType: "expertise",
    blockCode: "ART",
    label: "[ART] Arts",
    matchKeys: ["[ART]"],
    durationMinutes: 120,
    levelTags: ["B", "A", "I"],
  },

  {
    id: "process-experience",
    examType: "experience",
    blockCode: "PROCESS",
    label: "Kiểm tra quy trình & kỹ năng trải nghiệm",
    matchKeys: ["[Trial] Quy Trình Trai nghiệm", "quy trình"],
    durationMinutes: 60,
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const inferLevel = (set: ExamSetRecord): { label: string; className: string } => {
  const fullText = `${set.set_code} ${set.set_name}`.toLowerCase();

  if (fullText.includes("-b-") || fullText.includes("basic")) {
    return { label: "Basic", className: "bg-green-100 text-green-700" };
  }

  if (fullText.includes("-a-") || fullText.includes("advanced")) {
    return { label: "Advanced", className: "bg-blue-100 text-blue-700" };
  }

  if (fullText.includes("-i-") || fullText.includes("intensive")) {
    return { label: "Intensive", className: "bg-rose-100 text-rose-700" };
  }

  return { label: "Set", className: "bg-gray-100 text-gray-700" };
};

export const getSetsBySubject = (sets: ExamSetRecord[], subject: SubjectConfig) => {
  return sets
    .filter((set) => {
      if (set.exam_type !== subject.examType) return false;

      const setCodeNormalized = normalize(set.subject_code || "");
      const setNameNormalized = normalize(set.subject_name || "");

      return subject.matchKeys.some((key) => {
        const normalizedKey = normalize(key);
        return (
          setCodeNormalized.includes(normalizedKey) ||
          setNameNormalized.includes(normalizedKey) ||
          normalizedKey.includes(setCodeNormalized)
        );
      });
    })
    .sort((a, b) => a.set_code.localeCompare(b.set_code));
};

export const getSubjectById = (subjectId: string) => SUBJECT_CONFIGS.find((subject) => subject.id === subjectId);
