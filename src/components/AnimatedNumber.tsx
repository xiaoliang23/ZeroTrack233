import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatter?: (v: number) => string;
  className?: string;
  flashThreshold?: number;
  isUpRed?: boolean;
  isPercent?: boolean;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  formatter = (v: number) => v.toFixed(2),
  className = "",
  flashThreshold = 0.01,
  isUpRed = true,
  isPercent = false
}) => {
  const [isFlashing, setIsFlashing] = useState<"up" | "down" | null>(null);
  const prevValueRef = useRef(value);
  
  // Use a spring to animate the number smoothly
  const springValue = useSpring(value, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  });
  
  // Format the spring value to a string
  const display = useTransform(springValue, (current) => formatter(current));

  useEffect(() => {
    const prev = prevValueRef.current;
    const diff = Math.abs(value - prev);

    if (diff >= flashThreshold && prev !== value) {
      const isUp = value > prev;
      setIsFlashing(isUp ? "up" : "down");
      
      const timer = setTimeout(() => setIsFlashing(null), 800);
      
      springValue.set(value);
      prevValueRef.current = value;
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      // Small changes instantly update
      springValue.set(value);
      prevValueRef.current = value;
    }
  }, [value, flashThreshold, springValue]);

  let flashClass = "";
  if (isFlashing === "up") {
    flashClass = isUpRed ? "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)] scale-105 font-black" : "text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] scale-105 font-black";
  } else if (isFlashing === "down") {
    flashClass = isUpRed ? "text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.9)] scale-105 font-black" : "text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)] scale-105 font-black";
  }

  return (
    <motion.span 
      className={`inline-block font-black font-mono tracking-tight [text-shadow:_0_1px_2px_rgba(0,0,0,0.4)] transition-all duration-300 ${flashClass} ${className}`}
    >
      {/* display is a MotionValue<string>. Framer Motion renders this natively. */}
      {display}
    </motion.span>
  );
};

export default AnimatedNumber;
