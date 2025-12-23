# Homebrew formula for Cortex Memory CLI
# Auto-updated by CI on each release
#
# Install: brew install saintnick1214/project-cortex/cli
# Or:      brew tap saintnick1214/project-cortex https://github.com/SaintNick1214/Project-Cortex.git
#          brew install cli

class Cli < Formula
  desc "CLI for managing Cortex Memory deployments and performing administrative tasks"
  homepage "https://github.com/SaintNick1214/Project-Cortex"
  url "https://registry.npmjs.org/@cortexmemory/cli/-/cli-0.24.0.tgz"
  sha256 "c8d8179e9c30d4f6b95f60f8306fc0e1639e780ddbd852f9d7eb60309653370a"
  license "Apache-2.0"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/cortex --version")
  end
end
