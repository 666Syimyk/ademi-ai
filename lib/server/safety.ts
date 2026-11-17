export type Language = "RU" | "KG" | "EN";
export type SafetyAssessment = {
  level: "standard" | "sensitive" | "crisis";
  category: string | null;
};

const crisisPatterns = [
  /хочу\s+(умереть|покончить с собой|убить себя)/i,
  /не\s+хочу\s+жить/i,
  /я\s+(?:(?:прямо\s+)?сейчас\s+|сегодня\s+)?(?:застрелюсь|повешусь|утоплюсь|выпрыгну\s+из\s+окна|покончу\s+с\s+собой)/i,
  /(лучше|хочу)\s+(исчезнуть|не проснуться|умереть)(?:\s|[.!?,]|$)/i,
  /(планирую|собираюсь|решил[а]?)\s+.{0,24}(повес|прыг|вскры|отрав|умер|убить себя)/i,
  /нет\s+(смысла|причины)\s+жить|исчезн(у|уть)\s+навсегда|сделать\s+с\s+собой/i,
  /не\s+вижу\s+смысла\s+(?:жить|продолжать)|всем\s+будет\s+лучше\s+без\s+меня|хочу\s+(?:закончить|прекратить)\s+вс[её]/i,
  /повеситься|вскрыть\s+вены|передоз|выпить\s+все\s+таблетки/i,
  /(?:я\s+)?(?:уже\s+)?выпил[аи]?\s+вс[её](?:\s+свои)?\s+таблетки/i,
  /самоповреж|режу\s+себя|порезал[а]?\s+себя|наношу\s+себе\s+порез|обжигаю\s+себя|хочу\s+обжечь\s+себя/i,
  /суицид|самоубийств/i,
  /өзүмдү\s+өлтүр|өлгүм\s+келет|жашагым\s+келбейт|жок\s+болгум\s+келет|жашоонун\s+мааниси\s+жок|менсиз\s+баарына\s+жакшы|баарын\s+бүтүргүм\s+келет|өзүмө\s+зыян|өзүмдү\s+кесип|өзүмө\s+жаракат|өзүмдү\s+өрттө|асылып|суицид/i,
  /өз\s+жанымды\s+кыям|жанымды\s+кыюуга|таблеткалар(?:дын)?\s+баарын\s+ичтим/i,
  /kill\s+myself|end\s+(?:my\s+life|it\s+all)|want\s+to\s+die|better\s+off\s+dead|everyone\s+(?:would\s+be|is)\s+better\s+without\s+me|can(?:not|'t)\s+go\s+on|disappear\s+forever|not\s+wake\s+up|no\s+(reason|point)\s+to\s+live|hurt\s+myself|overdos|hang\s+myself|suicid/i,
  /self[- ]harm|cut(?:ting)?\s+myself|cut\s+myself|burn(?:ing)?\s+myself|want\s+to\s+burn\s+myself/i,
  /(?:i\s+)?(?:just\s+)?(?:took|have\s+taken|swallowed)\s+all\s+(?:of\s+)?(?:my\s+)?pills/i,
  /(?:хочу\s+)?убить\s+(?:его|её|их|кого-то)|өлтүргүм\s+келет|өлтүрөм|(?:want\s+to\s+)?kill\s+(?:him|her|them|someone)/i,
  /(?:я\s+)?(?:собираюсь|планирую|решил[аи]?|намерен[а]?|хочу)\s+.{0,32}(?:застрел|выстрел.{0,8}себ|порез.{0,8}вен|причинить\s+себе\s+вред|убить\s+себя)/i,
  /я\s+(?:убью|застрелю|зарежу)\s+(?:его|её|их|кого[- ]?то)|(?:собираюсь|планирую|решил[аи]?|намерен[а]?)\s+.{0,24}(?:убить|застрелить|зарезать)\s+(?:его|её|их|кого[- ]?то)/i,
  /shoot\s+myself|cut\s+(?:my\s+)?wrists?|slit\s+(?:my\s+)?wrists?|take\s+all\s+(?:my\s+)?pills|jump\s+(?:off|from)\s+(?:a\s+)?(?:roof|bridge|building)/i,
  /(?:i(?:'m|\s+am)?\s+)?(?:will|am\s+going\s+to|plan(?:ning)?\s+to|intend\s+to|want\s+to)\s+.{0,24}(?:kill|murder|shoot|stab|poison)\s+(?:him|her|them|someone|myself)/i,
  /i(?:'m|\s+am)\s+(?:going\s+to|planning\s+to|intending\s+to)\s+.{0,24}(?:kill|murder|shoot|stab|poison)\s+(?:him|her|them|someone|myself)|i(?:'ll|\s+will)\s+.{0,24}(?:kill|murder|shoot|stab|poison)\s+(?:him|her|them|someone|myself)/i,
  /\bi\s+(?:will|am\s+going\s+to|plan(?:ning)?\s+to|intend(?:ing)?\s+to|want\s+to)\s+.{0,24}(?:kill(?!\s+(?:time|the\s+process|a\s+process))|murder|shoot(?!\s+(?:photos?|videos?|a\s+film))|stab|poison)\b|\bi(?:'m|'ll)\s+(?:(?:going|planning|intending)\s+to\s+)?.{0,24}(?:kill(?!\s+(?:time|the\s+process|a\s+process))|murder|shoot(?!\s+(?:photos?|videos?|a\s+film))|stab|poison)\b/i,
  /я\s+(?:убью|застрелю|зарежу|отравлю|взорву)(?:\s|[.!?,]|$)|(?:(?:я\s+)?хочу|собираюсь|планирую|решил[аи]?|намерен[а]?)\s+.{0,24}(?:убить|застрелить|зарезать|отравить|взорвать)(?:\s|[.!?,]|$)/i,
  /(?:(?:я\s+)?(?:хочу|собираюсь|планирую)\s+|я\s+(?:могу|боюсь,?\s+что(?:\s+я)?)\s+).{0,20}(?:ударить|избить|напасть\s+на|причин.{0,10}вред)(?:\s|[.!?,]|$)/i,
  /я\s+(?:(?:прямо\s+)?сейчас\s+|сегодня\s+)?(?:причиню\s+вред|ударю|изобью)\s+(?:реб[её]нк\p{L}*|малыш\p{L}*|муж\p{L}*|жен\p{L}*|партн[её]р\p{L}*|человек\p{L}*)/iu,
  /\bi\s+(?:want\s+to|am\s+going\s+to|plan\s+to|intend\s+to|might|may)\s+.{0,20}(?:hurt|harm|attack|hit)\s+(?:someone|somebody|you|him|her|them|people|my\s+(?:partner|husband|wife|child|kid|baby|parent|mother|father|friend|boss|teacher|student)|a\s+(?:person|child|kid))\b|\bi(?:'m|\s+am)\s+(?:afraid|scared|worried)\s+(?:that\s+)?i\s+(?:might|may|will)\s+.{0,20}(?:hurt|harm|attack|hit)\b/i,
  /\bi(?:\s+will|'ll|\s+am\s+about\s+to)\s+.{0,20}(?:hurt|harm|attack|hit)\s+(?:someone|somebody|you|him|her|them|people|my\s+(?:partner|husband|wife|child|kid|baby|parent|mother|father|friend|boss|teacher|student)|a\s+(?:person|child|kid))\b/i,
  /мен\s+.{0,28}(?:бирөөгө\s+зыян\s+келтиргим|зыян\s+келтиргим|ургум|сабагым|кол\s+салгым)\s+келет|мен\s+.{0,20}(?:бирөөгө|ага|ага карата).{0,12}(?:зыян|кол\s+сал)/i,
  /мен\s+.{0,40}өлтүрүп\s+салам/i,
  /i\s+have\s+a\s+plan.{0,32}(?:kill|murder|shoot|stab|harm).{0,20}(?:myself|someone|him|her|them)?/i,
  /(?:муж|жена|партн[её]р|парень|девушка|бывш(?:ий|ая)|он|она|кто[- ]?то)\s+.{0,32}(?:угрожа[а-яё]*|обеща[а-яё]*|сказал[а]?,?\s+что)\s+.{0,24}(?:убь|застрел|заре[зж]|причин.{0,8}вред)|мне\s+угрожа.{0,24}(?:оруж|пистолет|нож)|угрожа.{0,24}(?:убить|застрелить|зарезать)\s+меня/i,
  /(?:my\s+)?(?:husband|wife|partner|boyfriend|girlfriend|ex|he|she|someone)\s+.{0,32}(?:threaten|said|says|going\s+to|plans?\s+to)\s+.{0,24}(?:kill|murder|shoot|stab|hurt)\s+(?:me|us)|(?:stalk|threaten).{0,20}(?:gun|knife|weapon)|someone\s+is\s+going\s+to\s+(?:shoot|kill|stab)\s+me/i,
  /(?:my\s+)?(?:husband|wife|partner|boyfriend|girlfriend|ex|he|she|someone)\s+.{0,64}(?:gun|knife|weapon).{0,64}(?:not\s+(?:leav\w*|mak\w*).{0,12}alive|won't\s+leave\s+alive|die\s+tonight)/i,
  /(?:күйөөм|аялым|өнөктөшүм|жигитим|кызым|ал|бирөө)\s+.{0,32}(?:өлтүр|атып|бычакта|союп).{0,20}(?:деп\s+коркут|жатат|деди)|мени\s+.{0,20}(?:өлтүр|атып|бычакта|союп).{0,20}(?:деп\s+коркут|жатат|деди)|(?:мылтык|бычак).{0,20}коркут/i,
];

const urgentMedicalPatterns = [
  /(?:сильн|резк|нов).{0,18}бол.{0,10}груд|бол.{0,10}груд.{0,18}(?:сильн|резк|нов)|потер.{0,10}сознани|теряю\s+сознание|без\s+сознания|обморок|судорог|анафилак|сильн.{0,12}аллерг|не\s+могу\s+дышать|задыхаюсь|не\s+могу\s+бодрствовать|невозможно\s+разбудить/i,
  /көкүрө(?:к|г)\p{L}*.{0,16}(?:катуу|жаңы|кескин).{0,8}оор|(?:катуу|жаңы|кескин).{0,16}көкүрө(?:к|г)\p{L}*.{0,8}оор|эс-учун\s+жогот|эсимди.{0,8}жогот|эсим\s+ооп|эссиз|тырыш|талма|анафилак|катуу.{0,12}аллерг|дем\s+ала\s+албай|муунуп|ойгоно\s+албай|ойготууга\s+болбой/iu,
  /(?:severe|new|sudden).{0,20}chest\s+pain|chest\s+pain.{0,20}(?:severe|new|sudden)|\bfaint|loss\s+of\s+consciousness|unconscious|seizure|convulsion|anaphyla|severe\s+allergic|marked\s+trouble\s+breathing|cannot\s+breathe|can't\s+breathe|struggling\s+to\s+breathe|cannot\s+stay\s+awake|can't\s+stay\s+awake|hard\s+to\s+wake/i,
];

const sensitivePatterns = [
  /депрес|травм|насили|паничес|лекарств|антидепресс|диагноз/i,
  /травма|зомбулук|дары|диагноз|тынчсыздан/i,
  /depress|trauma|abuse|panic|medication|diagnos/i,
];

export function assessSafety(message: string): SafetyAssessment {
  if (crisisPatterns.some((pattern) => pattern.test(message)))
    return { level: "crisis", category: "immediate_risk" };
  if (urgentMedicalPatterns.some((pattern) => pattern.test(message)))
    return { level: "sensitive", category: "urgent_medical" };
  if (sensitivePatterns.some((pattern) => pattern.test(message)))
    return { level: "sensitive", category: "mental_health_sensitive" };
  return { level: "standard", category: null };
}

const crisisFollowUpPatterns = [
  /^(?:и\s+)?(?:пожалуйста[,\s]+)?(?:что\s+(?:мне\s+)?делать|как\s+остановиться|что\s+теперь|что\s+дальше|помоги(?:те)?(?:\s+мне)?|мне\s+(?:вс[её]\s+ещ[её]\s+)?страшно|не\s+оставляй(?:те)?\s+меня|побудь(?:те)?\s+со\s+мной|куда\s+(?:мне\s+)?звонить|как\s+получить\s+помощь)[?.!\s]*$/i,
  /^(?:эми\s+)?(?:эмне\s+кыл(?:айын|ышым\s+керек)|кантип\s+токтотом|андан\s+ары\s+эмне|(?:мага\s+)?жардам\s+бер(?:иңиз|чи)?|мен\s+(?:дагы\s+эле\s+)?коркуп\s+жатам|жанымда\s+бол(?:уңуз)?|кайда\s+чалайын)[?.!\s]*$/i,
  /^(?:and\s+)?(?:please[,\s]+)?(?:what\s+(?:should\s+i|do\s+i)\s+do(?:\s+now)?|how\s+do\s+i\s+stop|what\s+(?:now|next)|help(?:\s+me)?|i(?:'m|\s+am)\s+(?:still\s+)?scared|can\s+you\s+stay\s+with\s+me|where\s+(?:should\s+i|do\s+i)\s+call|how\s+do\s+i\s+get\s+help)[?.!\s]*$/i,
];

export function shouldRepeatCrisisGuidance(
  message: string,
  previousUserMessage: string | undefined,
) {
  if (!previousUserMessage || message.length > 180) return false;
  return (
    crisisFollowUpPatterns.some((pattern) => pattern.test(message.trim())) &&
    assessSafety(previousUserMessage).level === "crisis"
  );
}

export function crisisResponse(language: Language) {
  if (language === "KG")
    return "Сиздин коопсуздугуңуз азыр эң маанилүү. Эгер өзүңүзгө же башка адамга зыян келтирүү коркунучу болсо, дароо 112ге же жергиликтүү тез жардам кызматына чалыңыз. Жалгыз калбаңыз: ишенген адамыңызга азыр эле кабарлап, жаныңызда болушун сураңыз. Эгер коопсуз болсо, кооптуу буюмдардан алыстаңыз. ADEMI MIND шашылыш жардамды алмаштыра албайт.";
  if (language === "EN")
    return "Your immediate safety matters most. If you may harm yourself or someone else, call 112 or your local emergency service now. Do not stay alone: contact a trusted person and ask them to remain with you. If it is safe, move away from anything you could use to cause harm. ADEMI MIND cannot replace emergency support.";
  return "Сейчас важнее всего ваша безопасность. Если есть риск причинить вред себе или другому человеку, немедленно позвоните 112 или в местную экстренную службу. Не оставайтесь в одиночестве: свяжитесь с человеком, которому доверяете, и попросите его побыть рядом. Если это безопасно, отойдите от потенциально опасных предметов. ADEMI MIND не заменяет экстренную помощь.";
}

export function urgentMedicalResponse(language: Language) {
  if (language === "KG")
    return "Бул белгилер шашылыш медициналык жардамды талап кылышы мүмкүн. Азыр дароо 112ге же жергиликтүү шашылыш кызматка чалыңыз. Өзүңүз унаа айдабаңыз; мүмкүн болсо, ишенимдүү адамдан жаныңызда калып, жардам кызматын тосуп алууга көмөктөшүүсүн сураңыз. Маекти улантуу үчүн жардамды кечиктирбеңиз: ADEMI MIND диагноз коё албайт жана шашылыш медициналык жардамды алмаштырбайт.";
  if (language === "EN")
    return "These symptoms may require emergency medical care. Call 112 or your local emergency service now. Do not drive yourself; if possible, ask a trusted person to stay nearby and help meet the emergency team. Do not delay care to continue this chat: ADEMI MIND cannot diagnose or replace emergency medical support.";
  return "Такие симптомы могут требовать экстренной медицинской помощи. Немедленно позвоните 112 или в местную экстренную службу. Не садитесь за руль самостоятельно; если возможно, попросите надёжного человека остаться рядом и помочь встретить бригаду. Не откладывайте помощь ради продолжения чата: ADEMI MIND не ставит диагноз и не заменяет экстренную медицинскую помощь.";
}
