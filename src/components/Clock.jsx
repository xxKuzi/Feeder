import React, { useState, useEffect } from "react";

function DateTimeDisplay() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString();
  const formattedTime = currentDateTime.toLocaleTimeString().substring(0, 5);

  return (
    <div>
      <p>{formattedTime}</p>
      <p>{formattedDate}</p>
    </div>
  );
}

export default DateTimeDisplay;
