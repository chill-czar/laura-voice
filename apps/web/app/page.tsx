import Link from "next/link";
import { CallConsole } from "@/components/CallConsole";

export default function HomePage() {
  return (
    <main className="page">
      <div className="topbar">
        <div className="brand">
          <h1>Laura Voice Intake Demo</h1>
          <span className="tag">voice AI orchestrator</span>
        </div>
        <nav className="nav">
          <Link href="/">Live Call</Link>
          <Link href="/calls">Call History</Link>
        </nav>
      </div>

      <p className="disclaimer">
        Portfolio demo using synthetic data only. This system is an automated intake assistant — it does not provide
        legal advice, does not create an attorney-client relationship, and does not make legal conclusions.
      </p>

      <CallConsole />
    </main>
  );
}
