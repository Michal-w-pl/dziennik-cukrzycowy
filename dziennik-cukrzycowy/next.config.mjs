import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Wyłącza PWA w trybie dev, żeby nie psuć cache'u podczas kodowania
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Twoje domyślne ustawienia Next.js (zostawiamy puste, jeśli nie miałeś tu nic wcześniej)
};

export default withPWA(nextConfig);