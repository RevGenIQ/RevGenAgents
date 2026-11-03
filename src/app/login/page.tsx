import { AuthSplitView } from "@/components/auth/AuthSplitView";

export const metadata = {
  title: "Sign in — RevGen IQ",
  description: "Sign in to your RevGen IQ workspace.",
};

export default function LoginPage() {
  return <AuthSplitView initialMode="signin" />;
}
