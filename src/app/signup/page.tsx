import { AuthSplitView } from "@/components/auth/AuthSplitView";

export const metadata = {
  title: "Create your workspace — RevGen IQ",
  description: "Create a RevGen IQ workspace and claim 5 free sample accounts researched for your ICP.",
};

export default function SignupPage() {
  return <AuthSplitView initialMode="signup" />;
}
