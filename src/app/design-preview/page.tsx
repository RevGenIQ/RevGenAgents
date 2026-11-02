import { notFound } from "next/navigation";
import { LandingPreview } from "./LandingPreview";

// Development-only route: shows the public landing page even while signed in.
export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <LandingPreview />;
}
