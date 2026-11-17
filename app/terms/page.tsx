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
    eyebrow: "ПРАВОВАЯ ИНФОРМАЦИЯ · УСЛОВИЯ",
    title: "Условия использования",
    sections: [
      {
        heading: "1. Назначение",
        body: "ADEMI MIND — образовательный помощник по психологии. Он объясняет психологические понятия, предлагает низкорисковые шаги для самостоятельной рефлексии и отвечает по авторской программе курса, когда вопрос относится к ней.",
      },
      {
        heading: "2. Медицинские ограничения",
        body: "Сервис не является врачом, психотерапевтом или экстренной службой, не ставит диагнозы, не назначает лекарства и не заменяет очную помощь. Решения о лечении принимаются только с квалифицированным специалистом.",
      },
      {
        heading: "3. Доступ",
        body: "Во время текущего тестового периода чат доступен бесплатно после личной регистрации. Аккаунт является персональным. Передача доступа, автоматизированный сбор данных, попытки обхода ограничений и вредоносное использование запрещены. Если позже появятся тарифы, условия будут показаны до их подключения.",
      },
      {
        heading: "4. Оплата и возвраты",
        body: "Сейчас платёжная функция не подключена и сервис не принимает оплату. До будущего запуска оплаты владелец обязан опубликовать цену, срок доступа, правила отмены и возврата, а также необходимые юридические сведения.",
      },
      {
        heading: "5. Материалы и интеллектуальные права",
        body: "Материалы курса принадлежат их правообладателям. Покупка доступа не разрешает перепродажу, массовое копирование или публичное распространение.",
      },
      {
        heading: "6. Ограничение ответственности",
        body: "Ответы ИИ могут быть неполными или ошибочными. Пользователь обязан оценивать их критически и обращаться к человеку-специалисту в ситуациях высокого риска.",
      },
      {
        heading: "7. Блокировка",
        body: "Владелец может приостановить аккаунт при мошенничестве, угрозах, нарушении прав других лиц или попытках компрометации системы.",
      },
    ],
  },
  KG: {
    eyebrow: "УКУКТУК МААЛЫМАТ · КОЛДОНУУ ШАРТТАРЫ",
    title: "Колдонуу шарттары",
    sections: [
      {
        heading: "1. Максаты",
        body: "ADEMI MIND — психология боюнча билим берүүчү жардамчы. Ал психологиялык түшүнүктөрдү чечмелеп, өз алдынча ой жүгүртүү үчүн тобокелдиги төмөн кадамдарды сунуштайт жана суроо тиешелүү болсо, автордук курс программасы боюнча жооп берет.",
      },
      {
        heading: "2. Медициналык чектөөлөр",
        body: "Сервис дарыгер, психотерапевт же шашылыш жардам кызматы эмес; диагноз койбойт, дары-дармек дайындабайт жана бетме-бет жардамды алмаштырбайт. Дарылоо тууралуу чечимдер квалификациялуу адис менен гана кабыл алынат.",
      },
      {
        heading: "3. Жеткиликтүүлүк",
        body: "Учурдагы тесттик мезгилде чат жеке каттоодон кийин акысыз жеткиликтүү. Аккаунт жеке болуп саналат. Жеткиликтүүлүктү башка бирөөгө берүү, маалыматтарды автоматтык чогултуу, чектөөлөрдү айланып өтүү жана зыяндуу пайдалануу тыюу салынат. Кийин тарифтер пайда болсо, шарттар кошулганга чейин көрсөтүлөт.",
      },
      {
        heading: "4. Төлөм жана акчаны кайтаруу",
        body: "Азыр төлөм функциясы туташтырылган эмес жана сервис төлөм кабыл албайт. Келечекте төлөм ишке киргенге чейин ээси бааны, жеткиликтүүлүк мөөнөтүн, жокко чыгаруу жана кайтаруу эрежелерин, ошондой эле зарыл юридикалык маалыматтарды жарыялоого тийиш.",
      },
      {
        heading: "5. Материалдар жана интеллектуалдык укуктар",
        body: "Курстун материалдары алардын укук ээлерине таандык. Жеткиликтүүлүктү сатып алуу кайра сатууга, массалык көчүрүүгө же жалпыга ачык жайылтууга уруксат бербейт.",
      },
      {
        heading: "6. Жоопкерчиликти чектөө",
        body: "Жасалма интеллекттин жооптору толук эмес же жаңылыш болушу мүмкүн. Колдонуучу аларды сын көз менен баалап, тобокелдик жогору болгон жагдайларда адиске кайрылууга милдеттүү.",
      },
      {
        heading: "7. Аккаунтту бөгөттөө",
        body: "Алдамчылык, коркутуу, башка адамдардын укуктарын бузуу же системанын коопсуздугун бузууга аракет кылуу учурларында ээси аккаунтту убактылуу токтото алат.",
      },
    ],
  },
  EN: {
    eyebrow: "LEGAL · TERMS",
    title: "Terms of Use",
    sections: [
      {
        heading: "1. Purpose",
        body: "ADEMI MIND is an educational psychology assistant. It explains psychological concepts, offers low-risk steps for personal reflection, and answers from the author's course program when a question concerns that program.",
      },
      {
        heading: "2. Medical limitations",
        body: "The service is not a doctor, psychotherapist, or emergency service. It does not diagnose, prescribe medication, or replace in-person care. Treatment decisions must be made only with a qualified professional.",
      },
      {
        heading: "3. Access",
        body: "During the current testing period, chat is free after personal registration. Each account is personal. Sharing access, automated data collection, attempts to bypass restrictions, and malicious use are prohibited. If plans are introduced later, their terms will be shown before enrollment.",
      },
      {
        heading: "4. Payments and refunds",
        body: "Payments are not currently enabled and the service does not accept payment. Before any future payment launch, the owner must publish the price, access period, cancellation and refund rules, and required legal details.",
      },
      {
        heading: "5. Materials and intellectual property",
        body: "Course materials belong to their respective rights holders. Purchasing access does not permit resale, bulk copying, or public distribution.",
      },
      {
        heading: "6. Limitation of liability",
        body: "AI responses may be incomplete or incorrect. Users must evaluate them critically and contact a qualified professional in high-risk situations.",
      },
      {
        heading: "7. Suspension",
        body: "The owner may suspend an account in cases of fraud, threats, infringement of others' rights, or attempts to compromise the system.",
      },
    ],
  },
};

export default async function TermsPage({ searchParams }: LegalRouteProps) {
  const language = await readLegalLanguage(searchParams);
  const page = content[language];

  return (
    <LegalPage
      language={language}
      currentPath="/terms"
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
