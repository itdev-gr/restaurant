/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },
  transpilePackages: ["@app/db", "@app/shared"],
};
export default nextConfig;
