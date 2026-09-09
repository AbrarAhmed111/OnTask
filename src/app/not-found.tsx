import { Metadata } from 'next';
import * as React from 'react';
import { RiAlarmWarningFill } from 'react-icons/ri';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page Not Found | Jazzi Creates',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="text-center">
        <RiAlarmWarningFill
          size={80}
          className="mx-auto animate-pulse text-orange-500 mb-6"
        />
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4 md:text-6xl">
          404 - Page Not Found
        </h1>
        
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Go Home
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-12 text-sm text-gray-500">
          <p>If you believe this is an error, please contact support.</p>
        </div>
      </div>
    </main>
  );
}