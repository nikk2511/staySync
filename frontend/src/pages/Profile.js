import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { 
  UserCircleIcon, 
  Cog6ToothIcon, 
  MoonIcon, 
  SunIcon,
  KeyIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const Profile = () => {
  const { user, updateProfile, changePassword, deleteAccount, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    preferences: {
      theme: user?.preferences?.theme || (isDark ? 'dark' : 'light'),
      notifications: user?.preferences?.notifications ?? true,
      autoJoinRooms: user?.preferences?.autoJoinRooms ?? false
    }
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await updateProfile(profileData);
    if (result.success) {
      // Update theme if changed
      if (profileData.preferences.theme !== (isDark ? 'dark' : 'light')) {
        toggleTheme();
      }
    }
    
    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return;
    }
    
    setLoading(true);
    
    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);
    if (result.success) {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
    
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    
    const result = await deleteAccount();
    if (result.success) {
      // User will be logged out automatically
    }
    
    setLoading(false);
  };

  const tabs = [
    { id: 'profile', name: 'Profile Settings', icon: UserCircleIcon },
    { id: 'preferences', name: 'Preferences', icon: Cog6ToothIcon },
    { id: 'security', name: 'Security', icon: KeyIcon },
    { id: 'danger', name: 'Danger Zone', icon: TrashIcon }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">
              Profile Settings
            </h1>
            <p className="text-gray-600 dark:text-dark-muted mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-card'
                    }`}
                  >
                    <tab.icon className="w-5 h-5 mr-3" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              <div className="card dark:card-dark p-6">
                {/* Profile Settings */}
                {activeTab === 'profile' && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
                    
                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="flex items-center space-x-6">
                        <div className="flex-shrink-0">
                          <img
                            src={user?.avatar}
                            alt={user?.name}
                            className="w-20 h-20 rounded-full"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                            {user?.name}
                          </h3>
                          <p className="text-gray-600 dark:text-dark-muted">
                            {user?.email}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                          Display Name
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={profileData.name}
                          onChange={(e) => setProfileData(prev => ({
                            ...prev,
                            name: e.target.value
                          }))}
                        />
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="btn-primary flex items-center"
                        >
                          {loading ? <LoadingSpinner size="sm" color="white" className="mr-2" /> : null}
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Preferences */}
                {activeTab === 'preferences' && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Preferences</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                            Theme
                          </h3>
                          <p className="text-gray-600 dark:text-dark-muted">
                            Choose your preferred theme
                          </p>
                        </div>
                        <button
                          onClick={toggleTheme}
                          className="flex items-center px-4 py-2 bg-gray-200 dark:bg-dark-card rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          {isDark ? (
                            <>
                              <SunIcon className="w-5 h-5 mr-2" />
                              Light
                            </>
                          ) : (
                            <>
                              <MoonIcon className="w-5 h-5 mr-2" />
                              Dark
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                            Notifications
                          </h3>
                          <p className="text-gray-600 dark:text-dark-muted">
                            Receive notifications for room activities
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.preferences.notifications}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                notifications: e.target.checked
                              }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                            Auto-join Rooms
                          </h3>
                          <p className="text-gray-600 dark:text-dark-muted">
                            Automatically join rooms you were in previously
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileData.preferences.autoJoinRooms}
                            onChange={(e) => setProfileData(prev => ({
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                autoJoinRooms: e.target.checked
                              }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Security */}
                {activeTab === 'security' && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6">Security Settings</h2>
                    
                    {user?.googleId ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-blue-800 dark:text-blue-200">
                          Your account is secured with Google OAuth. Password changes are not available for OAuth accounts.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handlePasswordChange} className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                            Current Password
                          </label>
                          <input
                            type="password"
                            className="input-field"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({
                              ...prev,
                              currentPassword: e.target.value
                            }))}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            className="input-field"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({
                              ...prev,
                              newPassword: e.target.value
                            }))}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            className="input-field"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({
                              ...prev,
                              confirmPassword: e.target.value
                            }))}
                          />
                        </div>

                        <div className="pt-4">
                          <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex items-center"
                          >
                            {loading ? <LoadingSpinner size="sm" color="white" className="mr-2" /> : null}
                            Change Password
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Danger Zone */}
                {activeTab === 'danger' && (
                  <div>
                    <h2 className="text-xl font-semibold mb-6 text-red-600">Danger Zone</h2>
                    
                    <div className="space-y-6">
                      <div className="border border-red-200 dark:border-red-800 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-red-600 mb-2">
                          Delete Account
                        </h3>
                        <p className="text-gray-600 dark:text-dark-muted mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={loading}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {loading ? <LoadingSpinner size="sm" color="white" className="mr-2" /> : null}
                          Delete Account
                        </button>
                      </div>

                      <div className="border border-gray-200 dark:border-dark-border rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-2">
                          Sign Out
                        </h3>
                        <p className="text-gray-600 dark:text-dark-muted mb-4">
                          Sign out of your account on this device.
                        </p>
                        <button
                          onClick={logout}
                          className="btn-outline"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;