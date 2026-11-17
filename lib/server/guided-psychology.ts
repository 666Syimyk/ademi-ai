import {
  courseProgram,
  courseProgramMetadata,
  evidenceBoundary,
} from "./course-program";
import { expandedPsychologyReply } from "./guided-psychology-knowledge";

export type GuidedLanguage = "RU" | "KG" | "EN";

export type GuidedChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GuidedIntent =
  | "greeting"
  | "help"
  | "course_overview"
  | "course_modules"
  | "course_meditations"
  | "course_journals"
  | "course_quantum"
  | "course_money_debt"
  | "course_forgiveness"
  | "emotion_regulation"
  | "burnout"
  | "motivation"
  | "focus"
  | "decision_making"
  | "cognitive_distortions"
  | "attachment"
  | "communication_conflict"
  | "jealousy_trust"
  | "breakup"
  | "parenting"
  | "inner_child"
  | "perfectionism"
  | "people_pleasing"
  | "guilt_shame"
  | "fear_phobia"
  | "social_anxiety"
  | "work_stress"
  | "study_exams"
  | "self_compassion"
  | "assertiveness"
  | "trauma_boundary"
  | "addiction_boundary"
  | "eating_body_image"
  | "therapist_selection"
  | "journaling_reflection"
  | "general_psychology"
  | "anxiety"
  | "urgent_medical"
  | "panic"
  | "boundaries"
  | "difficult_conversation"
  | "relationships"
  | "self_worth"
  | "goals"
  | "habits"
  | "procrastination"
  | "meditation"
  | "sleep"
  | "anger"
  | "sadness_loneliness"
  | "grief"
  | "diagnosis_medication"
  | "abuse"
  | "content"
  | "unknown";

export type GuidedPsychologyContext = {
  audience: "owner" | "student";
  history?: GuidedChatTurn[];
  /**
   * A weak signal from the route-level course matcher. It is intentionally used
   * only for ambiguous follow-ups; explicit current-message intent wins.
   */
  courseMatched?: boolean;
  safetyLevel?: "standard" | "sensitive";
};

export type GuidedSource = {
  filename: string;
  fileId: null;
};

export type GuidedPsychologyResponse = {
  text: string;
  sources: GuidedSource[];
  model: "ademi-guided-v1";
  responseId: undefined;
  answerMode: "guided";
  intent: GuidedIntent;
};

type LocalizedText = Record<GuidedLanguage, string>;

const localize = (language: GuidedLanguage, text: LocalizedText) =>
  text[language];

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/g, " ").trim();

const patterns = {
  abuse: [
    /насили|абьюз|избива|бь[её]т|ударил|принужда|домогат|угрожа|преследу|сталкинг|оруж|пистолет|нож|небезопасно дома/u,
    /зомбулук|урат|уруп жатат|уруп|сабайт|коркут|куугунтук|мажбурла|мылтык|бычак|үйдө коопсуз эмес/u,
    /\babuse\b|assault|hits? me|hit me|violent partner|unsafe at home|coerc|stalk|threat|gun|knife|weapon/u,
  ],
  diagnosisMedication: [
    /диагноз|психиатр|антидепресс|таблет|лекарств|дозиров|биполяр|сдвг/u,
    /диагноз|психиатр|антидепресс|дары|дозасы|биполяр/u,
    /diagnos|psychiatr|antidepress|medication|dosage|bipolar|adhd/u,
  ],
  urgentMedical: [
    /(?:сильн|резк|нов).{0,18}бол.{0,10}груд|бол.{0,10}груд.{0,18}(?:сильн|резк|нов)|потер.{0,10}сознани|теряю сознание|без сознания|обморок|судорог|анафилак|сильн.{0,12}аллерг|не могу дышать|задыхаюсь|не могу бодрствовать|невозможно разбудить/u,
    /көкүрө(?:к|г)\p{L}*.{0,16}(?:катуу|жаңы|кескин).{0,8}оор|(?:катуу|жаңы|кескин).{0,16}көкүрө(?:к|г)\p{L}*.{0,8}оор|эс-учун жогот|эсимди.{0,8}жогот|эсим ооп|эссиз|тырыш|талма|анафилак|катуу.{0,12}аллерг|дем ала албай|муунуп|ойгоно албай|ойготууга болбой/u,
    /(?:severe|new|sudden).{0,20}chest pain|chest pain.{0,20}(?:severe|new|sudden)|\bfaint|loss of consciousness|unconscious|seizure|convulsion|anaphyla|severe allergic|marked trouble breathing|cannot breathe|can't breathe|struggling to breathe|cannot stay awake|can't stay awake|hard to wake/u,
  ],
  panic: [
    /паническ|паника|не могу дышать|сердце выскакивает/u,
    /паника|дем ала албай|жүрөгүм катуу/u,
    /panic attack|cannot breathe|can't breathe|heart is racing/u,
  ],
  courseProgram: [
    /программ.{0,18}курс|курс.{0,18}программ|что входит в курс|о ч[её]м курс/u,
    /курс.{0,18}программ|программ.{0,18}курс|курста эмне бар/u,
    /course (?:program|programme|curriculum|overview)|what(?:'s| is) in the course/u,
  ],
  courseModules: [
    /модул|раздел.{0,12}курс/u,
    /модул/u,
    /\bmodules?\b/u,
  ],
  courseMeditations: [
    /(?:курс|программ).{0,24}медитац|(?:какие|перечисли|назови|список).{0,18}медитац|(?:9|девять).{0,6}медитац|медитац.{0,18}(?:курс|программ|№|номер|перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|[1-9])|(?:перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|[1-9](?:-?[яйе])?).{0,10}медитац/u,
    /(?:курс|программ).{0,24}медитац|(?:кандай|кайсы|тизме|ата).{0,18}медитац|(?:9|тогуз).{0,6}медитац|медитац.{0,18}(?:курс|программ|№|номер|биринчи|экинчи|үчүнчү|төртүнчү|бешинчи|алтынчы|жетинчи|сегизинчи|тогузунчу|[1-9])|(?:биринчи|экинчи|үчүнчү|төртүнчү|бешинчи|алтынчы|жетинчи|сегизинчи|тогузунчу|[1-9]-?).{0,10}медитац/u,
    /(?:course|program).{0,24}meditat|which meditations|(?:what are|list|name).{0,18}(?:9|nine).{0,6}meditations|meditation.{0,18}(?:#|number|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|[1-9])|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|[1-9](?:st|nd|rd|th)?).{0,10}meditation/u,
  ],
  courseJournals: [
    /дневник|письменн.{0,10}практик/u,
    /күндөлүк|жазуу.{0,10}практик/u,
    /journal|workbook|writing practice/u,
  ],
  courseQuantum: [
    /квант|аур[аеуы]|энергетическ.{0,12}(?:поле|связ)/u,
    /квант|аура|энергетикалык/u,
    /quantum|\bauras?\b|energy field/u,
  ],
  courseMoneyDebt: [
    /деньги.{0,10}энерг|финансов.{0,10}(?:поток|блок)|долг|кредит/u,
    /акча.{0,10}энерг|финансылык.{0,10}(?:агым|блок)|карыз/u,
    /money.{0,10}energy|financial (?:flow|block)|\bdebt\b|credit/u,
  ],
  courseForgiveness: [
    /(?:простить|прощени|кечир).{0,22}(?:мам|пап|родител|себя|деньг)|медитац.{0,18}прощ/u,
    /кечирим.{0,22}(?:апа|ата|өзүм|акча)|кечирим суроо/u,
    /forgiv.{0,22}(?:mother|father|parent|myself|money)|forgiveness meditation/u,
  ],
  anxiety: [
    /тревог|тревож|стресс|волну|беспокой|накручив/u,
    /тынчсыздан|кабатыр|стресс|толкундан/u,
    /anxi|stress|worr|nervous|overthink/u,
  ],
  boundaries: [
    /личн.{0,8}границ|поставить границ|сказать нет|отказать|наруша.{0,8}границ/u,
    /жеке\s+ч(?:ек|ег)\p{L}*|чег(?:им|иң|иңиз|ибиз)(?:ди|де|ден|ге)?|чек кою|жок деп айт|баш тарт/u,
    /boundar|say no|refus/u,
  ],
  difficultConversation: [
    /важн.{0,10}разговор|сложн.{0,10}разговор|поговорить с|обсудить конфликт/u,
    /маанилүү.{0,10}сүйлөш|оор.{0,10}сүйлөш|сүйлөшүү алдында/u,
    /difficult conversation|hard conversation|talk to my|discuss a conflict/u,
  ],
  relationships: [
    /отношен|партн[её]р|муж|жена|семейн|расставан|ревност|конфликт/u,
    /мамиле|өнөктөш|күйөө|аял|үй-бүлө|ажыраш|кызган/u,
    /relationship|partner|husband|wife|breakup|jealous|conflict/u,
  ],
  selfWorth: [
    /самооцен|самоцен|уверенн.{0,8}себ|внутренн.{0,8}критик|любить себя/u,
    /өзүн.{0,8}баалоо|өзүмдү.{0,8}сүй|ички сын|өзүнө ишен/u,
    /self[- ]?(?:esteem|worth)|confidence|inner critic|love myself/u,
  ],
  procrastination: [
    /прокраст|откладыва|не могу начать|тяну до последн/u,
    /кийинге калтыр|баштай албай|создуктур/u,
    /procrast|putting (?:it|things) off|cannot start|can't start/u,
  ],
  habits: [
    /привыч|атомн.{0,8}привыч|режим дня/u,
    /адат|атомдук.{0,8}адат|күн тартиб/u,
    /habit|routine|atomic habits/u,
  ],
  goals: [
    /цель|достичь|планирован|мотивац|намерен/u,
    /максат|жетиш|план|мотивац|ниет/u,
    /\bgoal|achiev|planning|motivat|intention/u,
  ],
  sleep: [
    /сон|уснуть|бессон|просыпаюсь ночью|не высыпа/u,
    /уйку|уктай албай|түнкүсүн ойгон/u,
    /\bsleep|insomnia|fall asleep|wake up at night/u,
  ],
  anger: [
    /злость|злюсь|гнев|раздраж|ярость/u,
    /ачуу|кыжыр|каар/u,
    /anger|angry|irritat|rage/u,
  ],
  grief: [
    /горе|утрат|умер.{0,10}(?:мам|пап|близ|друг)|похорон/u,
    /(?:жакын|адам|апа|ата|эне|мама|папа|дос|тууган|бирөө)\p{L}*.{0,18}жогот|жоготуу.{0,18}(?:кайгы|аза)|каза бол|жакын адам.{0,12}өл|кайгы.{0,20}жогот/u,
    /\bgrief|bereav|died|death of|funeral/u,
  ],
  sadnessLoneliness: [
    /груст|одинок|пустот|печаль|никому не нужен/u,
    /кайгыр|жалгыз|көңүлсүз|боштук/u,
    /sad|lonely|emptiness|alone|no one needs me/u,
  ],
  meditation: [
    /медитац|осознанност|заземлен|заземлён|дыхательн.{0,8}практик/u,
    /медитац|аң-сезим|жерге туташ|дем алуу практик/u,
    /meditat|mindful|grounding|breathing practice/u,
  ],
  burnout: [
    /выгоран|эмоциональн.{0,12}истощ|истощен.{0,12}работ|нет сил.{0,12}работ|работа опустошает/u,
    /күйүп кет|эмоциялык.{0,12}чарч|иштен.{0,12}чарч|ишке күч жок/u,
    /burnout|burnt out|burned out|emotionally exhausted.{0,12}work|work drains me/u,
  ],
  workStress: [
    /стресс.{0,12}(?:на работе|из-за работы)|работа.{0,12}(?:давит|стресс)|начальник.{0,12}(?:давит|стресс)|рабоч.{0,10}нагруз/u,
    /иштеги.{0,10}стресс|жумуш.{0,12}(?:басым|стресс)|жетекчи.{0,12}(?:басым|стресс)|иш жүгү/u,
    /work stress|job stress|workload|boss.{0,12}(?:pressure|stress)|work pressure/u,
  ],
  studyExams: [
    /экзамен|сессия|уч[её]б|подготовк.{0,12}(?:тест|экзамен)|боюсь сдавать/u,
    /экзамен|окуудагы.{0,10}стресс|сабакка даяр|тестке даяр|сессия/u,
    /exam|test anxiety|study stress|studying|school stress|university stress/u,
  ],
  socialAnxiety: [
    /социальн.{0,10}тревог|социофоб|боюсь людей|страшно говорить.{0,12}люд|страх оценки|публичн.{0,8}выступ/u,
    /социалдык.{0,10}тынчсыздан|адамдардан корк|эл алдында.{0,20}корк|баалоодон корк/u,
    /social anxi|social phobia|fear of judgment|afraid of people|public speaking anxi/u,
  ],
  fearPhobia: [
    /\bфоби|страх|боюсь|корк(?:уу|ом)|панически боюсь/u,
    /фобия|коркуу|корком|катуу корком/u,
    /\bphobi|\bfear\b|afraid of|terrified of/u,
  ],
  traumaBoundary: [
    /птср|посттравмат|психологическ.{0,10}травм|(?:^|[^\p{L}])травм(?:а|ы|ой|у)(?:$|[^\p{L}])|травматич.{0,10}(?:опыт|событ)|фл[эе]шб[эе]к/u,
    /птср|травма|травмалык.{0,10}(?:тажрыйба|окуя)|өткөн окуя эсиме/u,
    /\bptsd\b|\btrauma\b|post-traumatic|psychological trauma|traumatic (?:event|experience)|flashbacks?/u,
  ],
  addictionBoundary: [
    /зависимост|алкогол|наркот|не могу бросить пить|ломк|запой|ставки|азартн.{0,8}игр/u,
    /көз каранд|алкогол|баңгизат|ичкенди токтото албай|кумар оюн/u,
    /addict|substance use|alcohol problem|drink alcohol|alcohol.{0,12}daily|drug use|withdrawal|cannot stop drinking|can't stop drinking|gambling problem/u,
  ],
  eatingBodyImage: [
    /расстройств.{0,10}пищев|рпп|анорек|булим|переедан|не ем.{0,12}(?:чтобы|из-за)|ненавижу.{0,8}тел|стыжусь.{0,8}тел|образ тела/u,
    /тамактануу.{0,10}бузул|анорек|булим|ашыкча жеп|денемди жек көр|денемден уялам/u,
    /eating disorder|anorexi|bulimi|binge eat|body image|hate my body|ashamed of my body/u,
  ],
  therapistSelection: [
    /как (?:найти|выбрать).{0,12}(?:психолог|психотерапевт)|хороший психолог|перв.{0,8}сесси|психолог не подходит/u,
    /психологду кантип.{0,10}(?:танда|тап)|жакшы психолог|биринчи сессия|психолог туура келбейт/u,
    /how to (?:find|choose).{0,12}(?:therapist|psychologist)|good therapist|first therapy session|therapist.{0,10}fit/u,
  ],
  cognitiveDistortions: [
    /когнитивн.{0,10}искаж|ошибк.{0,8}мышлен|катастрофизац|чтение мыслей|вс[её] или ничего/u,
    /когнитивдик.{0,10}бурмалан|ой жүгүртүү.{0,10}ката|катастрофалаш|оюн окуу/u,
    /cognitive distortion|thinking error|catastrophi[sz]|mind reading|all[- ]or[- ]nothing/u,
  ],
  perfectionism: [
    /перфекциони|идеально или никак|боюсь ошиб|ошибка.{0,12}провал/u,
    /перфекциони|идеалдуу болбосо|ката кетирүүдөн корк/u,
    /perfectionis|perfect or nothing|afraid of mistakes?|mistake means failure/u,
  ],
  peoplePleasing: [
    /угожда|быть удобн|всем нравиться|не могу отказать|боюсь расстроить.{0,10}люд/u,
    /баарына жагын|ыңгайлуу бол|баш тарта албай|адамды капа кылуудан корк/u,
    /people[- ]pleas|keep everyone happy|cannot say no|can't say no|afraid to disappoint/u,
  ],
  guiltShame: [
    /чувств.{0,8}вин|вина|стыд|мне стыдно|я плохой человек/u,
    /күнөө сез|күнөөлүүмүн|уялам|уят|мен жаман адаммын/u,
    /\bguilt|guilty|\bshame|ashamed|i am a bad person/u,
  ],
  selfCompassion: [
    /самосострадан|сочувств.{0,6}себ|бережно к себе|добрее к себе/u,
    /өзүнө боорукер|өзүмө боорукер|өзүмө жумшак|өзүмдү колдоо/u,
    /self[- ]compassion|kind(?:er)? to myself|gentle with myself/u,
  ],
  innerChild: [
    /внутренн.{0,8}реб[её]н|исцелить детств|детск.{0,8}травм/u,
    /ички бала|балалыкты айыктыр|балалык травма/u,
    /inner child|heal(?:ing)? childhood|childhood wound/u,
  ],
  assertiveness: [
    /ассертив|отстоять себя|защитить своё мнение|говорить прямо.{0,12}уваж/u,
    /ассертив|өз оюмду корго|өзүмдү корго|түз жана сыйлуу сүйлө/u,
    /assertiv|stand up for myself|express myself respectfully/u,
  ],
  attachment: [
    /тип.{0,8}привязанност|стиль.{0,8}привязанност|тревожн.{0,8}привязан|избегающ.{0,8}привязан/u,
    /байлануу стили|тынчсыз.{0,8}байлануу|качкан.{0,8}байлануу/u,
    /attachment style|anxious attachment|avoidant attachment|secure attachment/u,
  ],
  jealousyTrust: [
    /ревност|доверие.{0,10}(?:потер|вернут|нет)|не доверяю.{0,10}партн|измена/u,
    /кызган|ишеним.{0,10}(?:жогол|кайтар)|өнөктөшкө ишенбей|чыккынчылык/u,
    /jealous|trust issue|rebuild trust|do not trust my partner|don't trust my partner|infidelit/u,
  ],
  breakup: [
    /расставан|разрыв.{0,10}отношен|после разрыва|бывш(?:ий|ая)|не могу отпустить/u,
    /ажыраш|мамиле бүт|мурдагы өнөктөш|коё бере албай/u,
    /breakup|break up|relationship ended|my ex|cannot let go|can't let go/u,
  ],
  communicationConflict: [
    /коммуникац|общение.{0,10}(?:партн|семь|работ)|часто ссор|решить конфликт|конструктивн.{0,8}спор/u,
    /баарлашуу|көп уруш|чырды чеч|мамиледеги сүйлөшүү/u,
    /communication|keep arguing|resolve conflict|constructive disagreement|conflict with/u,
  ],
  parenting: [
    /воспитан|реб[её]нок.{0,12}(?:не слуш|истерик|тревог|боится)|подросток.{0,12}(?:конфликт|не слуш)|как говорить с ребен/u,
    /бала тарбия|балам укпайт|баланын истерика|өспүрүм менен чыр|бала менен кантип сүйлөш/u,
    /parenting|my child.{0,12}(?:won't listen|tantrum|anxi|afraid)|teenager.{0,12}conflict|talk to my child/u,
  ],
  emotionRegulation: [
    /эмоци|чувств|регуляц.{0,8}эмоц|управлять.{0,8}эмоц|не понимаю что чувствую/u,
    /эмоция|сезим|эмоцияны жөнгө сал|эмне сезип жатканымды/u,
    /emotion regulation|manage my emotions|what am i feeling|feelings? overwhelm/u,
  ],
  focus: [
    /концентрац|сосредоточ|внимани|отвлекаюсь|не могу сфокус/u,
    /көңүл топто|концентрация|алаксыйм|көңүлүм бөлүн/u,
    /\bfocus|concentrat|attention|distracted|cannot focus|can't focus/u,
  ],
  decisionMaking: [
    /принять решени|сделать выбор|не могу решить|сомневаюсь.{0,12}выбор/u,
    /чечим кабыл|тандоо жас|чече албай|тандоодон күмөн/u,
    /decision[- ]making|make a decision|choose between|cannot decide|can't decide/u,
  ],
  motivation: [
    /мотивац|нет желания.{0,10}делать|не хочется начинать|как заставить себя/u,
    /мотивация|каалоо жок|баштағым келбейт|өзүмдү кантип мажбур/u,
    /motivat|no desire to|do not feel like starting|don't feel like starting|make myself do/u,
  ],
  journalingReflection: [
    /дневник|ведение запис|рефлекси|письменн.{0,10}практик|вопросы для себя/u,
    /күндөлүк|жазуу практик|рефлексия|өзүмө суроо/u,
    /journal|reflective writing|reflection prompts?|writing practice/u,
  ],
  generalPsychology: [
    /что такое психология|основы психологии|как работает психика|поведение человека|мысли эмоции поведение|подкреплен|обусловливан|бессознательн|подсознани|защитн.{0,8}механизм|проекци|эмпати|темперамент|психологическ.{0,8}устойчив/u,
    /психология деген эмне|психологиянын негиздери|психика кантип иштейт|ой сезим жүрүм-турум|бекемдөө|шарттануу|аң-сезимсиз|коргонуу механизм|проекция|эмпатия|темперамент|психологиялык туруктуулук/u,
    /what is psychology|psychology basics|how the mind works|human behaviou?r|thoughts emotions behaviou?r|reinforcement|conditioning|unconscious|subconscious|defen[cs]e mechanism|projection|empathy|temperament|psychological resilience/u,
  ],
  content: [
    /reels?|instagram|контент|ролик|сценар|сторис|публикац/u,
    /reels?|instagram|контент|ролик|сценарий|сторис/u,
    /reels?|instagram|content|video script|social post/u,
  ],
  greeting: [
    /^(?:привет|здравствуй|добрый (?:день|вечер|утро)|салам|саламатсызбы|hello|hi|hey)[!. ]*$/u,
  ],
  help: [
    /что ты умеешь|чем поможешь|помоги выбрать тему|как пользоваться/u,
    /эмне кыла аласың|кантип колдоном|кайсы темалар/u,
    /what can you do|how can you help|how to use|supported topics/u,
  ],
} as const;

function matchesAny(input: string, candidates: readonly RegExp[]) {
  return candidates.some((pattern) => pattern.test(input));
}

const explicitCoursePatterns = [
  /(?:^|[^\p{L}])курс(?:а|е|ом|у|ы|ов)?(?:$|[^\p{L}])|курсунун|курста|курстун|программ.{0,12}курс|модул/u,
  /квант|аур[аеуы]|акча.{0,10}энерг|деньги.{0,10}энерг|money.{0,10}energy/u,
  /финансылык.{0,10}(?:агым|блок)|финансов.{0,10}(?:поток|блок)|financial (?:flow|block)/u,
  /(?:ата|апа|акча|жаным).{0,14}кечир|(?:мама|папа|деньги|себя).{0,14}(?:прости|прощ)|(?:mother|father|money|myself).{0,14}forgiv/u,
  /(?:6|шесть|алты|six).{0,12}(?:дневник|күндөлүк|journals?)|(?:дневник|күндөлүк|journals?).{0,12}(?:6|шесть|алты|six)/u,
  /\bcourse\b|curriculum|\bmodules?\b/u,
] as const;

const followUpPatterns = [
  /^(?:а )?(?:подробнее|почему|зачем|как именно|что дальше|что ещ[её]|продолжай|можно пример|дай пример)[?.! ]*$/u,
  /^(?:дагы|кененирээк|эмне үчүн|кантип|андан кийин|мисал бер|улант)[?.! ]*$/u,
  /^(?:and )?(?:why|how exactly|what next|what else|more|continue|can you explain|give an example)[?.! ]*$/u,
] as const;

function isShortFollowUp(input: string) {
  if (input.length > 120) return false;
  if (matchesAny(input, followUpPatterns)) return true;
  const words = input.split(" ").filter(Boolean);
  return words.length <= 5 && /^(?:а|и|но|как|почему|что|дагы|анан|кантип|эмне|and|but|how|why|what)\b/u.test(input);
}

function classifyDirect(input: string, explicitCourse = false): GuidedIntent {
  if (matchesAny(input, patterns.abuse)) return "abuse";
  if (matchesAny(input, patterns.urgentMedical)) return "urgent_medical";
  if (matchesAny(input, patterns.addictionBoundary))
    return "addiction_boundary";
  if (matchesAny(input, patterns.eatingBodyImage))
    return "eating_body_image";
  if (matchesAny(input, patterns.traumaBoundary)) return "trauma_boundary";
  if (matchesAny(input, patterns.diagnosisMedication))
    return "diagnosis_medication";
  if (matchesAny(input, patterns.panic)) return "panic";

  if (matchesAny(input, patterns.courseProgram)) return "course_overview";
  if (matchesAny(input, patterns.courseModules)) return "course_modules";
  if (explicitCourse && matchesAny(input, patterns.courseJournals))
    return "course_journals";
  if (matchesAny(input, patterns.courseQuantum)) return "course_quantum";
  if (matchesAny(input, patterns.courseMoneyDebt)) return "course_money_debt";
  if (matchesAny(input, patterns.courseForgiveness))
    return "course_forgiveness";
  if (matchesAny(input, patterns.courseMeditations))
    return "course_meditations";

  if (matchesAny(input, patterns.burnout)) return "burnout";
  if (matchesAny(input, patterns.workStress)) return "work_stress";
  if (matchesAny(input, patterns.studyExams)) return "study_exams";
  if (matchesAny(input, patterns.socialAnxiety)) return "social_anxiety";
  if (matchesAny(input, patterns.fearPhobia)) return "fear_phobia";
  if (matchesAny(input, patterns.therapistSelection))
    return "therapist_selection";
  if (matchesAny(input, patterns.cognitiveDistortions))
    return "cognitive_distortions";
  if (matchesAny(input, patterns.perfectionism)) return "perfectionism";
  if (matchesAny(input, patterns.peoplePleasing)) return "people_pleasing";
  if (matchesAny(input, patterns.guiltShame)) return "guilt_shame";
  if (matchesAny(input, patterns.selfCompassion)) return "self_compassion";
  if (matchesAny(input, patterns.innerChild)) return "inner_child";
  if (matchesAny(input, patterns.assertiveness)) return "assertiveness";
  if (matchesAny(input, patterns.attachment)) return "attachment";
  if (matchesAny(input, patterns.jealousyTrust)) return "jealousy_trust";
  if (matchesAny(input, patterns.breakup)) return "breakup";
  if (matchesAny(input, patterns.communicationConflict))
    return "communication_conflict";
  if (matchesAny(input, patterns.parenting)) return "parenting";
  if (matchesAny(input, patterns.emotionRegulation))
    return "emotion_regulation";
  if (matchesAny(input, patterns.focus)) return "focus";
  if (matchesAny(input, patterns.decisionMaking)) return "decision_making";
  if (matchesAny(input, patterns.motivation)) return "motivation";
  if (matchesAny(input, patterns.journalingReflection))
    return "journaling_reflection";
  if (matchesAny(input, patterns.generalPsychology))
    return "general_psychology";
  if (matchesAny(input, patterns.anxiety)) return "anxiety";
  if (matchesAny(input, patterns.boundaries)) return "boundaries";
  if (matchesAny(input, patterns.difficultConversation))
    return "difficult_conversation";
  if (matchesAny(input, patterns.relationships)) return "relationships";
  if (matchesAny(input, patterns.selfWorth)) return "self_worth";
  if (matchesAny(input, patterns.procrastination)) return "procrastination";
  if (matchesAny(input, patterns.habits)) return "habits";
  if (matchesAny(input, patterns.goals)) return "goals";
  if (matchesAny(input, patterns.sleep)) return "sleep";
  if (matchesAny(input, patterns.anger)) return "anger";
  if (matchesAny(input, patterns.grief)) return "grief";
  if (matchesAny(input, patterns.sadnessLoneliness))
    return "sadness_loneliness";
  if (matchesAny(input, patterns.meditation))
    return explicitCourse ? "course_meditations" : "meditation";
  if (matchesAny(input, patterns.content)) return "content";
  if (matchesAny(input, patterns.greeting)) return "greeting";
  if (matchesAny(input, patterns.help)) return "help";
  return "unknown";
}

function resolveIntent(input: string, context: GuidedPsychologyContext) {
  const normalized = normalize(input);
  const explicitCourse = matchesAny(normalized, explicitCoursePatterns);
  const direct = classifyDirect(normalized, explicitCourse);
  if (direct !== "unknown") return direct;

  if (isShortFollowUp(normalized)) {
    const previousUserTurns = (context.history ?? [])
      .filter((turn) => turn.role === "user")
      .slice(-3)
      .reverse();
    for (const turn of previousUserTurns) {
      const previous = normalize(turn.content);
      const previousIntent = classifyDirect(
        previous,
        matchesAny(previous, explicitCoursePatterns),
      );
      if (previousIntent !== "unknown") return previousIntent;
    }
    if (context.courseMatched) return "course_overview";
  }

  return "unknown";
}

function sourceLabel(language: GuidedLanguage) {
  if (language === "KG") return courseProgramMetadata.sourceTitle;
  if (language === "EN")
    return 'Ademi “Quantum Leap” course program (author-provided material)';
  return 'Программа курса Ademi «КВАНТОВЫЙ СКАЧОК» (авторский материал)';
}

const courseIntents = new Set<GuidedIntent>([
  "course_overview",
  "course_modules",
  "course_meditations",
  "course_journals",
  "course_quantum",
  "course_money_debt",
  "course_forgiveness",
]);

type CourseCorpusView = {
  readonly modules: readonly {
    readonly title: string;
    readonly items: readonly string[];
  }[];
  readonly meditationBlocks: readonly {
    readonly title: string;
    readonly items: readonly {
      readonly title: string;
      readonly description: string;
    }[];
  }[];
  readonly journals: readonly {
    readonly title: string;
    readonly description: string;
  }[];
};

/**
 * Faithful display translations of the author-provided Kyrgyz outline. These
 * translate only titles and stated aims; they do not add protocols or claims.
 */
const translatedCourseCorpus: Record<"RU" | "EN", CourseCorpusView> = {
  RU: {
    modules: [
      {
        title: "Введение и фундамент",
        items: [
          "Знакомство и порядок обучения.",
          "Общие понятия и сведения по психологии.",
          "Как работает медитация? (Основы практики).",
          "Искусство формулировать намерения и ставить цели.",
          "Технические правила и организационные вопросы.",
        ],
      },
      {
        title: "Квантовая реальность и энергия",
        items: [
          "Понятие квантовой физики.",
          "Как мысли превращаются в реальность? (Сила мысли).",
          "Принципы работы ауры в квантовой механике.",
          "Ключ к благополучной жизни и управление энергией.",
        ],
      },
      {
        title: "Внутренняя трансформация и финансы",
        items: [
          "Самоценность — основа успеха.",
          "Деньги — это энергия. Открытие финансового потока.",
          "Квантовый скачок — переход на новый уровень.",
          "Что такое иллюзия и как выйти из ограничений?",
        ],
      },
      {
        title: "Масштаб и стратегия новой жизни",
        items: [
          "Выход на новый масштаб: как правильно планировать жизнь?",
          "Эффективные способы избавиться от долгов (финансовых блоков).",
          "Атомные привычки — большие результаты маленькими шагами.",
        ],
      },
    ],
    meditationBlocks: [
      {
        title: "Очищение и освобождение",
        items: [
          {
            title: "Медитация прощения у мамы",
            description:
              "Очищение энергетической связи с матерью, освобождение от внутренних обид и раскрытие энергии нежности.",
          },
          {
            title: "Медитация прощения у папы",
            description:
              "Гармонизация отношений с отцом, восстановление энергии защищённости, доверия и успеха в обществе.",
          },
          {
            title: "Медитация прощения у себя (самоценность)",
            description:
              "Остановка внутреннего критика, освобождение себя от прошлых ошибок и повышение самооценки.",
          },
          {
            title: "Медитация прощения у денег",
            description:
              "Работа с финансовыми блоками, очищение негативных убеждений о деньгах и подготовка к принятию энергии изобилия.",
          },
        ],
      },
      {
        title: "Любовь и наполнение",
        items: [
          {
            title: "Медитация открытия сердца",
            description:
              "Пробуждение замороженных чувств, взгляд на мир с доверием и раскрытие потока любви.",
          },
          {
            title: "Медитация любви к себе",
            description:
              "Принятие себя таким, какой вы есть, наполнение внутренних ресурсов и обретение подлинной гармонии.",
          },
        ],
      },
      {
        title: "Новый уровень и масштаб",
        items: [
          {
            title: "Медитация новых возможностей",
            description:
              "Умение видеть новые пути, преодоление страхов и открытие двери к будущим успехам.",
          },
          {
            title: "Медитация «Квантовый скачок»",
            description:
              "Сильная визуализация для перехода в новую реальность, максимального повышения энергии и достижения масштабных целей.",
          },
          {
            title: "Медитация при ходьбе",
            description:
              "Практика укрепления контакта с телом, остановки потока мыслей и пребывания в состоянии «здесь и сейчас» в повседневной жизни.",
          },
        ],
      },
    ],
    journals: [
      {
        title: "Дневник «Папа, прости меня»",
        description:
          "Перенесение на бумагу и освобождение невысказанных обид на отца, восстановление доверия к жизни и чувства опоры.",
      },
      {
        title: "Дневник «Мама, прости меня»",
        description:
          "Исцеление эмоциональной связи с матерью, пробуждение энергии любви, принятия и открытости миру.",
      },
      {
        title: "Дневник «Душа моя, прости меня» (самопрощение)",
        description:
          "Прекращение самообвинения и самокритики, контакт с внутренним ребёнком и начало бережного отношения к своему внутреннему миру.",
      },
      {
        title: "Дневник «Деньги, простите меня»",
        description:
          "Изменение негативного отношения и установок о деньгах, письменная работа с блоками, которые препятствуют финансовому потоку.",
      },
      {
        title: "Дневник «Достижение цели»",
        description:
          "Превращение мечты из простой мысли в чёткий план, сохранение правильного фокуса и подготовка к квантовому скачку.",
      },
      {
        title: "Дневник «Повышение самоценности»",
        description:
          "Глубокое ощущение собственной ценности, укрепление внутренней опоры и ежедневное развитие уверенности в себе.",
      },
    ],
  },
  EN: {
    modules: [
      {
        title: "Introduction and foundations",
        items: [
          "Introduction and study process.",
          "General concepts and information in psychology.",
          "How does meditation work? (Foundations of practice).",
          "The art of setting intentions and goals.",
          "Technical rules and organizational matters.",
        ],
      },
      {
        title: "Quantum reality and energy",
        items: [
          "An introduction to quantum physics.",
          "How do thoughts turn into reality? (The power of thought).",
          "Principles of how auras work in quantum mechanics.",
          "The key to a prosperous life and managing energy.",
        ],
      },
      {
        title: "Inner transformation and finances",
        items: [
          "Self-worth as the foundation of success.",
          "Money is energy. Opening the financial flow.",
          "Quantum leap: moving to a new level.",
          "What is illusion, and how can we move beyond limitations?",
        ],
      },
      {
        title: "Scale and a strategy for a new life",
        items: [
          "Moving to a new scale: how do we plan life effectively?",
          "Effective ways to become free of debts (financial blocks).",
          "Atomic habits: achieving big results through small steps.",
        ],
      },
    ],
    meditationBlocks: [
      {
        title: "Cleansing and release",
        items: [
          {
            title: "Meditation asking one’s mother for forgiveness",
            description:
              "Cleansing the energetic connection with one’s mother, releasing inner resentment, and opening the energy of tenderness.",
          },
          {
            title: "Meditation asking one’s father for forgiveness",
            description:
              "Harmonizing the relationship with one’s father and restoring the energy of protection, trust, and success in society.",
          },
          {
            title: "Meditation asking oneself for forgiveness (self-worth)",
            description:
              "Stopping the inner critic, releasing oneself from past mistakes, and raising self-esteem.",
          },
          {
            title: "Meditation asking money for forgiveness",
            description:
              "Working through financial blocks, clearing negative beliefs about money, and preparing to receive the energy of abundance.",
          },
        ],
      },
      {
        title: "Love and replenishment",
        items: [
          {
            title: "Heart-opening meditation",
            description:
              "Awakening frozen feelings, viewing the world with trust, and opening the flow of love.",
          },
          {
            title: "Self-love meditation",
            description:
              "Accepting oneself as one is, replenishing inner resources, and finding genuine harmony.",
          },
        ],
      },
      {
        title: "A new level and scale",
        items: [
          {
            title: "New opportunities meditation",
            description:
              "Seeing new paths, overcoming fears, and opening the door to future successes.",
          },
          {
            title: "“Quantum Leap” meditation",
            description:
              "A powerful visualization for moving into a new reality, raising energy to its maximum level, and reaching large-scale goals.",
          },
          {
            title: "Walking meditation",
            description:
              "A practice for strengthening connection with the body, stopping the stream of thoughts, and being in the here and now in everyday life.",
          },
        ],
      },
    ],
    journals: [
      {
        title: '“Father, forgive me” journal',
        description:
          "Putting unspoken resentment toward one’s father on paper and releasing it, restoring trust in life and a sense of support.",
      },
      {
        title: '“Mother, forgive me” journal',
        description:
          "Healing the emotional connection with one’s mother and awakening the energy of love, acceptance, and openness to the world.",
      },
      {
        title: '“My soul, forgive me” journal (self-forgiveness)',
        description:
          "Stopping self-blame and self-criticism, connecting with the inner child, and beginning to treat one’s inner world with compassion.",
      },
      {
        title: '“Money, forgive me” journal',
        description:
          "Changing negative attitudes and beliefs about money and using writing to work through blocks described as obstructing financial flow.",
      },
      {
        title: '“Achieving a goal” journal',
        description:
          "Turning dreams from simple thoughts into a clear plan, maintaining the right focus, and preparing for a quantum leap.",
      },
      {
        title: '“Raising self-worth” journal',
        description:
          "Developing a deep sense of one’s value, strengthening inner support, and growing self-confidence each day.",
      },
    ],
  },
};

function courseCorpus(language: GuidedLanguage): CourseCorpusView {
  return language === "KG" ? courseProgram : translatedCourseCorpus[language];
}

function numbered(items: readonly string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function extractOrdinal(input: string, max: number) {
  const normalized = normalize(input);
  const explicitDigit =
    normalized.match(/(?:№|#|номер|number|no\.?)[\s:-]*([1-9])(?=$|[^0-9])/u)?.[1] ??
    normalized.match(
      /(?:модул\p{L}*|медитац\p{L}*|дневник\p{L}*|күндөлүк\p{L}*|modules?|meditations?|journals?)[\s:-]*(?:№|#|номер|number|no\.?)?[\s:-]*([1-9])(?=$|[^0-9])/u,
    )?.[1] ??
    normalized.match(
      /([1-9])\s*(?:-|(?:-?\s*(?:й|я|е|ая|ый|ое|чы|чи|чу|чү|st|nd|rd|th))\s+)(?:модул\p{L}*|медитац\p{L}*|дневник\p{L}*|күндөлүк\p{L}*|modules?|meditations?|journals?)/u,
    )?.[1];
  if (explicitDigit) {
    const value = Number(explicitDigit);
    if (value >= 1 && value <= max) return value;
  }

  const ordinalWords: ReadonlyArray<readonly [RegExp, number]> = [
    [/перв(?:ый|ая|ое|ую)|биринчи|\bfirst\b/u, 1],
    [/втор(?:ой|ая|ое|ую)|экинчи|\bsecond\b/u, 2],
    [/трет(?:ий|ья|ье|ью)|үчүнчү|\bthird\b/u, 3],
    [/четв[её]рт(?:ый|ая|ое|ую)|төртүнчү|\bfourth\b/u, 4],
    [/пят(?:ый|ая|ое|ую)|бешинчи|\bfifth\b/u, 5],
    [/шест(?:ой|ая|ое|ую)|алтынчы|\bsixth\b/u, 6],
    [/седьм(?:ой|ая|ое|ую)|жетинчи|\bseventh\b/u, 7],
    [/восьм(?:ой|ая|ое|ую)|сегизинчи|\beighth\b/u, 8],
    [/девят(?:ый|ая|ое|ую)|тогузунчу|\bninth\b/u, 9],
  ];
  const word = ordinalWords.find(
    ([pattern, value]) => value <= max && pattern.test(normalized),
  );
  return word?.[1] ?? null;
}

function findMeditationIndex(input: string) {
  const normalized = normalize(input);
  const count = courseProgram.meditationBlocks.reduce(
    (total, block) => total + block.items.length,
    0,
  );
  const ordinal = extractOrdinal(normalized, count);
  if (ordinal) return ordinal - 1;
  const aliases: Array<[RegExp, number]> = [
    [/апа|мам|mother/u, 0],
    [/ата(?:дан|м|га|ны|сы| жөнүндө| тууралуу)|пап|father/u, 1],
    [/өзүбүз|себя|myself/u, 2],
    [/акча|деньг|money/u, 3],
    [/жүрөк|сердц|heart/u, 4],
    [/өзүмдү сүй|любов.{0,6}себ|self[- ]love/u, 5],
    [/мүмкүнчүлүк|возможност|opportunit/u, 6],
    [/квант|quantum/u, 7],
    [/басуу|ходьб|walking/u, 8],
  ];
  const match = aliases.find(([pattern]) => pattern.test(normalized));
  return match?.[1] ?? null;
}

function findJournalIndex(input: string) {
  const normalized = normalize(input);
  const ordinal = extractOrdinal(normalized, courseProgram.journals.length);
  if (ordinal) return ordinal - 1;
  const aliases: Array<[RegExp, number]> = [
    [/ата(?:дан|м|га|ны|сы| жөнүндө| тууралуу)|пап|father/u, 0],
    [/апа|мам|mother/u, 1],
    [/жаным|себя|myself/u, 2],
    [/акча|деньг|money/u, 3],
    [/максат|цел|goal/u, 4],
    [/өзүн баалоо|самоцен|self[- ]worth/u, 5],
  ];
  const match = aliases.find(([pattern]) => pattern.test(normalized));
  return match?.[1] ?? null;
}

function moduleAnswer(input: string, language: GuidedLanguage) {
  const corpus = courseCorpus(language);
  const ordinal = extractOrdinal(input, corpus.modules.length);
  if (ordinal) {
    const courseModule = corpus.modules[ordinal - 1];
    return localize(language, {
      RU: `Модуль ${ordinal} курса называется «${courseModule.title}». В программе указаны темы:\n${numbered(courseModule.items)}\n\nЭто точный перечень из авторской программы; подробные методики в этом кратком плане не приведены, поэтому я не буду их додумывать.`,
      KG: `${ordinal}-модуль «${courseModule.title}» деп аталат. Программада төмөнкү темалар көрсөтүлгөн:\n${numbered(courseModule.items)}\n\nБул автордук программадагы так тизме. Кыска планда толук методикалар жок болгондуктан, аларды ойлоп чыгарбайм.`,
      EN: `Module ${ordinal} is titled “${courseModule.title}.” The supplied program lists these topics:\n${numbered(courseModule.items)}\n\nThis is the exact outline from the author-provided program. It does not contain complete protocols, so I will not invent them.`,
    });
  }

  const titles = corpus.modules.map(
    (courseModule, index) => `${index + 1}. ${courseModule.title}`,
  );
  return localize(language, {
    RU: `В авторской программе ровно ${corpus.modules.length} модуля:\n${titles.join("\n")}\n\nНапишите номер модуля, и я покажу его точный перечень тем.`,
    KG: `Автордук программада так ${corpus.modules.length} модуль бар:\n${titles.join("\n")}\n\nМодулдун номерин жазыңыз — анын темаларын так көрсөтөм.`,
    EN: `The author-provided program contains exactly ${corpus.modules.length} modules:\n${titles.join("\n")}\n\nSend a module number and I will show its exact topic list.`,
  });
}

function meditationAnswer(input: string, language: GuidedLanguage) {
  const corpus = courseCorpus(language);
  const allMeditations = corpus.meditationBlocks.flatMap(
    (block) => block.items,
  );
  const selectedIndex = findMeditationIndex(input);
  const selected =
    selectedIndex === null ? null : allMeditations[selectedIndex] ?? null;
  if (selected) {
    return localize(language, {
      RU: `В программе указана практика: ${selected.title}. Её заявленная цель: ${selected.description}\n\nЭто описание цели из авторского плана, а не полный сценарий терапии: в исходном материале нет длительности, пошагового текста или противопоказаний. Практику можно остановить, если становится тяжело или небезопасно.`,
      KG: `Программада ${selected.title} бар. Анын көрсөтүлгөн максаты: ${selected.description}\n\nБул автордук пландагы максаттын сүрөттөмөсү, толук терапиялык сценарий эмес: баштапкы материалда узактыгы, кадамдык тексти же каршы көрсөтмөлөрү берилген эмес. Оор же кооптуу сезилсе, практиканы токтотууга болот.`,
      EN: `The program includes this practice: ${selected.title}. Its stated aim is: ${selected.description}\n\nThat is the aim stated in the author-provided outline, not a complete therapy protocol; the source gives no duration, step-by-step script, or contraindications. You may stop if the practice feels unsafe or overwhelming.`,
    });
  }

  const blocks = corpus.meditationBlocks
    .map(
      (block) =>
        `${block.title}:\n${block.items.map((item) => `• ${item.title}`).join("\n")}`,
    )
    .join("\n\n");
  const count = corpus.meditationBlocks.reduce(
    (total, block) => total + block.items.length,
    0,
  );
  return localize(language, {
    RU: `В программе ровно ${count} медитаций в ${corpus.meditationBlocks.length} блоках:\n${blocks}\n\nЭто названия и заявленные цели авторского курса, а не медицинские или психотерапевтические протоколы.`,
    KG: `Программада ${corpus.meditationBlocks.length} блокко бөлүнгөн так ${count} медитация бар:\n${blocks}\n\nБул автордук курстагы аталыштар жана максаттар; медициналык же психотерапиялык протоколдор эмес.`,
    EN: `The program contains exactly ${count} meditations across ${corpus.meditationBlocks.length} blocks:\n${blocks}\n\nThese are the titles and stated aims in the author-provided course, not medical or psychotherapy protocols.`,
  });
}

function journalAnswer(input: string, language: GuidedLanguage) {
  const corpus = courseCorpus(language);
  const selectedIndex = findJournalIndex(input);
  const selected =
    selectedIndex === null ? null : corpus.journals[selectedIndex] ?? null;
  if (selected) {
    return localize(language, {
      RU: `В программе указан ${selected.title}. Его заявленная цель: ${selected.description}\n\nЭто образовательная письменная практика для саморефлексии, а не психотерапия. Пишите только столько, сколько ощущается посильным; при сильном ухудшении самочувствия остановитесь и обратитесь за поддержкой.`,
      KG: `Программада ${selected.title} бар. Анын көрсөтүлгөн максаты: ${selected.description}\n\nБул өзүн-өзү талдоо үчүн билим берүүчү жазуу практикасы, психотерапия эмес. Өзүңүз көтөрө алган көлөмдө гана жазыңыз; абалыңыз кескин оорлосо, токтоп, жардамга кайрылыңыз.`,
      EN: `The program includes ${selected.title}. Its stated aim is: ${selected.description}\n\nThis is an educational writing practice for reflection, not psychotherapy. Write only as much as feels manageable; stop and seek support if your distress rises sharply.`,
    });
  }

  const titles = corpus.journals.map(
    (journal, index) => `${index + 1}. ${journal.title}`,
  );
  return localize(language, {
    RU: `В программе ровно ${corpus.journals.length} практических дневников:\n${titles.join("\n")}\n\nНапишите номер или название дневника, и я покажу его заявленную цель без добавления несуществующих инструкций.`,
    KG: `Программада так ${corpus.journals.length} практикалык күндөлүк бар:\n${titles.join("\n")}\n\nНомерин же аталышын жазыңыз — көрсөтүлгөн максатын кошумча көрсөтмө ойлоп чыгарбай түшүндүрөм.`,
    EN: `The program contains exactly ${corpus.journals.length} practical journals:\n${titles.join("\n")}\n\nSend a journal number or title and I will show its stated aim without inventing missing instructions.`,
  });
}

function courseOverview(language: GuidedLanguage) {
  const meditationCount = courseProgram.meditationBlocks.reduce(
    (total, block) => total + block.items.length,
    0,
  );
  return localize(language, {
    RU: `Авторская программа Ademi «Квантовый скачок» включает ровно ${courseProgram.modules.length} модуля, ${meditationCount} медитаций и ${courseProgram.journals.length} письменных дневников. Модули охватывают основы психологии и медитации, намерение и цели, авторскую «квантовую» рамку, самоценность, финансовые убеждения, планирование и привычки.\n\n${evidenceBoundary.RU}`,
    KG: `Ademiнин «Кванттык секирик» автордук программасында так ${courseProgram.modules.length} модуль, ${meditationCount} медитация жана ${courseProgram.journals.length} жазуу күндөлүгү бар. Модулдар психология менен медитациянын негиздерин, ниет жана максатты, автордук «кванттык» алкакты, өзүн баалоону, финансылык ишенимдерди, пландоону жана адаттарды камтыйт.\n\n${evidenceBoundary.KG}`,
    EN: `Ademi’s author-provided “Quantum Leap” program contains exactly ${courseProgram.modules.length} modules, ${meditationCount} meditations, and ${courseProgram.journals.length} writing journals. Its modules cover psychology and meditation basics, intention and goals, the author’s “quantum” framework, self-worth, beliefs about money, planning, and habits.\n\n${evidenceBoundary.EN}`,
  });
}

function replyForIntent(
  intent: GuidedIntent,
  input: string,
  language: GuidedLanguage,
  context: GuidedPsychologyContext,
) {
  const expandedReply = expandedPsychologyReply(intent, language, input);
  if (expandedReply) return expandedReply;

  switch (intent) {
    case "course_overview":
      return courseOverview(language);
    case "course_modules":
      return moduleAnswer(input, language);
    case "course_meditations":
      return meditationAnswer(input, language);
    case "course_journals":
      return journalAnswer(input, language);
    case "course_quantum":
      return localize(language, {
        RU: `В авторской программе «квантовая реальность», аура, управление энергией и «квантовый скачок» используются как духовная или коучинговая рамка. Курс включает эти темы во 2-м и 3-м модулях, но это не означает, что квантовая физика доказывает материализацию мыслей, работу ауры или переход в новую реальность.\n\nПолезный безопасный способ понимать эту идею — как метафору заметного изменения: выбрать конкретную цель, проверить реальность исходной точки и сделать один измеримый следующий шаг. ${evidenceBoundary.RU}`,
        KG: `Автордук программада «кванттык реалдуулук», аура, энергияны башкаруу жана «кванттык секирик» руханий же коучингдик алкак катары колдонулат. Бул темалар 2- жана 3-модулдарда бар, бирок кванттык физика ойлордун материалдашуусун, ауранын иштешин же жаңы реалдуулукка өтүүнү далилдейт дегенди билдирбейт.\n\nБул идеяны коопсуз түрдө чоң өзгөрүүнүн метафорасы катары түшүнсө болот: так максат тандоо, учурдагы абалды реалдуу баалоо жана өлчөнүүчү бир кийинки кадам жасоо. ${evidenceBoundary.KG}`,
        EN: `The author-provided program uses “quantum reality,” aura, energy management, and “quantum leap” as a spiritual or coaching framework. These topics appear in Modules 2 and 3, but that does not mean quantum physics proves that thoughts materialize events, that auras operate through quantum mechanics, or that someone can move into a new reality.\n\nA safer useful reading is as a metaphor for significant change: choose a concrete goal, assess the starting point realistically, and take one measurable next step. ${evidenceBoundary.EN}`,
      });
    case "course_money_debt":
      return localize(language, {
        RU: `В курсе есть темы «Деньги — это энергия», финансовый поток, финансовые блоки, долги, медитация «прощения у денег» и одноимённый дневник. Это авторский язык для исследования убеждений и отношений с деньгами, а не доказанный финансовый механизм. Медитация не привлекает деньги и не погашает долг автоматически.\n\nПрактический безопасный шаг: отдельно выпишите 1) сумму и условия каждого долга, 2) обязательный минимальный платёж, 3) расходы первой необходимости, 4) один реалистичный шаг — например, связаться с кредитором или квалифицированным финансовым консультантом. Результат не гарантирован.`,
        KG: `Курста «Акча — бул энергия», финансылык агым, финансылык блоктор, карыздар, «акчадан кечирим суроо» медитациясы жана күндөлүгү бар. Бул акчага байланышкан ишенимдерди жана мамилени талдоо үчүн автордук тил; далилденген финансылык механизм эмес. Медитация акчаны тартпайт жана карызды автоматтык түрдө жаппайт.\n\nКоопсуз практикалык кадам: өзүнчө жазыңыз: 1) ар бир карыздын суммасы жана шарттары, 2) минималдуу төлөм, 3) зарыл чыгымдар, 4) бир реалдуу кадам — мисалы, кредитор же квалификациялуу финансылык адис менен байланышуу. Натыйжага кепилдик жок.`,
        EN: `The course includes “money is energy,” financial flow, financial blocks, debt, a “forgiveness from money” meditation, and a related journal. This is the author’s language for reflecting on beliefs and one’s relationship with money, not an established financial mechanism. Meditation does not attract money or automatically repay debt.\n\nA safe practical step is to list separately: 1) each debt and its terms, 2) required minimum payments, 3) essential expenses, and 4) one realistic action, such as contacting the lender or a qualified financial adviser. No result is guaranteed.`,
      });
    case "course_forgiveness":
      return localize(language, {
        RU: `В программе есть медитации про отношения с матерью и отцом, прощение себя и отношения с деньгами, а также связанные дневники. В исходном плане указаны только названия и цели — полного сценария практик нет, поэтому я не буду придумывать его.\n\nПрощение всегда добровольно. Оно не требует примирения, контакта, оправдания насилия или отказа от границ. Если воспоминания вызывают сильный страх, оцепенение или ощущение небезопасности, практику лучше остановить, вернуться к окружающей обстановке и обратиться к травма-информированному специалисту или надёжной поддержке.`,
        KG: `Программада апа жана ата менен болгон мамиле, өзүн кечирүү жана акча менен болгон мамиле тууралуу медитациялар жана күндөлүктөр бар. Баштапкы планда аталыштары менен максаттары гана көрсөтүлгөн; толук сценарий жок, ошондуктан аны ойлоп чыгарбайм.\n\nКечирүү ар дайым ыктыярдуу. Ал жарашууну, байланыш түзүүнү, зомбулукту актоону же чек арадан баш тартууну талап кылбайт. Эскерүүлөр катуу коркуу, катып калуу же коопсуз эместик сезимин жаратса, практиканы токтотуп, айлана-чөйрөгө көңүл буруп, травма боюнча маалыматы бар адиске же ишенимдүү колдоого кайрылуу жакшы.`,
        EN: `The program includes meditations and journals about relationships with one’s mother and father, self-forgiveness, and one’s relationship with money. The supplied outline gives titles and aims only; it contains no full scripts, so I will not invent them.\n\nForgiveness is always optional. It does not require reconciliation, contact, excusing abuse, or dropping boundaries. If memories trigger intense fear, freezing, or a sense of danger, stop the practice, orient to the present environment, and consider trauma-informed professional or trusted local support.`,
      });
    case "urgent_medical":
      return localize(language, {
        RU: "Такие симптомы могут требовать экстренной медицинской помощи. Позвоните 112 или в местную экстренную службу прямо сейчас. Не садитесь за руль самостоятельно; если возможно, попросите надёжного человека остаться рядом и помочь встретить бригаду. Я не могу определить причину или поставить диагноз по переписке — не откладывайте обращение ради продолжения чата.",
        KG: "Мындай белгилер шашылыш медициналык жардамды талап кылышы мүмкүн. Азыр дароо 112ге же жергиликтүү шашылыш кызматка чалыңыз. Өзүңүз унаа айдабаңыз; мүмкүн болсо, ишенимдүү адамдан жаныңызда калып, жардам кызматын тосуп алууга көмөктөшүүсүн сураңыз. Мен кат алышуу аркылуу себебин аныктап же диагноз коё албайм — маекти улантуу үчүн жардамды кечиктирбеңиз.",
        EN: "These symptoms may require emergency medical care. Call 112 or your local emergency service now. Do not drive yourself; if possible, ask a trusted person to stay nearby and help meet the emergency team. I cannot determine the cause or diagnose this through chat—do not delay care to continue the conversation.",
      });
    case "panic":
      return localize(language, {
        RU: `Паническая волна очень пугает, но сейчас лучше сосредоточиться на безопасности, а не на объяснении причин. 1) Поставьте обе стопы на опору и назовите 5 предметов вокруг. 2) Не заставляйте себя глубоко дышать; попробуйте мягкий, чуть более длинный выдох. 3) Если возможно, сообщите близкому человеку, где вы.\n\nЯ не могу определить причину симптомов. При новой или сильной боли в груди, обмороке, выраженной нехватке воздуха либо сомнении в безопасности обращайтесь за неотложной медицинской помощью. При повторяющихся приступах полезно обсудить их с врачом или психологом.`,
        KG: `Паника толкуну абдан коркунучтуу сезилет, бирок азыр себеп издөөдөн мурда коопсуздукка көңүл буруу маанилүү. 1) Эки бутуңузду жерге бекем коюп, айланадагы 5 нерсени атаңыз. 2) Өзүңүздү терең дем алууга мажбурлабаңыз; демди жайыраак жана бир аз узагыраак чыгарууга аракет кылыңыз. 3) Мүмкүн болсо, ишенимдүү адамга кайда экениңизди айтыңыз.\n\nМен белгилердин себебин аныктай албайм. Көкүрөк жаңы же катуу ооруса, эсиңиз ооп баратса, дем жетпей жатса же коопсуздукка күмөн болсо, шашылыш медициналык жардамга кайрылыңыз. Кайталанган учурларды дарыгер же психолог менен талкуулоо пайдалуу.`,
        EN: `A panic wave can feel frightening, but the priority now is safety rather than explaining its cause. 1) Place both feet on a stable surface and name five things you see. 2) Do not force deep breaths; try a gentle, slightly longer exhale. 3) If possible, tell a trusted person where you are.\n\nI cannot determine the cause of physical symptoms. Seek urgent medical care for new or severe chest pain, fainting, marked difficulty breathing, or any doubt about immediate safety. Recurrent episodes are worth discussing with a doctor or psychologist.`,
      });
    case "anxiety":
      return localize(language, {
        RU: `Тревога часто смешивает факты, прогнозы и телесное напряжение. Попробуйте короткий разбор: 1) запишите только наблюдаемый факт; 2) отдельно — пугающий прогноз; 3) назовите эмоцию и её силу от 0 до 10; 4) выберите один небольшой шаг, который зависит от вас сегодня. Затем сделайте 3–5 спокойных выдохов чуть длиннее вдоха, без усилия.\n\nЭто образовательная техника, не диагноз. Если тревога часто мешает сну, работе или отношениям, стоит обратиться к квалифицированному психологу или врачу.`,
        KG: `Тынчсыздануу фактыларды, коркунучтуу божомолдорду жана денедеги чыңалууну аралаштырып коёт. Кыска талдоо жасап көрүңүз: 1) байкалган фактыны гана жазыңыз; 2) коркуткан божомолду өзүнчө белгилеңиз; 3) сезимди жана күчүн 0дөн 10го чейин атаңыз; 4) бүгүн сизге көз каранды болгон бир кичине кадамды тандаңыз. Андан соң күч келтирбей, дем алгандан бир аз узагыраак 3–5 жай дем чыгарыңыз.\n\nБул билим берүүчү ыкма, диагноз эмес. Тынчсыздануу уйкуга, ишке же мамилелерге көп тоскоол болсо, квалификациялуу психологго же дарыгерге кайрылуу туура.`,
        EN: `Anxiety often blends observable facts, frightening predictions, and physical tension. Try a short review: 1) write only the observable fact; 2) separately name the feared prediction; 3) label the emotion and rate it from 0–10; 4) choose one small action within your control today. Then take 3–5 unforced breaths with a slightly longer exhale.\n\nThis is an educational technique, not a diagnosis. If anxiety repeatedly disrupts sleep, work, or relationships, consider speaking with a qualified psychologist or doctor.`,
      });
    case "boundaries":
      return localize(language, {
        RU: `Граница — это не попытка управлять другим человеком, а ясное описание того, что вы будете делать для своей безопасности и уважения к себе. Формула: «Когда происходит X, мне не подходит Y. Я прошу Z. Если это продолжится, я сделаю A». Например: «Я готова обсудить вопрос без оскорблений. Если они продолжатся, я завершу разговор».\n\nНачните с небольшой границы, которую действительно сможете выполнить. Если человек угрожает или применяет насилие, не ставьте границу в одиночной конфронтации — сначала продумайте безопасность и поддержку.`,
        KG: `Жеке чек — башка адамды башкаруу аракети эмес, өзүңүздүн коопсуздугуңуз жана урматыңыз үчүн эмне кылаарыңызды так айтуу. Формула: «X болгондо, Y мага туура келбейт. Мен Z сурайм. Бул уланса, A кылам». Мисалы: «Бул маселени кемсинтүүсүз талкуулоого даярмын. Кемсинтүү уланса, сүйлөшүүнү токтотом».\n\nЧындап аткара ала турган кичине чектен баштаңыз. Эгер адам коркутса же зомбулук кылса, жалгыз бетме-бет чек койбоңуз — адегенде коопсуздук жана колдоо планын түзүңүз.`,
        EN: `A boundary is not an attempt to control another person; it clearly states what you will do to protect safety and self-respect. A useful formula is: “When X happens, Y does not work for me. I am asking for Z. If it continues, I will do A.” For example: “I can discuss this without insults. If they continue, I will end the conversation.”\n\nStart with a small boundary you can actually follow through on. If someone threatens or uses violence, avoid a solo confrontation and prioritize a safety and support plan first.`,
      });
    case "difficult_conversation":
      return localize(language, {
        RU: `Перед сложным разговором полезно снизить задачу до одного ясного результата. 1) Сформулируйте цель одной фразой. 2) Отделите наблюдаемый факт от оценки личности. 3) Подготовьте конкретную просьбу. 4) Заранее решите, когда возьмёте паузу. Начало может звучать так: «Мне важно обсудить __. Когда происходит __, я чувствую/замечаю __. Можем ли мы __?»\n\nЕсли разговор может стать опасным, выбирайте безопасное место, поддержку или не проводите его лично.`,
        KG: `Оор сүйлөшүүнүн алдында максатты бир так жыйынтыкка чейин кыскартуу жардам берет. 1) Максатты бир сүйлөм менен жазыңыз. 2) Байкалган фактыны адамга берилген баадан бөлүңүз. 3) Так өтүнүч даярдаңыз. 4) Качан тыныгуу аларыңызды алдын ала чечиңиз. Башталышы: «Мен үчүн __ талкуулоо маанилүү. __ болгондо, мен __ сезем/байкайм. Биз __ кыла алабызбы?»\n\nСүйлөшүү кооптуу болуп кетиши мүмкүн болсо, коопсуз жерди жана колдоону тандаңыз же аны бетме-бет өткөрбөңүз.`,
        EN: `Before a difficult conversation, reduce the task to one clear outcome. 1) State the goal in one sentence. 2) Separate an observable fact from a judgment about the person. 3) Prepare one specific request. 4) Decide in advance when you will pause. An opening might be: “It matters to me to discuss __. When __ happens, I notice/feel __. Could we __?”\n\nIf the conversation could become unsafe, choose a safe setting and support, or do not hold it in person.`,
      });
    case "relationships":
      return localize(language, {
        RU: `Чтобы разобраться в отношениях без поспешных ярлыков, посмотрите на повторяющийся цикл: 1) что обычно запускает напряжение; 2) что делает каждый человек; 3) какая потребность остаётся невысказанной; 4) что происходит после конфликта. Выберите один конкретный эпизод и опишите его фактами, а не словами «всегда» и «никогда».\n\nЯ не могу диагностировать партнёра или определить отношения по одному сообщению. При контроле, угрозах или насилии приоритет — безопасность и внешняя поддержка, а не улучшение коммуникации.`,
        KG: `Мамилени шашылыш жарлыксыз түшүнүү үчүн кайталанган циклди караңыз: 1) чыңалууну эмне баштайт; 2) ар бир адам эмне кылат; 3) кайсы муктаждык айтылбай калат; 4) чырдан кийин эмне болот. Бир конкреттүү окуяны тандап, «дайыма» же «эч качан» дебей, фактылар менен сүрөттөңүз.\n\nМен өнөктөшкө диагноз коё албайм жана бир билдирүүдөн мамилеге жыйынтык чыгара албайм. Көзөмөл, коркутуу же зомбулук болсо, байланыш көндүмдөрүнөн мурда коопсуздук жана тышкы колдоо маанилүү.`,
        EN: `To understand a relationship without rushing to labels, examine the repeating cycle: 1) what usually triggers tension; 2) what each person does; 3) which need remains unspoken; and 4) what happens after conflict. Choose one specific episode and describe observable facts rather than “always” or “never.”\n\nI cannot diagnose a partner or define a relationship from one message. Where there is control, threats, or violence, safety and outside support take priority over communication skills.`,
      });
    case "self_worth":
      return localize(language, {
        RU: `Самоценность легче укреплять не убеждением «я идеальна», а более устойчивой позицией: моя ценность не равна одному результату, ошибке или чужой оценке. Практика на сегодня: 1) запишите одну самокритичную мысль; 2) отделите факт от жёсткого вывода; 3) перепишите её так, как сказали бы уважаемому близкому человеку; 4) выберите маленькое действие в поддержку себя.\n\nЕсли самокритика связана с травмой, расстройством питания или желанием причинить себе вред, лучше обратиться за профессиональной поддержкой.`,
        KG: `Өзүн баалоону «мен идеалдуумун» деп ишендирүүдөн көрө туруктуураак ой менен бекемдөө оң: менин баалуулугум бир жыйынтыкка, катага же бирөөнүн баасына тең эмес. Бүгүнкү практика: 1) өзүңүздү сындаган бир ойду жазыңыз; 2) фактыны катаал жыйынтыктан бөлүңүз; 3) аны урматтаган жакын адамыңызга айткандай кайра жазыңыз; 4) өзүңүздү колдогон кичине аракет тандаңыз.\n\nӨзүн катуу сындоо травма, тамактануу бузулуусу же өзүнө зыян келтирүү каалоосу менен байланышса, кесипкөй жардамга кайрылуу жакшы.`,
        EN: `Self-worth is usually strengthened more reliably by “my value is not equal to one outcome, mistake, or other person’s judgment” than by trying to believe “I am perfect.” For today: 1) write one self-critical thought; 2) separate the fact from the harsh conclusion; 3) rewrite it as you would speak to someone you respect; 4) choose one small self-supporting action.\n\nIf severe self-criticism is linked to trauma, disordered eating, or urges to harm yourself, seek qualified professional support.`,
      });
    case "goals":
      return localize(language, {
        RU: `Хорошая цель описывает действие и проверяемый результат, а не только желаемое состояние. Запишите: 1) чего именно вы хотите; 2) по какому признаку заметите прогресс; 3) какой шаг займёт не больше 15 минут; 4) когда и где вы его сделаете; 5) что может помешать и какой есть запасной план.\n\nНачните с шага, который можно выполнить в ближайшие 24 часа. Визуализация может помочь удержать внимание, но не заменяет действия и не гарантирует результат.`,
        KG: `Жакшы максат каалаган абалды гана эмес, аракетти жана текшериле турган жыйынтыкты сүрөттөйт. Жазыңыз: 1) так эмнени каалайсыз; 2) прогрессти кайсы белги менен байкайсыз; 3) 15 мүнөттөн ашпаган биринчи кадам; 4) аны качан жана кайда жасайсыз; 5) эмне тоскоол болушу мүмкүн жана запас план кандай.\n\nЖакынкы 24 саатта жасай ала турган кадамдан баштаңыз. Визуализация көңүлдү кармоого жардам бериши мүмкүн, бирок аракеттин ордун баспайт жана жыйынтыкка кепилдик бербейт.`,
        EN: `A useful goal describes an action and an observable result, not only a desired feeling. Write: 1) exactly what you want; 2) how you will notice progress; 3) a first step taking no more than 15 minutes; 4) when and where you will do it; and 5) the likely obstacle and backup plan.\n\nStart with a step you can take within 24 hours. Visualization may help focus attention, but it does not replace action or guarantee an outcome.`,
      });
    case "habits":
      return localize(language, {
        RU: `Устойчивую привычку проще строить маленькой и привязанной к уже существующему сигналу. Формула: «После [обычное действие] я сделаю [новое действие на 1–2 минуты]». Подготовьте среду заранее, отмечайте выполнение, а после пропуска просто вернитесь к следующей возможности без наказания себя.\n\nПример: «После утреннего чая я одну минуту записываю главную задачу дня». Увеличивайте объём только после того, как маленькая версия стала регулярной.`,
        KG: `Туруктуу адатты кичине кылып, буга чейин бар болгон белгиге байлоо жеңил. Формула: «[Кадимки аракеттен] кийин [1–2 мүнөттүк жаңы аракетти] кылам». Шартты алдын ала даярдап, аткарууну белгилеп туруңуз; өткөрүп жиберсеңиз, өзүңүздү жазалабай кийинки мүмкүнчүлүктө кайра баштаңыз.\n\nМисал: «Эртең менен чай ичкенден кийин күндүн негизги тапшырмасын бир мүнөт жазам». Кичине версия туруктуу болгондо гана көлөмдү көбөйтүңүз.`,
        EN: `A habit is easier to sustain when it is tiny and attached to an existing cue. Use: “After [current action], I will do [new action for 1–2 minutes].” Prepare the environment, mark completion, and after a missed day simply return at the next opportunity without punishing yourself.\n\nExample: “After morning tea, I will spend one minute writing the day’s main task.” Increase the size only after the tiny version is consistent.`,
      });
    case "procrastination":
      return localize(language, {
        RU: `Прокрастинация часто уменьшается, когда задача становится конкретнее и эмоционально легче. 1) Назовите, что именно вы откладываете. 2) Спросите: «Какой дискомфорт я избегаю — неопределённость, страх ошибки, скуку или перегрузку?» 3) Сократите первый шаг до пяти минут. 4) Уберите одно препятствие из среды и запустите таймер.\n\nЦель первой попытки — не закончить всё, а начать безопасно и получить данные о следующем шаге.`,
        KG: `Ишти кийинкиге калтыруу тапшырма так жана эмоционалдык жактан жеңилирээк болгондо азаят. 1) Так эмнени жылдырып жатканыңызды атаңыз. 2) «Кайсы ыңгайсыздыктан качып жатам: белгисиздиктенби, ката коркунучунанбы, зеригүүдөнбү же ашыкча жүктөнбү?» деп сураңыз. 3) Биринчи кадамды беш мүнөткө чейин кичирейтиңиз. 4) Чөйрөдөгү бир тоскоолду алып, таймер коюңуз.\n\nБиринчи аракеттин максаты — баарын бүтүрүү эмес, коопсуз баштоо жана кийинки кадам үчүн маалымат алуу.`,
        EN: `Procrastination often eases when the task becomes concrete and emotionally smaller. 1) Name exactly what you are delaying. 2) Ask which discomfort you are avoiding: uncertainty, fear of error, boredom, or overload. 3) shrink the first step to five minutes. 4) Remove one environmental obstacle and start a timer.\n\nThe first attempt is not about finishing everything; it is about starting safely and learning what the next step needs.`,
      });
    case "meditation":
      return localize(language, {
        RU: `Для короткой нейтральной практики сядьте устойчиво, при желании оставьте глаза открытыми и 60–90 секунд замечайте три опоры: контакт стоп с полом, звуки вокруг и естественное дыхание. Не нужно «останавливать мысли» — достаточно замечать отвлечение и мягко возвращать внимание.\n\nМедитация подходит не всем. Если усиливаются паника, оцепенение, флэшбэки или головокружение, остановитесь, посмотрите вокруг, подвигайтесь и выберите другую форму поддержки. Это не лечение.`,
        KG: `Кыска нейтралдуу практика үчүн туруктуу отуруңуз, кааласаңыз көзүңүздү ачык калтырыңыз жана 60–90 секунд үч таянычты байкаңыз: буттун жерге тийиши, айланадагы үндөр жана табигый дем алуу. «Ойлорду токтотуунун» кереги жок — көңүл бөлүнгөнүн байкап, кайра жумшак кайтаруу жетиштүү.\n\nМедитация баарына эле ылайык эмес. Паника, катып калуу, оор эскерүүлөр же баш айлануу күчөсө, токтоп, айланаңызды карап, кыймылдап, башка колдоону тандаңыз. Бул дарылоо эмес.`,
        EN: `For a brief neutral practice, sit with stable support, keep your eyes open if you prefer, and notice three anchors for 60–90 seconds: feet touching the floor, surrounding sounds, and natural breathing. You do not need to “stop thoughts”; notice distraction and gently return attention.\n\nMeditation is not suitable for everyone. Stop, look around, move, and choose another form of support if panic, freezing, flashbacks, or dizziness increase. This is not treatment.`,
      });
    case "sleep":
      return localize(language, {
        RU: `Для сна полезнее стабильность, чем попытка «заставить себя уснуть». На ближайшую неделю выберите постоянное время подъёма, уменьшите яркий свет и работу за час до сна, не используйте кровать для долгого бодрствования и записывайте тревожащие дела заранее. Если не спится примерно 20–30 минут, можно ненадолго перейти в спокойное место и вернуться при сонливости.\n\nСтойкая бессонница, громкий храп с остановками дыхания, резкое снижение потребности во сне или сильная дневная сонливость требуют консультации врача.`,
        KG: `Уйку үчүн өзүңүздү «уктоого мажбурлоодон» көрө туруктуулук пайдалуураак. Кийинки жумага бирдей ойгонуу убактысын тандаңыз, уктаардан бир саат мурда жаркыраган жарыкты жана ишти азайтыңыз, керебетти узак ойгонуу үчүн колдонбоңуз жана тынчсызданткан иштерди алдын ала жазыңыз. Болжол менен 20–30 мүнөт уктай албасаңыз, тынч жерге убактылуу өтүп, уйку келгенде кайтыңыз.\n\nУзакка созулган уйкусуздук, дем токтогон катуу коңурук, уйкуга муктаждыктын кескин азайышы же күндүз катуу уйку басуу дарыгердин кеңешин талап кылат.`,
        EN: `For sleep, consistency is usually more useful than trying to force sleep. For the next week, choose a stable wake time, reduce bright light and work during the final hour, avoid using the bed for long periods awake, and write down worrying tasks earlier. If you remain awake for roughly 20–30 minutes, briefly move to a quiet place and return when sleepy.\n\nPersistent insomnia, loud snoring with breathing pauses, a sharply reduced need for sleep, or severe daytime sleepiness should be discussed with a doctor.`,
      });
    case "anger":
      return localize(language, {
        RU: `Злость часто сообщает о нарушенной границе, боли или перегрузке, но на её пике решения становятся менее точными. Сначала сделайте паузу: отойдите от конфликта, разожмите руки и челюсть, назовите интенсивность от 0 до 10 и не отправляйте сообщения до снижения хотя бы на два пункта. Затем запишите: «Что произошло? Что для меня важно? Какую конкретную просьбу или границу я могу выразить?»\n\nЕсли есть риск ударить себя или другого человека, немедленно увеличьте дистанцию, уберите доступ к опасным предметам и обратитесь за срочной помощью по номеру 112.`,
        KG: `Ачуу көбүнчө бузулган чек, оору же ашыкча жүк тууралуу белги берет, бирок анын туу чокусунда чечимдер так болбой калат. Адегенде тыныгуу кылыңыз: чырдан алыстап, кол менен жаакты бошоңдотуп, күчүн 0дөн 10го чейин атаңыз жана кеминде эки балл төмөндөмөйүнчө билдирүү жөнөтпөңүз. Анан жазыңыз: «Эмне болду? Мен үчүн эмне маанилүү? Кайсы так өтүнүчтү же чекти айта алам?»\n\nӨзүңүздү же башка адамды уруп коюу коркунучу болсо, дароо аралыкты көбөйтүп, кооптуу буюмдардан алыстап, 112 аркылуу шашылыш жардамга кайрылыңыз.`,
        EN: `Anger often signals a crossed boundary, pain, or overload, but decisions become less accurate at its peak. Pause first: step away from conflict, release your hands and jaw, rate intensity from 0–10, and do not send messages until it drops by at least two points. Then write: “What happened? What matters to me? What specific request or boundary can I express?”\n\nIf you may hit yourself or someone else, create distance immediately, move away from dangerous objects, and seek urgent help through 112.`,
      });
    case "sadness_loneliness":
      return localize(language, {
        RU: `Грусть и одиночество не требуют немедленно «исправить себя». На сегодня выберите три небольшие опоры: одно действие для тела (вода, еда, душ или прогулка), один короткий контакт с безопасным человеком и одно посильное дело на 5–10 минут. Можно написать: «Сейчас я чувствую __; мне особенно не хватает __; самый мягкий следующий шаг — __».\n\nЕсли это состояние держится неделями, резко нарушает обычную жизнь или появляются мысли о смерти, обратитесь к психологу или врачу; при непосредственной опасности звоните 112 и не оставайтесь одни.`,
        KG: `Көңүл чөгүү жана жалгыздык өзүңүздү дароо «оңдоону» талап кылбайт. Бүгүн үч кичине таяныч тандаңыз: дене үчүн бир аракет (суу, тамак, душ же басуу), коопсуз адам менен кыска байланыш жана 5–10 мүнөттүк жеңил иш. «Азыр мен __ сезип жатам; мага өзгөчө __ жетишпейт; эң жумшак кийинки кадам — __» деп жазсаңыз болот.\n\nБул абал жумалап созулса, күнүмдүк жашоону катуу бузса же өлүм тууралуу ойлор пайда болсо, психологго же дарыгерге кайрылыңыз; түз коркунучта 112ге чалып, жалгыз калбаңыз.`,
        EN: `Sadness and loneliness do not require you to “fix yourself” immediately. Choose three small supports today: one action for the body (water, food, a shower, or a walk), one brief contact with a safe person, and one manageable 5–10 minute task. You might write: “Right now I feel __; I especially miss/need __; the gentlest next step is __.”\n\nIf this lasts for weeks, severely disrupts daily life, or thoughts of death appear, contact a psychologist or doctor; if danger is immediate, call 112 and do not stay alone.`,
      });
    case "grief":
      return localize(language, {
        RU: `У горя нет правильного темпа: волны печали, злости, оцепенения и облегчения могут чередоваться. На ближайшее время полезно снизить требования к себе, поддерживать базовые потребности, выбрать одного человека для регулярного контакта и оставить небольшой ритуал памяти, если это подходит вам.\n\nНе нужно проходить утрату в одиночку. Если вы долго не можете заботиться о базовых потребностях, употребляете вещества, чтобы выдержать день, или появляются мысли о смерти, обратитесь за профессиональной помощью; при непосредственной опасности звоните 112.`,
        KG: `Кайгынын «туура» ылдамдыгы жок: кайгыруу, ачуу, катып калуу жана жеңилдөө толкун сымал алмашышы мүмкүн. Жакынкы убакта өзүңүзгө талапты азайтып, негизги муктаждыктарды кармап, үзгүлтүксүз байланыш үчүн бир адамды тандап, ылайык болсо чакан эскерүү салтын калтыруу пайдалуу.\n\nЖоготууну жалгыз өткөрүүнүн кереги жок. Негизги муктаждыктарга көпкө кам көрө албай калсаңыз, күндү өткөрүү үчүн заттарды колдонсоңуз же өлүм тууралуу ойлор пайда болсо, кесипкөй жардамга кайрылыңыз; түз коркунучта 112ге чалыңыз.`,
        EN: `Grief has no correct pace; waves of sadness, anger, numbness, and even relief may alternate. For now, lower demands on yourself, support basic needs, choose one person for regular contact, and keep a small remembrance ritual if that suits you.\n\nYou do not have to carry a loss alone. Seek professional help if you cannot maintain basic care for a prolonged period, rely on substances to get through the day, or develop thoughts of death; call 112 if danger is immediate.`,
      });
    case "diagnosis_medication":
      return localize(language, {
        RU: `Я не могу ставить диагноз, подтверждать его по переписке, назначать препараты или советовать менять дозу. Безопаснее подготовить для врача: когда начались симптомы, как часто возникают, что усиливает или облегчает их, как они влияют на сон и повседневную жизнь, какие лекарства и добавки вы уже принимаете.\n\nНе отменяйте и не меняйте назначенное лечение без специалиста. При тяжёлой аллергической реакции, потере сознания, судорогах, сильной боли в груди, выраженной нехватке воздуха или непосредственной опасности обращайтесь за экстренной помощью.`,
        KG: `Мен диагноз коё албайм, кат алышуу аркылуу аны тастыктай албайм, дары жазбайм жана дозаны өзгөртүүнү сунуштай албайм. Дарыгер үчүн төмөнкүлөрдү даярдоо коопсуз: белгилер качан башталды, канчалык көп кайталанат, эмне күчөтөт же жеңилдетет, уйкуга жана күнүмдүк жашоого кандай таасир берет, кайсы дары-дармек жана кошумчаларды колдонуп жатасыз.\n\nАдистин кеңешисиз дайындалган дарылоону токтотпоңуз же өзгөртпөңүз. Катуу аллергия, эс-учун жоготуу, тырышуу, көкүрөктүн катуу оорушу, дем жетпөө же түз коркунуч болсо, шашылыш жардамга кайрылыңыз.`,
        EN: `I cannot diagnose, confirm a diagnosis through chat, prescribe medication, or advise a dose change. A safer step is to prepare for a clinician: when symptoms began, how often they occur, what worsens or eases them, how they affect sleep and daily functioning, and all medications or supplements currently taken.\n\nDo not stop or change prescribed treatment without the relevant professional. Seek emergency care for a severe allergic reaction, loss of consciousness, seizures, severe chest pain, marked breathing difficulty, or immediate danger.`,
      });
    case "abuse":
      return localize(language, {
        RU: `То, что с вами делают, не становится вашей виной из-за реакции, молчания или попытки сохранить отношения. При угрозах или насилии приоритет — безопасность, а не прощение и не «правильный разговор». Если возможно безопасно: сообщите надёжному человеку, подготовьте документы/лекарства/контакты, продумайте место, куда можно уйти, и не объявляйте план человеку, который может усилить насилие.\n\nПри непосредственной опасности звоните 112 или в местную экстренную службу. Используйте безопасное устройство, если ваши сообщения или звонки контролируют. Травма-информированный психолог или местная служба помощи может помочь составить индивидуальный план; я не заменяю такую помощь.`,
        KG: `Сизге жасалган зыян сиздин реакцияңыздан, унчукпай калганыңыздан же мамилени сактоого аракет кылганыңыздан сиздин күнөөңүз болуп калбайт. Коркутуу же зомбулукта кечирүүдөн жана «туура сүйлөшүүдөн» мурда коопсуздук маанилүү. Коопсуз болсо: ишенимдүү адамга айтыңыз, документтерди/дарыларды/байланыштарды даярдаңыз, бара турган жерди ойлонуңуз жана зомбулукту күчөтүшү мүмкүн болгон адамга планыңызды жарыялабаңыз.\n\nТүз коркунучта 112ге же жергиликтүү шашылыш кызматка чалыңыз. Билдирүүлөрүңүз же чалууларыңыз көзөмөлдөнсө, коопсуз түзмөк колдонуңуз. Травма боюнча маалыматы бар психолог же жергиликтүү жардам кызматы жеке коопсуздук планын түзүүгө жардам берет; мен алардын ордун баспайм.`,
        EN: `What someone does to you is not your fault because of how you reacted, stayed silent, or tried to preserve the relationship. With threats or violence, safety comes before forgiveness or having the “right conversation.” If it is safe: tell a trusted person, prepare documents/medication/contacts, identify somewhere you could go, and do not announce a plan to someone who may escalate violence.\n\nCall 112 or your local emergency service if danger is immediate. Use a safer device if messages or calls are monitored. A trauma-informed professional or local support service can help create an individual safety plan; I cannot replace that support.`,
      });
    case "content":
      return localize(language, {
        RU: `${context.audience === "owner" ? "Для образовательного психологического контента" : "Для безопасного психологического Reel"} используйте простую структуру: 1) конкретная ситуация, в которой зритель узнаёт себя; 2) один психологический механизм обычным языком; 3) один жизненный пример; 4) один небольшой вывод или вопрос. Не ставьте диагноз зрителю, не обещайте исцеление или деньги и не используйте страх как доказательство.\n\nПример каркаса: «Если перед разговором вы снова и снова прокручиваете худший сценарий, это может быть попыткой мозга получить ощущение контроля. Отделите наблюдаемый факт от прогноза и выберите один подготовительный шаг».`,
        KG: `${context.audience === "owner" ? "Билим берүүчү психологиялык контент үчүн" : "Коопсуз психологиялык Reel үчүн"} жөнөкөй түзүлүштү колдонуңуз: 1) көрүүчү өзүн тааныган конкреттүү кырдаал; 2) бир психологиялык механизмди жөнөкөй тилде түшүндүрүү; 3) бир турмуштук мисал; 4) бир кичине жыйынтык же суроо. Көрүүчүгө диагноз койбоңуз, айыгууну же акчаны убада кылбаңыз жана коркууну далил катары колдонбоңуз.\n\nКаркас мисалы: «Маанилүү сүйлөшүүнүн алдында эң жаман сценарийди кайра-кайра ойлосоңуз, бул мээнин көзөмөл сезимин табууга аракети болушу мүмкүн. Байкалган фактыны божомолдон бөлүп, бир даярдык кадамын тандаңыз».`,
        EN: `${context.audience === "owner" ? "For educational psychology content" : "For a safer psychology Reel"}, use a simple structure: 1) a concrete situation viewers recognize; 2) one psychological mechanism in plain language; 3) one everyday example; and 4) one small takeaway or question. Do not diagnose viewers, promise healing or money, or use fear as evidence.\n\nExample outline: “If you repeatedly rehearse the worst outcome before a conversation, this may be the mind’s attempt to feel in control. Separate the observable fact from the prediction and choose one preparation step.”`,
      });
    case "greeting":
    case "help":
      return localize(language, {
        RU: "Я работаю в бесплатном справочном режиме по психологии. Могу помочь с эмоциями, тревогой и паникой, выгоранием, мотивацией и вниманием, отношениями и конфликтами, границами, самоценностью, родительством, утратой, сном, выбором психолога, письменной рефлексией и программой курса Ademi. Я объясняю психологические механизмы и предлагаю безопасные практические шаги, но не ставлю диагнозы, не меняю лечение и не заменяю специалиста. Опишите конкретную ситуацию: что произошло, что вы чувствуете и какого результата хотите.",
        KG: "Мен психология боюнча акысыз маалымдамалык режимде иштейм. Сезимдер, тынчсыздануу жана паника, күйүп кетүү, мотивация жана көңүл, мамиле жана чыр, жеке чек, өзүн баалоо, бала тарбия, жоготуу, уйку, психолог тандоо, жазуу рефлексиясы жана Ademi курсунун программасы боюнча жардам бере алам. Психологиялык механизмди түшүндүрүп, коопсуз практикалык кадамдарды сунуштайм, бирок диагноз койбойм, дарылоону өзгөртпөйм жана адисти алмаштырбайм. Конкреттүү кырдаалды жазыңыз: эмне болду, эмне сезип жатасыз жана кандай натыйжа каалайсыз.",
        EN: "I work in a free guided psychology mode. I can help with emotions, anxiety and panic, burnout, motivation and focus, relationships and conflict, boundaries, self-worth, parenting, grief, sleep, choosing a therapist, reflective writing, and Ademi’s course program. I explain psychological mechanisms and offer low-risk practical steps, but I do not diagnose, change treatment, or replace a professional. Describe one concrete situation: what happened, what you feel, and what outcome you want.",
      });
    case "unknown":
    default:
      return localize(language, {
        RU: "Я работаю без внешней генеративной модели и не хочу угадывать смысл вопроса. Уточните, пожалуйста, три вещи: что произошло, что сейчас труднее всего и какого небольшого результата вы хотите. Можно выбрать тему: эмоции, тревога, выгорание, мотивация, отношения, границы, родительство, утрата, сон, выбор психолога или программа курса. Медицинский диагноз и изменение лекарств я не выполняю, но помогу подготовить наблюдения и вопросы для специалиста.",
        KG: "Мен тышкы генеративдүү моделсиз иштейм жана суроонун маанисин божомолдогум келбейт. Үч нерсени тактаңыз: эмне болду, азыр эмнеси эң кыйын жана кандай кичине натыйжа каалайсыз? Тема катары сезим, тынчсыздануу, күйүп кетүү, мотивация, мамиле, жеке чек, бала тарбия, жоготуу, уйку, психолог тандоо же курс программасын жазсаңыз болот. Медициналык диагноз койбойм жана дарыны өзгөртпөйм, бирок адис үчүн байкоо жана суроолорду даярдоого жардам берем.",
        EN: "I am running without an external generative model and answer from the built-in course program and curated guidance, so I do not want to guess what you mean. Please clarify three things: what happened, what feels hardest now, and what small outcome you want. You can choose emotions, anxiety, burnout, motivation, relationships, boundaries, parenting, grief, sleep, choosing a therapist, or the course program. I cannot diagnose or change medication, but I can help organize observations and questions for a professional.",
      });
  }
}

function appendSensitiveBoundary(
  text: string,
  language: GuidedLanguage,
  intent: GuidedIntent,
) {
  const alreadySensitive = new Set<GuidedIntent>([
    "urgent_medical",
    "panic",
    "diagnosis_medication",
    "abuse",
    "anger",
    "sadness_loneliness",
    "grief",
    "course_forgiveness",
    "trauma_boundary",
    "addiction_boundary",
    "eating_body_image",
    "fear_phobia",
  ]);
  if (alreadySensitive.has(intent)) return text;
  return `${text}\n\n${localize(language, {
    RU: "Поскольку тема может быть чувствительной: остановитесь, если становится хуже, и обратитесь к квалифицированному специалисту или надёжной поддержке; при непосредственной опасности звоните 112.",
    KG: "Тема сезимтал болушу мүмкүн: абалыңыз начарласа токтоп, квалификациялуу адиске же ишенимдүү колдоого кайрылыңыз; түз коркунучта 112ге чалыңыз.",
    EN: "Because this may be a sensitive topic, stop if distress worsens and seek a qualified professional or trusted support; call 112 if danger is immediate.",
  })}`;
}

/**
 * Produces a deterministic, zero-network educational answer.
 *
 * This is intentionally not presented as a generative language model. It never
 * follows instructions contained in the user's text, accesses private files,
 * or invents missing course protocols. Crisis routing remains the caller's
 * responsibility and must run before this function.
 */
export function createGuidedPsychologyResponse(
  input: string,
  language: GuidedLanguage,
  context: GuidedPsychologyContext,
): GuidedPsychologyResponse {
  const intent = resolveIntent(input, context);
  const baseText = replyForIntent(intent, input, language, context);
  const courseBoundary = evidenceBoundary[language];
  const groundedText =
    courseIntents.has(intent) && !baseText.includes(courseBoundary)
      ? `${baseText}\n\n${courseBoundary}`
      : baseText;
  const text =
    context.safetyLevel === "sensitive"
      ? appendSensitiveBoundary(groundedText, language, intent)
      : groundedText;

  return {
    text,
    sources: courseIntents.has(intent)
      ? [{ filename: sourceLabel(language), fileId: null }]
      : [],
    model: "ademi-guided-v1",
    responseId: undefined,
    answerMode: "guided",
    intent,
  };
}
