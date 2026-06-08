import { autoClassifyTag } from '@/lib/autoTag';

export type WorkType = 'deep' | 'shallow' | 'admin' | 'errand' | 'recovery';
export type WorkTypeEntity = 'todo' | 'moment';

export const WORK_TYPE_STORAGE_KEY = 'eol-work-type-overrides-v1';
export const WORK_TYPE_EVENT = 'eol-work-type-updated';

export const WORK_TYPE_META: Record<WorkType, { label: string; shortLabel: string; color: string; bg: string }> = {
  deep: {
    label: 'Deep',
    shortLabel: 'Deep',
    color: '#5C66BE',
    bg: '#EFF0FB',
  },
  shallow: {
    label: 'Shallow',
    shortLabel: 'Shallow',
    color: '#7C828B',
    bg: '#F1F2F4',
  },
  admin: {
    label: 'Admin',
    shortLabel: 'Admin',
    color: '#98678F',
    bg: '#F6EEF4',
  },
  errand: {
    label: 'Errand',
    shortLabel: 'Errand',
    color: '#C06B52',
    bg: '#FBEFEB',
  },
  recovery: {
    label: 'Recovery',
    shortLabel: 'Recovery',
    color: '#5C9B7E',
    bg: '#EDF6F1',
  },
};

export type WorkTypeOverrideMap = Record<string, WorkType>;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()\-_/\\.,:;!?[\]{}"'`~@#$%^&*+=|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatches(text: string, patterns: Array<string | RegExp>): number {
  return patterns.reduce((score, pattern) => {
    if (typeof pattern === 'string') return score + (text.includes(pattern) ? 1 : 0);
    return score + (pattern.test(text) ? 1 : 0);
  }, 0);
}

export function getWorkTypeKey(entity: WorkTypeEntity, id: string) {
  return `${entity}:${id}`;
}

export function readWorkTypeOverrides(): WorkTypeOverrideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WORK_TYPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeWorkTypeOverrides(overrides: WorkTypeOverrideMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WORK_TYPE_STORAGE_KEY, JSON.stringify(overrides));
  window.dispatchEvent(new CustomEvent(WORK_TYPE_EVENT));
}

export function inferWorkType(input: { title?: string; text?: string; tags?: string[] }): WorkType {
  const source = normalizeText([input.title || '', input.text || ''].join(' '));
  const category = autoClassifyTag(input.title || input.text || '');

  const scores: Record<WorkType, number> = {
    deep: 0,
    shallow: 0,
    admin: 0,
    errand: 0,
    recovery: 0,
  };

  if (category === 'study') scores.deep += 3;
  // "work" is a broad bucket (projects, coding, interview prep, resume...) that
  // mostly is NOT clerical busywork, so nudge it toward shallow rather than admin.
  if (category === 'work') scores.shallow += 1;
  if (category === 'health') scores.recovery += 2;
  if (category === 'shopping' || category === 'travel') scores.errand += 3;
  if (category === 'life') scores.errand += 1;

  scores.deep += scoreMatches(source, [
    'homework', 'assignment', 'review', 'research', 'study', 'prepare', 'write', 'build', 'code',
    'debug', 'design', 'draft', 'essay', 'paper', 'deep work', 'analyze', 'analysis',
    'aml', 'nlp', 'machine learning', 'cs336', 'leetcode', 'project',
    '作业', '复习', '预习', '写', '研究', '刷题',
  ]) * 2;

  scores.shallow += scoreMatches(source, [
    'reply', 'email', 'notes', 'read', 'listen', 'watch', 'check', 'browse', 'skim',
    'message', 'messages', 'amz', 'amazon', 'slides',
    '回复', '邮件', '消息', '看看', '听课', '看课',
  ]) * 2;

  // Admin = clerical / bureaucratic logistics only. Keep this list specific so
  // it does not swallow real work ("fix bug", "update code", "改方案").
  scores.admin += scoreMatches(source, [
    'survey', 'form', 'schedule', 'submit', 'application', 'apply', 'upload',
    'appointment', 'insurance', 'account', 'paperwork', 'register', 'registration',
    'renew', 'tax', 'taxes', 'bill', 'invoice', 'refund', 'reimburse', 'reservation',
    'booking', 'password', 'verify', 'sign up', 'visa', 'passport', 'license',
    '填表', '安排', '预约', '申请', '提交', '报税', '账单', '注册', '续费', '密码', 'check adhd',
  ]) * 2;

  scores.errand += scoreMatches(source, [
    'buy', 'purchase', 'pickup', 'drop off', 'rent', 'dental', 'doctor', 'otc', 'coffee',
    'lunch', 'makeup', 'shower', 'grocery', 'groceries', 'store', 'shopping',
    '买', '取', '寄', '牙', '逛', '洗澡', '买菜',
  ]) * 2;

  scores.recovery += scoreMatches(source, [
    'rest', 'nap', 'walk', 'therapy', 'gym', 'workout', 'stretch', 'meditate', 'sleep',
    'recover', 'reset', 'journal', 'shower',
    '休息', '散步', '健身', '睡', 'therapy', 'recovery',
  ]) * 2;

  if (/\breply\b|\bemail\b|\bsurvey\b|\bform\b/.test(source)) {
    scores.deep = Math.max(0, scores.deep - 1);
  }

  if (/\bapply for jobs?\b|\bjob application\b/.test(source)) {
    scores.admin += 2;
  }

  if (/\bfix this website\b|\bbuild\b|\bdebug\b/.test(source)) {
    scores.deep += 2;
  }

  if (/\btherapy\b|\bwalk\b|\bnap\b|\brest\b|\bshower\b/.test(source)) {
    scores.recovery += 2;
  }

  // Default to "shallow" (light, undifferentiated work) when no signal wins —
  // admin must now earn a strict lead instead of being the catch-all bucket.
  const ordered: WorkType[] = ['deep', 'shallow', 'admin', 'errand', 'recovery'];
  return ordered.reduce((best, current) => (
    scores[current] > scores[best] ? current : best
  ), 'shallow');
}

export function resolveWorkType(input: {
  entity?: WorkTypeEntity;
  id?: string;
  title?: string;
  text?: string;
  tags?: string[];
  overrides?: WorkTypeOverrideMap;
}): WorkType {
  const overrides = input.overrides || readWorkTypeOverrides();
  if (input.entity && input.id) {
    const stored = overrides[getWorkTypeKey(input.entity, input.id)];
    if (stored) return stored;
  }
  return inferWorkType(input);
}
