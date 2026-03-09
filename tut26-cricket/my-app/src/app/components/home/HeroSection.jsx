"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import LiveNowBanner from "./LiveNowBanner";

export default function HeroSection({ liveMatch = null }) {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.5]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <section ref={heroRef} className="h-screen relative overflow-hidden">
      <motion.div
        style={{ scale: heroScale, opacity: heroOpacity }}
        className="sticky top-0 h-screen flex flex-col items-center justify-center text-center"
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
          >
            <Image
              src="/gvLogo.png"
              alt="GV Cricket logo"
              width={500}
              height={400}
              priority
              className="mb-5 h-auto w-[340px] max-w-[88vw] object-contain drop-shadow-[0_10px_48px_rgba(255,100,120,0.8)] md:w-[520px]"
            />
          </motion.div>
          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            className="
              animate-[animate-gradient_5s_linear_infinite]
              bg-clip-text text-transparent
              text-6xl md:text-8xl font-extrabold tracking-tight
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
