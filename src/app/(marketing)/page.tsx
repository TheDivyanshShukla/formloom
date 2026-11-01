import Link from "next/link";
import { Logo } from "@/components/shared/brand";
import { CloudOffIcon, LogicIcon, ServerIcon, SparkleIcon, UsersIcon } from "@/components/shared/icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { LoomClip, PhotoStage, RuleTester, type StagePhoto, StartDialog, Steps } from "./landing-parts";

// One photograph per stage of the reading column, in order: hero, rules, features.
const PHOTOS: StagePhoto[] = [
  { src: "/loom/nms-jacquard-loom-2.jpg", alt: "A wooden Jacquard loom with its chain of punched cards hanging above the warp", caption: "Jacquard loom, National Museum of Scotland" },
  { src: "/loom/jacquard-loom-cards.jpg", alt: "A long chain of grey punched cards laced together, each row of holes a row of the pattern", caption: "Punched cards: one row of holes per row of cloth" },
  { src: "/loom/van-phuc-loom-punch-cards-02.jpg", alt: "Worn punch cards feeding a silk loom in a workshop", caption: "Punch cards on a silk loom, Van Phuc, Hanoi" },
];

const CREDITS = [
  ["NMS Jacquard loom 2", "Ad Meskens", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:NMS_Jacquard_loom_2.JPG"],
  ["Jacquard loom cards", "Robert-brook", "CC0", "https://commons.wikimedia.org/wiki/File:Jacquard_loom_cards.jpg"],
  ["Van Phuc loom punch cards 02", "Dragfyre", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Van_Phuc_loom_punch_cards_02.jpg"],
  ["A Jacquard loom showing information punchcards", "Stephencdickson", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:A_Jacquard_loom_showing_information_punchcards,_National_Museum_of_Scotland.jpg"],
  ["Métier à tisser Jacquard 01", "Bastenbas", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:M%C3%A9tier_%C3%A0_tisser_Jacquard_01.webm"],
] as const;

// "formloom" in 8-bit ASCII: a punched hole for every 1, as on a loom card.
const BITS = [..."formloom"].flatMap((c) => [...c.charCodeAt(0).toString(2).padStart(8, "0")].map(Number));

function PunchBand({ className = "h-10 sm:h-14" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex gap-px bg-foreground p-1.5 ${className}`}>
      {BITS.map((b, i) => (
        <span
          key={i}
          style={{ animationDelay: `${i * 12}ms` }}
          className={b ? "punch my-auto h-1/2 min-h-1 flex-1 rounded-full bg-card" : "flex-1"}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    t: "It asks back",
    d: ["When your sentence leaves something open, it drafts a best guess and asks, with answers you can pick in one click.", "Long lists become a searchable dropdown. IDs get a pattern."],
    demo: (
      <div className="p-4 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <SparkleIcon className="size-4 text-support" /> 42 branches is a long list
        </p>
        <p className="mt-1 text-muted-foreground">Make it a dropdown with search?</p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg border-2 border-foreground bg-card px-2.5 py-1 font-medium">Yes</span>
          <span className="rounded-lg border bg-card px-2.5 py-1">Keep as list</span>
        </div>
      </div>
    ),
  },
  {
    t: "Logic without a flowchart",
    d: ["Write the condition the way you would say it. Questions and whole sections appear only when they apply.", "Hidden answers are never sent."],
    demo: (
      <div className="p-4 text-sm">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <LogicIcon className="size-4" /> Show this question when
        </p>
        <p className="mt-2 rounded-lg border bg-card px-3 py-2">Score is 6 or lower</p>
        <p className="mt-2 font-medium">What could we do better?</p>
      </div>
    ),
  },
  {
    t: "Straight into your sheet",
    d: ["Link a Google Sheet once and every answer becomes a row. Excel reads the live CSV feed.", "The responses grid stays quick at ten thousand rows."],
    demo: (
      <div className="text-sm">
        {[
          ["A", "Company", "Score"],
          ["2", "Kavya Traders", "9"],
          ["3", "Brightline Print", "6"],
          ["4", "Mehta & Sons", "10"],
        ].map((r, n) => (
          <div key={r[0]} className={n === 0 ? "grid grid-cols-[2rem_1fr_3rem] border-b bg-card/60 text-muted-foreground" : "grid grid-cols-[2rem_1fr_3rem] border-b last:border-0"}>
            {r.map((c, j) => (
              <span key={c} className={j === 0 ? "border-r px-2 py-1.5 text-muted-foreground" : j === 2 ? "px-2 py-1.5 text-right" : "truncate border-r px-2 py-1.5"}>
                {c}
              </span>
            ))}
          </div>
        ))}
      </div>
    ),
  },
  {
    t: "Works on bad Wi-Fi",
    d: ["Install it like an app. An opened form keeps working offline.", "Answers wait on the phone and send themselves when the signal returns."],
    demo: (
      <div className="flex items-center gap-3 p-4 text-sm">
        <CloudOffIcon className="size-5 shrink-0 text-muted-foreground" />
        <p>
          <span className="font-medium">2 answers waiting</span>
          <span className="block text-muted-foreground">Sending when you are back online</span>
        </p>
      </div>
    ),
  },
  {
    t: "Solo or as an organisation",
    d: ["A private workspace for you, shared ones for teams.", "Owners, editors and viewers, invited with a link."],
    demo: (
      <ul className="divide-y text-sm">
        {[
          ["Aditi Rao", "Owner"],
          ["Tomás Ferreira", "Editor"],
          ["Lin Wei", "Viewer"],
        ].map(([n, r]) => (
          <li key={n} className="flex items-center gap-2 px-4 py-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            {n}
            <span className="ml-auto text-muted-foreground">{r}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    t: "Yours to host",
    d: ["Open source. One Postgres, one Redis, one container.", "Uploads on disk or Cloudflare R2."],
    demo: (
      <div className="p-4 text-sm leading-relaxed">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <ServerIcon className="size-4" /> Your server
        </p>
        <code className="mt-2 block">docker compose up -d</code>
        <p className="text-muted-foreground">formloom ready on :3000</p>
      </div>
    ),
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)]">
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        <div className="order-1 h-[48svh] lg:order-2 lg:sticky lg:top-3 lg:h-[calc(100svh-24px)]">
          <PhotoStage photos={PHOTOS} />
        </div>

        <main className="order-2 -mt-9 min-w-0 lg:order-1 lg:mt-0">
          {/* Hero: the printed card. */}
          <section data-stage data-index={0} className="relative flex flex-col overflow-hidden rounded-lg bg-card lg:min-h-[calc(100svh-24px)]">
            <PunchBand />
            <div className="flex items-center justify-between px-5 pt-4 sm:px-8">
              <Logo compact />
              <nav className="flex items-center gap-1">
                <ThemeToggle />
                <Button variant="ghost" className="rounded-lg" render={<Link href="/sign-in" />}>
                  Sign in
                </Button>
              </nav>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
              <h1 className="text-[10vw] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[56px]">
                Describe it.
                <br />
                Get the form.
              </h1>
              <p className="mt-8 max-w-[36ch] text-base leading-relaxed text-muted-foreground">
                Formloom is an open-source form builder. Write one sentence and get the questions, the rules and the branching. Answers land in a spreadsheet.
              </p>
              <Button className="mt-9 h-12 rounded-lg px-7 text-base active:scale-[0.97]" render={<Link href="/sign-up" />}>
                Build a form
              </Button>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 px-5 pb-7 text-sm font-medium">
              <a href="#rules" className="underline-offset-4 hover:underline">
                Try a rule
              </a>
              <a href="#how" className="underline-offset-4 hover:underline">
                How it works
              </a>
              <a href="#loom" className="underline-offset-4 hover:underline">
                Why a loom
              </a>
            </nav>
          </section>

          {/* Showcase: the live validator. */}
          <section id="rules" data-stage data-index={1} className="reveal mx-auto max-w-[46rem] px-5 pb-28 pt-28 sm:px-8">
            <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] sm:text-[40px]">Rules you can test.</h2>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed">
              Every ID question gets a pattern and a plain message. This is the validator your respondents meet. Type into it.
            </p>
            <div className="mt-10">
              <RuleTester />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link href="/sign-up" className="flex h-16 items-center px-5 text-sm font-medium transition-transform duration-100 active:scale-[0.98] rounded-lg bg-primary text-primary-foreground">
                Use it on a form
              </Link>
              <a href="#what" className="flex h-16 items-center rounded-lg bg-muted px-5 text-sm font-medium transition-transform duration-100 active:scale-[0.98]">
                What else it does
              </a>
            </div>
          </section>

          {/* Features: small proof beside text. */}
          <section id="what" data-stage data-index={2} className="mx-auto max-w-[46rem] px-5 pb-32 sm:px-8">
            <h2 className="text-[26px] font-semibold tracking-[-0.02em]">What it does</h2>
            <div className="mt-16 space-y-16 sm:space-y-24">
              {FEATURES.map((f) => (
                <article key={f.t} className="reveal grid gap-4 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)] sm:gap-6">
                  <div data-ui className="self-start overflow-hidden rounded-lg bg-muted">
                    {f.demo}
                  </div>
                  <div>
                    <h3 className="text-base font-medium">{f.t}</h3>
                    {f.d.map((p) => (
                      <p key={p} className="mt-2 text-base leading-relaxed text-muted-foreground">
                        {p}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* How it works: breaks the split and runs full width. */}
      <section id="how" className="mx-auto max-w-6xl px-5 pt-24 sm:px-8">
        <h2 className="text-[26px] font-semibold tracking-[-0.02em]">How it works</h2>
        <Steps />
      </section>

      {/* About: why a loom. */}
      <section id="loom" className="mx-auto max-w-[34rem] px-6 pb-28 pt-12">
        <div>
          <LoomClip />
        </div>
        <h2 className="mt-12 text-[26px] font-semibold tracking-[-0.02em]">Why a loom</h2>
        <div className="mt-6 space-y-6 text-base leading-[1.6]">
          <p>
            In 1804 Joseph Marie Jacquard gave the loom a chain of punched cards. Each card was one row of the cloth. A hole lifted a
            thread, no hole left it down, and the pattern came out the same every time.
          </p>
          <p>
            A form is that card. Each question is a row of holes: <mark className="bg-pop px-1 text-black">which answers pass, which
            come next, which never come at all</mark>. Get the card right and the cloth takes care of itself.
          </p>
          <p>
            Formloom writes the card for you from a sentence, lets you change it by talking, and keeps what comes through in a sheet.
            The strip at the top of this page spells our name in holes.
          </p>
          <p>
            It is open source because forms hold other people&apos;s details. You should be able to read the code that handles them and
            run it on your own machine.
          </p>
        </div>
        <p className="mt-10 text-[26px] italic">Formloom</p>
        <p className="mt-1 text-sm text-muted-foreground">Open source, self-hostable</p>
      </section>

      {/* CTA: the first screen, already open. */}
      <section className="bg-highlight text-background">
        <div className="mx-auto grid min-h-[90svh] max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:py-10">
          <div className="flex flex-col lg:justify-end">
            <p className="text-[13vw] font-semibold leading-[0.92] tracking-[-0.04em] lg:text-[clamp(56px,6.2vw,96px)]">
              Start with
              <br />a sentence.
            </p>
            <p className="mt-6 max-w-[38ch] text-base leading-relaxed text-background/90">
              Create a free account and the form is built from what you wrote. Then edit it, test it and share the link.
            </p>
          </div>
          <div className="flex items-end justify-center lg:items-center lg:justify-end">
            <StartDialog />
          </div>
        </div>
      </section>

      <footer className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[20svh] sm:px-8">
        <p className="text-sm text-muted-foreground">
          Pictures from Wikimedia Commons:{" "}
          {CREDITS.map(([t, by, lic, href], i) => (
            <span key={t}>
              <a href={href} className="underline underline-offset-2 hover:text-foreground">
                {t}
              </a>{" "}
              by {by}, {lic}
              {i < CREDITS.length - 1 ? "; " : "."}
            </span>
          ))}
        </p>
        <PunchBand className="mt-8 h-2 p-0" />
        <div className="mt-6 grid gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-baseline">
          <span className="text-muted-foreground">Open-source form builder</span>
          <nav className="flex flex-wrap gap-6">
            <Link href="/sign-in" className="hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:underline">
              Create account
            </Link>
            <a href="#how" className="hover:underline">
              How it works
            </a>
          </nav>
          <span className="text-muted-foreground sm:text-right">2026</span>
        </div>
      </footer>
    </div>
  );
}
