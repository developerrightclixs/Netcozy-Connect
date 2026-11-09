import Link from "next/link";
export default function Home() {
  return (
    <>
      <header className="landing-nav">
        <Link className="brand" href="/">
          n
          <span>
            netcozy<span className="brand-light"> connect</span>
          </span>
        </Link>
        <div className="row">
          <Link href="/login">Sign in</Link>
          <Link className="button" href="/signup">
            Get started →
          </Link>
        </div>
      </header>
      <main className="landing">
        <div>
          <span className="pill">PURPOSEFUL NETWORKING</span>
          <h1>
            Less searching.
            <br />
            More <em>meaningful</em>
            <br />
            connections.
          </h1>
          <p>
            Bring your goals into focus. Discover relevant people, prepare
            thoughtful introductions, and keep your next steps in one place.
          </p>
          <div className="row">
            <Link className="button" href="/signup">
              Find your next connection →
            </Link>
            <Link href="/login">Explore your workspace →</Link>
          </div>
          <p className="fine">
            Your goals lead the way. Every introduction stays in your hands.
          </p>
        </div>
        <div
          className="hero-art"
          aria-label="An illustration of goals connected to opportunities"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="center-node">
            n
            <span>
              YOUR NEXT
              <br />
              CONNECTION
            </span>
          </div>
          <span className="floating one">✧ Shared goals</span>
          <span className="floating two">↗ Relevant people</span>
          <span className="floating three">✓ A thoughtful introduction</span>
        </div>
      </main>
      <section className="landing-features">
        <article>
          <span>01 / FOCUS</span>
          <h2>Start with your goals</h2>
          <p>One profile, with room for every direction you want to grow.</p>
        </article>
        <article>
          <span>02 / DISCOVER</span>
          <h2>Understand the fit</h2>
          <p>See the reasons behind each match. Choose what feels relevant.</p>
        </article>
        <article>
          <span>03 / CONNECT</span>
          <h2>Make it personal</h2>
          <p>Prepare your message, review it, and decide when to reach out.</p>
        </article>
      </section>
      <footer className="landing-footer">
        Netcozy Connect · Shared-core development preview. Example matches are
        labelled Demo.
      </footer>
    </>
  );
}
