import { HeartHandshake } from "lucide-react";
import "./RetiredPage.css";

export default function App() {
  return (
    <main className="retired-page">
      <section className="retired-card" aria-labelledby="retired-title">
        <div className="retired-icon">
          <HeartHandshake size={34} aria-hidden="true" />
        </div>
        <p className="retired-kicker">Jersey Dashboard</p>
        <h1 id="retired-title">This website is no longer in operation.</h1>
        <p className="retired-message">
          The jersey distribution project has been completed. Thank you for being part of it, and thank you for making this jersey journey meaningful.
        </p>
        <p className="retired-signature">
          Warm regards,<br />
          Student Committee Cohort 9
        </p>
      </section>
    </main>
  );
}
