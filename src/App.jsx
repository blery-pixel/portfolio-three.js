import ApartmentSection from './components/apartment/ApartmentSection'

// NOTE: this shell stands in for your existing pages (your repository was empty when this was set up).
// In your real project, only the <ApartmentSection /> line + its import are needed.
export default function App() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">Portfolio</a>
        <nav>
          <a href="#work">Work</a>
          <a href="#apartment">3D Apartment</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Creative developer</p>
          <h1>Worlds, built for the browser.</h1>
          <p>Scroll down to step inside an interactive 3D scene.</p>
        </section>

        <section id="work" className="block"><h2>Selected work</h2><p>Your existing content lives here.</p></section>

        <ApartmentSection />

        <section id="contact" className="block"><h2>Contact</h2><p>hello@example.com</p></section>
      </main>
    </>
  )
}
