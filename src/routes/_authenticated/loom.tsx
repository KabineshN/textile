import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { PageBackground } from "@/components/PageBackground";
import { LoomDetailsForm } from "@/components/LoomDetailsForm";

export const Route = createFileRoute("/_authenticated/loom")({
  head: () => ({
    meta: [
      { title: "Loom Details — Sri Sakthi Vinayaka Tex" },
      { name: "description", content: "Capture loom, warp, weft and yarn incoming details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageTransition>
      <PageBackground image="loom" />
      <AppHeader />
      <LoomDetailsForm />
    </PageTransition>
  ),
});
