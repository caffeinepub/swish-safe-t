import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { hashPassword } from "../lib/crypto";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup form
  const [setupName, setSetupName] = useState("");
  const [setupUser, setSetupUser] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [showSetupCard, setShowSetupCard] = useState(false);
  const [showSetupForm, setShowSetupForm] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Login failed");
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupCode !== "SWISH-SETUP-2026") {
      toast.error("Invalid setup code");
      return;
    }
    if (!setupName.trim() || !setupUser.trim() || !setupPass.trim()) {
      toast.error("All fields are required");
      return;
    }
    setSetupLoading(true);
    try {
      const hash = await hashPassword(setupUser.trim(), setupPass);
      const actor = await import("../config").then((m) =>
        m.createActorWithConfig(),
      );
      const appUser = {
        username: setupUser.trim().toLowerCase(),
        passwordHash: hash,
        fullName: setupName.trim(),
        role: { admin: null } as { admin: null },
        originalRole: { admin: null } as { admin: null },
        elevatedUntil: [] as [],
        isEnabled: true,
      };
      const seeded: boolean = await (actor as any).seedAppAdmin(appUser);
      if (seeded) {
        toast.success("Admin account created! You can now log in.");
        setShowSetupCard(false);
        setShowSetupForm(false);
        setUsername(setupUser.trim());
        setPassword(setupPass);
      } else {
        toast.error("An admin already exists. Please sign in directly.");
        setShowSetupCard(false);
        setShowSetupForm(false);
      }
    } catch (err) {
      toast.error("Setup failed. Please try again.");
      console.error(err);
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a2420] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/assets/uploads/image-019d38f8-f918-70cd-9a4b-dbde1288b762-1.png"
              alt="SWiSH SAFE-T"
              className="h-24 w-auto object-contain bg-white rounded-lg px-3 py-2"
            />
          </div>
          <p className="text-gray-400 text-sm">
            Electrical Safety Audit Platform
          </p>
        </div>

        {/* Login card */}
        <Card className="bg-[#243028] border-[#3a4f44] shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-gray-300">
                  Username
                </Label>
                <Input
                  id="username"
                  data-ocid="login.input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  data-ocid="login.textarea"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[#4a7c59] hover:bg-[#3d6849] text-white"
                disabled={loading}
                data-ocid="login.submit_button"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* First-time setup toggle — always accessible */}
        {!showSetupCard ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowSetupCard(true)}
              className="text-xs text-gray-500 hover:text-[#6aab7e] transition-colors underline"
            >
              First time? Set up admin account
            </button>
          </div>
        ) : (
          <Card className="bg-[#243028] border-[#3a4f44]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">
                First-Time Admin Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showSetupForm ? (
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">
                    Set up your organisation&apos;s admin account
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      className="border-[#4a7c59] text-[#6aab7e] hover:bg-[#4a7c59]/20"
                      onClick={() => setShowSetupForm(true)}
                      data-ocid="setup.open_modal_button"
                    >
                      Create Admin Account
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-gray-500 hover:text-gray-300"
                      onClick={() => setShowSetupCard(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSetup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Full Name</Label>
                    <Input
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder="Your full name"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Username</Label>
                    <Input
                      value={setupUser}
                      onChange={(e) => setSetupUser(e.target.value)}
                      placeholder="Choose a username"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.search_input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Password</Label>
                    <Input
                      type="password"
                      value={setupPass}
                      onChange={(e) => setSetupPass(e.target.value)}
                      placeholder="Choose a password"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.textarea"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Setup Code</Label>
                    <Input
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value)}
                      placeholder="SWISH-SETUP-2026"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.secondary_input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-[#3a4f44] text-gray-400"
                      onClick={() => setShowSetupForm(false)}
                      data-ocid="setup.cancel_button"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#4a7c59] hover:bg-[#3d6849] text-white"
                      disabled={setupLoading}
                      data-ocid="setup.submit_button"
                    >
                      {setupLoading ? "Creating..." : "Create Admin"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
