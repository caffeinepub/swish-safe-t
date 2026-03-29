import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { hashPassword } from "../lib/crypto";
import { hasAdmin } from "../lib/userStore";
import { addUser } from "../lib/userStore";

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
  const [showSetup, setShowSetup] = useState(false);

  const adminExists = hasAdmin();

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
    const hash = await hashPassword(setupUser.trim(), setupPass);
    addUser({
      username: setupUser.trim(),
      passwordHash: hash,
      fullName: setupName.trim(),
      role: "admin",
      originalRole: "admin",
      elevatedUntil: null,
      isEnabled: true,
    });
    toast.success("Admin account created! You can now log in.");
    setSetupLoading(false);
    setShowSetup(false);
    setUsername(setupUser.trim());
    setPassword(setupPass);
  };

  return (
    <div className="min-h-screen bg-[#1a2420] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/assets/generated/safe_t_logo_transparent.png"
              alt="SWiSH SAFE-T"
              className="h-20 w-auto object-contain"
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
                  data-ocid="login.username.input"
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
                  data-ocid="login.password.input"
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
                data-ocid="login.submit.button"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 p-3 bg-[#1a2420] rounded-md">
              <p className="text-xs text-gray-400 text-center">
                Default admin:{" "}
                <span className="text-[#6aab7e] font-mono">admin</span> /{" "}
                <span className="text-[#6aab7e] font-mono">Admin@1234</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* First-time setup */}
        {!adminExists && (
          <Card className="bg-[#243028] border-[#3a4f44]">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">
                First-Time Admin Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showSetup ? (
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-3">
                    Set up your organisation&apos;s admin account
                  </p>
                  <Button
                    variant="outline"
                    className="border-[#4a7c59] text-[#6aab7e] hover:bg-[#4a7c59]/20"
                    onClick={() => setShowSetup(true)}
                    data-ocid="setup.open.button"
                  >
                    Create Admin Account
                  </Button>
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
                      data-ocid="setup.name.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Username</Label>
                    <Input
                      value={setupUser}
                      onChange={(e) => setSetupUser(e.target.value)}
                      placeholder="Choose a username"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.username.input"
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
                      data-ocid="setup.password.input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Setup Code</Label>
                    <Input
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value)}
                      placeholder="SWISH-SETUP-2026"
                      className="bg-[#1a2420] border-[#3a4f44] text-white placeholder:text-gray-500"
                      data-ocid="setup.code.input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-[#3a4f44] text-gray-400"
                      onClick={() => setShowSetup(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-[#4a7c59] hover:bg-[#3d6849] text-white"
                      disabled={setupLoading}
                      data-ocid="setup.submit.button"
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
