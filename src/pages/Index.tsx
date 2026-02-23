import { useState } from "react";
import { motion } from "framer-motion";
import { Waves, Thermometer, Gauge, Radio, Radar, Activity } from "lucide-react";
import ParticleField from "@/components/ParticleField";
import HiddenTrigger from "@/components/HiddenTrigger";
import VaultModal from "@/components/VaultModal";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } },
};

const stats = [
  { label: "Depth", value: "10,994m", icon: Waves, sub: "Challenger Deep" },
  { label: "Pressure", value: "1,086 bar", icon: Gauge, sub: "Crushing force" },
  { label: "Temperature", value: "1–4°C", icon: Thermometer, sub: "Near freezing" },
  { label: "Signal", value: "Active", icon: Radio, sub: "Monitoring" },
];

const Index = () => {
  const [vaultOpen, setVaultOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "#010a0f" }}>
      <ParticleField />

      {/* Content layer */}
      <div className="relative" style={{ zIndex: 2 }}>
        {/* Hero section */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 text-center"
        >
          {/* Sonar ping */}
          <motion.div variants={fadeUp} className="relative mb-6 sm:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-primary/20 flex items-center justify-center relative">
              <Radar className="text-primary" size={24} />
              <div className="absolute inset-0 rounded-full border border-primary/10 animate-sonar-ping" />
            </div>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-3 sm:mb-4 text-foreground glow-teal-text leading-tight"
          >
            The Abyss Archive
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="font-body text-muted-foreground text-sm sm:text-base md:text-lg lg:text-xl max-w-xl mb-8 sm:mb-12 px-2"
          >
            Deep sea research station · Hadal zone monitoring · 
            <span className="text-primary"> Signal active</span>
          </motion.p>

          {/* Depth gauge line */}
          <motion.div
            variants={fadeUp}
            className="w-px h-16 sm:h-24 bg-gradient-to-b from-primary/50 to-transparent mb-8 sm:mb-12"
          />

          {/* Stats grid */}
          <motion.div
            variants={stagger}
            className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 max-w-3xl w-full px-2"
          >
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                className="porthole-heavy rounded-xl sm:rounded-2xl p-3 sm:p-5 text-center group hover:glow-teal transition-all duration-500"
              >
                <stat.icon className="mx-auto mb-2 sm:mb-3 text-primary/70 group-hover:text-primary transition-colors" size={18} />
                <p className="font-display text-lg sm:text-xl md:text-2xl text-foreground mb-1">
                  {stat.value}
                </p>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-widest">
                  {stat.label}
                </p>
                <p className="font-body text-xs text-muted-foreground/50 mt-1 hidden sm:block">
                  {stat.sub}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* Research station section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="py-16 sm:py-24 px-4 sm:px-6"
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="porthole-heavy rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Activity className="text-primary" size={18} />
                <h2 className="font-display text-xl sm:text-2xl md:text-3xl text-foreground">
                  Station Log
                </h2>
              </div>

              <div className="space-y-4 sm:space-y-6 font-body text-muted-foreground leading-relaxed text-sm sm:text-base">
                <p>
                  <span className="text-primary/70 text-xs font-mono mr-2">2026.02.23</span>
                  Bathypelagic sensors recalibrated. Bioluminescence index at 0.47 — unusual concentration of
                  <span className="text-primary"> cnidarian specimens</span> near Vent Cluster Δ-7.
                </p>
                <p>
                  <span className="text-primary/70 text-xs font-mono mr-2">2026.02.19</span>
                  Submersible <span className="text-accent">NEREUS-IV</span> completed 6-hour descent to
                  hadal zone floor. Core samples extracted from sediment layer bearing unknown
                  chemosynthetic organisms.
                </p>
                <p>
                  <span className="text-primary/70 text-xs font-mono mr-2">2026.02.14</span>
                  Sonar array detected anomalous acoustic signature at bearing 247°. Analysis ongoing.
                  Pressure hull integrity confirmed at 100%.
                </p>
              </div>

              {/* Status bar */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-border flex flex-wrap gap-3 sm:gap-6 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
                  Systems nominal
                </span>
                <span>Hull: 100%</span>
                <span>O₂: 98.2%</span>
                <span className="hidden sm:inline">Comms: Encrypted</span>
              </div>
            </motion.div>
          </div>
        </motion.section>
      </div>

      {/* Hidden trigger */}
      <HiddenTrigger onActivate={() => setVaultOpen(true)} />

      {/* Vault modal */}
      <VaultModal isOpen={vaultOpen} onClose={() => setVaultOpen(false)} />
    </div>
  );
};

export default Index;
