import React from "react";

interface MarqueeProps {
  children: React.ReactNode;
  direction?: "left" | "right";
  speed?: number;
  pauseOnHover?: boolean;
  className?: string;
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  direction = "left",
  speed = 32,
  pauseOnHover = true,
  className = "",
}) => {
  return (
    <div
      className={`marquee-container ${pauseOnHover ? "pause-on-hover" : ""} ${className}`}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className={`marquee-track ${direction === "right" ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`marquee-track ${direction === "right" ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </div>
    </div>
  );
};

export default Marquee;

