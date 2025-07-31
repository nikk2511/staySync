import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  HomeIcon, 
  ArrowLeftIcon,
  MusicalNoteIcon 
} from '@heroicons/react/24/outline';

const NotFound = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* 404 Animation */}
        <div className="mb-8">
          <div className="relative">
            <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-800">
              404
            </h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <MusicalNoteIcon className="w-16 h-16 text-primary-600 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-4">
            Oops! Page Not Found
          </h2>
          <p className="text-gray-600 dark:text-dark-muted mb-6">
            The page you're looking for doesn't exist. It might have been moved, deleted, 
            or you entered the wrong URL.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.history.back()}
              className="btn-outline flex items-center justify-center"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Go Back
            </button>
            
            <Link
              to={isAuthenticated ? "/dashboard" : "/"}
              className="btn-primary flex items-center justify-center"
            >
              <HomeIcon className="w-5 h-5 mr-2" />
              {isAuthenticated ? 'Dashboard' : 'Home'}
            </Link>
          </div>

          {!isAuthenticated && (
            <div className="pt-4 border-t border-gray-200 dark:border-dark-border">
              <p className="text-sm text-gray-600 dark:text-dark-muted mb-4">
                New to MusicApp?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  to="/signup"
                  className="btn-primary text-sm px-4 py-2"
                >
                  Sign Up
                </Link>
                <Link
                  to="/login"
                  className="btn-ghost text-sm px-4 py-2"
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Fun element */}
        <div className="mt-12 text-gray-400 dark:text-gray-600">
          <div className="flex justify-center space-x-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-current rounded-full animate-pulse"
                style={{
                  height: Math.random() * 20 + 10 + 'px',
                  animationDelay: i * 0.1 + 's'
                }}
              />
            ))}
          </div>
          <p className="text-xs">
            Even our 404 page has rhythm! 🎵
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;