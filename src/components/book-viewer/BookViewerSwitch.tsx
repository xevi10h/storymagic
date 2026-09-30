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
      <div className="aspect-square w-full animate-pulse rounded-2xl bg-line" />
    </div>
  );
}

export default function BookViewerSwitch(props: BookViewerProps) {
  return <BookViewer {...props} />;
}
