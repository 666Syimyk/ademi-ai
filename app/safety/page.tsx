import { Fragment } from "react";
import {
  LegalPage,
  readLegalLanguage,
  type LegalLanguage,
  type LegalRouteProps,
} from "../legal-page";

const content: Record<
  LegalLanguage,
  {
    eyebrow: string;
    title: string;
    sections: Array<{ heading: string; body: string }>;
  }
> = {
  RU: {
    eyebrow: "ДОВЕРИЕ · БЕЗОПАСНОСТЬ",
    title: "Безопасность психологической поддержки",
    sections: [
      {
        heading: "Когда ADEMI MIND полезен",
        body: "Для изучения материалов курса, объяснения психологических понятий, подготовки вопросов специалисту, дневника наблюдений и низкорисковых упражнений на осознанность.",
      },
      {
        heading: "Чего ADEMI MIND не делает",
        body: "Не ставит диагноз, не оценивает другого человека как «нарцисса», не назначает и не отменяет лечение, не обещает выздоровление и не проводит кризисную терапию.",
      },
      {
        heading: "Если есть непосредственная опасность",
        body: "В Кыргызстане при риске причинить вред себе или другому человеку нужно немедленно позвонить 112, не оставаться одному и обратиться к человеку, которому вы доверяете. Если это безопасно, следует отойти от потенциально опасных предметов. Детям и родителям также доступен бесплатный анонимный телефон доверия 111.",
      },
      {
        heading: "Насилие и уязвимые ситуации",
        body: "При насилии, угрозах, тяжёлых медицинских симптомах или вопросах, связанных с несовершеннолетними, сервис направляет к квалифицированной локальной помощи и не предлагает рискованных самостоятельных действий.",
      },
      {
        heading: "Как сообщить о проблеме",
        body: "Сохранённый ответ можно отметить как небезопасный, неточный или бесполезный. Такая отметка сохраняется для проверки без передачи владельцу полной личной переписки; полный текст не раскрывается без отдельного разрешения пользователя.",
      },
    ],
  },
  KG: {
    eyebrow: "ИШЕНИМ · КООПСУЗДУК",
    title: "Психологиялык колдоонун коопсуздугу",
    sections: [
      {
        heading: "ADEMI MIND кайсы учурда пайдалуу",
        body: "Курстун материалдарын үйрөнүү, психологиялык түшүнүктөрдү чечмелөө, адиске берилчү суроолорду даярдоо, байкоо күндөлүгүн жүргүзүү жана тобокелдиги төмөн аң-сезимдүүлүк көнүгүүлөрүн аткаруу үчүн.",
      },
      {
        heading: "ADEMI MIND эмнелерди жасабайт",
        body: "Диагноз койбойт, башка адамды «нарцисс» деп баалабайт, дарылоону дайындабайт же токтотпойт, айыгууга убада бербейт жана кризистик терапия жүргүзбөйт.",
      },
      {
        heading: "Түздөн-түз коркунуч болсо",
        body: "Кыргызстанда өзүнө же башка адамга зыян келтирүү коркунучу болсо, дароо 112 номерине чалып, жалгыз калбоо жана өзүңүз ишенген адамга кайрылуу керек. Эгер коопсуз болсо, коркунуч жаратышы мүмкүн болгон буюмдардан алыстоо зарыл. Балдар жана ата-энелер үчүн 111 акысыз жана жашыруун ишеним телефону да жеткиликтүү.",
      },
      {
        heading: "Зомбулук жана аялуу жагдайлар",
        body: "Зомбулук, коркутуу, оор медициналык белгилер же жашы жете электерге байланышкан суроолор болгон учурда сервис квалификациялуу жергиликтүү жардамга багыттайт жана тобокелдүү өз алдынча аракеттерди сунуштабайт.",
      },
      {
        heading: "Көйгөй тууралуу кантип билдирүүгө болот",
        body: "Сакталган жоопту кооптуу, так эмес же пайдасыз деп белгилөөгө болот. Мындай белги текшерүү үчүн сакталат, бирок колдонуучунун өзүнчө уруксаты жок болсо, курстун ээсине толук жеке кат алышуу берилбейт.",
      },
    ],
  },
  EN: {
    eyebrow: "TRUST · SAFETY",
    title: "Safety of Psychological Support",
    sections: [
      {
        heading: "When ADEMI MIND is useful",
        body: "For studying course materials, explaining psychological concepts, preparing questions for a professional, keeping an observation journal, and completing low-risk mindfulness exercises.",
      },
      {
        heading: "What ADEMI MIND does not do",
        body: "It does not diagnose, label another person as a “narcissist,” prescribe or discontinue treatment, promise recovery, or provide crisis therapy.",
      },
      {
        heading: "If there is immediate danger",
        body: "In Kyrgyzstan, if there is a risk of harm to yourself or another person, call 112 immediately, do not remain alone, and contact someone you trust. If it is safe, move away from potentially dangerous objects. Children and parents can also call the free, anonymous 111 helpline.",
      },
      {
        heading: "Violence and vulnerable situations",
        body: "In cases involving violence, threats, severe medical symptoms, or minors, the service directs users to qualified local help and does not suggest risky actions without professional support.",
      },
      {
        heading: "How to report a problem",
        body: "A saved answer can be flagged as unsafe, inaccurate, or unhelpful. The flag is stored for review without disclosing the full private conversation to the course owner unless the user separately authorizes that disclosure.",
      },
    ],
  },
};

export default async function SafetyPage({ searchParams }: LegalRouteProps) {
  const language = await readLegalLanguage(searchParams);
  const page = content[language];

  return (
    <LegalPage
      language={language}
      currentPath="/safety"
      eyebrow={page.eyebrow}
      title={page.title}
    >
      {page.sections.map((section) => (
        <Fragment key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </Fragment>
      ))}
    </LegalPage>
  );
}
