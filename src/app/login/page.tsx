import { AuthSplitView } from "@/components/auth/AuthSplitView";

export const metadata = {
  title: "Sign in — RevGen AI",
  description: "Sign in to your RevGen AI portal with your authorized credentials.",
};

export default function LoginPage() {
  return <AuthSplitView initialMode="signin" />;
}
