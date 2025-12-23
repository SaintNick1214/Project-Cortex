# Homebrew formula for Cortex Memory CLI
# Auto-updated by CI on each release
#
# Install: brew install saintnick1214/project-cortex/cli
# Or:      brew tap saintnick1214/project-cortex https://github.com/SaintNick1214/Project-Cortex.git
#          brew install cli

class Cli < Formula
  desc "CLI for managing Cortex Memory deployments and performing administrative tasks"
  homepage "https://github.com/SaintNick1214/Project-Cortex"
  url "https://registry.npmjs.org/@cortexmemory/cli/-/cli-0.23.0.tgz"
  sha256 "f6ceb07d239759d14221c92b90e09b7dabc5b4d64c2543a50cea1091505fe176"
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
