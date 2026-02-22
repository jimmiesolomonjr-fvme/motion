import { useRef, useEffect } from 'react';

export default function AuthLayout({ children }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen bg-dark flex items-center justify-center px-6">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        src="/bg-video.mp4"
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
