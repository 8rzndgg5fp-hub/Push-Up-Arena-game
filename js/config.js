/* ==================================================================
   config.js — все настраиваемые константы в одном месте.
   Меняешь пороги, нагрузку или планы — только здесь.
   ================================================================== */
'use strict';

const CONFIG = {
  DUEL_TIME: 60,

  // Нагрузка → обязательная передышка при 100%
  FATIGUE: {
    perRep: { pushup: 3, squat: 2 },  // % за чистый повтор
    perError: 1.5,                    // % за повтор с ошибкой (усилие всё равно было)
    decayPerSec: 0.25,                // спад 15% в минуту
    lockSec: 120,                     // обязательный отдых 2 минуты
    afterLock: 50                     // нагрузка после окончания отдыха
  },

  // Эло: K-фактор зависит от опыта игрока
  ELO: { start: 1000, kNew: 40, kMid: 32, kPro: 24, newbieDuels: 10, proElo: 1400 },

  // Жест «руки над головой»
  GESTURE: { holdMs: 800, errorAfterMs: 700, errorRepeatMs: 3000, cooldownMs: 1500 },

  // Окно правильной техники
  TECH_MODAL_COOLDOWN: 15000,   // одна и та же ошибка — не чаще раза в 15 с
  TECH_MODAL_AUTOCLOSE: 7000,

  // MediaPipe Tasks Vision — умеет находить 2 человек в кадре
  TASKS_VERSION: '0.10.14',
  MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  MODEL_TIMEOUT: 30000,
  VIS: 0.5
};

/* 6 рангов по Эло */
const RANKS = [
  { min: -Infinity, name: 'Новичок', icon: '🌱' },
  { min: 1050,      name: 'Боец',    icon: '🥊' },
  { min: 1150,      name: 'Атлет',   icon: '🏃' },
  { min: 1250,      name: 'Мастер',  icon: '🎯' },
  { min: 1350,      name: 'Чемпион', icon: '🏆' },
  { min: 1450,      name: 'Титан',   icon: '👑' }
];

const EXERCISES = {
  pushup: { id: 'pushup', name: 'Отжимания',  icon: '💪', setup: 'Встань боком к камере в упоре лёжа, всё тело в кадре.' },
  squat:  { id: 'squat',  name: 'Приседания', icon: '🦵', setup: 'Встань боком или лицом к камере, от головы до стоп в кадре.' }
};

/*
  Каталог ошибок техники.
  title  — коротко (журнал, статистика)
  tip    — конкретная подсказка (панель + крупно поверх видео)
  voice  — фраза для озвучки
  joints — точки MediaPipe, которые подсвечиваются красным
  view   — ракурс анимации в окне «правильная техника»
*/
const ERRORS = {
  pushup: {
    depth:   { title: 'Мало опускаешься',  tip: 'Опусти грудь ниже: угол в локте меньше 90–100°.', voice: 'Опустись ниже', joints: [11, 12, 13, 14], view: 'side' },
    sag:     { title: 'Провисший таз',      tip: 'Напряги пресс и ягодицы — тело прямое от плеч до пяток.', voice: 'Таз провис, напряги пресс', joints: [23, 24], view: 'side' },
    pike:    { title: 'Задранный таз',      tip: 'Опусти таз: плечи, таз и пятки на одной линии.', voice: 'Опусти таз', joints: [23, 24], view: 'side' },
    lockout: { title: 'Руки не выпрямлены', tip: 'Наверху выпрямляй руки до конца.', voice: 'Выпрями руки до конца', joints: [13, 14, 15, 16], view: 'side' }
  },
  squat: {
    depth:   { title: 'Недостаточная глубина', tip: 'Садись ниже — бедро хотя бы параллельно полу.', voice: 'Садись глубже', joints: [23, 24, 25, 26], view: 'side' },
    valgus:  { title: 'Колени внутрь',          tip: 'Разводи колени наружу, по линии носков.', voice: 'Колени наружу', joints: [25, 26], view: 'front' },
    toes:    { title: 'Колени за носками',      tip: 'Отводи таз назад, колени не уходят далеко за носки.', voice: 'Таз назад, колени не вперёд', joints: [25, 26, 31, 32], view: 'side' },
    lean:    { title: 'Наклон корпуса',         tip: 'Держи грудь выше, спина прямая.', voice: 'Грудь выше', joints: [11, 12, 23, 24], view: 'side' },
    lockout: { title: 'Неполный подъём',        tip: 'Вставай полностью — выпрями колени и таз.', voice: 'Вставай до конца', joints: [23, 24, 25, 26], view: 'side' },
    tempo:   { title: 'Слишком быстрый темп',   tip: 'Медленнее: около 2 секунд вниз и 1 вверх.', voice: 'Медленнее', joints: [23, 24, 25, 26], view: 'side' }
  }
};

/* Ошибки жеста «руки над головой» */
const GESTURE_ERRORS = {
  oneHand: { title: 'Подними и вторую руку',    voice: 'Подними и вторую руку' },
  low:     { title: 'Выше — кисти над головой', voice: 'Руки выше головы' }
};

/* 3 готовых плана */
const PRESET_PLANS = [
  { id: 'preset-start', preset: true, name: 'Старт новичка', rest: 45, desc: 'Чередуем ноги и руки — мягкий вход.',
    sets: [{ ex: 'squat', reps: 10 }, { ex: 'pushup', reps: 6 }, { ex: 'squat', reps: 10 }, { ex: 'pushup', reps: 6 }] },
  { id: 'preset-push', preset: true, name: 'Жим от пола', rest: 60, desc: '4 подхода отжиманий на силу.',
    sets: [{ ex: 'pushup', reps: 12 }, { ex: 'pushup', reps: 12 }, { ex: 'pushup', reps: 10 }, { ex: 'pushup', reps: 10 }] },
  { id: 'preset-legs', preset: true, name: 'Ноги из стали', rest: 45, desc: '4 подхода глубоких приседаний.',
    sets: [{ ex: 'squat', reps: 15 }, { ex: 'squat', reps: 15 }, { ex: 'squat', reps: 15 }, { ex: 'squat', reps: 15 }] }
];
