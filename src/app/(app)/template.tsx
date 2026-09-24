import { FadeIn } from "@/components/motion";

/** Re-mounts on every navigation inside the app shell → gentle page-enter transition. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <FadeIn y={6}>{children}</FadeIn>;
}
