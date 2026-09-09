'use client'; 

import * as React from 'react';
import { RiAlarmWarningFill } from 'react-icons/ri';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="text-center">
        <RiAlarmWarningFill 
          size={80} 
          className="mx-auto animate-pulse text-red-500 mb-6" 
        />
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4 md:text-6xl">
          Oops! Something went wrong
        </h1>
        
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          We encountered an unexpected error. Please try again or return to the homepage.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try Again
          </button>
          
          <Link
            href="/"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go Home
          </Link>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-left max-w-2xl mx-auto">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error Details (Development)
            </summary>
            <pre className="mt-2 p-4 bg-gray-800 text-red-400 rounded-lg text-xs overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
