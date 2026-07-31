import "./RetiredPage.css";

export default function App() {
  return (
    <main className="retired-page">
      <section className="retired-content" aria-labelledby="retired-title">
        <h1 id="retired-title">This website is no longer in operation.</h1>
        <p className="retired-message">
          The jersey distribution project has been completed. Thank you for being part of it!
        </p>
        <p className="retired-signature">
          Warm regards,<br />
          Student Committee Cohort 9
        </p>
      </section>
    </main>
  );
}
