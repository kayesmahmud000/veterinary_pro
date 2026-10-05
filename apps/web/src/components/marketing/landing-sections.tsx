import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Sprout,
  BookOpen,
  HeartPulse,
  Leaf,
  Check,
  MoveUpRight,
} from "lucide-react";
import styles from "./marketing.module.css";

const pillars = [
  {
    number: "01",
    icon: Sprout,
    title: "Know your farm.",
    body: "Bring animal records, daily production and farm finances into one connected picture.",
    href: "/farm-management",
    action: "Farm management",
    className: styles.farmCard,
  },
  {
    number: "02",
    icon: BookOpen,
    title: "Grow your knowledge.",
    body: "Explore the vision for practical courses, veterinary guides and tools for everyday decisions.",
    href: "/learning",
    action: "Learning & resources",
    className: styles.learnCard,
  },
  {
    number: "03",
    icon: HeartPulse,
    title: "Connect the care.",
    body: "See how animal history can connect your farm with veterinary consultations and prescriptions.",
    href: "/veterinary-care",
    action: "Veterinary care",
    className: styles.vetCard,
  },
];
const questions = [
  [
    "Who is Vetralink Pro for?",
    "The platform is designed for farm owners and staff, veterinarians, and people learning about livestock farming. Its product vision brings farm records, educational resources and veterinary care together.",
  ],
  [
    "What can I explore on this website?",
    "You can learn about the farm management, learning and veterinary-care areas. Account access, purchases and consultation booking are not available on this public site yet.",
  ],
  [
    "Which animals is the platform designed to support?",
    "The product covers multi-species livestock management, including cattle, buffalo, goats, sheep, camels and poultry. Specific workflows will depend on the species and the feature being used.",
  ],
  [
    "Will it work on my phone or offline?",
    "These public pages adapt to phone, tablet and desktop screens. Offline farm workflows and the mobile application are part of the product direction; they are not available through this website yet.",
  ],
];

export function LandingSections() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <div className="eyebrow">
              <span className="status-dot" /> CONNECTED FARMING, THOUGHTFULLY
              BUILT
            </div>
            <h1>
              A clearer picture
              <br />
              of your farm.
              <br />
              <span>
                Better care for
                <br />
                every animal.
              </span>
            </h1>
            <p>
              Your farm is more than a collection of records. Discover a
              connected approach to everyday management, practical learning and
              veterinary care.
            </p>
            <div className="actions">
              <Link className="button" href="/farm-management">
                Explore farm tools <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link className="text-link" href="/learning">
                Explore learning <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.heroNote}>
              <Leaf size={16} aria-hidden="true" /> Made for the people behind
              every healthy herd.
            </div>
          </div>
          <div
            className={styles.visual}
            role="img"
            aria-label="Illustration of a farm with connected animal records, daily logs and care. Illustrative preview, not a live dashboard."
          >
            <div className={styles.visualTop}>
              <span>THE CONNECTED FARM</span>
              <span>FIELD NOTES / 01</span>
            </div>
            <div className={styles.sun} />
            <div className={styles.fieldBack} />
            <div className={styles.fieldFront} />
            <div className={styles.furrows} />
            <div className={styles.barn}>
              <div className={styles.roof} />
              <div className={styles.barnDoor} />
              <div className={styles.barnWindow} />
            </div>
            <div className={styles.tree}>
              <span />
              <i />
            </div>
            <div className={`${styles.noteCard} ${styles.animalNote}`}>
              <span className={styles.noteIcon}>
                <Sprout size={19} />
              </span>
              <div>
                <strong>Every animal, a story</strong>
                <small>Records that stay connected</small>
              </div>
            </div>
            <div className={`${styles.noteCard} ${styles.careNote}`}>
              <span className={styles.noteIcon}>
                <HeartPulse size={19} />
              </span>
              <div>
                <strong>Care with context</strong>
                <small>From farm history to the vet</small>
              </div>
              <span className={styles.check}>
                <Check size={14} />
              </span>
            </div>
            <div className={styles.visualBottom}>
              <span>
                <span className="status-dot" /> A MORE CONNECTED EVERYDAY
              </span>
              <span>Illustrative preview</span>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.pillars}>
        <div className="container">
          <div className={styles.sectionHeading}>
            <div>
              <div className="eyebrow">ONE CONNECTED ECOSYSTEM</div>
              <h2>
                Good farming starts
                <br />
                with a fuller picture.
              </h2>
            </div>
            <p>
              Less disconnected information.
              <br />
              More room to focus on what matters.
            </p>
          </div>
          <div className={styles.pillarGrid}>
            {pillars.map(({ icon: Icon, ...pillar }) => (
              <Link
                className={`${styles.pillarCard} ${pillar.className}`}
                href={pillar.href}
                key={pillar.number}
              >
                <div className={styles.cardTop}>
                  <Icon size={28} aria-hidden="true" />
                  <span>{pillar.number}</span>
                </div>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
                <div className={styles.cardLink}>
                  {pillar.action}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.workflow}>
        <div className={`container ${styles.workflowGrid}`}>
          <div>
            <div className="eyebrow">FROM THE BARN TO THE BIG PICTURE</div>
            <h2>
              Everyday records.
              <br />
              <span>Meaningful connections.</span>
            </h2>
            <p>
              A milk log, a health event, a question for your vet. Each is part
              of the same story. Our product vision keeps that story together.
            </p>
            <Link className="text-link" href="/farm-management">
              See the farm management approach{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <ol className={styles.steps}>
            {[
              [
                "Know each animal",
                "Build a history around animal identity, growth and lineage.",
              ],
              [
                "Keep track of the everyday",
                "Connect milk production, health events and vaccination records.",
              ],
              [
                "Understand the bigger picture",
                "Bring expenses, revenue and farm performance into view.",
              ],
              [
                "Bring history into care",
                "Give veterinary conversations the context of the animal’s records.",
              ],
            ].map(([title, body], i) => (
              <li key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container">
        <div className={styles.editorialGrid}>
          <article className={styles.editorial}>
            <BookOpen size={30} aria-hidden="true" />
            <div className="eyebrow">LEARN WITH PURPOSE</div>
            <h2>
              A little knowledge.
              <br />A better next decision.
            </h2>
            <p>
              Discover the thinking behind practical courses, downloadable
              guides and tools for life on the farm.
            </p>
            <Link className="text-link" href="/learning">
              Explore learning <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
          <article className={`${styles.editorial} ${styles.editorialCare}`}>
            <HeartPulse size={30} aria-hidden="true" />
            <div className="eyebrow">CARE THAT SEES THE WHOLE STORY</div>
            <h2>
              Better context for
              <br />
              every consultation.
            </h2>
            <p>
              Explore a veterinary-care journey built around animal history,
              thoughtful intake and connected prescriptions.
            </p>
            <Link className="text-link" href="/veterinary-care">
              Explore veterinary care{" "}
              <MoveUpRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
      <section className={`container ${styles.faq}`}>
        <div>
          <div className="eyebrow">A FEW THINGS TO KNOW</div>
          <h2>
            Your questions,
            <br />
            answered.
          </h2>
        </div>
        <div>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className={`container ${styles.finalSection}`}>
        <div className={styles.finalCta}>
          <div className="eyebrow">YOUR FARM. A MORE CONNECTED FUTURE.</div>
          <h2>Start with the bigger picture.</h2>
          <p>Explore how records, knowledge and care can work together.</p>
          <Link className="button button-light" href="/farm-management">
            Explore farm management{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
