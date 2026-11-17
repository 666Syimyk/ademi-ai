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
    eyebrow: "ПРАВОВАЯ ИНФОРМАЦИЯ · КОНФИДЕНЦИАЛЬНОСТЬ",
    title: "Политика конфиденциальности",
    sections: [
      {
        heading: "1. Какие данные обрабатываются",
        body: "Идентификатор аккаунта, email, имя, выбранный язык, добровольно добавленная фотография профиля, сведения о доступе к курсу, загруженные владельцем материалы и — только при отдельном согласии — история диалогов. Фотография хранится в закрытом файловом хранилище и может быть заменена или удалена в профиле. При срабатывании серверной проверки безопасности может сохраняться событие с идентификатором аккаунта, временем, языком и уровнем риска; исходный текст кризисного сообщения отдельно в таком событии не сохраняется.",
      },
      {
        heading: "2. Для чего используются данные",
        body: "Для предоставления доступа, ответа на вопросы, сохранения выбранных настроек, обработки оплаты, предотвращения злоупотреблений и улучшения качества сервиса. Данные не продаются рекламным компаниям.",
      },
      {
        heading: "3. ИИ и материалы курса",
        body: "В бесплатном справочном режиме запрос обрабатывается внутри приложения по встроенной программе и заранее подготовленным безопасным темам и не передаётся внешней языковой модели. Если владелец отдельно подключит генеративную модель, запросы могут передаваться её поставщику для создания ответа. Опубликованные владельцем материалы могут индексироваться в закрытой базе поиска. Внутренние материалы автора курса должны храниться отдельно и не использоваться в ответах ученикам.",
      },
      {
        heading: "4. Срок хранения",
        body: "История чата по умолчанию выключена. При включении она хранится до удаления пользователем либо до установленного владельцем срока. Платёжные и аудиторские записи могут храниться дольше, если этого требует закон или разрешение споров.",
      },
      {
        heading: "5. Защита",
        body: "Доступ проверяется на сервере; файлы хранятся в закрытом объектном хранилище; секретные ключи не передаются браузеру. Ни одна система не может гарантировать абсолютную безопасность, поэтому не следует отправлять лишние паспортные, банковские или медицинские данные.",
      },
      {
        heading: "6. Права пользователя",
        body: "В кабинете пользователь может скачать доступные данные, отключить сохранение сообщений и безвозвратно удалить историю диалогов и связанные отзывы. Для исправления данных или полного удаления аккаунта нужен официальный контакт, который владелец обязан указать до запуска. Платёжные и аудиторские записи могут сохраняться в предусмотренных законом случаях.",
      },
      {
        heading: "7. Несовершеннолетние",
        body: "Сервис предназначен для совершеннолетних. Использование несовершеннолетними допускается только после отдельной юридической проверки и внедрения подтверждаемого согласия законного представителя.",
      },
      {
        heading: "8. Голосовые функции и локальная обработка",
        body: "В локальном режиме русская озвучка работает через Microsoft Edge Neural TTS только после явного согласия: туда отправляется только текст выбранного русскоязычного ответа. Запись с микрофона туда не отправляется. Запись с микрофона обрабатывается локальной службой Whisper на машине, где запущено приложение; временный файл для декодирования удаляется сразу после распознавания, а ADEMI MIND не сохраняет аудиозапись. Согласие на озвучивание привязано к аккаунту и может быть отозвано в профиле. Когда включена локальная Ollama, текст запроса передаётся локальной модели; во внешнюю модель запрос передаётся только если владелец отдельно настроил такого поставщика.",
      },
    ],
  },
  KG: {
    eyebrow: "УКУКТУК МААЛЫМАТ · КУПУЯЛЫК",
    title: "Купуялык саясаты",
    sections: [
      {
        heading: "1. Кайсы маалыматтар иштетилет",
        body: "Аккаунттун идентификатору, электрондук почта дареги, аты, тандалган тил, колдонуучу кааласа кошкон профиль сүрөтү, курска жеткиликтүүлүк тууралуу маалыматтар, ээси жүктөгөн материалдар жана — өзүнчө макулдук берилгенде гана — диалогдордун тарыхы иштетилет. Профиль сүрөтү жабык файл сактагычта сакталып, профилден алмаштырылышы же өчүрүлүшү мүмкүн. Сервердеги коопсуздук текшерүүсү иштегенде аккаунттун идентификатору, убактысы, тили жана тобокелдик деңгээли камтылган окуя сакталиши мүмкүн; кризистик билдирүүнүн баштапкы тексти мындай окуяда өзүнчө сакталбайт.",
      },
      {
        heading: "2. Маалыматтар эмне үчүн колдонулат",
        body: "Маалыматтар жеткиликтүүлүктү камсыз кылуу, суроолорго жооп берүү, тандалган жөндөөлөрдү сактоо, төлөмдөрдү иштетүү, кыянаттыкты алдын алуу жана сервистин сапатын жакшыртуу үчүн колдонулат. Маалыматтар жарнама компанияларына сатылбайт.",
      },
      {
        heading: "3. Жасалма интеллект жана курстун материалдары",
        body: "Акысыз маалымдама режиминде сурам колдонмонун ичинде камтылган программа жана алдын ала даярдалган коопсуз темалар боюнча иштетилип, тышкы тил моделине берилбейт. Ээси генеративдик моделди өзүнчө туташтырса, жооп түзүү үчүн сурамдар анын камсыздоочусуна берилиши мүмкүн. Ээси жарыялаган материалдар жабык издөө базасында индекстелиши мүмкүн. Курстун авторунун ички материалдары өзүнчө сакталып, окуучуларга берилген жооптордо колдонулбашы керек.",
      },
      {
        heading: "4. Сактоо мөөнөтү",
        body: "Чаттын тарыхы демейки боюнча өчүрүлгөн. Ал иштетилсе, колдонуучу өчүргөнгө же ээси белгилеген мөөнөт аяктаганга чейин сакталат. Мыйзам талап кылса же талаштарды чечүү үчүн зарыл болсо, төлөм жана аудит жазуулары узагыраак сакталышы мүмкүн.",
      },
      {
        heading: "5. Коргоо",
        body: "Жеткиликтүүлүк серверде текшерилет; файлдар жабык объекттик сактагычта сакталат; жашыруун ачкычтар браузерге берилбейт. Эч бир система толук коопсуздукка кепилдик бере албайт, ошондуктан ашыкча паспорттук, банктык же медициналык маалыматтарды жөнөтпөө керек.",
      },
      {
        heading: "6. Колдонуучунун укуктары",
        body: "Кабинеттен колдонуучу жеткиликтүү маалыматтарынын көчүрмөсүн жүктөп, билдирүүлөрдү сактоону өчүрүп, маектердин тарыхын жана ага байланышкан пикирлерди кайтарылгыс түрдө жок кыла алат. Маалыматты оңдоо же аккаунтту толук өчүрүү үчүн ээси сервис ишке киргенге чейин көрсөтүүгө тийиш болгон расмий байланыш керек. Мыйзамда каралган учурларда төлөм жана аудит жазуулары сакталышы мүмкүн.",
      },
      {
        heading: "7. Жашы жете электер",
        body: "Сервис бойго жеткендерге арналган. Жашы жете электер сервисти өзүнчө укуктук текшерүүдөн кийин жана мыйзамдуу өкүлдүн ырасталуучу макулдугу киргизилгенде гана колдоно алышат.",
      },
      {
        heading: "8. Үн функциялары жана жергиликтүү иштетүү",
        body: "Жергиликтүү режимде орусча үн Microsoft Edge Neural TTS аркылуу ачык макулдуктан кийин гана түзүлөт: ал жакка тандалган орусча жооптун тексти гана жөнөтүлөт. Микрофондун аудиосу ал жакка жөнөтүлбөйт. Микрофон жазуусу колдонмо иштеп жаткан машинадагы жергиликтүү Whisper кызматы тарабынан иштетилет; чечмелөө үчүн убактылуу файл таанылгандан кийин дароо өчүрүлөт жана ADEMI MIND аудио жазууну сактабайт. Үнгө берилген уруксат аккаунтка байланыштырылат жана профилден кайтарылып алынышы мүмкүн. Жергиликтүү Ollama иштетилсе, суроонун тексти ошол жергиликтүү моделге берилет; тышкы модель провайдерине суроо ээси аны өзүнчө жөндөсө гана жөнөтүлөт.",
      },
    ],
  },
  EN: {
    eyebrow: "LEGAL · PRIVACY",
    title: "Privacy Policy",
    sections: [
      {
        heading: "1. Data we process",
        body: "We process the account identifier, email address, name, selected language, an optional profile photo, course-access information, materials uploaded by the owner, and — only with separate consent — conversation history. The profile photo is kept in private file storage and can be replaced or removed from the profile. When a server-side safety check is triggered, an event containing the account identifier, time, language, and risk level may be stored; the original crisis-message text is not stored separately in that event.",
      },
      {
        heading: "2. How data is used",
        body: "Data is used to provide access, answer questions, save selected settings, process payments, prevent abuse, and improve service quality. Data is not sold to advertising companies.",
      },
      {
        heading: "3. AI and course materials",
        body: "In free guided mode, a request is processed inside the application using the built-in course program and prewritten safety-reviewed topics and is not sent to an external language model. If the owner separately enables a generative model, requests may be sent to that provider to create a response. Materials published by the owner may be indexed in a private search database. The course author's internal materials must be stored separately and must not be used in answers to students.",
      },
      {
        heading: "4. Retention",
        body: "Chat history is off by default. If enabled, it is stored until the user deletes it or until the end of a period set by the owner. Payment and audit records may be kept longer when required by law or for resolving disputes.",
      },
      {
        heading: "5. Protection",
        body: "Access is checked on the server; files are kept in private object storage; secret keys are not sent to the browser. No system can guarantee absolute security, so users should not submit unnecessary passport, banking, or medical information.",
      },
      {
        heading: "6. User rights",
        body: "From the dashboard, users can download their available data, turn off message storage, and permanently delete conversation history and related feedback. Correcting data or fully deleting an account requires an official contact, which the owner must provide before launch. Payment and audit records may be retained where the law permits or requires it.",
      },
      {
        heading: "7. Minors",
        body: "The service is intended for adults. Use by minors is permitted only after a separate legal review and implementation of verifiable consent from a legal guardian.",
      },
      {
        heading: "8. Voice features and local processing",
        body: "In local mode, Russian playback uses Microsoft Edge Neural TTS only after explicit consent: only the selected Russian reply text is sent there. Microphone audio is not sent there. A microphone recording is processed by local Whisper on the machine running the app; the temporary decoding file is removed immediately after transcription and ADEMI MIND does not save the audio recording. Voice consent is tied to the account and can be revoked in the profile. When local Ollama is enabled, query text goes to that local model; query text is sent to an external AI provider only if the owner separately configures that provider.",
      },
    ],
  },
};

export default async function PrivacyPage({ searchParams }: LegalRouteProps) {
  const language = await readLegalLanguage(searchParams);
  const page = content[language];

  return (
    <LegalPage
      language={language}
      currentPath="/privacy"
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
