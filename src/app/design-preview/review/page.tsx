import { notFound } from "next/navigation";
import { RunReviewQueue } from "@/components/modules/RunReviewQueue";

// Development-only route: renders the run review screen outside the staff portals.
export default function ReviewPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <RunReviewQueue />
    </main>
  );
}
