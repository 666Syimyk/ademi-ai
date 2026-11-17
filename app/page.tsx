"use client";

import Link from "next/link";
import {
  MAX_RECORDING_SECONDS,
  createAudioObjectUrl,
  revokeAudioObjectUrl,
  startAudioRecording,
  synthesizeRussianSpeech,
  transcribeRecording,
  type ActiveAudioRecording,
  type RussianVoice,
} from "@/lib/client/local-audio";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Language = "RU" | "KG" | "EN";
type Screen = "chat" | "profile" | "billing";
type ThemeMode = "system" | "light" | "dark";
type RecordingState = "idle" | "recording" | "processing";
type LocalAudioHealthState =
  | "checking"
  | "ready"
  | "decoder_unavailable"
  | "unavailable";

const VOICE_CONSENT_KEY_PREFIX = "ademi-edge-voice-consent-v2";
const VOICE_PREFERENCE_KEY = "ademi-edge-voice-v1";
function voiceConsentKey(userId: string) {
  return `${VOICE_CONSENT_KEY_PREFIX}:${userId}`;
}
const LANGUAGE_LABELS: Record<Language, string> = {
  RU: "Русский",
  KG: "Кыргызча",
  EN: "English",
};
const VOICE_COPY: Record<Language, {
  listen: string;
  reading: string;
  stop: string;
  sayQuestion: string;
  recording: string;
  processing: string;
  cancelProcessing: string;
  voiceUnavailable: string;
  microphoneDenied: string;
  microphoneUnavailable: string;
  transcriptionUnavailable: string;
  recordingTooLarge: string;
  noSpeech: string;
  recordingError: string;
  hostedUnavailable: string;
  consentEyebrow: string;
  consentTitle: string;
  consentBody: string;
  voiceLabel: string;
  later: string;
  accept: string;
  consentTitleProfile: string;
  consentActive: string;
  consentInactive: string;
  revoke: string;
}> = {
  RU: {
    listen: "Прослушать", reading: "Читаю…", stop: "Остановить", sayQuestion: "Сказать вопрос", recording: "Идёт запись…", processing: "Распознаю запись…", cancelProcessing: "Отменить распознавание",
    voiceUnavailable: "Нейроголос временно недоступен. Проверьте локальную аудиослужбу.", microphoneDenied: "Разрешите доступ к микрофону в настройках браузера.", microphoneUnavailable: "Микрофон недоступен. Подключите его и разрешите доступ для localhost.", transcriptionUnavailable: "Локальное распознавание временно недоступно. Проверьте локальную аудиослужбу.", recordingTooLarge: "Запись получилась слишком большой. Попробуйте сказать короче.", noSpeech: "Речь не распознана. Попробуйте сказать вопрос ещё раз.", recordingError: "Не удалось обработать запись. Попробуйте ещё раз или напишите вопрос.",
    hostedUnavailable: "Озвучивание и микрофон доступны только в локальной разработке; в размещённой версии эти функции недоступны.", consentEyebrow: "НЕЙРОГОЛОС", consentTitle: "Разрешить онлайн-озвучивание?", consentBody: "Русская нейроозвучка пока доступна только для ответов на русском. После вашего согласия в Microsoft Edge Neural TTS отправляется только текст выбранного ответа; аудио с микрофона туда не отправляется.", voiceLabel: "Голос", later: "Не сейчас", accept: "Разрешить озвучивание", consentTitleProfile: "Онлайн-озвучивание", consentActive: "Разрешение для этого аккаунта активно.", consentInactive: "Разрешение для этого аккаунта не выдано.", revoke: "Отозвать разрешение",
  },
  KG: {
    listen: "Угуу", reading: "Окуп жатам…", stop: "Токтотуу", sayQuestion: "Суроону айтуу", recording: "Жазылууда…", processing: "Жазуу таанылууда…", cancelProcessing: "Таанууну токтотуу",
    voiceUnavailable: "Нейроүн убактылуу жеткиликсиз. Жергиликтүү аудио кызматын текшериңиз.", microphoneDenied: "Браузердин жөндөөлөрүнөн микрофонго уруксат бериңиз.", microphoneUnavailable: "Микрофон жеткиликсиз. Аны туташтырып, localhost үчүн уруксат бериңиз.", transcriptionUnavailable: "Жергиликтүү таануу убактылуу жеткиликсиз. Жергиликтүү аудио кызматын текшериңиз.", recordingTooLarge: "Жазуу өтө чоң болуп калды. Кыскараак сүйлөп көрүңүз.", noSpeech: "Сүйлөө таанылган жок. Суроону кайра айтып көрүңүз.", recordingError: "Жазууну иштетүү мүмкүн болгон жок. Кайра аракет кылыңыз же суроону жазыңыз.",
    hostedUnavailable: "Үн жана микрофон жергиликтүү иштеп чыгууда гана жеткиликтүү; жайгаштырылган версияда бул функциялар жеткиликсиз.", consentEyebrow: "НЕЙРОҮН", consentTitle: "Онлайн үн чыгарууга уруксат бересизби?", consentBody: "Орусча нейроаудио азырынча орус тилиндеги жооптор үчүн гана жеткиликтүү. Сиз макул болгондон кийин Microsoft Edge Neural TTS кызматына тандалган жооптун тексти гана жөнөтүлөт; микрофондун аудиосу ал жакка жөнөтүлбөйт.", voiceLabel: "Үн", later: "Азыр эмес", accept: "Үн чыгарууга уруксат берүү", consentTitleProfile: "Онлайн үн чыгаруу", consentActive: "Бул аккаунт үчүн уруксат активдүү.", consentInactive: "Бул аккаунт үчүн уруксат берилген эмес.", revoke: "Уруксатты кайтарып алуу",
  },
  EN: {
    listen: "Listen", reading: "Reading…", stop: "Stop", sayQuestion: "Speak a question", recording: "Recording…", processing: "Transcribing…", cancelProcessing: "Cancel transcription",
    voiceUnavailable: "Neural voice is temporarily unavailable. Check the local audio service.", microphoneDenied: "Allow microphone access in your browser settings.", microphoneUnavailable: "The microphone is unavailable. Connect it and allow localhost access.", transcriptionUnavailable: "Local transcription is temporarily unavailable. Check the local audio service.", recordingTooLarge: "The recording is too large. Try speaking more briefly.", noSpeech: "No speech was recognized. Try saying your question again.", recordingError: "The recording could not be processed. Try again or type your question.",
    hostedUnavailable: "Voice and microphone are available only in local development; they are unavailable in the hosted runtime.", consentEyebrow: "NEURAL VOICE", consentTitle: "Allow online voice playback?", consentBody: "Russian neural audio is currently available only for Russian answers. After you consent, only the text of the selected reply goes to Microsoft Edge Neural TTS; microphone audio does not go there.", voiceLabel: "Voice", later: "Not now", accept: "Allow voice playback", consentTitleProfile: "Online voice playback", consentActive: "Permission for this account is active.", consentInactive: "Permission for this account has not been granted.", revoke: "Revoke permission",
  },
};

const AUDIO_HEALTH_COPY: Record<
  Language,
  {
    checking: string;
    decoderUnavailable: string;
    localServiceUnavailable: string;
  }
> = {
  RU: {
    checking: "Проверяю локальную голосовую службу…",
    decoderUnavailable:
      "Распознавание с микрофона недоступно: установите FFmpeg/ffprobe и перезапустите локальный сервис.",
    localServiceUnavailable:
      "Локальная голосовая служба недоступна. Запустите npm run dev и проверьте терминал.",
  },
  KG: {
    checking: "Жергиликтүү үн кызматы текшерилүүдө…",
    decoderUnavailable:
      "Микрофондон таануу жеткиликсиз: FFmpeg/ffprobe орнотуп, жергиликтүү кызматты кайра иштетиңиз.",
    localServiceUnavailable:
      "Жергиликтүү үн кызматы жеткиликсиз. npm run dev иштетип, терминалды текшериңиз.",
  },
  EN: {
    checking: "Checking the local voice service…",
    decoderUnavailable:
      "Microphone transcription is unavailable: install FFmpeg/ffprobe and restart the local service.",
    localServiceUnavailable:
      "The local voice service is unavailable. Start npm run dev and check the terminal.",
  },
};

type Message = {
  id?: string;
  role: "user" | "ai";
  text: string;
  sources?: Array<{ filename: string }>;
  safetyLevel?: string;
  answerMode?: "generative" | "guided";
  aiProvider?: "openai" | "ollama" | null;
  language?: Language;
};

type ConversationSummary = {
  id: string;
  title: string;
  language: Language;
  lastMessageAt: number | null;
};

type Me = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
    role: "owner" | "student";
    preferredLanguage: Language;
    historyEnabled: boolean;
    avatarUrl?: string | null;
    profileCompletedAt?: number | null;
  };
  consentRequired?: boolean;
  services?: {
    ai: boolean;
    answerMode?: "generative" | "guided";
    externalModel?: boolean;
    aiProvider?: "openai" | "ollama" | null;
    aiProviderPreference?: "openai" | "ollama" | null;
    localAudio?: boolean;
    payments: boolean;
  };
};

const COPY = {
  RU: {
    brandLine: "Психология, которая говорит с вами",
    signInEyebrow: "ВАШЕ ЛИЧНОЕ ПРОСТРАНСТВО",
    signInTitle: "Познакомьтесь с ADEMI MIND",
    signInBody:
      "Бережный интеллектуальный собеседник о психологии, отношениях и внутренней опоре — на русском, кыргызском и английском языках.",
    signIn: "Войти или зарегистрироваться",
    signInHint: "Без карты · регистрация через ChatGPT",
    checking: "Создаём безопасное пространство…",
    newChat: "Новый диалог",
    recent: "Недавние",
    noRecent: "Ваши диалоги появятся здесь",
    historyOff: "История сейчас выключена",
    navChat: "Чат",
    navProfile: "Профиль",
    navPayment: "Оплата",
    deleteChat: "Удалить диалог",
    menu: "Открыть меню",
    close: "Закрыть меню",
    greeting: "Я рядом, чтобы помочь разобраться",
    greetingNamed: "Рада видеть вас",
    lead:
      "Расскажите, что происходит. Я помогу увидеть ситуацию яснее и найти бережный следующий шаг.",
    generativeLead:
      "Опишите ситуацию, которая вас волнует: мысли, эмоции, отношения, тревогу, конфликт, усталость или решение. Я помогу разобраться бережно и прямо.",
    freeMode: "Бесплатный guided-режим",
    freeModeShort: "Guided AI · бесплатно",
    freeDisclosure:
      "Сейчас работает базовый бесплатный режим по психологии — не полноценная генеративная модель.",
    ollamaUnavailableDisclosure:
      "Локальная модель пока недоступна. Запустите Ollama и загрузите выбранную модель — до этого работает базовый guided-режим.",
    ollamaMode: "Бесплатный Ollama AI",
    ollamaModeShort: "Ollama AI · бесплатно",
    ollamaDisclosure:
      "Ответ создаёт подключённая модель Ollama. Если модель недоступна до отправки, работает базовый guided-режим; при перезапуске во время ответа повторите запрос.",
    cloudMode: "Облачный AI",
    cloudModeShort: "AI · online",
    cloudDisclosure:
      "Ответ создаёт подключённая облачная модель. Не отправляйте пароли, ключи и другие секреты.",
    placeholder: "Расскажите, что сейчас происходит…",
    send: "Отправить",
    assistant: "ADEMI MIND",
    you: "Вы",
    thinking: "Вдумчиво разбираю ваш вопрос",
    disclaimer: "Образовательная поддержка, не диагноз и не замена психологу",
    call112: "Позвонить 112",
    report: "Отметить ответ",
    inaccurate: "Неточно",
    unsafe: "Небезопасно",
    unhelpful: "Не помогло",
    feedbackThanks: "Спасибо — отметка сохранена",
    topics: [
      { icon: "◌", title: "Тревога", text: "Как успокоиться перед важным разговором?" },
      { icon: "↗", title: "Отношения", text: "Как спокойно обозначить личные границы?" },
      { icon: "✦", title: "Нагрузка", text: "Я устал(а) и ничего не успеваю. С чего начать?" },
      { icon: "✎", title: "Сложный разговор", text: "Помоги подготовиться к важному разговору без конфликта" },
      { icon: "△", title: "Привычки", text: "Как начать действовать без давления на себя?" },
      { icon: "∞", title: "Осознанность", text: "Дай короткую практику, чтобы вернуться в настоящий момент" },
    ],
    profileTitle: "Ваш профиль",
    profileLead: "Настройте пространство так, чтобы оно ощущалось вашим.",
    photo: "Изменить фото",
    removePhoto: "Удалить фото",
    photoRemoved: "Фото профиля удалено",
    photoHint: "JPG, PNG или WebP до 3 МБ",
    name: "Имя",
    namePlaceholder: "Как к вам обращаться?",
    email: "Email",
    language: "Язык ответов",
    theme: "Оформление",
    themeSystem: "Система",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    history: "История диалогов",
    historyHint: "Сохранять чаты, чтобы возвращаться к ним позже",
    save: "Сохранить изменения",
    saving: "Сохраняем…",
    profileSaved: "Профиль обновлён",
    photoSaved: "Фото профиля обновлено",
    photoLocal: "Предпросмотр готов. Фото будет сохранено после подключения хранилища.",
    invalidPhoto: "Выберите изображение JPG, PNG или WebP размером до 3 МБ.",
    nameRequired: "Введите имя длиной от 2 до 80 символов.",
    dataTitle: "Ваши данные",
    dataBody: "Скачайте копию или удалите сохранённую историю диалогов.",
    exportData: "Скачать данные",
    deleteHistory: "Удалить историю",
    deleteConfirm: "Удалить все сохранённые диалоги? Это действие нельзя отменить.",
    deleteDone: "История диалогов удалена",
    paymentEyebrow: "СКОРО",
    paymentTitle: "Оплата появится здесь",
    paymentBody:
      "Пока ADEMI MIND доступен бесплатно. Когда появятся подписки, вы увидите понятные условия на этой странице — без неожиданных списаний.",
    paymentBadge: "Сейчас бесплатно",
    paymentNote: "Ничего подключать не нужно",
    onboardingEyebrow: "ДОБРО ПОЖАЛОВАТЬ",
    onboardingTitle: "Сделаем ADEMI MIND вашим",
    onboardingBody: "Пара деталей — и можно начинать первый диалог.",
    onboardingPhoto: "Добавить фото",
    onboardingContinue: "Открыть ADEMI MIND",
    onboardingSkipPhoto: "Фото можно добавить позже в профиле",
    consentEyebrow: "ПЕРЕД НАЧАЛОМ",
    consentTitle: "Бережное использование",
    consentBody:
      "ADEMI MIND даёт образовательную поддержку, но не ставит диагнозы и не заменяет врача, психолога или экстренную службу. При непосредственной опасности звоните 112.",
    consentAgree: "Мне исполнилось 18 лет, я понимаю ограничения и принимаю",
    consentContinue: "Продолжить",
    privacy: "Конфиденциальность",
    terms: "Условия",
    roleOwner: "Автор",
    roleMember: "Участник",
    errors: {
      authentication_required: "Войдите, чтобы продолжить.",
      account_suspended: "Аккаунт приостановлен.",
      consent_required: "Сначала подтвердите правила использования.",
      validation_error: "Проверьте введённые данные.",
      duplicate_request: "Этот запрос уже обработан.",
      rate_limit_exceeded: "Слишком много запросов. Попробуйте через минуту.",
      daily_quota_exceeded: "Дневной лимит ответов исчерпан.",
      feedback_exists: "Вы уже отметили этот ответ.",
      not_found: "Запись не найдена.",
      local_ai_unavailable:
        "Локальный ИИ сейчас недоступен. Запустите Ollama, убедитесь, что выбранная модель загружена, и повторите запрос.",
      ai_not_configured:
        "ИИ пока не настроен. Запустите Ollama и загрузите выбранную модель.",
      ai_provider_error:
        "Модель вернула некорректный ответ. Повторите запрос.",
      empty_ai_response:
        "Модель не сформировала ответ. Попробуйте ещё раз.",
      server_error: "Временная ошибка. Попробуйте ещё раз.",
    },
  },
  KG: {
    brandLine: "Сиз менен сүйлөшкөн психология",
    signInEyebrow: "СИЗДИН ЖЕКЕ МЕЙКИНДИГИҢИЗ",
    signInTitle: "ADEMI MIND менен таанышыңыз",
    signInBody:
      "Психология, мамилелер жана ички тирек тууралуу камкор интеллектуалдык маектеш — кыргызча, орусча жана англисче.",
    signIn: "Кирүү же катталуу",
    signInHint: "Картасыз · ChatGPT аркылуу катталуу",
    checking: "Коопсуз мейкиндикти даярдап жатабыз…",
    newChat: "Жаңы маек",
    recent: "Акыркы маектер",
    noRecent: "Маектериңиз ушул жерде пайда болот",
    historyOff: "Тарых азыр өчүрүлгөн",
    navChat: "Чат",
    navProfile: "Профиль",
    navPayment: "Төлөм",
    deleteChat: "Маекти өчүрүү",
    menu: "Менюну ачуу",
    close: "Менюну жабуу",
    greeting: "Түшүнүүгө жардам берүү үчүн жаныңыздамын",
    greetingNamed: "Сизди көргөнүмө кубанычтамын",
    lead:
      "Эмне болуп жатканын айтып бериңиз. Кырдаалды так көрүп, камкор кийинки кадамды табууга жардам берем.",
    generativeLead:
      "Каалаган суроону бериңиз: окуу, иш, тексттер, идеялар, технология же психология. Так жана пайдалуу жооп берем.",
    freeMode: "Акысыз guided-режим",
    freeModeShort: "Guided AI · акысыз",
    freeDisclosure:
      "Азыр психология боюнча негизги акысыз режим иштейт — бул толук генеративдик модель эмес.",
    ollamaUnavailableDisclosure:
      "Локалдык модель азырынча жеткиликсиз. Ollama'ны иштетип, тандалган моделди жүктөңүз — ага чейин негизги guided-режим иштейт.",
    ollamaMode: "Акысыз Ollama ИИ",
    ollamaModeShort: "Ollama AI · акысыз",
    ollamaDisclosure:
      "Жоопту туташтырылган Ollama модели түзөт. Модель жөнөтүүдөн мурун жеткиликсиз болсо, негизги guided-режим иштейт; жооп учурунда кайра иштетилсе, суроону кайталаңыз.",
    cloudMode: "Булуттагы ИИ",
    cloudModeShort: "AI · online",
    cloudDisclosure:
      "Жоопту туташтырылган булут модели түзөт. Сырсөздөрдү, ачкычтарды жана башка купуя маалыматты жөнөтпөңүз.",
    placeholder: "Каалаган сурооңузду бериңиз…",
    send: "Жөнөтүү",
    assistant: "ADEMI MIND",
    you: "Сиз",
    thinking: "Сурооңузду кунт коюп талдап жатам",
    disclaimer: "Билим берүүчү колдоо, диагноз эмес жана психологду алмаштырбайт",
    call112: "112ге чалуу",
    report: "Жоопту белгилөө",
    inaccurate: "Так эмес",
    unsafe: "Кооптуу",
    unhelpful: "Жардам берген жок",
    feedbackThanks: "Рахмат — белги сакталды",
    topics: [
      { icon: "◌", title: "Тынчсыздануу", text: "Маанилүү сүйлөшүүнүн алдында кантип тынчтанам?" },
      { icon: "↗", title: "Мамилелер", text: "Жеке чегимди кантип тынч билдирем?" },
      { icon: "✦", title: "Окуу жана иш", text: "Аптага түшүнүктүү план түзүүгө жардам бер" },
      { icon: "✎", title: "Идеялар жана тексттер", text: "Текстимди жакшыртып, аны түшүнүктүү кылууга жардам бер" },
      { icon: "△", title: "Адаттар", text: "Өзүмө басым кылбай кантип аракет баштайм?" },
      { icon: "∞", title: "Аң-сезимдүүлүк", text: "Ушул учурга кайтуу үчүн кыска практика бер" },
    ],
    profileTitle: "Сиздин профилиңиз",
    profileLead: "Мейкиндикти өзүңүзгө ылайыктаңыз.",
    photo: "Сүрөттү өзгөртүү",
    removePhoto: "Сүрөттү өчүрүү",
    photoRemoved: "Профиль сүрөтү өчүрүлдү",
    photoHint: "JPG, PNG же WebP, 3 МБ чейин",
    name: "Аты",
    namePlaceholder: "Сизге кантип кайрылабыз?",
    email: "Email",
    language: "Жооптордун тили",
    theme: "Көрүнүш",
    themeSystem: "Система",
    themeLight: "Жарык",
    themeDark: "Караңгы",
    history: "Маектердин тарыхы",
    historyHint: "Кийин кайтуу үчүн маектерди сактоо",
    save: "Өзгөртүүлөрдү сактоо",
    saving: "Сакталып жатат…",
    profileSaved: "Профиль жаңыртылды",
    photoSaved: "Профиль сүрөтү жаңыртылды",
    photoLocal: "Алдын ала көрүнүш даяр. Сактагыч кошулганда сүрөт сакталат.",
    invalidPhoto: "3 МБ чейинки JPG, PNG же WebP сүрөтүн тандаңыз.",
    nameRequired: "2ден 80ге чейинки белгиден турган атты жазыңыз.",
    dataTitle: "Сиздин маалыматтарыңыз",
    dataBody: "Көчүрмөсүн жүктөп алыңыз же сакталган маектерди өчүрүңүз.",
    exportData: "Маалыматты жүктөө",
    deleteHistory: "Тарыхты өчүрүү",
    deleteConfirm: "Бардык сакталган маектер өчүрүлсүнбү? Бул аракетти артка кайтарууга болбойт.",
    deleteDone: "Маектердин тарыхы өчүрүлдү",
    paymentEyebrow: "ЖАКЫНДА",
    paymentTitle: "Төлөм ушул жерде пайда болот",
    paymentBody:
      "Азыр ADEMI MIND акысыз. Жазылуулар чыкканда, бул жерден күтүлбөгөн төлөмдөрсүз так шарттарды көрөсүз.",
    paymentBadge: "Азыр акысыз",
    paymentNote: "Эч нерсе кошуунун кереги жок",
    onboardingEyebrow: "КОШ КЕЛИҢИЗ",
    onboardingTitle: "ADEMI MIND сиздики болсун",
    onboardingBody: "Бир нече маалымат — анан биринчи маекти баштайбыз.",
    onboardingPhoto: "Сүрөт кошуу",
    onboardingContinue: "ADEMI MIND ачуу",
    onboardingSkipPhoto: "Сүрөттү кийин профилден кошсоңуз болот",
    consentEyebrow: "БАШТООДОН МУРУН",
    consentTitle: "Камкор колдонуу",
    consentBody:
      "ADEMI MIND билим берүүчү колдоо көрсөтөт, бирок диагноз койбойт жана дарыгерди, психологду же тез жардамды алмаштырбайт. Түз коркунуч болсо 112ге чалыңыз.",
    consentAgree: "Мен 18 жаштамын, чектөөлөрдү түшүнөм жана кабыл алам",
    consentContinue: "Улантуу",
    privacy: "Купуялуулук",
    terms: "Шарттар",
    roleOwner: "Автор",
    roleMember: "Катышуучу",
    errors: {
      authentication_required: "Улантуу үчүн кириңиз.",
      account_suspended: "Аккаунт токтотулган.",
      consent_required: "Адегенде колдонуу эрежелерин ырастаңыз.",
      validation_error: "Киргизилген маалыматты текшериңиз.",
      duplicate_request: "Бул суроо мурунтан иштетилген.",
      rate_limit_exceeded: "Суроолор өтө көп. Бир мүнөттөн кийин кайталаңыз.",
      daily_quota_exceeded: "Күнүмдүк жооп чеги бүттү.",
      feedback_exists: "Бул жоопту мурда белгилегенсиз.",
      not_found: "Жазуу табылган жок.",
      local_ai_unavailable:
        "Локалдык ИИ азыр жеткиликсиз. Ollama'ны иштетип, тандалган модель жүктөлгөнүн текшерип, кайра аракет кылыңыз.",
      ai_not_configured:
        "ИИ азырынча жөндөлгөн эмес. Ollama'ны иштетип, тандалган моделди жүктөңүз.",
      ai_provider_error:
        "Модель туура эмес жооп кайтарды. Кайра аракет кылыңыз.",
      empty_ai_response:
        "Модель жооп түзгөн жок. Дагы бир жолу аракет кылыңыз.",
      server_error: "Убактылуу ката. Кайра аракет кылыңыз.",
    },
  },
  EN: {
    brandLine: "Psychology that speaks with you",
    signInEyebrow: "YOUR PERSONAL SPACE",
    signInTitle: "Meet ADEMI MIND",
    signInBody:
      "A thoughtful companion for psychology, relationships and inner steadiness — in Russian, Kyrgyz and English.",
    signIn: "Sign in or create an account",
    signInHint: "No card · registration via ChatGPT",
    checking: "Preparing your private space…",
    newChat: "New conversation",
    recent: "Recent",
    noRecent: "Your conversations will appear here",
    historyOff: "History is currently off",
    navChat: "Chat",
    navProfile: "Profile",
    navPayment: "Payment",
    deleteChat: "Delete conversation",
    menu: "Open menu",
    close: "Close menu",
    greeting: "I’m here to help you make sense of things",
    greetingNamed: "It’s good to see you",
    lead:
      "Tell me what is happening. I’ll help you see the situation more clearly and find a gentle next step.",
    generativeLead:
      "Ask anything: study, work, writing, ideas, technology, or psychology. I’ll give you a clear, useful answer.",
    freeMode: "Free guided mode",
    freeModeShort: "Guided AI · free",
    freeDisclosure:
      "The free foundational psychology mode is active — it is not a full generative model.",
    ollamaUnavailableDisclosure:
      "The local model is not available yet. Start Ollama and download the selected model; the foundational guided mode remains available until then.",
    ollamaMode: "Free Ollama AI",
    ollamaModeShort: "Ollama AI · free",
    ollamaDisclosure:
      "Responses come from the connected Ollama model. If it is unavailable before sending, the foundational guided mode remains available; retry if Ollama restarts while replying.",
    cloudMode: "Cloud AI",
    cloudModeShort: "AI · online",
    cloudDisclosure:
      "Responses come from a connected cloud model. Do not share passwords, API keys, or other secrets.",
    placeholder: "Ask any question…",
    send: "Send",
    assistant: "ADEMI MIND",
    you: "You",
    thinking: "Thinking carefully about your question",
    disclaimer: "Educational support, not a diagnosis or a replacement for a psychologist",
    call112: "Call 112",
    report: "Flag response",
    inaccurate: "Inaccurate",
    unsafe: "Unsafe",
    unhelpful: "Unhelpful",
    feedbackThanks: "Thank you — your feedback was saved",
    topics: [
      { icon: "◌", title: "Anxiety", text: "How can I settle myself before an important conversation?" },
      { icon: "↗", title: "Relationships", text: "How can I communicate a personal boundary calmly?" },
      { icon: "✦", title: "Study and work", text: "Help me make a clear plan for this week" },
      { icon: "✎", title: "Ideas and writing", text: "Help me make this text clearer and stronger" },
      { icon: "△", title: "Habits", text: "How can I start taking action without pressuring myself?" },
      { icon: "∞", title: "Mindfulness", text: "Give me a short practice to return to the present moment" },
    ],
    profileTitle: "Your profile",
    profileLead: "Shape this space so it feels like yours.",
    photo: "Change photo",
    removePhoto: "Remove photo",
    photoRemoved: "Profile photo removed",
    photoHint: "JPG, PNG or WebP up to 3 MB",
    name: "Name",
    namePlaceholder: "What should we call you?",
    email: "Email",
    language: "Response language",
    theme: "Appearance",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    history: "Conversation history",
    historyHint: "Save chats so you can return to them later",
    save: "Save changes",
    saving: "Saving…",
    profileSaved: "Profile updated",
    photoSaved: "Profile photo updated",
    photoLocal: "Preview ready. The photo will save when storage is connected.",
    invalidPhoto: "Choose a JPG, PNG or WebP image up to 3 MB.",
    nameRequired: "Enter a name between 2 and 80 characters.",
    dataTitle: "Your data",
    dataBody: "Download a copy or delete your saved conversation history.",
    exportData: "Download data",
    deleteHistory: "Delete history",
    deleteConfirm: "Delete all saved conversations? This cannot be undone.",
    deleteDone: "Conversation history deleted",
    paymentEyebrow: "COMING SOON",
    paymentTitle: "Payment will live here",
    paymentBody:
      "ADEMI MIND is free for now. When subscriptions arrive, you’ll see clear terms on this page — with no surprise charges.",
    paymentBadge: "Free right now",
    paymentNote: "Nothing to set up",
    onboardingEyebrow: "WELCOME",
    onboardingTitle: "Make ADEMI MIND yours",
    onboardingBody: "A couple of details, then your first conversation can begin.",
    onboardingPhoto: "Add a photo",
    onboardingContinue: "Open ADEMI MIND",
    onboardingSkipPhoto: "You can add a photo later in Profile",
    consentEyebrow: "BEFORE YOU BEGIN",
    consentTitle: "Use with care",
    consentBody:
      "ADEMI MIND offers educational support. It does not diagnose or replace a doctor, psychologist or emergency service. Call 112 if there is immediate danger.",
    consentAgree: "I am 18 or older, understand the limitations and accept the",
    consentContinue: "Continue",
    privacy: "Privacy",
    terms: "Terms",
    roleOwner: "Creator",
    roleMember: "Member",
    errors: {
      authentication_required: "Sign in to continue.",
      account_suspended: "This account is suspended.",
      consent_required: "Please accept the usage terms first.",
      validation_error: "Check the information you entered.",
      duplicate_request: "This request has already been processed.",
      rate_limit_exceeded: "Too many requests. Try again in a minute.",
      daily_quota_exceeded: "The daily response limit has been reached.",
      feedback_exists: "You already flagged this response.",
      not_found: "That record was not found.",
      local_ai_unavailable:
        "Local AI is unavailable. Start Ollama, make sure the selected model is downloaded, then try again.",
      ai_not_configured:
        "AI is not configured yet. Start Ollama and download the selected model.",
      ai_provider_error:
        "The model returned an invalid response. Please try again.",
      empty_ai_response:
        "The model did not produce a response. Please try again.",
      server_error: "Temporary error. Please try again.",
    },
  },
} as const;

function initials(name: string | null | undefined, email: string) {
  const source = name?.trim() || email.split("@")[0] || "A";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(timestamp: number | null, language: Language) {
  if (!timestamp) return "";
  const locale = language === "KG" ? "ky-KG" : language === "EN" ? "en-US" : "ru-RU";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
    new Date(timestamp),
  );
}

function LanguagePills({
  value,
  onChange,
  compact = false,
}: {
  value: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`language-pills${compact ? " compact" : ""}`}
      role="group"
      aria-label="Language"
    >
      {(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => (
        <button
          className={value === option ? "active" : ""}
          type="button"
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          title={LANGUAGE_LABELS[option]}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Avatar({
  url,
  label,
  fallback,
  large = false,
}: {
  url?: string | null;
  label: string;
  fallback: string;
  large?: boolean;
}) {
  return (
    <span
      className={`user-avatar ${large ? "large" : ""} ${url ? "has-photo" : ""}`}
      style={url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
      role={url ? "img" : undefined}
      aria-label={url ? label : undefined}
    >
      {!url && fallback}
    </span>
  );
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("RU");
  const [screen, setScreen] = useState<Screen>("chat");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("ademi-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [notice, setNotice] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<string[]>([]);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileLanguage, setProfileLanguage] = useState<Language>("RU");
  const [profileHistoryEnabled, setProfileHistoryEnabled] = useState(true);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [localProfileComplete, setLocalProfileComplete] = useState(false);
  const [speakingMessageKey, setSpeakingMessageKey] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [localAudioHealth, setLocalAudioHealth] =
    useState<LocalAudioHealthState>("checking");
  const [voiceConsentOpen, setVoiceConsentOpen] = useState(false);
  const [pendingSpeech, setPendingSpeech] = useState<{
    messageKey: string;
    text: string;
  } | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<RussianVoice>(() => {
    if (typeof window === "undefined") return "svetlana";
    const savedVoice = window.localStorage.getItem(VOICE_PREFERENCE_KEY);
    return savedVoice === "svetlana" || savedVoice === "dmitry"
      ? savedVoice
      : "svetlana";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechAbortRef = useRef<AbortController | null>(null);
  const recordingRef = useRef<ActiveAudioRecording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTokenRef = useRef(0);
  const recordingStartingRef = useRef(false);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const t = COPY[language];
  const voice = VOICE_COPY[language];
  const audioHealth = AUDIO_HEALTH_COPY[language];
  const localAudio = me?.services?.localAudio === true;
  const localVoiceAvailable =
    localAudio &&
    (localAudioHealth === "ready" || localAudioHealth === "decoder_unavailable");
  const localMicrophoneAvailable = localAudio && localAudioHealth === "ready";
  const localAudioDisclosure = !localAudio
    ? voice.hostedUnavailable
    : localAudioHealth === "checking"
      ? audioHealth.checking
      : localAudioHealth === "decoder_unavailable"
        ? audioHealth.decoderUnavailable
        : localAudioHealth === "unavailable"
          ? audioHealth.localServiceUnavailable
          : null;
  const aiProvider = me?.services?.aiProvider;
  const isGenerative = me?.services?.answerMode === "generative";
  const ollamaUnavailable =
    me?.services?.answerMode === "guided" &&
    me?.services?.aiProviderPreference === "ollama";
  const modeTitle =
    aiProvider === "ollama"
      ? t.ollamaMode
      : aiProvider === "openai"
        ? t.cloudMode
        : t.freeMode;
  const modeShort =
    aiProvider === "ollama"
      ? t.ollamaModeShort
      : aiProvider === "openai"
        ? t.cloudModeShort
        : t.freeModeShort;
  const modeDisclosure =
    ollamaUnavailable
      ? t.ollamaUnavailableDisclosure
      : aiProvider === "ollama"
      ? t.ollamaDisclosure
      : aiProvider === "openai"
        ? t.cloudDisclosure
        : t.freeDisclosure;
  const welcomeLead = isGenerative ? t.generativeLead : t.lead;

  const displayName = profileName.trim() || me?.user?.fullName?.trim() || "";
  const firstName = displayName.split(/\s+/)[0] || "";
  const avatarUrl = localAvatarUrl || me?.user?.avatarUrl;
  const userInitials = useMemo(
    () => initials(displayName, me?.user?.email ?? "ADEMI"),
    [displayName, me?.user?.email],
  );

  const localizedError = (code?: string, fallback?: string) =>
    (code ? (t.errors as Record<string, string>)[code] : undefined) ??
    fallback ??
    t.errors.server_error;

  function updateServiceMode(
    answerMode: "generative" | "guided" | undefined,
    provider: "openai" | "ollama" | null | undefined,
    safetyLevel?: string,
  ) {
    // Crisis guidance is intentionally generated by the safety layer; it says
    // nothing about whether the selected AI service is currently online.
    if (!answerMode || safetyLevel === "crisis") return;
    setMe((current) =>
      current?.services
        ? {
            ...current,
            services: {
              ...current.services,
              answerMode,
              externalModel: answerMode === "generative",
              aiProvider: answerMode === "generative" ? provider ?? null : null,
            },
          }
        : current,
    );
  }

  function answerModeLabel(item: Message) {
    if (item.answerMode === "guided") return t.freeModeShort;
    if (item.aiProvider === "ollama") return t.ollamaModeShort;
    if (item.aiProvider === "openai") return t.cloudModeShort;
    return modeShort;
  }

  const clearRecordingTimers = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingStopTimerRef.current !== null) {
      clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speechAbortRef.current?.abort();
    speechAbortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
    }
    audioRef.current = null;
    revokeAudioObjectUrl(audioUrlRef.current);
    audioUrlRef.current = null;
    setSpeakingMessageKey(null);
  }, []);

  const discardVoiceInput = useCallback(() => {
    recordingTokenRef.current += 1;
    recordingStartingRef.current = false;
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;
    clearRecordingTimers();
    const recording = recordingRef.current;
    recordingRef.current = null;
    recording?.stop();
    setRecordingState("idle");
    setRecordingSeconds(0);
  }, [clearRecordingTimers]);

  const recordNotice = useCallback((error: unknown) => {
    const name =
      error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
    const code = error instanceof Error ? error.message : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setNotice(voice.microphoneDenied);
    } else if (name === "NotFoundError" || code === "recording_unsupported") {
      setNotice(voice.microphoneUnavailable);
    } else if (code === "recording_too_large") {
      setNotice(voice.recordingTooLarge);
    } else if (code === "local_transcription_unavailable") {
      setNotice(voice.transcriptionUnavailable);
    } else if (code === "recording_empty") {
      setNotice(voice.noSpeech);
    } else {
      setNotice(voice.recordingError);
    }
  }, [voice]);

  const playSpeech = useCallback(
    async (messageKey: string, text: string) => {
      stopSpeaking();
      const controller = new AbortController();
      speechAbortRef.current = controller;
      setSpeakingMessageKey(messageKey);
      let audio: HTMLAudioElement | null = null;
      let audioUrl: string | null = null;
      const finish = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (audioUrlRef.current === audioUrl) {
          revokeAudioObjectUrl(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        if (speechAbortRef.current === controller) speechAbortRef.current = null;
        setSpeakingMessageKey((current) =>
          current === messageKey ? null : current,
        );
      };

      try {
        const blob = await synthesizeRussianSpeech(
          text,
          selectedVoice,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        audioUrl = createAudioObjectUrl(blob);
        audioUrlRef.current = audioUrl;
        audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = finish;
        audio.onerror = () => {
          finish();
          setNotice(voice.voiceUnavailable);
        };
        await audio.play();
      } catch {
        if (controller.signal.aborted) return;
        finish();
        setNotice(voice.voiceUnavailable);
      }
    },
    [selectedVoice, stopSpeaking, voice],
  );

  function toggleSpeech(messageKey: string, text: string) {
    if (!localVoiceAvailable) return;
    if (speakingMessageKey === messageKey) {
      stopSpeaking();
      return;
    }
    if (!voiceConsent) {
      setPendingSpeech({ messageKey, text });
      setVoiceConsentOpen(true);
      return;
    }
    void playSpeech(messageKey, text);
  }

  function acceptVoiceConsent() {
    const userId = me?.user?.id;
    if (!userId) return;
    window.localStorage.setItem(voiceConsentKey(userId), "accepted");
    setVoiceConsent(true);
    setVoiceConsentOpen(false);
    const target = pendingSpeech;
    setPendingSpeech(null);
    if (target) void playSpeech(target.messageKey, target.text);
  }

  function revokeVoiceConsent() {
    const userId = me?.user?.id;
    if (!userId) return;
    stopSpeaking();
    window.localStorage.removeItem(voiceConsentKey(userId));
    setVoiceConsent(false);
    setVoiceConsentOpen(false);
    setPendingSpeech(null);
  }

  function dismissVoiceConsent() {
    setVoiceConsentOpen(false);
    setPendingSpeech(null);
  }

  const finishVoiceInput = useCallback(() => {
    const recording = recordingRef.current;
    if (!recording) return;
    const token = recordingTokenRef.current;
    recordingRef.current = null;
    clearRecordingTimers();
    setRecordingState("processing");
    try {
      recording.stop();
    } catch {
      recordNotice(new Error("recording_failed"));
      setRecordingState("idle");
      return;
    }

    void recording.completed
      .then(async (blob) => {
        if (token !== recordingTokenRef.current) return;
        const controller = new AbortController();
        transcriptionAbortRef.current = controller;
        const transcript = await transcribeRecording(blob, language, controller.signal);
        if (token !== recordingTokenRef.current || controller.signal.aborted) return;
        setMessage((current) =>
          `${current.trim()}${current.trim() && transcript ? " " : ""}${transcript}`.trim(),
        );
      })
      .catch((error) => {
        if (token === recordingTokenRef.current) recordNotice(error);
      })
      .finally(() => {
        if (token !== recordingTokenRef.current) return;
        transcriptionAbortRef.current = null;
        setRecordingState("idle");
        setRecordingSeconds(0);
      });
  }, [clearRecordingTimers, language, recordNotice]);

  async function toggleVoiceInput() {
    stopSpeaking();
    if (recordingState === "recording") {
      finishVoiceInput();
      return;
    }
    if (recordingState === "processing") {
      discardVoiceInput();
      return;
    }
    if (recordingStartingRef.current) return;

    const token = ++recordingTokenRef.current;
    recordingStartingRef.current = true;
    setNotice("");
    try {
      const recording = await startAudioRecording();
      void recording.completed.catch(() => undefined);
      if (token !== recordingTokenRef.current) {
        recording.stop();
        return;
      }
      recordingRef.current = recording;
      recordingStartingRef.current = false;
      setRecordingState("recording");
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => Math.min(seconds + 1, MAX_RECORDING_SECONDS));
      }, 1_000);
      recordingStopTimerRef.current = setTimeout(
        finishVoiceInput,
        MAX_RECORDING_SECONDS * 1_000,
      );
    } catch (error) {
      if (token === recordingTokenRef.current) {
        recordingStartingRef.current = false;
        setRecordingState("idle");
        recordNotice(error);
      }
    }
  }

  async function loadConversations() {
    const response = await fetch("/api/chat", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { conversations: ConversationSummary[] };
    setRecentConversations(data.conversations);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<Me>)
      .then((data) => {
        if (!active) return;
        setMe(data);
        if (data.user) {
          setProfileName(data.user.fullName ?? "");
          setLanguage(data.user.preferredLanguage);
          setProfileLanguage(data.user.preferredLanguage);
          const locallyComplete =
            window.localStorage.getItem(`ademi-profile-${data.user.id}`) === "complete";
          setLocalProfileComplete(locallyComplete);
          setProfileHistoryEnabled(
            data.user.profileCompletedAt || locallyComplete ? data.user.historyEnabled : true,
          );
          const localVoiceServiceExpected =
            data.services?.localAudio === true;
          setVoiceConsent(
            localVoiceServiceExpected &&
              window.localStorage.getItem(voiceConsentKey(data.user.id)) === "accepted",
          );
          setLocalAudioHealth(
            localVoiceServiceExpected ? "checking" : "unavailable",
          );
          if (localVoiceServiceExpected) {
            void fetch("/local-ai/health", { cache: "no-store" })
              .then((response) => {
                if (!response.ok) throw new Error("local audio health unavailable");
                return response.json() as Promise<{
                  status?: string;
                  decoderAvailable?: boolean;
                }>;
              })
              .then((health) => {
                if (!active) return;
                if (health.status !== "ok") {
                  setLocalAudioHealth("unavailable");
                  return;
                }
                setLocalAudioHealth(
                  health.decoderAvailable === false
                    ? "decoder_unavailable"
                    : "ready",
                );
              })
              .catch(() => {
                if (active) setLocalAudioHealth("unavailable");
              });
          }
        } else {
          setVoiceConsent(false);
          setLocalAudioHealth("unavailable");
        }
        setProfileReady(true);
      })
      .catch(() => {
        if (active) {
          setMe({ authenticated: false });
          setLocalAudioHealth("unavailable");
          setProfileReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeMode = theme;
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang =
      language === "KG" ? "ky" : language === "EN" ? "en" : "ru";
  }, [language]);

  useEffect(() => {
    const stopVoiceWhenHidden = () => {
      if (!document.hidden) return;
      stopSpeaking();
      discardVoiceInput();
    };
    document.addEventListener("visibilitychange", stopVoiceWhenHidden);
    return () => document.removeEventListener("visibilitychange", stopVoiceWhenHidden);
  }, [discardVoiceInput, stopSpeaking]);

  useEffect(
    () => () => {
      stopSpeaking();
      discardVoiceInput();
    },
    [discardVoiceInput, stopSpeaking],
  );

  useEffect(() => {
    if (!me?.authenticated || !me.user?.historyEnabled) return;
    let active = true;
    void fetch("/api/chat", { cache: "no-store" })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ conversations: ConversationSummary[] }>)
          : null,
      )
      .then((data) => {
        if (active && data) setRecentConversations(data.conversations);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [me?.authenticated, me?.user?.historyEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation, sending]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.classList.add("drawer-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("drawer-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(
    () => () => {
      if (localAvatarUrl?.startsWith("blob:")) URL.revokeObjectURL(localAvatarUrl);
    },
    [localAvatarUrl],
  );

  function chooseTheme(next: ThemeMode) {
    setTheme(next);
    window.localStorage.setItem("ademi-theme", next);
  }

  function chooseVoice(next: RussianVoice) {
    setSelectedVoice(next);
    window.localStorage.setItem(VOICE_PREFERENCE_KEY, next);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    stopSpeaking();
    discardVoiceInput();
    setLanguage(nextLanguage);
    setProfileLanguage(nextLanguage);
    setConversation([]);
    setConversationId(null);
    setMessage("");
    setNotice("");
    if (!me?.authenticated || !me.user) return;

    void fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLanguage: nextLanguage }),
    })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ user?: Partial<NonNullable<Me["user"]>> }>)
          : null,
      )
      .then((data) => {
        if (!data?.user) return;
        setMe((current) =>
          current?.user
            ? { ...current, user: { ...current.user, ...data.user } }
            : current,
        );
      })
      .catch(() => undefined);
  }

  function go(next: Screen) {
    setScreen(next);
    setMenuOpen(false);
    setNotice("");
  }

  function newChat() {
    stopSpeaking();
    discardVoiceInput();
    setConversation([]);
    setConversationId(null);
    setMessage("");
    go("chat");
  }

  function choosePrompt(text: string) {
    setMessage(text);
    setConversation([]);
    setConversationId(null);
    go("chat");
  }

  async function openConversation(id: string) {
    stopSpeaking();
    discardVoiceInput();
    setNotice("");
    const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      error?: string;
      code?: string;
      messages?: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        language: Language;
        safetyLevel: string;
        sources: Array<{ filename: string }>;
      }>;
    };
    if (!response.ok || !data.messages) {
      setNotice(localizedError(data.code, data.error));
      return;
    }
    setConversation(
      data.messages.map((item) => ({
        id: item.id,
        role: item.role === "assistant" ? "ai" : "user",
        text: item.content,
        language: item.language,
        safetyLevel: item.safetyLevel,
        sources: item.sources,
      })),
    );
    setConversationId(id);
    go("chat");
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/chat?conversationId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setRecentConversations((items) => items.filter((item) => item.id !== id));
    if (conversationId === id) newChat();
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const clean = message.trim();
    if (!clean || sending) return;
    stopSpeaking();
    discardVoiceInput();
    setSending(true);
    setMessage("");
    setNotice("");
    setConversation((items) => [
      ...items,
      { role: "user", text: clean, language },
    ]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          language: language,
          conversationId,
          clientRequestId: crypto.randomUUID(),
          sessionContext: conversation
            .filter((item) => item.role === "user")
            .slice(-1)
            .map((item) => item.text.slice(0, 4000)),
        }),
      });
      const data = (await response.json()) as {
        text?: string;
        error?: string;
        code?: string;
        sources?: Array<{ filename: string }>;
        conversationId?: string | null;
        assistantMessageId?: string | null;
        safetyLevel?: string;
        answerMode?: "generative" | "guided";
        aiProvider?: "openai" | "ollama" | null;
        language?: Language;
      };
      if (!response.ok) {
        if (
          data.code === "local_ai_unavailable" ||
          data.code === "ai_provider_error" ||
          data.code === "empty_ai_response"
        ) {
          updateServiceMode("guided", null);
        }
        throw new Error(localizedError(data.code, data.error));
      }
      updateServiceMode(data.answerMode, data.aiProvider, data.safetyLevel);
      if (data.conversationId) setConversationId(data.conversationId);
      setConversation((items) => [
        ...items,
        {
          id: data.assistantMessageId ?? undefined,
          role: "ai",
          text: data.text ?? "",
          sources: data.sources,
          safetyLevel: data.safetyLevel,
          answerMode: data.answerMode,
          aiProvider: data.aiProvider,
          language: data.language ?? language,
        },
      ]);
      if (me?.user?.historyEnabled) void loadConversations();
    } catch (error) {
      setConversation((items) => {
        const last = items.at(-1);
        return last?.role === "user" && last.text === clean ? items.slice(0, -1) : items;
      });
      setMessage(clean);
      setNotice(error instanceof Error ? error.message : t.errors.server_error);
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function acceptConsent() {
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptConsent: true }),
    });
    if (response.ok) {
      setMe((current) => (current ? { ...current, consentRequired: false } : current));
      return;
    }
    const data = (await response.json()) as { error?: string; code?: string };
    setNotice(localizedError(data.code, data.error));
  }

  async function toggleHistory() {
    const enabled = !profileHistoryEnabled;
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ historyEnabled: enabled }),
    });
    if (!response.ok) {
      setProfileNotice(t.errors.server_error);
      return;
    }
    setMe((current) =>
      current?.user
        ? { ...current, user: { ...current.user, historyEnabled: enabled } }
        : current,
    );
    setProfileHistoryEnabled(enabled);
    if (!enabled) setRecentConversations([]);
  }

  async function saveProfile(onboarding = false) {
    const cleanName = profileName.trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      setProfileNotice(t.nameRequired);
      return;
    }
    setProfileBusy(true);
    setProfileNotice("");
    const completedAt = Date.now();
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          preferredLanguage: profileLanguage,
          historyEnabled: profileHistoryEnabled,
          profileCompletedAt: completedAt,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        user?: Partial<NonNullable<Me["user"]>>;
      };
      if (!response.ok) throw new Error(localizedError(data.code, data.error));
      setMe((current) =>
        current?.user
          ? {
              ...current,
              user: {
                ...current.user,
                ...data.user,
                fullName: data.user?.fullName ?? cleanName,
                preferredLanguage: data.user?.preferredLanguage ?? profileLanguage,
                historyEnabled: profileHistoryEnabled,
                profileCompletedAt: data.user?.profileCompletedAt ?? completedAt,
              },
            }
          : current,
      );
      if (profileLanguage !== language) {
        stopSpeaking();
        discardVoiceInput();
        setLanguage(profileLanguage);
        setConversation([]);
        setConversationId(null);
        setMessage("");
      }
      if (me?.user?.id) window.localStorage.setItem(`ademi-profile-${me.user.id}`, "complete");
      setLocalProfileComplete(true);
      setProfileNotice(t.profileSaved);
      if (onboarding) go("chat");
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : t.errors.server_error);
    } finally {
      setProfileBusy(false);
    }
  }

  async function selectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > 3 * 1024 * 1024) {
      setProfileNotice(t.invalidPhoto);
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalAvatarUrl(preview);
    setProfileNotice("");
    const form = new FormData();
    form.append("avatar", file);
    try {
      const response = await fetch("/api/me/avatar", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as {
        avatarUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.avatarUrl) {
        setProfileNotice(t.photoLocal);
        return;
      }
      setLocalAvatarUrl(data.avatarUrl);
      setMe((current) =>
        current?.user
          ? { ...current, user: { ...current.user, avatarUrl: data.avatarUrl } }
          : current,
      );
      setProfileNotice(t.photoSaved);
    } catch {
      setProfileNotice(t.photoLocal);
    }
  }

  async function removeAvatar() {
    setProfileNotice("");
    try {
      const response = await fetch("/api/me/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error(t.errors.server_error);
      setLocalAvatarUrl(null);
      setMe((current) =>
        current?.user
          ? { ...current, user: { ...current.user, avatarUrl: null } }
          : current,
      );
      setProfileNotice(t.photoRemoved);
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : t.errors.server_error);
    }
  }

  async function reportAnswer(
    messageId: string,
    category: "inaccurate" | "unsafe" | "unhelpful",
  ) {
    setNotice("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, category }),
    });
    const data = (await response.json()) as { error?: string; code?: string };
    if (!response.ok) {
      setNotice(localizedError(data.code, data.error));
      return;
    }
    setFeedbackSent((items) => [...new Set([...items, messageId])]);
    setFeedbackOpen(null);
  }

  async function exportMyData() {
    setPrivacyBusy(true);
    setProfileNotice("");
    try {
      const response = await fetch("/api/me/data", { cache: "no-store" });
      if (!response.ok) throw new Error(t.errors.server_error);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ademi-mind-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : t.errors.server_error);
    } finally {
      setPrivacyBusy(false);
    }
  }

  async function deleteAllHistory() {
    if (!window.confirm(t.deleteConfirm)) return;
    setPrivacyBusy(true);
    setProfileNotice("");
    try {
      const response = await fetch("/api/me/data", { method: "DELETE" });
      if (!response.ok) throw new Error(t.errors.server_error);
      setConversation([]);
      setConversationId(null);
      setRecentConversations([]);
      setProfileNotice(t.deleteDone);
    } catch (error) {
      setProfileNotice(error instanceof Error ? error.message : t.errors.server_error);
    } finally {
      setPrivacyBusy(false);
    }
  }

  const showOnboarding =
    Boolean(me?.authenticated && me.user) &&
    profileReady &&
    !me?.consentRequired &&
    !me?.user?.profileCompletedAt &&
    !localProfileComplete;

  if (!me) {
    return (
      <main className="entry-shell loading-entry">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="entry-card" aria-live="polite">
          <div className="brand-lockup centered">
            <span className="brand-symbol" aria-hidden="true"><b>A</b></span>
            <span><strong>ADEMI MIND</strong><small>PSYCHOLOGY INTELLIGENCE</small></span>
          </div>
          <span className="entry-loader" aria-hidden="true" />
          <h1>{COPY.RU.checking}</h1>
        </div>
      </main>
    );
  }

  if (!me.authenticated) {
    return (
      <main className="entry-shell">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />
        <header className="entry-header">
          <div className="brand-lockup">
            <span className="brand-symbol" aria-hidden="true"><b>A</b></span>
            <span><strong>ADEMI MIND</strong><small>PSYCHOLOGY INTELLIGENCE</small></span>
          </div>
          <LanguagePills value={language} onChange={changeLanguage} />
        </header>
        <section className="entry-stage">
          <div className="entry-copy">
            <span className="entry-kicker"><i />{t.signInEyebrow}</span>
            <h1>{t.signInTitle}</h1>
            <p>{t.signInBody}</p>
            <a className="primary-entry-action" href="/signin-with-chatgpt?return_to=/">
              <span>{t.signIn}</span><b aria-hidden="true">↗</b>
            </a>
            <small>{t.signInHint}</small>
          </div>
          <div className="entry-art" aria-hidden="true">
            <div className="mind-orbit orbit-a"><span>смысл</span></div>
            <div className="mind-orbit orbit-b"><span>баланс</span></div>
            <div className="mind-core"><i>A</i><b>MIND</b></div>
            <div className="floating-thought thought-a">Как я себя чувствую?</div>
            <div className="floating-thought thought-b">Что мне сейчас нужно?</div>
            <div className="floating-thought thought-c">Бирге түшүнөбүз</div>
          </div>
        </section>
        <footer className="entry-footer"><span>{t.brandLine}</span><nav><Link href={`/privacy?lang=${language}`}>{t.privacy}</Link><Link href={`/terms?lang=${language}`}>{t.terms}</Link></nav></footer>
      </main>
    );
  }

  return (
    <main className="product-shell">
      <div className="app-ambient app-ambient-a" aria-hidden="true" />
      <div className="app-ambient app-ambient-b" aria-hidden="true" />
      <button
        className={`drawer-scrim ${menuOpen ? "visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-label={t.close}
        tabIndex={menuOpen ? 0 : -1}
      />
      <aside className={`product-sidebar ${menuOpen ? "open" : ""}`} aria-label="ADEMI MIND">
        <div className="sidebar-topline">
          <button className="brand-lockup sidebar-brand" onClick={() => go("chat")} aria-label="ADEMI MIND">
            <span className="brand-symbol" aria-hidden="true"><b>A</b></span>
            <span><strong>ADEMI MIND</strong><small>PSYCHOLOGY INTELLIGENCE</small></span>
          </button>
          <button className="icon-button close-drawer" onClick={() => setMenuOpen(false)} aria-label={t.close}>×</button>
        </div>

        <button className="new-conversation" onClick={newChat}>
          <span aria-hidden="true">＋</span><b>{t.newChat}</b><kbd>N</kbd>
        </button>

        <section className="history-section" aria-labelledby="recent-heading">
          <div className="sidebar-label"><span id="recent-heading">{t.recent}</span>{recentConversations.length > 0 && <b>{recentConversations.length}</b>}</div>
          <div className="conversation-list">
            {!me.user?.historyEnabled ? (
              <button className="empty-history" onClick={() => go("profile")}><span>◷</span>{t.historyOff}</button>
            ) : recentConversations.length === 0 ? (
              <div className="empty-history"><span>◷</span>{t.noRecent}</div>
            ) : (
              recentConversations.slice(0, 12).map((item) => (
                <div className={`history-item ${conversationId === item.id ? "active" : ""}`} key={item.id}>
                  <button className="history-open" onClick={() => void openConversation(item.id)}>
                    <span aria-hidden="true">◌</span><span><b>{item.title}</b><small>{formatDate(item.lastMessageAt, language)}</small></span>
                  </button>
                  <button className="history-delete" onClick={() => void deleteConversation(item.id)} aria-label={`${t.deleteChat}: ${item.title}`}>×</button>
                </div>
              ))
            )}
          </div>
        </section>

        <nav className="primary-nav" aria-label="Main navigation">
          <button className={screen === "chat" ? "active" : ""} onClick={() => go("chat")}><span aria-hidden="true">◫</span>{t.navChat}</button>
          <button className={screen === "profile" ? "active" : ""} onClick={() => go("profile")}><span aria-hidden="true">○</span>{t.navProfile}</button>
          <button className={screen === "billing" ? "active" : ""} onClick={() => go("billing")}><span aria-hidden="true">◇</span>{t.navPayment}<i>Скоро</i></button>
        </nav>

        <button className="sidebar-profile" onClick={() => go("profile")}>
          <Avatar url={avatarUrl} label={displayName || me.user?.email || "Profile"} fallback={userInitials} />
          <span><strong>{displayName || me.user?.email?.split("@")[0]}</strong><small>{me.user?.role === "owner" ? t.roleOwner : t.roleMember}</small></span>
          <b aria-hidden="true">›</b>
        </button>
        <div className="sidebar-legal"><Link href={`/privacy?lang=${language}`}>{t.privacy}</Link><span>·</span><Link href={`/terms?lang=${language}`}>{t.terms}</Link></div>
      </aside>

      <section className="product-main">
        <header className="product-topbar">
          <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label={t.menu}><span /><span /><span /></button>
          <div className="mobile-brand">ADEMI <b>MIND</b></div>
          <div className="topbar-spacer" />
          <div className="mode-pill"><i /><span>{modeShort}</span></div>
          <LanguagePills value={language} onChange={changeLanguage} compact />
          <div className="theme-mini" role="group" aria-label={t.theme}>
            <button className={theme === "light" ? "active" : ""} onClick={() => chooseTheme("light")} aria-label={t.themeLight}>☼</button>
            <button className={theme === "system" ? "active" : ""} onClick={() => chooseTheme("system")} aria-label={t.themeSystem}>◐</button>
            <button className={theme === "dark" ? "active" : ""} onClick={() => chooseTheme("dark")} aria-label={t.themeDark}>◒</button>
          </div>
        </header>

        {screen === "chat" && (
          <section className={`chat-screen ${conversation.length ? "has-conversation" : ""}`}>
            <div className="chat-scroll" aria-live="polite">
              {conversation.length === 0 ? (
                <div className="welcome-stage">
                  <div className="welcome-mark" aria-hidden="true"><span>A</span><i /><i /></div>
                  <div className="welcome-badge"><i />{modeTitle}</div>
                  <h1>{firstName ? `${t.greetingNamed}, ${firstName}` : t.greeting}</h1>
                  <p>{welcomeLead}</p>
                  <div className="topic-grid">
                    {t.topics.map((topic, index) => (
                      <button key={topic.title} style={{ "--delay": `${index * 55}ms` } as React.CSSProperties} onClick={() => choosePrompt(topic.text)}>
                        <span aria-hidden="true">{topic.icon}</span><b>{topic.title}</b><p>{topic.text}</p><i aria-hidden="true">↗</i>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="message-stream">
                  {conversation.map((item, index) => {
                    const feedbackKey = item.id ?? `message-${index}`;
                    const isCrisis = item.safetyLevel === "crisis";
                    return (
                      <article className={`chat-message ${item.role} ${isCrisis ? "crisis" : ""}`} key={`${item.role}-${index}`}>
                        <div className="message-avatar" aria-hidden="true">{item.role === "ai" ? "A" : userInitials}</div>
                        <div className="message-content">
                          <header><strong>{item.role === "ai" ? t.assistant : t.you}</strong>{item.role === "ai" && <span>{answerModeLabel(item)}</span>}</header>
                          <p>{item.text}</p>
                          {item.role === "ai" && localVoiceAvailable && item.language === "RU" && (
                            <button
                              className={`voice-button ${speakingMessageKey === feedbackKey ? "active" : ""}`}
                              type="button"
                              aria-label={speakingMessageKey === feedbackKey ? voice.stop : voice.listen}
                              aria-pressed={speakingMessageKey === feedbackKey}
                              title={speakingMessageKey === feedbackKey ? voice.stop : voice.listen}
                              onClick={() => toggleSpeech(feedbackKey, item.text)}
                            >
                              <span aria-hidden="true">🔊</span>
                              {speakingMessageKey === feedbackKey ? voice.reading : voice.listen}
                            </button>
                          )}
                          {item.sources && item.sources.length > 0 && (
                            <div className="message-sources">{item.sources.map((source) => <span key={source.filename}>↳ {source.filename}</span>)}</div>
                          )}
                          {isCrisis && <a className="crisis-call" href="tel:112">{t.call112}</a>}
                          {item.role === "ai" && item.id && (
                            <div className="feedback-wrap">
                              {feedbackSent.includes(item.id) ? <small>{t.feedbackThanks}</small> : (
                                <>
                                  <button className="feedback-trigger" onClick={() => setFeedbackOpen(feedbackOpen === feedbackKey ? null : feedbackKey)} aria-expanded={feedbackOpen === feedbackKey}>··· <span>{t.report}</span></button>
                                  {feedbackOpen === feedbackKey && (
                                    <div className="feedback-menu">
                                      <button onClick={() => void reportAnswer(item.id!, "inaccurate")}>{t.inaccurate}</button>
                                      <button onClick={() => void reportAnswer(item.id!, "unsafe")}>{t.unsafe}</button>
                                      <button onClick={() => void reportAnswer(item.id!, "unhelpful")}>{t.unhelpful}</button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {sending && (
                    <article className="chat-message ai typing-message">
                      <div className="message-avatar" aria-hidden="true">A</div>
                      <div className="message-content"><header><strong>{t.assistant}</strong></header><div className="thinking-dots"><i /><i /><i /></div><small>{t.thinking}</small></div>
                    </article>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="composer-zone">
              {notice && <div className="notice-bar" role="alert"><span>!</span>{notice}<button onClick={() => setNotice("")} aria-label="Close">×</button></div>}
              <form className="chat-composer" onSubmit={sendMessage}>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={t.placeholder} maxLength={4000} rows={1} aria-label={t.placeholder} />
                <div className="composer-actions">
                  <span><i />{modeShort}</span>
                  {localMicrophoneAvailable && recordingState !== "idle" && <span className={`recording-status ${recordingState}`} role="status">{recordingState === "recording" ? `${voice.recording} ${Math.max(MAX_RECORDING_SECONDS - recordingSeconds, 0)}` : voice.processing}</span>}
                  {localMicrophoneAvailable && (
                    <button
                      className={`microphone-button ${recordingState === "recording" ? "recording" : ""} ${recordingState === "processing" ? "processing" : ""}`}
                      type="button"
                      disabled={sending && recordingState === "idle"}
                      aria-label={recordingState === "processing" ? voice.cancelProcessing : recordingState === "recording" ? voice.stop : voice.sayQuestion}
                      aria-pressed={recordingState === "recording"}
                      title={recordingState === "processing" ? voice.cancelProcessing : recordingState === "recording" ? voice.stop : voice.sayQuestion}
                      onClick={toggleVoiceInput}
                    >
                      <span aria-hidden="true">{recordingState === "recording" ? "■" : "🎙"}</span>
                      <span className="visually-hidden">{recordingState === "processing" ? voice.cancelProcessing : recordingState === "recording" ? voice.stop : voice.sayQuestion}</span>
                    </button>
                  )}
                  <button className="send-button" disabled={!message.trim() || sending} type="submit" aria-label={t.send}>↑</button>
                </div>
              </form>
              {localVoiceAvailable && language === "RU" && <label className="voice-picker"><span>Голос озвучки</span><select value={selectedVoice} onChange={(event) => chooseVoice(event.target.value as RussianVoice)}><option value="svetlana">Светлана</option><option value="dmitry">Дмитрий</option></select></label>}
              <p className="composer-disclosure">{t.disclaimer} · {modeDisclosure}{localAudioDisclosure && ` · ${localAudioDisclosure}`}</p>
            </div>
          </section>
        )}

        {screen === "profile" && me.user && (
          <section className="settings-screen">
            <div className="settings-heading"><span className="section-kicker">ADEMI SPACE</span><h1>{t.profileTitle}</h1><p>{t.profileLead}</p></div>
            <div className="profile-grid">
              <article className="settings-card identity-card">
                <div className="profile-photo-wrap">
                  <Avatar url={avatarUrl} label={displayName || me.user.email} fallback={userInitials} large />
                  <label className="photo-action" htmlFor="profile-avatar">＋<span>{t.photo}</span></label>
                  <input id="profile-avatar" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} />
                </div>
                <div className="identity-copy"><h2>{displayName || me.user.email.split("@")[0]}</h2><p>{me.user.email}</p><small>{t.photoHint}</small>{avatarUrl && <button className="remove-photo" onClick={() => void removeAvatar()}>{t.removePhoto}</button>}<span>{me.user.role === "owner" ? t.roleOwner : t.roleMember}</span></div>
              </article>

              <article className="settings-card form-card">
                <div className="field"><label htmlFor="profile-name">{t.name}</label><input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={t.namePlaceholder} maxLength={80} autoComplete="name" /></div>
                <div className="field"><label htmlFor="profile-email">{t.email}</label><input id="profile-email" value={me.user.email} readOnly /></div>
                <div className="field"><label htmlFor="profile-language">{t.language}</label><select id="profile-language" value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as Language)}>{(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => <option key={option} value={option}>{LANGUAGE_LABELS[option]}</option>)}</select></div>
                <button className="primary-button" onClick={() => void saveProfile()} disabled={profileBusy}>{profileBusy ? t.saving : t.save}</button>
                {profileNotice && <p className="profile-notice" role="status">{profileNotice}</p>}
              </article>

              <article className="settings-card preference-card">
                <div><span className="card-icon">◐</span><div><h2>{t.theme}</h2><p>{t.brandLine}</p></div></div>
                <div className="theme-picker" role="group" aria-label={t.theme}>
                  <button className={theme === "system" ? "active" : ""} onClick={() => chooseTheme("system")}><span>◐</span>{t.themeSystem}</button>
                  <button className={theme === "light" ? "active" : ""} onClick={() => chooseTheme("light")}><span>☼</span>{t.themeLight}</button>
                  <button className={theme === "dark" ? "active" : ""} onClick={() => chooseTheme("dark")}><span>◒</span>{t.themeDark}</button>
                </div>
              </article>

              <article className="settings-card history-card">
                <div><span className="card-icon">◷</span><div><h2>{t.history}</h2><p>{t.historyHint}</p></div></div>
                <button className={`switch ${profileHistoryEnabled ? "on" : ""}`} onClick={() => void toggleHistory()} role="switch" aria-checked={profileHistoryEnabled}><span /></button>
              </article>

              {localVoiceAvailable && (
                <article className="settings-card history-card">
                  <div><div><h2>{voice.consentTitleProfile}</h2><p>{voiceConsent ? voice.consentActive : voice.consentInactive}</p></div></div>
                  {voiceConsent ? (
                    <button className="remove-photo" type="button" onClick={revokeVoiceConsent}>{voice.revoke}</button>
                  ) : (
                    <button className="primary-button" type="button" onClick={() => setVoiceConsentOpen(true)}>{voice.accept}</button>
                  )}
                </article>
              )}

              <article className="settings-card data-card">
                <div><span className="card-icon">⌁</span><div><h2>{t.dataTitle}</h2><p>{t.dataBody}</p></div></div>
                <div className="data-actions"><button onClick={() => void exportMyData()} disabled={privacyBusy}>{t.exportData}</button><button className="danger" onClick={() => void deleteAllHistory()} disabled={privacyBusy}>{t.deleteHistory}</button></div>
              </article>
            </div>
          </section>
        )}

        {screen === "billing" && (
          <section className="billing-screen">
            <div className="billing-visual" aria-hidden="true">
              <div className="billing-ring ring-one" /><div className="billing-ring ring-two" /><div className="billing-core"><span>A</span></div>
              <i className="spark spark-a">✦</i><i className="spark spark-b">·</i><i className="spark spark-c">✦</i>
            </div>
            <span className="section-kicker">{t.paymentEyebrow}</span>
            <h1>{t.paymentTitle}</h1>
            <p>{t.paymentBody}</p>
            <div className="payment-status"><span><i />{t.paymentBadge}</span><b>{t.paymentNote}</b></div>
          </section>
        )}
      </section>

      {me.consentRequired && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card consent-card" role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <div className="consent-topline"><div className="modal-mark">A</div><LanguagePills value={language} onChange={changeLanguage} compact /></div><span className="section-kicker">{t.consentEyebrow}</span><h2 id="consent-title">{t.consentTitle}</h2><p>{t.consentBody}</p>
            <label className="consent-check"><input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} /><span>{t.consentAgree} <Link href={`/terms?lang=${language}`}>{t.terms.toLowerCase()}</Link>.</span></label>
            <button className="primary-button wide" disabled={!consentChecked} onClick={() => void acceptConsent()}>{t.consentContinue}</button>
          </section>
        </div>
      )}

      {localVoiceAvailable && voiceConsentOpen && (
        <div className="modal-backdrop voice-consent-backdrop" role="presentation">
          <section className="voice-consent" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title">
            <span className="section-kicker">{voice.consentEyebrow}</span>
            <h2 id="voice-consent-title">{voice.consentTitle}</h2>
            <p>{voice.consentBody}</p>
            <label className="voice-picker"><span>{voice.voiceLabel}</span><select value={selectedVoice} onChange={(event) => chooseVoice(event.target.value as RussianVoice)}><option value="svetlana">Светлана</option><option value="dmitry">Дмитрий</option></select></label>
            <div className="voice-consent-actions">
              <button type="button" onClick={dismissVoiceConsent}>{voice.later}</button>
              <button type="button" className="primary-button" onClick={acceptVoiceConsent}>{voice.accept}</button>
            </div>
          </section>
        </div>
      )}

      {showOnboarding && me.user && (
        <div className="modal-backdrop onboarding-backdrop" role="presentation">
          <section className="modal-card onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <div className="onboarding-top"><div><span className="section-kicker">{t.onboardingEyebrow}</span><h2 id="onboarding-title">{t.onboardingTitle}</h2><p>{t.onboardingBody}</p></div><div className="mini-orbit" aria-hidden="true"><span>A</span></div></div>
            <div className="onboarding-form">
              <div className="onboarding-avatar">
                <Avatar url={avatarUrl} label={profileName || me.user.email} fallback={userInitials} large />
                <label htmlFor="onboarding-photo">＋ {t.onboardingPhoto}</label>
                <input id="onboarding-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} />
                <small>{t.onboardingSkipPhoto}</small>
              </div>
              <div className="field"><label htmlFor="onboarding-name">{t.name}</label><input id="onboarding-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={t.namePlaceholder} maxLength={80} autoComplete="name" /></div>
              <div className="field"><label htmlFor="onboarding-language">{t.language}</label><select id="onboarding-language" value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as Language)}>{(Object.keys(LANGUAGE_LABELS) as Language[]).map((option) => <option key={option} value={option}>{LANGUAGE_LABELS[option]}</option>)}</select></div>
              <div className="onboarding-history">
                <span><b>{t.history}</b><small>{t.historyHint}</small></span>
                <button className={`switch ${profileHistoryEnabled ? "on" : ""}`} type="button" onClick={() => setProfileHistoryEnabled((enabled) => !enabled)} role="switch" aria-checked={profileHistoryEnabled}><span /></button>
              </div>
            </div>
            {profileNotice && <p className="profile-notice" role="status">{profileNotice}</p>}
            <button className="primary-button wide" onClick={() => void saveProfile(true)} disabled={profileBusy}>{profileBusy ? t.saving : t.onboardingContinue}<span aria-hidden="true">↗</span></button>
          </section>
        </div>
      )}
    </main>
  );
}
