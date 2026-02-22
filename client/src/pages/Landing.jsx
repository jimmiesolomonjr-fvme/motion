import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Sparkles, Flame, Mic, Heart } from 'lucide-react';

export default function Landing() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-dark">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        {/* Background video */}
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-dark" />

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 tracking-tight">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #B8960F 0%, #D4AF37 50%, #8B7209 100%)' }}
            >Motion</span>
          </h1>
          <p className="text-xl text-gray-300 mb-2 font-medium">Move Different.</p>
          <p className="text-gray-500 mb-10 max-w-sm mx-auto leading-relaxed">
            The dating platform for young Black excellence. Choose your role. Make your move. No games.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-gold flex items-center justify-center gap-2">
              Get Started <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-outline">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20 px-6">
        <div className="max-w-lg mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Choose How You Move</h2>

          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-gold/20 bg-gold/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center">
                  <Crown className="text-dark" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gold">Stepper</h3>
                  <p className="text-sm text-gray-400">The Provider</p>
                </div>
              </div>
              <p className="text-gray-400">
                You move with intention and success. Plan dates, set the tone, and show up with purpose. Your confidence speaks for itself.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-purple-accent/20 bg-purple-accent/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center">
                  <Sparkles className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-purple-glow">Baddie</h3>
                  <p className="text-sm text-gray-400">Confident & Chosen</p>
                </div>
              </div>
              <p className="text-gray-400">
                You know your worth. Attract intention, choose wisely, and let the right one earn your time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-dark-100">
        <div className="max-w-lg mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Motion?</h2>

          <div className="space-y-8">
            {[
              { icon: Flame, title: 'The Move', desc: 'Steppers post real date proposals. No more endless texting — make a move.', color: 'text-gold' },
              { icon: Mic, title: 'Voice Notes', desc: 'Hear their vibe before you meet. Voice messages build real connection.', color: 'text-purple-glow' },
              { icon: Heart, title: 'Vibe Check', desc: 'Answer questions, get matched by compatibility — not just looks.', color: 'text-pink-400' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-dark-50 flex items-center justify-center">
                  <Icon className={color} size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Move?</h2>
        <p className="text-gray-400 mb-8">Join the movement. Your next chapter starts here.</p>
        <Link to="/register" className="btn-gold inline-flex items-center gap-2">
          Create Your Profile <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-50 py-8 px-6 text-center">
        <p className="text-gradient-gold font-bold text-lg mb-2">Motion</p>
        <p className="text-gray-600 text-sm">Move Different. &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
