export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 py-12">
      <h1 className="text-5xl font-bold text-gold-400 mb-4">404</h1>
      <p className="text-neutral-400 mb-6 text-lg">
        The page you're looking for doesn't exist.
      </p>

      <a
        href="/"
        className="px-6 py-3 rounded-full bg-gold-400 text-black hover:bg-gold-300 transition shadow-lg"
      >
        Return Home
      </a>
    </div>
  );
}
