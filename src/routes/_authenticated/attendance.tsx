import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { PageBackground } from "@/components/PageBackground";
import { AttendanceModule } from "@/components/AttendanceModule";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Sri Sakthi Vinayaka Tex" },
      {
        name: "description",
        content: "Track worker attendance, hours and auto-calculate payments.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageTransition>
      <PageBackground image="attendance" />
      <AppHeader />
      <AttendanceModule />
    </PageTransition>
  ),
});
