"use client";

import dynamic from "next/dynamic";
import type { BookViewerProps } from "./types";

const BookViewer = dynamic(() => import("./MobileBookViewer"), {
  ssr: false,
  loading: () => <BookViewerSkeleton />,
});

function BookViewerSkeleton() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="aspect-square w-full overflow-hidden rounded-2xl shadow-xl border border-border-light bg-white animate-pulse" />
    </div>
  );
}

export default function BookViewerSwitch(props: BookViewerProps) {
  return <BookViewer {...props} />;
}
