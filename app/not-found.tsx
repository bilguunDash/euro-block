import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Хуудас олдсонгүй</h2>
        <p className="text-gray-500 mb-8">Таны хайсан хуудас олдсонгүй (404).</p>
        <Link href="/" className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold">
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
