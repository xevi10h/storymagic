interface BrandIconProps {
  className?: string;
}

/**
 * The Meapica open-book "M" mark as a standalone icon.
 * Uses CSS mask so it inherits currentColor from the parent.
 * Scale with height utilities: <BrandIcon className="h-5 text-primary" />
 */
export default function BrandIcon({ className = "" }: BrandIconProps) {
  return (
    <span
      role="img"
      aria-hidden="true"
      className={`inline-block aspect-square ${className}`}
      style={{
        maskImage: "url(/images/m-icon-mask.png)",
        WebkitMaskImage: "url(/images/m-icon-mask.png)",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        backgroundColor: "currentColor",
      }}
    />
  );
}
