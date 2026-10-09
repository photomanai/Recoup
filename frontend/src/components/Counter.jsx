import { useEffect, useRef, useState } from 'react';

// Animated number that counts up when scrolled into view.
// `decimals` for money values (e.g. 2 → $1.05). Static when reduced-motion.
export default function Counter({ to, suffix = '', prefix = '', decimals = 0 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min((t - t0) / 1200, 1);
          const eased = to * (1 - Math.pow(1 - p, 3));
          setVal(decimals ? +eased.toFixed(decimals) : Math.round(eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, decimals]);
  return (
    <span ref={ref} className="mono">
      {prefix}
      {decimals ? val.toFixed(decimals) : val}
      {suffix}
    </span>
  );
}
