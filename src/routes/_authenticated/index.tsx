import { createFileRoute } from "@tanstack/react-router";
import { InvoiceForm } from "@/components/InvoiceForm";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { PageBackground } from "@/components/PageBackground";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "New Order — Sri Sakthi Vinayaka Tex" },
      { name: "description", content: "Create a new tax invoice for Sri Sakthi Vinayaka Tex." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PageTransition>
      <PageBackground image="new" />
      <AppHeader />
      <InvoiceForm />
    </PageTransition>
  ),
});
