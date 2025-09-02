import { useAuthentication } from "@/stores/AuthContext";
import { TwitchLinkingComponent } from "@/components/TwitchLinkingComponent";
import { LucideUser, LucideMail, LucideCalendar, LucideShield } from "lucide-react";

export const ProfileView = () => {
  const { session } = useAuthentication();

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-800 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Profile</h1>
          <p className="text-neutral-400">Manage your account settings and integrations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <div className="bg-neutral-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                <LucideUser size={20} />
                <span>Profile Information</span>
              </h2>

              <div className="flex items-center space-x-4 mb-6">
                <img
                  src={session.avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h3 className="text-lg font-medium text-white">{session.username}</h3>
                  <p className="text-neutral-400">User ID: {session.id}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <LucideMail className="text-neutral-400" size={16} />
                  <div>
                    <div className="text-sm text-neutral-400">Email</div>
                    <div className="text-white">{session.email}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <LucideCalendar className="text-neutral-400" size={16} />
                  <div>
                    <div className="text-sm text-neutral-400">Member since</div>
                    <div className="text-white">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <LucideShield className="text-neutral-400" size={16} />
                  <div>
                    <div className="text-sm text-neutral-400">Role</div>
                    <div className="text-white capitalize">{session.role}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrations Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Account Integrations</h2>
              
              {/* Discord Integration Status */}
              <div className="bg-neutral-800 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">D</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Discord Integration</h3>
                </div>

                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 font-medium">Connected</span>
                </div>

                {session.discordId && (
                  <div className="text-sm text-neutral-400">
                    Discord ID: {session.discordId}
                  </div>
                )}
              </div>

              {/* Twitch Integration */}
              <TwitchLinkingComponent />

              {/* Patreon Integration Status (if available) */}
              {session.patreonId && (
                <div className="bg-neutral-800 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">Patreon Integration</h3>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-green-400 font-medium">Connected</span>
                  </div>

                  <div className="text-sm text-neutral-400">
                    Patreon ID: {session.patreonId}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-neutral-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-neutral-400">Publisher Status</div>
                  <div className="text-white">
                    {session.publisherMemberships && session.publisherMemberships.length > 0
                      ? `Publisher (${session.publisherMemberships.length} publisher${session.publisherMemberships.length > 1 ? 's' : ''})`
                      : 'Regular User'
                    }
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-400">Account Type</div>
                  <div className="text-white">
                    {session.isAdmin?.() ? 'Administrator' : 'Standard User'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Need Help?</h3>
              <p className="text-neutral-300 text-sm mb-4">
                Having trouble with your integrations or account settings?
              </p>
              <button className="text-blue-400 hover:text-blue-300 text-sm">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};