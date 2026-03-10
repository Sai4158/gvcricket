"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import LiveNowBanner from "./LiveNowBanner";

export default function HeroSection({ liveMatch = null }) {
  return (
    <section className="relative h-screen overflow-hidden">
      <motion.div
        initial={{ opacity: 0.9, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="sticky top-0 flex h-screen flex-col items-center justify-center text-center"
      >
        <LiveNowBanner liveMatch={liveMatch} />
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/Thumb1.png')" }}
        />
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster="/Thumb1.png"
        >
          <source src="/videos/Cricket1.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0.56)_48%,rgba(0,0,0,0.72)_100%)]" />
        <div className="relative z-20 flex flex-col items-center px-4 pt-28 md:pt-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            className="relative"
          >
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 scale-[1.08] rounded-full bg-[radial-gradient(circle,rgba(255,78,106,0.26)_0%,rgba(255,78,106,0.14)_28%,rgba(251,191,36,0.1)_48%,transparent_72%)] blur-2xl"
              animate={{
                opacity: [0.5, 0.82, 0.58],
                scale: [1, 1.05, 1.01],
              }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              animate={{
                scale: [1, 1.035, 1],
                y: [0, -3, 0],
                filter: [
                  "drop-shadow(0 10px 46px rgba(255,100,120,0.72))",
                  "drop-shadow(0 12px 56px rgba(255,110,130,0.92))",
                  "drop-shadow(0 10px 46px rgba(255,100,120,0.78))",
                ],
              }}
              transition={{
                duration: 6.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              <Image
                src="/gvLogo.png"
                alt="GV Cricket logo"
                width={500}
                height={400}
                priority
                className="mb-5 h-auto w-[340px] max-w-[88vw] object-contain md:w-[520px]"
              />
            </motion.div>
          </motion.div>
          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            className="
              animate-[animate-gradient_5s_linear_infinite]
              bg-clip-text text-transparent
              text-5xl md:text-7xl font-semibold tracking-tight
              drop-shadow-[0_0_1rem_rgba(249,115,22,0.4)]
            "
            style={{
              backgroundSize: "200% auto",
              backgroundImage:
                "linear-gradient(to right, #fde047, #fbcfe8, #fb923c, #fbcfe8, #fde047)",
            }}
          >
            End-to-end cricket scoring, made simple.
          </motion.h1>
        </div>
      </motion.div>
    </section>
  );
}
