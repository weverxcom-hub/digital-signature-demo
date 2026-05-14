/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // We use `unoptimized` on <Image> components that load user-supplied
    // logo URLs, so allow any remote host as a defence-in-depth.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
