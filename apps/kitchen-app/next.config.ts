import type { NextConfig } from "next";

const kitchenBasePath = process.env.KITCHEN_BASE_PATH ?? "/kitchen";
const kitchenDistDir = process.env.KITCHEN_DIST_DIR;

const nextConfig: NextConfig = {
  basePath: kitchenBasePath,
  ...(kitchenDistDir ? { distDir: kitchenDistDir } : {}),
};

export default nextConfig;
