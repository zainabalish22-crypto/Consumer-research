import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LogoMark } from "@/components/Logo";
import { PLATFORM } from "@/config/platform";

const FEATURES = ["questionnaires", "experiments", "village", "shop", "feed", "export"] as const;
const STEPS = ["choose", "preview", "share"] as const;

export default async function Home() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <LogoMark size={28} />
            {tc("platformName")}
          </Link>
          <nav aria-label={t("navLabel")} className="hidden gap-5 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-ink">
              {t("nav.features")}
            </a>
            <a href="#how" className="hover:text-ink">
              {t("nav.how")}
            </a>
            {PLATFORM.repositoryUrl && (
              <a href={`${PLATFORM.repositoryUrl}#set-up`} className="hover:text-ink">
                {t("nav.selfHosting")}
              </a>
            )}
          </nav>
          <div className="ms-auto flex items-center gap-2 text-sm">
            <LanguageSwitch />
            <Link href="/login" className="rounded-lg px-3 py-1.5 font-medium hover:bg-paper">
              {t("signIn")}
            </Link>
            <Link href="/login?mode=signup" className="hidden rounded-lg bg-accent px-3.5 py-1.5 font-medium text-white hover:bg-accent-strong sm:inline-block">
              {t("ctaShort")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="flex flex-col gap-5">
            <p className="w-fit rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-strong">{t("eyebrow")}</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t("headline")}</h1>
            <p className="max-w-xl text-lg text-muted">{t("lede")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="rounded-lg bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong">
                {t("cta")}
              </Link>
              <Link href="/login" className="rounded-lg border border-line-strong bg-surface px-5 py-3 font-medium hover:bg-paper">
                {t("signIn")}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {(["noTiers", "notSold", "selfHost"] as const).map((k) => (
                <li key={k} className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  {t(`promises.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <ShopIllustration t={t} />
        </section>

        <section id="features" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-bold">{t("featuresTitle")}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f} className="rounded-2xl border border-line bg-paper p-5">
                  <p className="font-semibold">{t(`features.${f}.title`)}</p>
                  <p className="mt-1.5 text-sm text-muted">{t(`features.${f}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold">{t("howTitle")}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{t(`steps.${s}.title`)}</p>
                  <p className="mt-1 text-sm text-muted">{t(`steps.${s}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
          <div className="grid items-center gap-6 rounded-3xl bg-accent-strong p-8 text-white md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold">{t("bilingualTitle")}</h2>
              <p className="mt-2 text-white/80">{t("bilingualBody")}</p>
            </div>
            <p lang="ar" dir="rtl" className="text-xl leading-relaxed font-semibold">
              صُممت لتعمل بالعربية والإنجليزية بالقدر نفسه من العناية.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>{t("footer")}</span>
          {PLATFORM.repositoryUrl && (
            <a href={PLATFORM.repositoryUrl} className="ms-auto hover:text-ink">
              {t("nav.source")}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

/** A stylised online-shop screen: what a participant might see in an experiment. Decorative only. */
function ShopIllustration({ t }: { t: Awaited<ReturnType<typeof getTranslations<"home">>> }) {
  const items = [
    { name: t("demo.iced"), price: "2.000", tone: "#e1efee" },
    { name: t("demo.cappuccino"), price: "1.800", tone: "#fcebd5" },
    { name: t("demo.arabic"), price: "1.500", tone: "#eee7f7" },
  ];
  return (
    <div aria-hidden="true" className="relative pb-10">
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm">
          <span className="size-6 rounded-md bg-shop" />
          <span className="font-semibold">{t("demo.shop")}</span>
          <span className="ms-auto rounded-full bg-paper px-2.5 py-1 text-xs">{t("demo.cart")}</span>
        </div>
        <div className="p-4">
          <div className="rounded-2xl bg-media-soft p-4">
            <p className="text-[11px] font-bold tracking-wide text-media">{t("demo.sponsored")}</p>
            <p className="mt-1 font-semibold">{t("demo.offer")}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {items.map((x) => (
              <div key={x.name} className="rounded-xl border border-line p-2">
                <div className="h-16 rounded-lg" style={{ background: x.tone }} />
                <p className="mt-2 truncate text-xs font-medium">{x.name}</p>
                <p className="text-xs text-muted" dir="ltr">
                  BHD {x.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 end-6 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md">
        <p className="font-semibold">{t("demo.condition")}</p>
        <p className="text-muted">{t("demo.recorded")}</p>
      </div>
    </div>
  );
}
