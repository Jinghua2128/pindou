import Link from "next/link";
import { Header } from "@/components/ui/Header";
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="empty-page">
        <h1>This little path leads nowhere.</h1>
        <p>Let’s get you back to your craft table.</p>
        <Link className="primary" href="/">
          Back to the studio
        </Link>
      </main>
    </>
  );
}
