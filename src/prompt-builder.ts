/**
 * 医学图示 Prompt 优化器（由原 Skill 的 scripts/prompt_builder.py 移植）
 *
 * 职责：判断图示类型 → 组织专业 Prompt。
 * 安全边界：仅组织用户提供的医学对象和关系，不补造剂量、疗效、发生率、
 * 临床结论或指南建议。
 */

export interface MedicalPrompt {
  illustrationType: string
  optimizedPrompt: string
}

/** 百通生图接口 prompt 上限 */
export const PROMPT_MAX_LENGTH = 4000

type TypeRule = {
  type: string
  keywords: readonly string[]
  guidance: string
}

/**
 * 关键词判定顺序即优先级：机制类先于解剖类，避免「作用机制」被「器官」误捕获。
 */
const TYPE_RULES: readonly TypeRule[] = [
  {
    type: 'drug_mechanism',
    keywords: ['作用机制', '药物', '受体', '靶点', '降糖', '药理'],
    guidance:
      'drug action mechanism with target, organ/cell pathway, directional arrows, and therapeutic effect',
  },
  {
    type: 'disease_mechanism',
    keywords: ['发病机制', '疾病机制', '病理', '病因', '发病'],
    guidance:
      'disease pathogenesis diagram with risk factors, pathophysiological cascade, and clinical consequences',
  },
  {
    type: 'medical_flowchart',
    keywords: ['流程', '路径', '诊疗', '筛查', '管理', '步骤'],
    guidance:
      'clinical process flowchart with ordered steps, decision nodes, and directional arrows',
  },
  {
    type: 'medical_comparison',
    keywords: ['区别', '对比', '比较', 'vs', 'VS'],
    guidance:
      'side-by-side comparison infographic with balanced columns, aligned dimensions, and contrasting visual encoding',
  },
  {
    type: 'patient_education',
    keywords: ['患者教育', '宣教', '科普', '注射', '自我管理', '依从性'],
    guidance:
      'patient education infographic with simple visual sequence, inclusive people, and non-alarming presentation',
  },
  {
    type: 'anatomy_physiology',
    keywords: ['结构', '解剖', '生理', '器官', '组织'],
    guidance:
      'anatomy and physiology schematic with accurate relative spatial relationships and callout labels',
  },
]

const FALLBACK: TypeRule = {
  type: 'medical_concept',
  keywords: [],
  guidance:
    'medical concept diagram with causal relationships, layered structure, and directional arrows',
}

/** 可选尺寸白名单（百通生图支持的常用规格） */
export const ALLOWED_SIZES = [
  '1024x1024',
  '1024x1536',
  '1536x1024',
  '1792x1024',
  '1024x1792',
] as const

export type AllowedSize = (typeof ALLOWED_SIZES)[number]

export const DEFAULT_SIZE: AllowedSize = '1024x1024'

export function classifyIllustrationType(request: string): { type: string; guidance: string } {
  const haystack = request.toLowerCase()
  for (const rule of TYPE_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return { type: rule.type, guidance: rule.guidance }
    }
  }
  return { type: FALLBACK.type, guidance: FALLBACK.guidance }
}

export function buildMedicalPrompt(request: string): MedicalPrompt {
  const subject = request.trim()
  if (!subject) {
    throw new Error('医学图示需求不能为空。')
  }

  const { type, guidance } = classifyIllustrationType(subject)
  const optimizedPrompt = [
    'Professional medical textbook illustration and medical infographic for a medical conference, training, or pharmaceutical PPT.',
    `Illustration type: ${type}.`,
    `Subject from user request: ${subject}.`,
    `Composition: ${guidance}.`,
    'Use a clean light background, restrained clinical blue and teal palette, clear hierarchy, precise directional arrows, publication-ready vector-like rendering, and generous space for legible Chinese labels.',
    'Show only concepts explicitly supplied by the user; do not invent dosage, efficacy statistics, clinical claims, or guideline recommendations.',
  ].join(' ')

  if (optimizedPrompt.length > PROMPT_MAX_LENGTH) {
    throw new Error(
      `优化后的医学图示 Prompt 长度 ${optimizedPrompt.length} 字符，超过百通接口 ${PROMPT_MAX_LENGTH} 字符上限，请缩小需求范围后重试。`,
    )
  }

  return { illustrationType: type, optimizedPrompt }
}

export function normalizeSize(size?: string | null): AllowedSize {
  const raw = (size ?? '').trim()
  if (!raw) return DEFAULT_SIZE
  return (ALLOWED_SIZES as readonly string[]).includes(raw) ? (raw as AllowedSize) : DEFAULT_SIZE
}