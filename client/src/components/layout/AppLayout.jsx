import Header from './Header';
import BottomNav from './BottomNav';

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark">
      <Header />
      <main className="max-w-lg mx-auto px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
