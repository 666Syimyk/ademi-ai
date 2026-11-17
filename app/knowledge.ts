export type ResearchAuthor = {
  name: string;
  handle: string;
  audience: string;
  niche: string;
  mechanism: string;
  ademi: string;
  tags: string[];
};

export const researchSource = {
  id: "ademi-20-psychologists",
  title: "20 психологов и mental-health авторов",
  filename: "ADEMI_20_psychologists_full_analysis.docx",
  category: "Контент-стратегия",
  language: "Русский · Кыргызча",
  records: 20,
  status: "Обработан",
  note: "Внутренний референс для контент-команды. Не является клиническим руководством и не используется для постановки диагнозов.",
};

export const researchAuthors: ResearchAuthor[] = [
  { name: "Nicole LePera", handle: "@the.holistic.psychologist", audience: "~8.9–9.1M IG", niche: "Балалык паттерн, нерв системасы, self-healing", mechanism: "Паттерн → простое объяснение → осознанный выбор", ademi: "Балалык реакция жана мээнин тааныш нерсеге жабышуусу", tags: ["детство", "нервная система", "паттерны"] },
  { name: "Dr. Becky Kennedy", handle: "@drbeckyatgoodinside", audience: "~3.4–3.5M IG", niche: "Ата-эне, reparenting, эмоция", mechanism: "Прямое обращение в камеру; одна проблема; поведение как сигнал", ademi: "Балаңды урушканда сенин кайсы жериң сүйлөп жатат?", tags: ["родительство", "эмоции", "детство"] },
  { name: "Diego Perez / Yung Pueblo", handle: "@yung_pueblo", audience: "~3.4M IG", niche: "Mindfulness, мамиле, ички тынчтык", mechanism: "Одна философская фраза, спокойный кадр и сильная финальная мысль", ademi: "Ички мотивация жана азыркы учурда жашоо", tags: ["осознанность", "отношения", "мотивация"] },
  { name: "Esther Perel", handle: "@estherperelofficial", audience: "~2.4M IG", niche: "Мамиле, конфликт, жакындык", mechanism: "Парадоксальный вопрос, который меняет угол зрения", ademi: "Мамиле жана өзүңдү жоготуу", tags: ["отношения", "конфликт", "близость"] },
  { name: "Dr. Julie Smith", handle: "@drjulie", audience: "~2.2M IG", niche: "Эмоция, тынчсыздануу, күнүмдүк психология", mechanism: "Физический предмет или метафора объясняет сложное", ademi: "Негативге каршылык эмес — аны өткөрүп жиберүү", tags: ["тревога", "эмоции", "метафоры"] },
  { name: "Nedra Glover Tawwab", handle: "@nedratawwab", audience: "~1.8M IG", niche: "Чек ара, мамиле, resentment", mechanism: "Очень прямая фраза и короткий список", ademi: "Энергияны сактоо жана баарын куткарбоо", tags: ["границы", "отношения", "энергия"] },
  { name: "Sara Kuburic", handle: "@millennial.therapist", audience: "~1.8M IG", niche: "Self-loss, жоопкерчилик, authenticity", mechanism: "Прямое узнавание и тема отказа от себя", ademi: "5 жаштагы позиция жана чоң адам позициясы", tags: ["ответственность", "детство", "аутентичность"] },
  { name: "Nawal Mustafa", handle: "@thebraincoach", audience: "~1.7M IG", niche: "Мээ, нерв системасы, эмоция", mechanism: "Do/don’t-списки и простое объяснение neuroscience", ademi: "Мээни инструмент катары түшүндүрүү", tags: ["мозг", "нервная система", "эмоции"] },
  { name: "Kier Gaines", handle: "@kiergaines", audience: "~1.6M IG", niche: "Өзүн колдоо, үй-бүлө, ата-энелик", mechanism: "Живой семейный момент и одна мягкая фраза", ademi: "Мен сен мененмин — колдоочу ички диалог", tags: ["самоподдержка", "семья", "родительство"] },
  { name: "Therapy Jeff", handle: "@therapyjeff", audience: "~1.4M IG", niche: "Dating, relationships, attachment", mechanism: "Быстрый темп, нумерованный список и прямая провокация", ademi: "Мамиледе өзүңдү саботаж кылуу", tags: ["отношения", "привязанность", "самосаботаж"] },
  { name: "Matthias J. Barker", handle: "@matthiasjbarker", audience: "~1.4M IG", niche: "Trauma, people-pleasing, emotional regulation", mechanism: "Перевод сложной темы на мягкий человеческий язык", ademi: "Куткаруучу роль жана өз муктаждыгын унутуу", tags: ["травма", "people-pleasing", "регуляция"] },
  { name: "Dr. Ramani Durvasula", handle: "@doctorramani", audience: "~830K IG", niche: "Toxic/narcissistic relationships", mechanism: "Сильный warning-hook и ясная граница ответственности", ademi: "Зыяндуу мамиледе энергияны коротпоо", tags: ["границы", "токсичные отношения", "энергия"] },
  { name: "Whitney Goodman", handle: "@sitwithwhit", audience: "~567K IG", niche: "Toxic positivity, үй-бүлөлүк динамика", mechanism: "Разрушение давления «думай позитивно» и разрешение на эмоцию", ademi: "Өзүңдү сөгүү эмес, эмоцияга орун берүү", tags: ["эмоции", "семья", "самоподдержка"] },
  { name: "Dr. Thema Bryant", handle: "@dr.thema", audience: "~507K IG", niche: "Травма, people-pleasing, self-worth, spirituality", mechanism: "Короткая эмоциональная фраза, отделяющая человека от травмы", ademi: "Ишеним, өзүн баалоо жана жаратуучу менен байланыш", tags: ["самооценка", "травма", "духовность"] },
  { name: "Dr. Judith Joseph", handle: "@drjudithjoseph", audience: "~395K IG", niche: "High-functioning depression, anhedonia, burnout", mechanism: "Контраст: снаружи всё хорошо, внутри пусто", ademi: "Сырткы жетишкендик жана ички мотивация", tags: ["выгорание", "мотивация", "анhedonia"] },
  { name: "Patrick Teahan", handle: "@patrickteahanofficial", audience: "~308K IG", niche: "Inner child, childhood trauma, family systems", mechanism: "Очень конкретные узнаваемые паттерны и role-play", ademi: "5 жаштагы позицияны таануу", tags: ["детство", "травма", "семья"] },
  { name: "Dr. Mariel Buqué", handle: "@dr.marielbuque", audience: "~286K IG", niche: "Intergenerational trauma, cycle breaking", mechanism: "Семейная тема, о которой раньше молчали, и разрыв цикла", ademi: "Үй-бүлөлүк программалар", tags: ["семья", "травма", "поколения"] },
  { name: "Dr. Kelly Vincent", handle: "@dr.kellyvincent", audience: "~257K IG", niche: "Anxiety, nervous system, mind-body", mechanism: "Наблюдение сигнала тела и простые шаги регуляции", ademi: "Каршылыкты байкоочу позицияда кароо", tags: ["тревога", "тело", "нервная система"] },
  { name: "Maria Parente", handle: "@healing_notes_", audience: "~214K IG", niche: "Балалык жараат, low self-worth, unhealthy patterns", mechanism: "То, что было в детстве, показывается в сегодняшнем поведении", ademi: "Мамиле кайталанышы жана өзүңө ишенбөө", tags: ["детство", "самооценка", "паттерны"] },
  { name: "Yolanda Renteria", handle: "@thisisyolandarenteria", audience: "~205K IG", niche: "Attachment, generational cycles", mechanism: "Связь родительской реакции с нынешними отношениями", ademi: "Үй-бүлөлүк цикл, мамиле жана жоопкерчилик", tags: ["привязанность", "семья", "отношения"] },
];

export const contentPrinciples = [
  "Узнавание себя в первые секунды без постановки диагноза",
  "Один психологический механизм и один сильный визуальный образ",
  "Научный термин сразу переводится на бытовой пример",
  "Финал возвращает начальный тезис с новым смыслом",
  "Одна короткая фраза, которую хочется сохранить",
  "Мягкий, прямой и не обвиняющий тон с ответственностью",
];

const tagAliases: Record<string, string[]> = {
  границы: ["границ", "boundar", "чек ара"],
  детство: ["детств", "inner child", "childhood", "балалык", "ребен", "бала"],
  отношения: ["отнош", "relationship", "мамиле", "dating", "привязан"],
  тревога: ["тревог", "anxiety", "тынчсыздан"],
  выгорание: ["выгоран", "burnout", "чарчоо", "пусто"],
  эмоции: ["эмоц", "emotion", "сезим"],
  семья: ["семь", "family", "үй-бүл"],
  самооценка: ["самооцен", "self-worth", "өзүн баа"],
  травма: ["травм", "trauma", "жараат"],
};

export function findAuthors(query: string) {
  const normalized = query.toLowerCase();
  const direct = researchAuthors.filter((author) => normalized.includes(author.name.toLowerCase()) || normalized.includes(author.handle.toLowerCase()));
  if (direct.length) return direct.slice(0, 4);

  const matchedTags = Object.entries(tagAliases)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))
    .map(([tag]) => tag);
  return researchAuthors.filter((author) => matchedTags.some((tag) => author.tags.includes(tag))).slice(0, 4);
}

export function isContentQuestion(query: string) {
  return /(reels?|instagram|контент|ролик|автор|блог|сторис|рилс|риилс|content|creator|охват|подписчик|сценарий)/i.test(query);
}
