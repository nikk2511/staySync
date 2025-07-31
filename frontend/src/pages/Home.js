import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  MusicalNoteIcon, 
  UserGroupIcon, 
  ChatBubbleLeftRightIcon,
  SparklesIcon 
} from '@heroicons/react/24/outline';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  const features = [
    {
      icon: MusicalNoteIcon,
      title: 'Synchronized Music',
      description: 'Listen to music together in perfect sync with friends around the world'
    },
    {
      icon: UserGroupIcon,
      title: 'Private Rooms',
      description: 'Create private or public rooms with customizable settings and permissions'
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Real-time Chat',
      description: 'Chat with room members while enjoying music together'
    },
    {
      icon: SparklesIcon,
      title: 'AI Suggestions',
      description: 'Get smart chat suggestions and music recommendations powered by AI'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-dark-bg dark:via-dark-bg dark:to-dark-card">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MusicalNoteIcon className="w-8 h-8 text-primary-600" />
            <span className="text-2xl font-bold text-gradient">MusicApp</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="btn-primary"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="btn-ghost"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="btn-primary"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-dark-text mb-6">
            Listen to Music
            <span className="text-gradient block mt-2">Together</span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-dark-muted mb-4 max-w-2xl mx-auto">
            Create synchronized music rooms, chat in real-time, and discover new music with friends. 
            Experience the future of social music listening.
          </p>
          
          <div className="mb-8 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              🎵 <strong>Try Guest Mode:</strong> Search and discover millions of songs from Audius & YouTube - no signup required!
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthenticated && (
              <>
                <Link
                  to="/signup"
                  className="btn-primary px-8 py-3 text-lg"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/dashboard"
                  className="btn-outline px-8 py-3 text-lg"
                >
                  🎵 Try Guest Mode
                </Link>
                <Link
                  to="/login"
                  className="btn-ghost px-8 py-3 text-lg"
                >
                  Login
                </Link>
              </>
            )}
            
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className="btn-primary px-8 py-3 text-lg"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-dark-text mb-4">
            Why Choose MusicApp?
          </h2>
          <p className="text-lg text-gray-600 dark:text-dark-muted max-w-2xl mx-auto">
            Powerful features designed to enhance your social music experience
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card dark:card-dark p-6 text-center hover:shadow-lg transition-shadow"
            >
              <feature.icon className="w-12 h-12 text-primary-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-dark-text mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-dark-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 dark:bg-primary-800 py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Listening Together?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of music lovers who are already sharing their favorite songs
          </p>
          
          {!isAuthenticated && (
            <Link
              to="/signup"
              className="inline-block bg-white text-primary-600 hover:bg-gray-100 px-8 py-3 rounded-lg font-semibold text-lg transition-colors"
            >
              Start Your Musical Journey
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-dark-bg text-white py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <MusicalNoteIcon className="w-6 h-6" />
            <span className="text-xl font-bold">MusicApp</span>
          </div>
          <p className="text-gray-400">
            © 2024 MusicApp. Made with ❤️ for music lovers everywhere.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;