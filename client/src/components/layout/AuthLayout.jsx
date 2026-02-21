export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-screen bg-dark flex items-center justify-center px-6">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
