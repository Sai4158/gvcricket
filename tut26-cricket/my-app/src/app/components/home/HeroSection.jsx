"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export default function HeroSection() {
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
        <div className="absolute inset-0 bg-black/70 z-10" />
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          poster="/Thumb1.png"
        >
          <source src="/videos/Cricket1.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="relative z-20 flex flex-col items-center px-4">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          >
            <Image
              src="/gvLogo.png"
              alt="GV Cricket logo"
              width={140}
              height={140}
              priority
              className="h-44 w-44 object-contain drop-shadow-[0_5px_35px_rgba(255,100,120,0.8)] rounded-full mb-6"
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
            The Home of GV Cricket.
          </motion.h1>
        </div>
      </motion.div>
    </section>
  );
}
