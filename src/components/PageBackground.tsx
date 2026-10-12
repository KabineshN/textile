export const pageBackgrounds = {
  new: "/backgrounds/bg-loom-white.jpg",
  orders: "/backgrounds/bg-loom-pink.jpg",
  delivered: "/backgrounds/bg-fabric-stack.jpg",
  loom: "/backgrounds/bg-loom-green.jpg",
  attendance: "/backgrounds/bg-machine-blue.jpg",
} as const;

export type PageBackgroundKey = keyof typeof pageBackgrounds;

/**
 * Fixed factory photo behind the page content.
 * Visible enough to read the imagery while keeping text and fields clear.
 */
export function PageBackground({ image }: { image: PageBackgroundKey }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed opacity-[0.68] dark:opacity-[0.48]"
        style={{ backgroundImage: `url(${pageBackgrounds[image]})` }}
      />
      <div className="absolute inset-0 bg-background/45 dark:bg-background/58" />
    </div>
  );
}
