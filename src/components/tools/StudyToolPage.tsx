import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { SCENES } from "@/components/env3d/scenes";
import { SCENES_LIVE } from "@/config/site";
import { Link } from "@/i18n/navigation";
import type { StudyToolId } from "@/lib/tools/registry";

const H2 = "font-display text-2xl font-light sm:text-3xl";
const panel = "flex flex-col gap-4 rounded-lg border border-line-2 bg-carbon p-6";
const button = "tracked inline-flex min-h-12 items-center self-start bg-photon px-6 font-semibold uppercase tracking-[0.05em] text-void hover:bg-white";

/** The eleven scenes of the shopping village, each a link when the scenes are published. */
async function Scenes() {
  const t = await getTranslations("environments");
  return (
    <section className={panel} aria-labelledby="scenes-h">
      <h2 id="scenes-h" className={H2}>
        {t("title")}
      </h2>
      <p className="max-w-3xl leading-[1.7] text-dim">{t("body")}</p>
      <p className="max-w-3xl leading-[1.7] text-dim">{t("avatar")}</p>
      <ol className="grid min-w-0 border-t border-line-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {SCENES.map((s, i) => {
          const row = (
            <>
              <span dir="ltr" className="font-mono text-xs text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 text-[17px] group-hover:text-signal">{t(`scenes.${s.id}`)}</span>
              <span className="whitespace-nowrap font-mono text-[11px] text-faint">
                {t(s.setting)} · {t(s.time === "night" ? "evening" : "day")}
              </span>
            </>
          );
          const cls = "group flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4";
          return (
            <li key={s.id} className="border-b border-line-2 sm:odd:border-e sm:odd:pe-6 sm:even:ps-6">
              {SCENES_LIVE ? (
                <NextLink href={`/prototype/scenes/${s.id}`} className={cls}>
                  {row}
                </NextLink>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** How conditions are assigned, with the Latin-square example. */
async function Engine() {
  const t = await getTranslations("engine");
  return (
    <section className={`${panel} lg:grid lg:grid-cols-2 lg:items-center lg:gap-10`} aria-labelledby="engine-h">
      <div className="flex flex-col gap-4">
        <h2 id="engine-h" className={H2}>
          {t("title")}
        </h2>
        <p className="leading-[1.7] text-dim">{t("body")}</p>
      </div>
      <figure className="m-0 flex min-w-0 flex-col gap-4 border border-line-2 bg-void p-5">
        <figcaption className="font-mono text-xs leading-relaxed text-faint">{t("caption")}</figcaption>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse font-mono text-[13px]">
            <thead>
              <tr className="text-faint">
                <th scope="col" className="border-b border-line-2 p-2.5 text-start font-normal">
                  {t("sequence")}
                </th>
                {[1, 2, 3].map((n) => (
                  <th key={n} scope="col" className="border-b border-line-2 p-2.5 text-start font-normal">
                    {t("brand", { n })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((row) => (
                <tr key={row}>
                  <th scope="row" className="p-2.5 text-start font-normal text-faint">
                    {row}
                  </th>
                  {[1, 2, 3].map((col) => (
                    <td key={col} className={`p-2.5 ${row === col ? "text-signal" : ""}`}>
                      {row === col ? `${t("ai")} ■` : t("authentic")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-faint">{t("note")}</p>
      </figure>
    </section>
  );
}

/** The four files a study exports. */
async function DataOut() {
  const t = await getTranslations("data");
  const files = [
    ["participants.csv", "participants"],
    ["events.csv", "events"],
    ["codebook.csv", "codebook"],
    ["labels.sps", "labels"],
  ] as const;
  return (
    <section className={panel} aria-labelledby="data-h">
      <h2 id="data-h" className={H2}>
        {t("title")}
      </h2>
      <p className="max-w-3xl leading-[1.7] text-dim">{t("body")}</p>
      <ul className="grid grid-cols-1 gap-px border border-line-2 bg-line-2 text-[13px] sm:grid-cols-2">
        {files.map(([file, key]) => (
          <li key={file} className="flex flex-col gap-1 bg-void p-5">
            <span dir="ltr" className="self-start font-mono">
              {file}
            </span>
            <span className="text-faint">{t(`files.${key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The own page of a study tool (shopping village, e-commerce simulator, forms): what it is,
 * what it records, the details, and where to open it. The homepage only links here.
 */
export async function StudyToolPage({ tool }: { tool: StudyToolId }) {
  const t = await getTranslations();
  const open =
    tool === "village"
      ? SCENES_LIVE
        ? { href: "/prototype/scenes", label: t("environments.open"), localized: false }
        : null
      : { href: tool === "shop" ? "/studio?module=shop" : "/studio?module=form", label: t(`tools.studyOpen.${tool}`), localized: true };
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <Link href="/tools" className="self-start text-sm text-faint hover:text-photon">
          <span aria-hidden="true" className="inline-block rtl:rotate-180">
            ←
          </span>{" "}
          {t("tools.back")}
        </Link>
        <h1 className="font-display text-3xl font-light sm:text-4xl">{t(`modules.${tool}.name`)}</h1>
        <p className="text-ice">{t(`modules.${tool}.kind`)}</p>
      </div>
      <p className="max-w-3xl text-lg leading-relaxed text-dim">{t(`modules.${tool}.body`)}</p>
      <section className={panel}>
        <h2 className="tracked font-mono text-xs uppercase tracking-[0.16em] text-faint">{t("modules.recordsLabel")}</h2>
        <p className="text-[15px] leading-relaxed text-mist">{t(`modules.${tool}.records`)}</p>
      </section>
      {open &&
        (open.localized ? (
          <Link href={open.href} className={button}>
            {open.label}
          </Link>
        ) : (
          <NextLink href={open.href} className={button}>
            {open.label}
          </NextLink>
        ))}
      {tool === "village" ? (
        <Scenes />
      ) : (
        <>
          <Engine />
          <DataOut />
        </>
      )}
    </main>
  );
}
