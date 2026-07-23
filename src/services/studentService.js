import * as storage from './storageService.js';

const STUDENTS_KEY = 'students:list';
const STUDENT_SCHEMA_VERSION = 1;

function _emitStudentsChanged() {
  try {
    window.dispatchEvent(new CustomEvent('students-changed', { detail: { time: Date.now() } }));
  } catch (e) {
    // ignore in non-browser environments
  }
}

function _studentId(index = 0) {
  return `student-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
}

export function parseStudentNames(input) {
  if (Array.isArray(input)) return input.map((name) => String(name || '').trim()).filter(Boolean);
  return String(input || '')
    .split(/[\n,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function _normalizeStudents(students = []) {
  const now = new Date().toISOString();
  const seen = new Set();
  const normalized = [];

  students.forEach((student, index) => {
    const name = typeof student === 'string' ? student.trim() : String(student?.name || '').trim();
    if (!name) return;

    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    normalized.push({
      id: typeof student === 'object' && student?.id ? student.id : _studentId(index),
      schemaVersion: STUDENT_SCHEMA_VERSION,
      name,
      createdAt: typeof student === 'object' && student?.createdAt ? student.createdAt : now,
      updatedAt: now
    });
  });

  return normalized;
}

export async function getStudents() {
  const raw = await storage.load(STUDENTS_KEY, []);
  return _normalizeStudents(Array.isArray(raw) ? raw : []);
}

export async function saveStudents(students = []) {
  const normalized = _normalizeStudents(students);
  await storage.save(STUDENTS_KEY, normalized);
  _emitStudentsChanged();
  return normalized;
}

export async function addStudents(input) {
  const existing = await getStudents();
  const names = parseStudentNames(input);
  return saveStudents([...existing, ...names]);
}

export async function removeStudent(studentId) {
  const existing = await getStudents();
  const next = existing.filter((student) => student.id !== studentId);
  await storage.save(STUDENTS_KEY, next);
  _emitStudentsChanged();
  return next;
}

export async function clearStudents() {
  await storage.save(STUDENTS_KEY, []);
  _emitStudentsChanged();
  return [];
}
