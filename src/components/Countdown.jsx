import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";

const Countdown = forwardRef(({ onCountdownEnd, onStop, onTick, lowSpec }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(null);

  const onTickRef = useRef(onTick);
  const onCountdownEndRef = useRef(onCountdownEnd);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    onCountdownEndRef.current = onCountdownEnd;
  }, [onCountdownEnd]);

  // Expose the function to the parent component
  useImperativeHandle(ref, () => ({
    startCountdown: (seconds) => {
      if (seconds <= 0) return;
      setIsOpen(true);
      setCount(seconds);
    },
    stopCountdown: () => {
      setIsOpen(false);
      setCount(null);
    },
  }));

  useEffect(() => {
    if (count === null || count <= 0) return;

    const timer = setTimeout(() => {
      const nextCount = count - 1;
      setCount(nextCount);
      if (onTickRef.current) onTickRef.current(nextCount);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (count === 0) {
      setIsOpen(false);
      setCount(-1);
      if (onCountdownEndRef.current) onCountdownEndRef.current(); // Notify parent when countdown ends
    }
  }, [count]);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <p className={`text-white text-9xl font-bold ${lowSpec ? "" : "animate-bounce"}`}>
            {count}
          </p>
          {onStop && (
            <button
              onClick={onStop}
              className="absolute bottom-16 px-10 py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-2xl rounded-full shadow-lg shadow-red-900/40 hover:shadow-red-800/60 transition-all duration-200 border border-red-500/50 flex items-center gap-3 tracking-wide"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 fill-current"
                viewBox="0 0 24 24"
              >
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
              Stop
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default Countdown;
