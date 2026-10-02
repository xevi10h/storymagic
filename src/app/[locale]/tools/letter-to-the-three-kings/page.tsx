import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import ToolLanding from "@/components/tools/ToolLanding";
import LetterTool from "@/components/tools/LetterTool";
import { toolMetadata } from "@/lib/tools/metadata";
import { TOOL_LOCALES, isToolLocale, toolPath } from "@/lib/tools/registry";

// The book band and the FAQ quote this season's Reyes cut-off: refresh daily.
export const revalidate = 86400;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TOOL_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return toolMetadata(locale, "tools.letter", toolPath("letter"));
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isToolLocale(locale)) notFound();
  setRequestLocale(locale);
  return (
    <ToolLanding tool="letter" locale={locale}>
      <LetterTool locale={locale} />
    </ToolLanding>
  );
}
