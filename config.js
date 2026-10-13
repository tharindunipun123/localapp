/**
 * Local App Sri Lanka — central configuration
 */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  googleMapsApiKey: "AIzaSyCY42svFS6IU77uHuN2dxzHGfvJgE003ng",

  /** Must match deployed Cloud Functions region */
  functionsRegion: "us-central1",

  firebase: {
    apiKey: "AIzaSyBVu16GXaHw5Up-kp6BQZkMi8RvkP7_tFo",
    authDomain: "localapp-4020b.firebaseapp.com",
    projectId: "localapp-4020b",
    storageBucket: "localapp-4020b.firebasestorage.app",
    messagingSenderId: "601639085621",
    appId: "1:601639085621:web:f82d21c62c3d51aced337c",
    measurementId: "G-V4RLVR270E",
  },

  firebaseAdmin: {
    projectId: "localapp-4020b",
    serviceAccountPath: null,
  },

  defaults: {
    nearbyRadiusKm: 10,
    featuredEventLimit: 6,
    eventsPageSize: 12,
    placesPageSize: 12,
    reviewsPageSize: 10,
    chatMessagesPageSize: 50,
  },

  /** Optional: Gemini API key for free-tier KYC AI review (Google AI Studio) */
  geminiApiKey: "",

  /** Notify.lk SMS — also configurable in Admin → Settings (Firestore settings/app) */
  notifyLk: {
    userId: "29316",
    apiKey: "RH9L1weIpJJODyQkFfSe",
    senderId: "NotifyDEMO",
  },
};

export default config;
