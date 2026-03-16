import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPagesBuild =
  process.env.GITHUB_ACTIONS === "true" && repoName.length > 0;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubPagesBuild ? `/${repoName}` : "",
  assetPrefix: isGitHubPagesBuild ? `/${repoName}/` : "",
};

export default nextConfig;
