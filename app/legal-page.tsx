import type { ReactNode } from "react";
import Link from "next/link";

export type LegalLanguage = "RU" | "KG" | "EN";

export type LegalRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type LegalPageProps = {
  language: LegalLanguage;
  currentPath: "/privacy" | "/terms" | "/safety";
  eyebrow: string;
  title: string;
  updated?: string;
  children: ReactNode;
};

const interfaceCopy: Record<
  LegalLanguage,
  {
    htmlLanguage: string;
    back: string;
    languageLabel: string;
    version: string;
    updated: string;
    draftWarning: string;
    documents: string;
    privacy: string;
    terms: string;
    safety: string;
    date: string;
  }
> = {
  RU: {
    htmlLanguage: "ru",
    back: "Вернуться в кабинет",
    languageLabel: "Язык документа",
    version: "Черновая версия",
    updated: "обновлено",
    draftWarning:
      "Перед публичным запуском владелец курса должен добавить юридическое наименование, реквизиты ИП/ОсОО, адрес и официальный контакт.",
    documents: "Документы",
    privacy: "Конфиденциальность",
    terms: "Условия использования",
    safety: "Безопасность",
    date: "14 августа 2026",
  },
  KG: {
    htmlLanguage: "ky",
    back: "Кабинетке кайтуу",
    languageLabel: "Документтин тили",
    version: "Долбоордун каралама версиясы",
    updated: "жаңыртылды",
    draftWarning:
      "Жалпыга ачык ишке киргизүүдөн мурун курстун ээси юридикалык аталышын, жеке ишкердин же ЖЧКнын реквизиттерин, дарегин жана расмий байланыш маалыматын кошушу керек.",
    documents: "Документтер",
    privacy: "Купуялык",
    terms: "Колдонуу шарттары",
    safety: "Коопсуздук",
    date: "2026-жылдын 14-августу",
  },
  EN: {
    htmlLanguage: "en",
    back: "Return to dashboard",
    languageLabel: "Document language",
    version: "Draft version",
    updated: "updated",
    draftWarning:
      "Before public launch, the course owner must add the legal business name, sole proprietor or LLC registration details, address, and official contact information.",
    documents: "Documents",
    privacy: "Privacy",
    terms: "Terms of use",
    safety: "Safety",
    date: "14 August 2026",
  },
};

export async function readLegalLanguage(
  searchParams: LegalRouteProps["searchParams"],
): Promise<LegalLanguage> {
  const params = await searchParams;
  const value = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const normalized = value?.toUpperCase();

  return normalized === "KG" || normalized === "EN" ? normalized : "RU";
}

export function LegalPage({
  language,
  currentPath,
  eyebrow,
  title,
  updated,
  children,
}: LegalPageProps) {
  const copy = interfaceCopy[language];
  const documentLinks = [
    { href: "/privacy", label: copy.privacy },
    { href: "/terms", label: copy.terms },
    { href: "/safety", label: copy.safety },
  ] as const;

  return (
    <main className="legal-shell" lang={copy.htmlLanguage}>
      <header className="legal-header">
        <Link href={`/?lang=${language}`} className="legal-brand">
          <span>A</span>
          <strong>ADEMI MIND</strong>
        </Link>
        <nav
          aria-label={copy.languageLabel}
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <Link href={`/?lang=${language}`}>{copy.back}</Link>
          <span aria-hidden="true">·</span>
          {(["RU", "KG", "EN"] as const).map((option) => (
            <Link
              key={option}
              href={`${currentPath}?lang=${option}`}
              aria-current={language === option ? "page" : undefined}
              style={{
                fontWeight: language === option ? 800 : 500,
                textDecoration: language === option ? "underline" : "none",
                textUnderlineOffset: "3px",
              }}
            >
              {option}
            </Link>
          ))}
        </nav>
      </header>
      <article className="legal-document">
        <p className="legal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-updated">
          {copy.version} · {copy.updated} {updated ?? copy.date}
        </p>
        <div className="legal-callout">{copy.draftWarning}</div>
        {children}
        <h2>{copy.documents}</h2>
        <nav className="legal-links" aria-label={copy.documents}>
          {documentLinks.map((document) => (
            <Link
              key={document.href}
              href={`${document.href}?lang=${language}`}
              aria-current={currentPath === document.href ? "page" : undefined}
            >
              {document.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </article>
    </main>
  );
}
