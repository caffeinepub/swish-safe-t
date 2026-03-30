import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#1a2420] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/assets/image-019d3d8b-584b-714e-ae50-a38cb11210fd-1.png"
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
      </div>
    </div>
  );
}
