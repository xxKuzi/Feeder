import { useState, useEffect, forwardRef, useImperativeHandle } from "react";

const Countdown = forwardRef(({ onCountdownEnd }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(null);

  // Expose the function to the parent component
  useImperativeHandle(ref, () => ({
    startCountdown: (seconds) => {
      if (seconds <= 0) return;
      setIsOpen(true);
      setCount(seconds);
    },
  }));

  useEffect(() => {
    if (count === null || count === 0) return;

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (count === 0) {
      setIsOpen(false);
      setCount(-1);
      if (onCountdownEnd) onCountdownEnd(); // Notify parent when countdown ends
    }
  }, [count, onCountdownEnd]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <p className="text-white text-9xl font-bold animate-bounce">
            {count}
          </p>
        </div>
      )}
    </>
  );
});

export default Countdown;
