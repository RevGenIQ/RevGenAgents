import { AuthSplitView } from "@/components/auth/AuthSplitView";

export const metadata = {
  title: "Request Client Access — RevGen AI",
  description: "Request client workspace access to RevGen AI.",
};

export default function SignupPage() {
  return <AuthSplitView initialMode="signup" />;
}
