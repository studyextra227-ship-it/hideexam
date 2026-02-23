import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HiddenTriggerProps {
  onActivate: () => void;
}

const HiddenTrigger = ({ onActivate }: HiddenTriggerProps) => {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        onActivate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onActivate]);

  return (
    <motion.button
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center cursor-default focus:outline-none touch-target"
      style={{ zIndex: 50 }}
      animate={{ opacity: hovered ? 0.6 : 0.08 }}
      transition={{ duration: 0.8 }}
      aria-label="Open vault (Ctrl+Shift+D)"
    >
      {/* Jellyfish sigil SVG */}
      <svg
        viewBox="0 0 64 64"
        className="w-10 h-10 sm:w-12 sm:h-12"
        fill="none"
        stroke={hovered ? "#00ffcc" : "#00ffcc"}
        strokeWidth="1.5"
        style={{
          filter: hovered ? "drop-shadow(0 0 8px rgba(0,255,204,0.6))" : "none",
          transition: "filter 0.8s ease",
        }}
      >
        {/* Bell/dome */}
        <path d="M16 32 C16 14 48 14 48 32" strokeLinecap="round" />
        <ellipse cx="32" cy="32" rx="16" ry="4" />
        {/* Tentacles */}
        <path d="M20 36 Q18 44 22 50" strokeLinecap="round" />
        <path d="M26 36 Q24 46 26 54" strokeLinecap="round" />
        <path d="M32 36 Q32 48 32 56" strokeLinecap="round" />
        <path d="M38 36 Q40 46 38 54" strokeLinecap="round" />
        <path d="M44 36 Q46 44 42 50" strokeLinecap="round" />
        {/* Inner glow dot */}
        <circle cx="32" cy="26" r="2" fill="#00ffcc" opacity={hovered ? 0.8 : 0.2} />
      </svg>
    </motion.button>
  );
};

export default HiddenTrigger;
