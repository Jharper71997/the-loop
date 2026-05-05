/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow /widget/* to be iframed from anywhere — that's the whole point of
  // the widget. Other routes inherit the default deny-by-omission posture.
  async headers() {
    return [
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ]
  },
};

export default nextConfig;
